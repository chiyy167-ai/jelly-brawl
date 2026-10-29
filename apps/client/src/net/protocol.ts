/** 联机协议：客户端和服务器共用。服务器跑物理，客户端只发输入、收快照。 */
import { cleanLook, type CosmeticLook } from '../data/cosmetics';
import { SKINS } from '../data/skins';
import { hazardKindFromIndex, hazardKindIndex, ITEM_KINDS } from '../game/items';
import { applyLevel } from '../game/physics';
import type { RosterSeat } from '../game/sim';
import type {
  Candy, FxEvent, Hazard, ItemKind, MapId, MatchPhase, MatchResult, MatchState, Pudding, ScheduledEvent,
} from '../game/types';

export const ROOM_NAME = 'jelly';
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export interface Profile {
  name: string;
  skinId: string;
  /** 开局携带；仅系列赛第一局生效 */
  startItem?: ItemKind | null;
  look?: CosmeticLook | null;
}

export interface LobbyInfo {
  code: string;
  hostId: string;
  phase: 'waiting' | 'playing';
  players: { sessionId: string; name: string; skinId: string }[];
}

export interface StartMsg {
  seed: number;
  roster: RosterSeat[];
  you: number;
  mapId: MapId;
}

const EVENT_KINDS = ['rotate', 'collapse', 'ice', 'gravity'] as const;
const PHASES: MatchPhase[] = ['countdown', 'play', 'round_end', 'series_end'];

/** 紧凑快照 */
export interface Snap {
  h: [number, number, number, number, number];
  ser: number[];
  w: [number, number] | null;
  j: number[];
  b: number[];
  c: number[];
  p: number[];
  sm: number[];
  st: number[];
  holes: number[];
  /** 塌方预警扇形；无则 null */
  wh: [number, number] | null;
  ev: number[];
  meta: [number, number, number, number];
  fx: FxEvent[];
  /** 事件横幅原文；旧服务器可能没有 */
  banner?: string | null;
}

export type InputMsg = [number, number, number, number, number];

const JELLY_FIELDS = 25;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function cleanProfile(p: Partial<Profile> | undefined): Profile {
  const name = String(p?.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10) || '果冻玩家';
  const skinId = SKINS.some((s) => s.id === p?.skinId) ? String(p?.skinId) : SKINS[0].id;
  const raw = p?.startItem;
  const startItem = typeof raw === 'string' && ITEM_KINDS.includes(raw as ItemKind)
    ? (raw as ItemKind)
    : null;
  const look = cleanLook(p?.look ?? null);
  return { name, skinId, startItem, look };
}

function packEvents(list: ScheduledEvent[]): number[] {
  const out: number[] = [];
  for (const e of list) {
    out.push(EVENT_KINDS.indexOf(e.kind), r2(e.start), e.announced ? 1 : 0, e.opened ? 1 : 0, r2(e.angle ?? 0), r2(e.half ?? 0));
  }
  return out;
}

function applyEvents(s: MatchState, raw: number[]): void {
  const stride = 6;
  while (s.events.length < Math.floor(raw.length / stride)) {
    s.events.push({ kind: 'rotate', start: 0, announced: false });
  }
  s.events.length = Math.floor(raw.length / stride);
  for (let i = 0; i < s.events.length; i += 1) {
    const o = i * stride;
    const kind = EVENT_KINDS[raw[o]] ?? 'rotate';
    const ev = s.events[i];
    ev.kind = kind;
    ev.start = raw[o + 1];
    ev.announced = raw[o + 2] === 1;
    ev.opened = raw[o + 3] === 1;
    ev.angle = raw[o + 4];
    ev.half = raw[o + 5];
  }
}

export function packSnap(s: MatchState): Snap {
  const j: number[] = [];
  for (const q of s.jellies) {
    j.push(
      r2(q.x), r2(q.y), r2(q.vx), r2(q.vy), r2(q.facing), q.level, q.alive ? 1 : 0, r2(q.fallY),
      r2(q.charge), q.charging ? 1 : 0, r2(q.dizzy), r2(q.dashT), q.kos, q.eaten,
      r2(q.shield), r2(q.magnet), q.item ? ITEM_KINDS.indexOf(q.item) + 1 : 0, r2(q.ghostCd),
      r2(q.gloveMul), q.puddings, r2(q.rocket), r2(q.star), r2(q.freezeT), r2(q.airT),
      q.itemB ? ITEM_KINDS.indexOf(q.itemB) + 1 : 0,
    );
  }
  const b: number[] = [];
  for (const blob of s.blobs) b.push(blob.alive ? 1 : 0, r2(blob.x), r2(blob.y), blob.color);
  const c: number[] = [];
  for (const candy of s.candies) {
    c.push(candy.alive ? 1 : 0, r2(candy.x), r2(candy.y), r2(candy.t));
  }
  const p: number[] = [];
  for (const pud of s.puddings) {
    p.push(pud.alive ? 1 : 0, r2(pud.x), r2(pud.y), r2(pud.vx), r2(pud.vy), r2(pud.life));
  }
  const sm: number[] = [];
  const st: number[] = [];
  for (const h of s.hazards) {
    st.push(hazardKindIndex(h.kind), r2(h.x), r2(h.y), r2(h.life), r2(h.radius), h.ownerId, r2(h.arm));
  }
  const holes: number[] = [];
  for (const h of s.holes) holes.push(r2(h.angle), r2(h.half));
  const board = s.series.board === 'final' ? 2 : s.series.board === 'next' ? 1 : 0;
  return {
    h: [r2(s.time), PHASES.indexOf(s.phase), r2(s.countdown), r2(s.platformRadius), r2(s.shake)],
    ser: [s.series.played, board, s.series.overtime ? 1 : 0, r2(s.roundEndT), ...s.series.scores.map(r2)],
    w: s.warn ? [r2(s.warn.timeLeft), r2(s.warn.targetRadius)] : null,
    j, b, c, p, sm, st, holes,
    wh: s.warnHole ? [r2(s.warnHole.angle), r2(s.warnHole.half)] : null,
    ev: packEvents(s.events),
    meta: [r2(s.spin), r2(s.frictionScale), r2(s.itemAcc), r2(s.bannerT)],
    fx: s.fx.splice(0),
    banner: s.banner,
  };
}

function syncPool<T extends { alive: boolean }>(pool: T[], count: number, make: () => T): void {
  while (pool.length < count) pool.push(make());
}

export function applySnap(s: MatchState, snap: Snap): void {
  const [time, phase, countdown, radius, shake] = snap.h;
  s.time = time;
  s.phase = PHASES[phase] ?? s.phase;
  s.countdown = countdown;
  s.platformRadius = radius;
  s.shake = Math.max(s.shake, shake);
  s.warn = snap.w ? { timeLeft: snap.w[0], targetRadius: snap.w[1] } : null;

  const [played, board, overtime, roundEndT, ...scores] = snap.ser;
  s.series.played = played;
  s.series.board = board === 2 ? 'final' : board === 1 ? 'next' : 'none';
  s.series.overtime = overtime === 1;
  s.roundEndT = roundEndT;
  scores.forEach((v, i) => { s.series.scores[i] = v; });

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
    q.shield = d[14];
    q.magnet = d[15];
    q.item = d[16] > 0 ? ITEM_KINDS[d[16] - 1] : null;
    q.ghostCd = d[17];
    q.gloveMul = d[18] || 1;
    q.puddings = d[19];
    q.rocket = d[20] ?? 0;
    q.star = d[21] ?? 0;
    q.freezeT = d[22] ?? 0;
    q.airT = d[23] ?? 0;
    q.itemB = d[24] > 0 ? ITEM_KINDS[d[24] - 1] : null;
  });

  s.blobs.forEach((blob, i) => {
    blob.alive = snap.b[i * 4] === 1;
    blob.x = snap.b[i * 4 + 1];
    blob.y = snap.b[i * 4 + 2];
    blob.color = snap.b[i * 4 + 3];
  });

  const candyN = Math.floor(snap.c.length / 4);
  syncPool(s.candies, candyN, () => ({ id: s.candySeq++, x: 0, y: 0, t: 0, alive: false }));
  for (let i = 0; i < candyN; i += 1) {
    const o = i * 4;
    const candy = s.candies[i] as Candy;
    candy.alive = snap.c[o] === 1;
    candy.x = snap.c[o + 1];
    candy.y = snap.c[o + 2];
    candy.t = snap.c[o + 3];
  }

  const pudN = Math.floor(snap.p.length / 6);
  syncPool(s.puddings, pudN, () => ({
    id: s.puddingSeq++, x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, life: 0, alive: false,
  }));
  for (let i = 0; i < pudN; i += 1) {
    const o = i * 6;
    const pud = s.puddings[i] as Pudding;
    pud.prevX = pud.x;
    pud.prevY = pud.y;
    pud.alive = snap.p[o] === 1;
    pud.x = snap.p[o + 1];
    pud.y = snap.p[o + 2];
    pud.vx = snap.p[o + 3];
    pud.vy = snap.p[o + 4];
    pud.life = snap.p[o + 5];
  }

  s.hazards = [];
  const stRaw = snap.st ?? [];
  for (let i = 0; i + 6 < stRaw.length; i += 7) {
    const h: Hazard = {
      kind: hazardKindFromIndex(stRaw[i]),
      x: stRaw[i + 1],
      y: stRaw[i + 2],
      life: stRaw[i + 3],
      radius: stRaw[i + 4],
      ownerId: stRaw[i + 5],
      arm: stRaw[i + 6],
    };
    s.hazards.push(h);
  }

  s.holes = [];
  for (let i = 0; i + 1 < snap.holes.length; i += 2) {
    s.holes.push({ angle: snap.holes[i], half: snap.holes[i + 1] });
  }
  s.warnHole = snap.wh ? { angle: snap.wh[0], half: snap.wh[1] } : null;

  applyEvents(s, snap.ev);
  [s.spin, s.frictionScale, s.itemAcc, s.bannerT] = snap.meta;
  s.banner = s.bannerT > 0 ? (snap.banner ?? s.banner) : null;
  s.fx.push(...snap.fx);
}

export function markResult(r: MatchResult, you: number): MatchResult {
  const ranking = r.ranking.map((e) => ({ ...e, isPlayer: e.id === you }));
  return { ...r, ranking, playerRank: ranking.find((e) => e.isPlayer)?.rank ?? ranking.length };
}
