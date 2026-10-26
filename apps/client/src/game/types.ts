import type { Rng } from './rng';

export type GameMode = 'match' | 'practice' | 'online' | 'tutorial';

/** 一帧指令：摇杆 + 蓄力；use 释放当前道具，swap 对调两个道具槽 */
export interface InputCmd {
  x: number;
  y: number;
  charge: boolean;
  use?: boolean;
  swap?: boolean;
}

/** 开箱可获得的道具（场上只掉神秘箱） */
export type ItemKind =
  | 'rocket' | 'shield' | 'pad' | 'grow' | 'magnet'
  | 'banana' | 'mine' | 'snow' | 'star' | 'glove' | 'cake';
export type HazardKind = 'pad' | 'banana' | 'mine';
export type MapId = 'candy' | 'volcano';
export type EventKind = 'rotate' | 'collapse' | 'ice' | 'gravity';

/** 换装外观（与 cosmetics 一致；放这里方便 sim/协议引用） */
export interface JellyLook {
  eye: string;
  mouth: string;
  gear: string;
}

export interface Jelly {
  id: number;
  name: string;
  skinId: string;
  /** 眼睛 / 嘴巴 / 头饰 */
  look: JellyLook;
  isPlayer: boolean;
  human: boolean;
  x: number; y: number;
  prevX: number; prevY: number;
  vx: number; vy: number;
  facing: number;
  level: number;
  radius: number; mass: number; speed: number; impact: number; resist: number;
  charge: number;
  charging: boolean;
  cool: number;
  dashT: number;
  hurtCd: number;
  dizzy: number;
  alive: boolean;
  /** 已掉落并回到台上的幽灵，不再重复坠落 */
  ghosting: boolean;
  elimTime: number;
  fallY: number;
  fallVy: number;
  lastHitBy: number;
  lastHitTime: number;
  kos: number;
  eaten: number;
  hits: number;
  selfOut: number;
  puddings: number;
  /** 当前选中、释放时消耗的道具 */
  item: ItemKind | null;
  /** 备用槽，和 item 对调后才能释放 */
  itemB: ItemKind | null;
  shield: number;
  magnet: number;
  /** 冲刺火箭剩余时间 */
  rocket: number;
  /** 能量星剩余时间 */
  star: number;
  /** 冰冻无法移动 */
  freezeT: number;
  /** 跳板弹起：短暂离地、不撞人 */
  airT: number;
  ghostCd: number;
  /** 拳套击退倍率；>1 表示拳套或雪球已释放、等下一次冲刺 */
  gloveMul: number;
  /** 手持道具累计时间，只给电脑自动释放用，不进快照 */
  itemHold: number;
  aiT: number;
  aiChargeT: number;
  wish: InputCmd;
}

export interface Blob {
  id: number;
  x: number; y: number;
  alive: boolean;
  color: number;
}

/** 场上神秘道具箱 */
export interface Candy {
  id: number;
  x: number; y: number;
  /** 0→1 落地进度 */
  t: number;
  alive: boolean;
}

/** 跳板 / 香蕉皮 / 地雷 */
export interface Hazard {
  kind: HazardKind;
  x: number; y: number;
  life: number;
  radius: number;
  ownerId: number;
  /** 放置后短暂延迟再触发，避免自己踩到 */
  arm: number;
}

export interface Pudding {
  id: number;
  x: number; y: number;
  prevX: number; prevY: number;
  vx: number; vy: number;
  life: number;
  alive: boolean;
}

export interface Hole {
  angle: number;
  half: number;
}

export interface ScheduledEvent {
  kind: EventKind;
  start: number;
  announced: boolean;
  /** 塌方 */
  angle?: number;
  half?: number;
  opened?: boolean;
  /** 重力波脉冲 */
  pulses?: { at: number; dir: number; fired: boolean; warned: boolean }[];
}

export type FxEvent =
  | { type: 'hit'; x: number; y: number; heavy: boolean }
  | { type: 'eat'; x: number; y: number; id: number }
  | { type: 'fall'; id: number }
  | { type: 'shrink' }
  | { type: 'dash'; id: number }
  | { type: 'banner'; text: string }
  /** 拾取或释放道具：彩色粒子 + 地面扩散圈 */
  | { type: 'item'; x: number; y: number; color: number };

export interface ShrinkWarn {
  timeLeft: number;
  targetRadius: number;
}

export interface SeriesState {
  /** 本场额定局数（不含加赛） */
  totalRounds: number;
  /** 已结算局数 */
  played: number;
  /** 每位果冻累计分，下标 = jelly.id */
  scores: number[];
  overtime: boolean;
  /** next=还有下一局；final=整场结束；none=局内 */
  board: 'none' | 'next' | 'final';
}

export interface RoundRank {
  id: number;
  name: string;
  skinId: string;
  isPlayer: boolean;
  rank: number;
  gain: number;
  bonus: number;
  total: number;
  kos: number;
  eaten: number;
}

export type MatchPhase = 'countdown' | 'play' | 'round_end' | 'series_end';

export interface MatchState {
  mode: GameMode;
  phase: MatchPhase;
  countdown: number;
  time: number;
  platformRadius: number;
  jellies: Jelly[];
  blobs: Blob[];
  blobT: number;
  hitStop: number;
  shake: number;
  warn: ShrinkWarn | null;
  fx: FxEvent[];
  rng: Rng;
  seed: number;
  series: SeriesState;
  /** 局间记分板剩余时间 */
  roundEndT: number;
  roundRanks: RoundRank[];
  titles: string[];
  events: ScheduledEvent[];
  holes: Hole[];
  warnHole: Hole | null;
  spin: number;
  frictionScale: number;
  banner: string | null;
  bannerT: number;
  alert: string | null;
  candies: Candy[];
  puddings: Pudding[];
  hazards: Hazard[];
  itemAcc: number;
  candySeq: number;
  puddingSeq: number;
  /** 决斗场外观；只影响渲染 */
  mapId: MapId;
}

export interface RankEntry {
  id: number;
  name: string;
  skinId: string;
  isPlayer: boolean;
  rank: number;
  kos: number;
  eaten: number;
  score: number;
  level: number;
  survived: number;
}

/** 整场（系列赛）结果；结算页与奖励只读这个 */
export interface MatchResult {
  mode: GameMode;
  ranking: RankEntry[];
  playerRank: number;
  duration: number;
  seed: number;
  /** 打了几小局（含加赛） */
  roundsPlayed: number;
  titles: string[];
  rewards: { xp: number; coins: number; gems: number };
}

export interface Progress {
  level: number;
  /** 当前等级内已有经验 */
  xp: number;
  gems: number;
  coins: number;
  /** 上次领取每日奖励的本地日期 YYYY-MM-DD */
  lastDaily: string;
}
