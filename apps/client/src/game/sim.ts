/** 对局主逻辑：创建对局、固定步长推进、计算排名。纯数据，不依赖 Three.js。 */
import { BOT_SKINS } from '../data/skins';
import { thinkAi } from './ai';
import { GAME, platformTarget, shrinkTimes } from './config';
import { applyLevel, collideAll, eatBlobs, eliminate, fallDown, integrate, steer } from './physics';
import { makeRng } from './rng';
import type { GameMode, InputCmd, Jelly, MatchResult, MatchState, RankEntry } from './types';

const BOT_NAMES = ['蓝蓝', '柠柠', '青青', '葡葡', '莓莓', '星星'];
export const PLAYER_NAME = '果冻小王子';
const SHRINKS = shrinkTimes();

function makeJelly(id: number, name: string, skinId: string, isPlayer: boolean, angle: number, human = isPlayer): Jelly {
  const r = GAME.match.spawnRadius;
  const j: Jelly = {
    id, name, skinId, isPlayer, human,
    x: Math.cos(angle) * r, y: Math.sin(angle) * r, prevX: 0, prevY: 0,
    vx: 0, vy: 0, facing: angle + Math.PI, level: 1,
    radius: 0, mass: 0, speed: 0, impact: 0, resist: 0,
    charge: 0, charging: false, cool: 0, dashT: 0, hurtCd: 0, dizzy: 0,
    alive: true, elimTime: 0, fallY: 0, fallVy: 0,
    lastHitBy: -1, lastHitTime: -99, kos: 0, eaten: 0,
    aiT: 0, aiChargeT: 0, wish: { x: 0, y: 0, charge: false },
  };
  j.prevX = j.x;
  j.prevY = j.y;
  applyLevel(j);
  return j;
}

export function createMatch(mode: GameMode, playerSkin: string, seed: number): MatchState {
  const rng = makeRng(seed);
  const bots = mode === 'practice' ? GAME.match.practiceBots : GAME.match.bots;
  const total = bots + 1;
  // 玩家固定在靠近镜头的一侧（下方），其余均匀分布
  const base = Math.PI / 2;
  const jellies: Jelly[] = [makeJelly(0, PLAYER_NAME, playerSkin, true, base)];
  const botSkins = BOT_SKINS.filter((id) => id !== playerSkin);
  for (let i = 1; i < total; i += 1) {
    const angle = base + (i / total) * Math.PI * 2;
    jellies.push(makeJelly(i, BOT_NAMES[i - 1], botSkins[(i - 1) % botSkins.length], false, angle));
  }
  return baseState(mode, jellies, rng, seed);
}

/** 联机名单里的一个座位（服务器和客户端用同一份名单建出一样的对局） */
export interface RosterSeat {
  name: string;
  skinId: string;
  human: boolean;
}

/** 联机对局：按名单顺序摆位；空位已经由服务器补成电脑。localId 是本机玩家（服务器传 -1）。 */
export function createNetMatch(roster: RosterSeat[], seed: number, localId: number): MatchState {
  const rng = makeRng(seed);
  const total = roster.length;
  const jellies = roster.map((p, i) =>
    makeJelly(i, p.name, p.skinId, i === localId, Math.PI / 2 + (i / total) * Math.PI * 2, p.human));
  return baseState('online', jellies, rng, seed);
}

/** 电脑补位用的名字和皮肤 */
export function botSeat(index: number, usedSkins: string[]): RosterSeat {
  const free = BOT_SKINS.filter((id) => !usedSkins.includes(id));
  return { name: `${BOT_NAMES[index % BOT_NAMES.length]}（电脑）`, skinId: free[index % free.length] ?? BOT_SKINS[0], human: false };
}

function baseState(mode: GameMode, jellies: Jelly[], rng: MatchState['rng'], seed: number): MatchState {
  const s: MatchState = {
    mode, phase: 'countdown', countdown: GAME.countdown, time: 0,
    platformRadius: GAME.platform.maxRadius, jellies,
    blobs: Array.from({ length: GAME.blobs.max }, (_, id) => ({ id, x: 0, y: 0, alive: false, color: 0 })),
    blobT: GAME.blobs.interval, hitStop: 0, shake: 0, warn: null, fx: [], rng, seed,
  };
  for (let i = 0; i < GAME.blobs.initial; i += 1) spawnBlob(s);
  return s;
}

function spawnBlob(s: MatchState): void {
  const blob = s.blobs.find((b) => !b.alive);
  if (!blob) return;
  const ang = s.rng.next() * Math.PI * 2;
  const dist = Math.sqrt(s.rng.next()) * s.platformRadius * 0.7;
  blob.x = Math.cos(ang) * dist;
  blob.y = Math.sin(ang) * dist;
  blob.color = s.rng.int(6);
  blob.alive = true;
}

const IDLE: InputCmd = { x: 0, y: 0, charge: false };

/** 推进一个固定步长。inputs：真人果冻 id → 这一步的指令。 */
export function stepMatch(s: MatchState, inputs: Record<number, InputCmd>, dt: number): void {
  for (const j of s.jellies) {
    j.prevX = j.x;
    j.prevY = j.y;
  }
  s.shake = Math.max(0, s.shake - dt * 2.5);
  if (s.phase === 'countdown') {
    s.countdown -= dt;
    if (s.countdown <= 0) s.phase = 'play';
    return;
  }
  for (const j of s.jellies) if (!j.alive && j.fallY > -60) fallDown(j, dt);
  if (s.phase === 'over') return;
  // 重击顿帧：短暂停住画面
  if (s.hitStop > 0) {
    s.hitStop -= dt;
    return;
  }
  s.time += dt;
  const before = s.platformRadius;
  const target = platformTarget(s.time);
  s.platformRadius += (target - s.platformRadius) * Math.min(1, dt / GAME.platform.shrinkDuration);
  if (before === GAME.platform.maxRadius && s.platformRadius < before) s.fx.push({ type: 'shrink' });
  s.warn = currentWarn(s.time);

  s.blobT -= dt;
  if (s.blobT <= 0) {
    s.blobT = GAME.blobs.interval;
    spawnBlob(s);
  }
  thinkAi(s, dt);
  for (const j of s.jellies) {
    if (!j.alive) continue;
    steer(j, j.human ? (inputs[j.id] ?? IDLE) : j.wish, dt);
    integrate(j, dt);
  }
  collideAll(s);
  eatBlobs(s);
  eliminate(s);
  checkEnd(s);
}

/** 缩圈前 warnLead 秒给出警告。 */
function currentWarn(time: number): MatchState['warn'] {
  for (const t of SHRINKS) {
    const left = t - time;
    if (left > 0 && left <= GAME.platform.warnLead) return { timeLeft: left, targetRadius: platformTarget(t) };
  }
  return null;
}

function checkEnd(s: MatchState): void {
  const alive = s.jellies.filter((j) => j.alive).length;
  if (s.time >= GAME.platform.roundTime || alive <= 1) {
    s.phase = 'over';
    s.warn = null;
  }
}

/** 名次：存活者按体型高、离中心近排序；淘汰者活得越久越靠前。 */
export function matchResult(s: MatchState): MatchResult {
  const alive = s.jellies.filter((j) => j.alive)
    .sort((a, b) => b.level - a.level || Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  const out = s.jellies.filter((j) => !j.alive).sort((a, b) => b.elimTime - a.elimTime);
  const ranking: RankEntry[] = [...alive, ...out].map((j, i) => ({
    id: j.id, name: j.name, skinId: j.skinId, isPlayer: j.isPlayer,
    rank: i + 1, kos: j.kos, eaten: j.eaten, level: j.level,
    score: (GAME.score.places[i] ?? 0) + j.kos * GAME.score.lastHit,
    survived: j.alive ? s.time : j.elimTime,
  }));
  const player = ranking.find((r) => r.isPlayer);
  return { mode: s.mode, ranking, playerRank: player?.rank ?? ranking.length, duration: s.time, seed: s.seed };
}
