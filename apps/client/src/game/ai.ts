/** 本地电脑对手：找果冻块吃，够大了就去撞人，靠边时往回走。 */
import { GAME } from './config';
import type { Jelly, MatchState } from './types';

export function thinkAi(s: MatchState, dt: number): void {
  const tutorial = s.mode === 'tutorial';
  const passive = s.mode === 'practice' || tutorial;
  for (const j of s.jellies) {
    if (!j.alive || j.human) continue;
    // 新手教程：电脑只慢慢吃果冻，绝不冲人、不用道具
    if (tutorial) {
      j.aiT -= dt;
      if (j.aiT > 0) continue;
      j.aiT = GAME.ai.interval * 1.4;
      decide(s, j, true, true);
      continue;
    }
    // 拿到道具后稍等再放，避免一捡就交掉
    if (!j.item && j.itemB) j.wish.swap = true;
    else if (j.item && j.gloveMul <= 1 && j.itemHold > 0.6 + (j.id % 3) * 0.25) j.wish.use = true;
    // 正在蓄力：计时到了就松手
    if (j.aiChargeT > 0) {
      j.aiChargeT -= dt;
      if (j.aiChargeT <= 0) j.wish = { ...j.wish, charge: false };
      continue;
    }
    j.aiT -= dt;
    if (j.aiT > 0) continue;
    j.aiT = GAME.ai.interval * (0.8 + s.rng.next() * 0.4);
    decide(s, j, passive, false);
  }
}

function decide(s: MatchState, j: Jelly, passive: boolean, tutorial: boolean): void {
  const dist = Math.hypot(j.x, j.y);
  if (dist > s.platformRadius * (tutorial ? 0.55 : GAME.ai.edgeSafe)) {
    j.wish = { x: -j.x / dist, y: -j.y / dist, charge: false };
    return;
  }
  const blob = nearest(s.blobs.filter((b) => b.alive), j);
  const foe = nearest(s.jellies.filter((o) => o.alive && o !== j), j);
  // 教程靶子只追果冻块；练习也优先吃，正式对战够大了才撞人
  const target = tutorial || (blob && (!foe || j.level < 3 || passive)) ? blob : foe;
  if (!target) {
    j.wish = { x: 0, y: 0, charge: false };
    return;
  }
  const dx = target.x - j.x;
  const dy = target.y - j.y;
  const len = Math.hypot(dx, dy) || 1;
  const scale = tutorial ? 0.35 : passive ? 0.55 : 1;
  j.wish = { x: (dx / len) * scale, y: (dy / len) * scale, charge: false };
  if (tutorial || passive || !foe || s.time < GAME.ai.grace) return;
  const foeDist = Math.hypot(foe.x - j.x, foe.y - j.y);
  if (foeDist >= GAME.ai.chargeRange || s.rng.next() >= GAME.ai.chargeChance) return;
  const hold = GAME.ai.chargeHold * (0.6 + s.rng.next() * 0.8);
  const nx = (foe.x - j.x) / foeDist;
  const ny = (foe.y - j.y) / foeDist;
  // 预估冲刺终点，会冲出平台就不冲
  const reach = Math.min(dashDistance(hold), foeDist + 1);
  if (Math.hypot(j.x + nx * reach, j.y + ny * reach) > s.platformRadius * GAME.ai.dashSafe) return;
  j.wish = { x: nx, y: ny, charge: true };
  j.aiChargeT = hold;
}

/** 蓄力 hold 秒后冲刺大约能滑多远（初速度 / 摩擦系数） */
function dashDistance(hold: number): number {
  const c = GAME.charge;
  const v = c.minForce + (c.maxForce - c.minForce) * Math.min(1, hold / c.maxTime);
  return v / GAME.physics.friction;
}

function nearest<T extends { x: number; y: number }>(list: T[], j: Jelly): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const item of list) {
    const d = (item.x - j.x) ** 2 + (item.y - j.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}
