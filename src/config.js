/** 全部可调数值。调试面板只改这里，不改公式。 */
export const config = {
  logicalWidth: 720,
  logicalHeight: 1280,
  fixedHz: 60,
  colors: ['#FF5B8F', '#2EC8FF', '#FFE14A', '#7DFF6B', '#C77DFF', '#FF8C42'],
  skins: ['normal', 'angry', 'happy', 'wink', 'dizzy', 'shy'],
  levels: [
    { radius: 26, mass: 1, speed: 260, impact: 1, resist: 0.75 },
    { radius: 36, mass: 1.7, speed: 210, impact: 1.45, resist: 1.15 },
    { radius: 48, mass: 2.8, speed: 165, impact: 2.1, resist: 1.7 },
  ],
  physics: { friction: 3.4, restitution: 0.42, maxSpeed: 980, fallMargin: 16 },
  charge: {
    maxTime: 1.2, moveScale: 0.4, cooldown: 0.4,
    minForce: 320, maxForce: 1040, hitStop: 0.08, heavyImpact: 460, shake: 12,
  },
  platform: {
    maxRadius: 250, finalRadius: 108, shrinkAfter: 15, shrinkEvery: 8,
    finalAt: 40, roundTime: 60, shrinkDuration: 1.15, rotateSpeed: 0.7,
  },
  blobs: { max: 6, interval: 3, radius: 11 },
  items: { interval: 10, radius: 14 },
  events: { minT: 15, maxT: 45 },
  ice: { frictionScale: 0.2, duration: 10 },
  collapse: { warn: 2, width: 1.15, inner: 0.42 },
  gravity: { interval: 3, warn: 1, force: 420 },
  score: { places: [4, 2, 1, 0, 0, 0], lastHit: 1, lastHitWindow: 3, rounds: 3 },
  ghost: { puddingCd: 10, puddingLife: 8, puddingRadius: 22 },
  smoke: { duration: 4, radius: 96 },
  shield: { duration: 3 },
  magnet: { duration: 5, range: 150, speed: 240 },
  spring: { multiplier: 2 },
  ai: { interval: 0.28, chargeChance: 0.35 },
  juice: { slowMo: 0.15, slowScale: 0.3, zoom: 1.08 },
  net: { snapshotMs: 50, appId: 'jelly-brawl.v1' },
};

/** 按局内时间给出平台目标半径。 */
export function platformTarget(time) {
  const p = config.platform;
  if (time < p.shrinkAfter) return p.maxRadius;
  if (time >= p.finalAt) return p.finalRadius;
  const steps = Math.floor((time - p.shrinkAfter) / p.shrinkEvery) + 1;
  const total = Math.floor((p.finalAt - p.shrinkAfter) / p.shrinkEvery) + 1;
  const span = p.maxRadius - p.finalRadius;
  return p.maxRadius - span * Math.min(1, steps / total);
}
