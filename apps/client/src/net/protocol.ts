/** 联机协议：客户端和服务器共用。服务器跑物理，客户端只发输入、收快照。 */
import { SKINS } from '../data/skins';
import { applyLevel } from '../game/physics';
import type { RosterSeat } from '../game/sim';
import type { FxEvent, MatchResult, MatchState } from '../game/types';

export const ROOM_NAME = 'jelly';
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

/** 进房时带上的资料 */
export interface Profile {
  name: string;
  skinId: string;
}

/** 房间等待界面看到的信息 */
export interface LobbyInfo {
  code: string;
  hostId: string;
  phase: 'waiting' | 'playing';
  players: { sessionId: string; name: string; skinId: string }[];
}

/** 开局：名单 + 种子；you 是收到这条消息的玩家在名单里的下标 */
export interface StartMsg {
  seed: number;
  roster: RosterSeat[];
  you: number;
}

/** 状态快照（数组越紧凑越省流量） */
export interface Snap {
  /** 时间、阶段、倒计时、平台半径、震屏 */
  h: [number, number, number, number, number];
  /** 缩圈警告 [剩余秒数, 目标半径] */
  w: [number, number] | null;
  /** 每只果冻 JELLY_FIELDS 个数 */
  j: number[];
  /** 每个果冻块 [是否存在, x, y, 颜色] */
  b: number[];
  fx: FxEvent[];
}

export type InputMsg = [number, number, number];

const PHASES: MatchState['phase'][] = ['countdown', 'play', 'over'];
const JELLY_FIELDS = 14;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function cleanProfile(p: Partial<Profile> | undefined): Profile {
  const name = String(p?.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10) || '果冻玩家';
  const skinId = SKINS.some((s) => s.id === p?.skinId) ? String(p?.skinId) : SKINS[0].id;
  return { name, skinId };
}

export function packSnap(s: MatchState): Snap {
  const j: number[] = [];
  for (const q of s.jellies) {
    j.push(r2(q.x), r2(q.y), r2(q.vx), r2(q.vy), r2(q.facing), q.level, q.alive ? 1 : 0, r2(q.fallY),
      r2(q.charge), q.charging ? 1 : 0, r2(q.dizzy), r2(q.dashT), q.kos, q.eaten);
  }
  const b: number[] = [];
  for (const blob of s.blobs) b.push(blob.alive ? 1 : 0, r2(blob.x), r2(blob.y), blob.color);
  return {
    h: [r2(s.time), PHASES.indexOf(s.phase), r2(s.countdown), r2(s.platformRadius), r2(s.shake)],
    w: s.warn ? [r2(s.warn.timeLeft), r2(s.warn.targetRadius)] : null,
    j, b,
    fx: s.fx.splice(0),
  };
}

/** 把快照写进客户端的镜像状态；上一份位置留在 prevX/prevY 里用于插值 */
export function applySnap(s: MatchState, snap: Snap): void {
  const [time, phase, countdown, radius, shake] = snap.h;
  s.time = time;
  s.phase = PHASES[phase] ?? s.phase;
  s.countdown = countdown;
  s.platformRadius = radius;
  s.shake = Math.max(s.shake, shake);
  s.warn = snap.w ? { timeLeft: snap.w[0], targetRadius: snap.w[1] } : null;
  s.jellies.forEach((q, i) => {
    const d = snap.j.slice(i * JELLY_FIELDS, (i + 1) * JELLY_FIELDS);
    if (d.length < JELLY_FIELDS) return;
    q.prevX = q.x;
    q.prevY = q.y;
    [q.x, q.y, q.vx, q.vy, q.facing] = d;
    if (q.level !== d[5]) {
      q.level = d[5];
      applyLevel(q);
    }
    q.alive = d[6] === 1;
    q.fallY = d[7];
    q.charge = d[8];
    q.charging = d[9] === 1;
    q.dizzy = d[10];
    q.dashT = d[11];
    q.kos = d[12];
    q.eaten = d[13];
  });
  s.blobs.forEach((blob, i) => {
    blob.alive = snap.b[i * 4] === 1;
    blob.x = snap.b[i * 4 + 1];
    blob.y = snap.b[i * 4 + 2];
    blob.color = snap.b[i * 4 + 3];
  });
  s.fx.push(...snap.fx);
}

/** 服务器发来的结果没有“谁是我”，客户端按自己的下标补上 */
export function markResult(r: MatchResult, you: number): MatchResult {
  const ranking = r.ranking.map((e) => ({ ...e, isPlayer: e.id === you }));
  return { ...r, ranking, playerRank: ranking.find((e) => e.isPlayer)?.rank ?? ranking.length };
}
