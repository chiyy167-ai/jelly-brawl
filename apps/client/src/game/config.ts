/**
 * 所有可调数值集中在这里。
 * 数值来自旧版 src/config.js（像素单位），按 1 世界单位 = 25 像素换算。
 */
export const GAME = {
  fixedDt: 1 / 60,
  countdown: 3,
  // 三个体型等级：半径、质量、移速、撞击系数、抗击飞
  levels: [
    { radius: 1.04, mass: 1, speed: 10.4, impact: 1, resist: 0.75 },
    { radius: 1.44, mass: 1.7, speed: 8.4, impact: 1.45, resist: 1.15 },
    { radius: 1.92, mass: 2.8, speed: 6.6, impact: 2.1, resist: 1.7 },
  ],
  physics: { friction: 3.4, restitution: 0.42, maxSpeed: 39, fallMargin: 0.64, accel: 3.2 },
  charge: {
    maxTime: 1.2, moveScale: 0.4, cooldown: 0.4, dashTime: 0.22,
    minForce: 12.8, maxForce: 41.6, heavyImpact: 18.4, hitStop: 0.08, shake: 0.45,
  },
  platform: {
    maxRadius: 10, finalRadius: 4.32, shrinkAfter: 15, shrinkEvery: 8,
    finalAt: 40, roundTime: 60, shrinkDuration: 1.15, warnLead: 3,
  },
  blobs: { max: 6, interval: 3, radius: 0.44, initial: 4 },
  // 电脑对手：开局 grace 秒内不冲撞；冲刺终点超出 dashSafe×半径 时放弃冲撞
  ai: { interval: 0.28, chargeChance: 0.14, chargeRange: 5, chargeHold: 0.45, edgeSafe: 0.72, grace: 3, dashSafe: 0.8 },
  score: { places: [4, 2, 1, 0, 0, 0], lastHit: 1, lastHitWindow: 3 },
  match: { bots: 5, practiceBots: 3, spawnRadius: 6 },
  // 联机：每房最多 4 个真人，人数不够时用电脑补到 seats 个；状态快照 20 次/秒，输入 30 次/秒
  online: { maxHumans: 4, seats: 4, snapHz: 20, inputHz: 30, resultDelay: 1.6 },
  fall: { gravity: 30, hideAfter: 2 },
  tile: { radius: 1.05, height: 0.7 },
  // 竖屏时镜头按 portraitFit / 宽高比 拉远，并更俯视一些
  camera: { fov: 40, height: 14.5, back: 17.5, portraitFit: 1.2, portraitTilt: 1.3, follow: 0.35 },
};

/** 按局内时间给出平台目标半径（与旧版规则一致）。 */
export function platformTarget(time: number): number {
  const p = GAME.platform;
  if (time < p.shrinkAfter) return p.maxRadius;
  if (time >= p.finalAt) return p.finalRadius;
  const steps = Math.floor((time - p.shrinkAfter) / p.shrinkEvery) + 1;
  const total = Math.floor((p.finalAt - p.shrinkAfter) / p.shrinkEvery) + 1;
  const span = p.maxRadius - p.finalRadius;
  return p.maxRadius - span * Math.min(1, steps / total);
}

/** 所有缩圈发生的时刻。 */
export function shrinkTimes(): number[] {
  const p = GAME.platform;
  const list: number[] = [];
  for (let t = p.shrinkAfter; t < p.finalAt; t += p.shrinkEvery) list.push(t);
  return list;
}
