import type { Rng } from './rng';

export type GameMode = 'match' | 'practice' | 'online';

/** 一帧的操作指令：摇杆方向 + 是否按住冲撞键。 */
export interface InputCmd {
  x: number;
  y: number;
  charge: boolean;
}

/** 果冻角色（纯数据，渲染只读）。坐标 x/y 对应 3D 世界的 x/z。 */
export interface Jelly {
  id: number;
  name: string;
  skinId: string;
  /** 本机玩家（镜头跟随、结算高亮） */
  isPlayer: boolean;
  /** 由真人操作；false 时由 AI 控制（联机掉线后也会变成 AI） */
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
  elimTime: number;
  fallY: number;
  fallVy: number;
  lastHitBy: number;
  lastHitTime: number;
  kos: number;
  eaten: number;
  // AI 用
  aiT: number;
  aiChargeT: number;
  wish: InputCmd;
}

/** 可以吃的果冻块。 */
export interface Blob {
  id: number;
  x: number; y: number;
  alive: boolean;
  color: number;
}

/** 给渲染层的一次性特效事件。 */
export type FxEvent =
  | { type: 'hit'; x: number; y: number; heavy: boolean }
  | { type: 'eat'; x: number; y: number; id: number }
  | { type: 'fall'; id: number }
  | { type: 'shrink' };

export interface ShrinkWarn {
  timeLeft: number;
  targetRadius: number;
}

export interface MatchState {
  mode: GameMode;
  phase: 'countdown' | 'play' | 'over';
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

/** 对局结果，结算页只读这个。 */
export interface MatchResult {
  mode: GameMode;
  ranking: RankEntry[];
  playerRank: number;
  duration: number;
  seed: number;
}
