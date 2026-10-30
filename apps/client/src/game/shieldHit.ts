/** 护盾受击：自己不被撞飞，每次受击掉 1 级血量（体型）。 */
import { GAME } from './config';
import { applyLevel } from './physics';
import type { Jelly, MatchState } from './types';

export function shieldClash(s: MatchState, a: Jelly, b: Jelly): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const min = a.radius + b.radius;
  if (dist >= min) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  if (a.shield > 0 && b.shield > 0) {
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
    if (a.hurtCd > 0 || b.hurtCd > 0) return;
    a.hurtCd = b.hurtCd = 0.35;
    dropLevel(s, a);
    dropLevel(s, b);
    s.fx.push({ type: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, heavy: false });
    return;
  }
  const wall = a.shield > 0 ? a : b;
  const foe = wall === a ? b : a;
  const outX = wall === a ? nx : -nx;
  const outY = wall === a ? ny : -ny;
  // 只把没盾的一方推出去，有盾的速度和位置保持不动
  foe.x += outX * overlap;
  foe.y += outY * overlap;
  const into = foe.vx * outX + foe.vy * outY;
  if (into < 0) {
    foe.vx -= into * outX;
    foe.vy -= into * outY;
  }
  foe.vx += outX * GAME.physics.minSepSpeed;
  foe.vy += outY * GAME.physics.minSepSpeed;
  if (wall.hurtCd > 0) return;
  wall.hurtCd = 0.35;
  foe.hurtCd = Math.max(foe.hurtCd, 0.35);
  wall.lastHitBy = foe.id;
  wall.lastHitTime = s.time;
  wall.hits += 1;
  dropLevel(s, wall);
  s.fx.push({ type: 'hit', x: (wall.x + foe.x) / 2, y: (wall.y + foe.y) / 2, heavy: false });
}

/** 掉 1 级血量，并把掉下来的体型变成一块果冻。1 级不再降。 */
export function dropLevel(s: MatchState, j: Jelly): void {
  if (j.level <= 1) return;
  j.level -= 1;
  applyLevel(j);
  const blob = s.blobs.find((b) => !b.alive);
  if (!blob) return;
  blob.alive = true;
  blob.x = j.x - Math.cos(j.facing) * (j.radius + 0.6);
  blob.y = j.y - Math.sin(j.facing) * (j.radius + 0.6);
}
