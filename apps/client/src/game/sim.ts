/** 对局主逻辑：创建、固定步长、三局赛推进。纯数据，不依赖 Three.js。 */
import { BOT_SKINS } from '../data/skins';
import { thinkAi } from './ai';
import { GAME, platformTarget, shrinkTimes } from './config';
import { computeRewards } from './economy';
import { scheduleEvents, tickEvents } from './events';
import { collidePuddings, tickGhost } from './ghost';
import { seedItems, swapHeld, tickItems, useHeldItem } from './items';
import { applyLevel, collideAll, eatBlobs, eliminate, integrate, settleGhost, steer } from './physics';
import { makeRng } from './rng';
import { awardRound, blankSeries } from './series';
import type {
  GameMode, InputCmd, Jelly, MapId, MatchResult, MatchState, RankEntry,
} from './types';

const BOT_NAMES = ['蓝蓝', '柠柠', '青青', '葡葡', '莓莓', '星星'];
export const PLAYER_NAME = '果冻小王子';
const SHRINKS = shrinkTimes();
const IDLE: InputCmd = { x: 0, y: 0, charge: false };

function makeJelly(id: number, name: string, skinId: string, isPlayer: boolean, angle: number, human = isPlayer): Jelly {
  const r = GAME.match.spawnRadius;
  const j: Jelly = {
    id, name, skinId, isPlayer, human,
    x: Math.cos(angle) * r, y: Math.sin(angle) * r, prevX: 0, prevY: 0,
    vx: 0, vy: 0, facing: angle + Math.PI, level: 1,
    radius: 0, mass: 0, speed: 0, impact: 0, resist: 0,
    charge: 0, charging: false, cool: 0, dashT: 0, hurtCd: 0, dizzy: 0,
    alive: true, ghosting: false, elimTime: 0, fallY: 0, fallVy: 0,
    lastHitBy: -1, lastHitTime: -99, kos: 0, eaten: 0,
    hits: 0, selfOut: 0, puddings: 0,
    item: null, itemB: null, shield: 0, magnet: 0, rocket: 0, star: 0, freezeT: 0, airT: 0,
    ghostCd: 0, gloveMul: 1, itemHold: 0,
    aiT: 0, aiChargeT: 0, wish: { x: 0, y: 0, charge: false },
  };
  j.prevX = j.x;
  j.prevY = j.y;
  applyLevel(j);
  return j;
}

export interface RosterSeat {
  name: string;
  skinId: string;
  human: boolean;
}

export function botSeat(index: number, usedSkins: string[]): RosterSeat {
  const free = BOT_SKINS.filter((id) => !usedSkins.includes(id));
  return { name: `${BOT_NAMES[index % BOT_NAMES.length]}（电脑）`, skinId: free[index % free.length] ?? BOT_SKINS[0], human: false };
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

function resetRoundFields(s: MatchState, seed: number): void {
  s.seed = seed;
  s.rng = makeRng(seed);
  s.phase = 'countdown';
  s.countdown = GAME.countdown;
  s.time = 0;
  s.platformRadius = GAME.platform.maxRadius;
  s.blobT = GAME.blobs.interval;
  s.hitStop = 0;
  s.shake = 0;
  s.warn = null;
  s.fx = [];
  s.roundEndT = 0;
  s.roundRanks = [];
  s.titles = [];
  s.events = scheduleEvents(s.rng);
  s.holes = [];
  s.warnHole = null;
  s.spin = 0;
  s.frictionScale = 1;
  s.banner = null;
  s.bannerT = 0;
  s.alert = null;
  s.candies.forEach((c) => { c.alive = false; });
  s.puddings.forEach((p) => { p.alive = false; });
  s.hazards = [];
  // 开局更快见到第一只神秘箱
  s.itemAcc = Math.max(0, GAME.items.every - GAME.items.firstAt);
  s.blobs.forEach((b) => { b.alive = false; });
  const n = s.jellies.length;
  const base = Math.PI / 2;
  for (let i = 0; i < n; i += 1) {
    const j = s.jellies[i];
    const angle = base + (i / n) * Math.PI * 2;
    j.x = Math.cos(angle) * GAME.match.spawnRadius;
    j.y = Math.sin(angle) * GAME.match.spawnRadius;
    j.prevX = j.x;
    j.prevY = j.y;
    j.vx = j.vy = 0;
    j.facing = angle + Math.PI;
    j.level = 1;
    applyLevel(j);
    j.charge = 0;
    j.charging = false;
    j.cool = 0;
    j.dashT = 0;
    j.hurtCd = 0;
    j.dizzy = 0;
    j.alive = true;
    j.ghosting = false;
    j.elimTime = 0;
    j.fallY = 0;
    j.fallVy = 0;
    j.lastHitBy = -1;
    j.lastHitTime = -99;
    // kos / eaten / 称号统计跨局累计，方便系列赛结算
    j.item = null;
    j.itemB = null;
    j.shield = 0;
    j.magnet = 0;
    j.rocket = 0;
    j.star = 0;
    j.freezeT = 0;
    j.airT = 0;
    j.ghostCd = 0;
    j.gloveMul = 1;
    j.itemHold = 0;
    j.aiT = 0;
    j.aiChargeT = 0;
    j.wish = { x: 0, y: 0, charge: false };
  }
  for (let i = 0; i < GAME.blobs.initial; i += 1) spawnBlob(s);
  seedItems(s, 2);
  s.series.board = 'none';
}

function baseState(mode: GameMode, jellies: Jelly[], seed: number, mapId: MapId = 'candy'): MatchState {
  const rng = makeRng(seed);
  const s: MatchState = {
    mode, phase: 'countdown', countdown: GAME.countdown, time: 0,
    platformRadius: GAME.platform.maxRadius, jellies,
    blobs: Array.from({ length: GAME.blobs.max }, (_, id) => ({ id, x: 0, y: 0, alive: false, color: 0 })),
    blobT: GAME.blobs.interval, hitStop: 0, shake: 0, warn: null, fx: [], rng, seed,
    series: blankSeries(mode, jellies.length),
    roundEndT: 0, roundRanks: [], titles: [],
    events: [], holes: [], warnHole: null, spin: 0, frictionScale: 1,
    banner: null, bannerT: 0, alert: null,
    candies: [], puddings: [], hazards: [],
    itemAcc: Math.max(0, GAME.items.every - GAME.items.firstAt),
    candySeq: 0, puddingSeq: 0,
    mapId,
  };
  s.events = scheduleEvents(s.rng);
  for (let i = 0; i < GAME.blobs.initial; i += 1) spawnBlob(s);
  seedItems(s, 2);
  return s;
}

export function createMatch(mode: GameMode, playerSkin: string, seed: number, mapId: MapId = 'candy'): MatchState {
  const bots = mode === 'practice' ? GAME.match.practiceBots : GAME.match.bots;
  const total = bots + 1;
  const base = Math.PI / 2;
  const jellies: Jelly[] = [makeJelly(0, PLAYER_NAME, playerSkin, true, base)];
  const botSkins = BOT_SKINS.filter((id) => id !== playerSkin);
  for (let i = 1; i < total; i += 1) {
    jellies.push(makeJelly(i, BOT_NAMES[i - 1], botSkins[(i - 1) % botSkins.length], false, base + (i / total) * Math.PI * 2));
  }
  return baseState(mode, jellies, seed, mapId);
}

export function createNetMatch(roster: RosterSeat[], seed: number, localId: number, mapId: MapId = 'candy'): MatchState {
  const total = roster.length;
  const jellies = roster.map((p, i) =>
    makeJelly(i, p.name, p.skinId, i === localId, Math.PI / 2 + (i / total) * Math.PI * 2, p.human));
  return baseState('online', jellies, seed, mapId);
}

function currentWarn(time: number): MatchState['warn'] {
  for (const t of SHRINKS) {
    const left = t - time;
    if (left > 0 && left <= GAME.platform.warnLead) return { timeLeft: left, targetRadius: platformTarget(t) };
  }
  return null;
}

function finishRound(s: MatchState): void {
  awardRound(s);
  s.phase = 'round_end';
  s.roundEndT = GAME.roundPause;
  s.warn = null;
  s.banner = null;
}

function beginNextRound(s: MatchState): void {
  const seed = (s.seed + s.series.played * 0x9e3779b9 + 1) >>> 0;
  resetRoundFields(s, seed);
}

/** 推进一个固定步长。 */
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

  if (s.phase === 'round_end') {
    s.roundEndT -= dt;
    if (s.roundEndT > 0) return;
    if (s.series.board === 'final') s.phase = 'series_end';
    else beginNextRound(s);
    return;
  }

  if (s.phase === 'series_end') return;

  for (const j of s.jellies) settleGhost(j, s.platformRadius, dt);

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

  tickEvents(s, dt);

  s.blobT -= dt;
  if (s.blobT <= 0) {
    s.blobT = GAME.blobs.interval;
    spawnBlob(s);
  }
  tickItems(s, dt);
  thinkAi(s, dt);
  for (const j of s.jellies) {
    if (!j.alive) continue;
    const cmd = j.human ? (inputs[j.id] ?? IDLE) : j.wish;
    if (cmd.swap) {
      swapHeld(j);
      if (cmd !== IDLE) cmd.swap = false;
    }
    if (cmd.use) {
      useHeldItem(s, j);
      if (cmd !== IDLE) cmd.use = false;
    }
    steer(j, cmd, dt, s.fx);
    integrate(j, dt, s.frictionScale);
  }
  tickGhost(s, dt, inputs);
  collideAll(s);
  collidePuddings(s);
  eatBlobs(s);
  eliminate(s);

  const alive = s.jellies.filter((j) => j.alive).length;
  if (s.time >= GAME.platform.roundTime || alive <= 1) finishRound(s);
}

/** 系列赛最终排名：按累计分；同分比本局 kos、再比 id。 */
export function matchResult(s: MatchState): MatchResult {
  const ranking: RankEntry[] = [...s.jellies]
    .sort((a, b) => (s.series.scores[b.id] - s.series.scores[a.id]) || b.kos - a.kos || a.id - b.id)
    .map((j, i) => ({
      id: j.id, name: j.name, skinId: j.skinId, isPlayer: j.isPlayer,
      rank: i + 1, kos: j.kos, eaten: j.eaten, level: j.level,
      score: s.series.scores[j.id] ?? 0,
      survived: j.alive ? s.time : j.elimTime,
    }));
  const player = ranking.find((r) => r.isPlayer);
  const playerRank = player?.rank ?? ranking.length;
  const rewards = player ? computeRewards(s.mode, player) : { xp: 0, coins: 0, gems: 0 };
  return {
    mode: s.mode, ranking, playerRank, duration: s.time, seed: s.seed,
    roundsPlayed: s.series.played, titles: s.titles, rewards,
  };
}
