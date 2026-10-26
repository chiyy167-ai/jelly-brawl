/**
 * 所有可调数值集中在这里。
 * 世界单位约等于旧版像素 ÷ 25。
 */
export const GAME = {
  fixedDt: 1 / 60,
  countdown: 3,
  /** 局间记分板停留秒数 */
  roundPause: 3.2,
  levels: [
    { radius: 1.04, mass: 1, speed: 10.4, impact: 1, resist: 0.75 },
    { radius: 1.44, mass: 1.7, speed: 8.4, impact: 1.45, resist: 1.15 },
    { radius: 1.92, mass: 2.8, speed: 6.6, impact: 2.1, resist: 1.7 },
  ],
  physics: {
    friction: 3.2, restitution: 0.58, maxSpeed: 39, fallMargin: 0.64, accel: 3.2,
    // 对撞：拆开“顶牛卡住”——最低弹开速度、侧滑、硬撞阈值、冲刺优势
    minSepSpeed: 6.5, clashSlip: 9, clashSpeed: 14, clashStun: 0.55, dashMassScale: 0.62,
  },
  charge: {
    maxTime: 1.2, moveScale: 0.4, cooldown: 0.4, dashTime: 0.22,
    minForce: 12.8, maxForce: 41.6, heavyImpact: 16.5, hitStop: 0.09, shake: 0.5,
  },
  platform: {
    maxRadius: 10, finalRadius: 4.32, shrinkAfter: 15, shrinkEvery: 8,
    finalAt: 40, roundTime: 60, shrinkDuration: 1.15, warnLead: 3,
  },
  blobs: { max: 6, interval: 3, radius: 0.44, initial: 4 },
  ai: { interval: 0.28, chargeChance: 0.14, chargeRange: 5, chargeHold: 0.45, edgeSafe: 0.72, grace: 3, dashSafe: 0.8 },
  score: { places: [4, 2, 1, 0, 0, 0], lastHit: 1, lastHitWindow: 3 },
  /** 正式对战 / 联机打满局数；练习与新手教程只打 1 局 */
  series: { rounds: 3, practiceRounds: 1 },
  match: { bots: 5, practiceBots: 3, tutorialBots: 1, spawnRadius: 6 },
  /** 首次完成新手教程的额外本机奖励 */
  tutorial: { bonusCoins: 40, bonusXp: 30 },
  online: {
    maxHumans: 4, seats: 4, snapHz: 20, inputHz: 30, resultDelay: 1.6, presenceSec: 8,
    /** 远端角色按这个秒数回放，吸收国内网络抖动 */
    interpDelay: 0.1,
    /** 本地预测和服务器差这么远才硬对齐（普通延迟下的领先量不要拉回去） */
    predictSnap: 12,
    predictBlend: 0.03,
  },
  fall: { gravity: 30, hideAfter: 2 },
  tile: { radius: 1.05, height: 0.7 },
  camera: {
    fov: 40, height: 14.5, back: 17.5, portraitFit: 1.2, portraitTilt: 1.3, follow: 0.35,
    high: { height: 28, back: 7, follow: 0.18 },
  },
  events: {
    minCount: 1, maxCount: 2, windowStart: 15, windowEnd: 45, minGap: 8, banner: 1.8,
    rotate: { omega: 0.55, edgeAccel: 3.6, duration: 12 },
    collapse: { sectorDeg: 52, warn: 2, minDist: 1.5 },
    ice: { frictionScale: 0.2, duration: 10 },
    gravity: { duration: 12, interval: 3, warn: 1, impulse: 10.4 },
  },
  items: {
    /** 开局约 3 秒掉第一箱，之后每 8 秒一箱 */
    every: 8, firstAt: 3, maxOnField: 3, radius: 0.9, fallSeconds: 0.4,
    shield: { duration: 3.2 },
    magnet: { duration: 5, radius: 6.4, pull: 8.8 },
    rocket: { duration: 2.2, speedMul: 1.75, turnScale: 0.35 },
    star: { duration: 4, speedMul: 1.35, impactMul: 1.45 },
    glove: { knockMul: 2.4 },
    snow: { freeze: 2.2 },
    pad: { life: 12, radius: 1.5, impulse: 22, air: 0.85, arm: 0.35 },
    banana: { life: 10, radius: 1.15, slip: 1.4, spin: 18, arm: 0.25 },
    mine: { life: 14, radius: 1.2, blast: 4.4, force: 26, arm: 0.55 },
  },
  ghost: { puddingRadius: 1.44, puddingMass: 0.9, puddingLife: 8, cooldown: 10, alpha: 0.45 },
  /** 整场结算奖励（练习再 × practiceScale） */
  economy: {
    practiceScale: 0.5,
    onlineBonusXp: 10,
    joinXp: 20,
    kosXp: 5,
    kosCoins: 8,
    placeXp: [80, 50, 35, 20, 15, 10],
    placeCoins: [60, 35, 22, 12, 8, 5],
    winGems: 5,
    practiceWinGems: 1,
    dailyCoins: 40,
    dailyGems: 1,
    gemCostCoins: 100,
  },
};

/** 升到 level+1 所需经验（当前等级内进度条分母） */
export function xpToNext(level: number): number {
  return 40 + Math.max(1, level) * 20;
}

export function platformTarget(time: number): number {
  const p = GAME.platform;
  if (time < p.shrinkAfter) return p.maxRadius;
  if (time >= p.finalAt) return p.finalRadius;
  const steps = Math.floor((time - p.shrinkAfter) / p.shrinkEvery) + 1;
  const total = Math.floor((p.finalAt - p.shrinkAfter) / p.shrinkEvery) + 1;
  const span = p.maxRadius - p.finalRadius;
  return p.maxRadius - span * Math.min(1, steps / total);
}

export function shrinkTimes(): number[] {
  const p = GAME.platform;
  const list: number[] = [];
  for (let t = p.shrinkAfter; t < p.finalAt; t += p.shrinkEvery) list.push(t);
  return list;
}
