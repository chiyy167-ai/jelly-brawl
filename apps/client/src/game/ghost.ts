/** 幽灵放布丁、布丁寿命与简单碰撞。 */
import { GAME } from './config';
import { onStand } from './events';
import type { InputCmd, Jelly, MatchState, Pudding } from './types';

function makePudding(s: MatchState, x: number, y: number): Pudding {
  return {
    id: s.puddingSeq++,
    x, y, prevX: x, prevY: y, vx: 0, vy: 0,
    life: GAME.ghost.puddingLife,
    alive: true,
  };
}

/** 在摇杆方向的平台落点放布丁；成功则进入冷却 */
export function tryPlace(s: MatchState, j: Jelly, cmd: InputCmd): boolean {
  if (j.alive || j.ghostCd > 0) return false;
  const len = Math.hypot(cmd.x, cmd.y);
  const ang = len > 0.08 ? Math.atan2(cmd.y, cmd.x) : j.facing;
  const dist = Math.min(s.platformRadius * 0.55, 3.5);
  const x = Math.cos(ang) * dist;
  const y = Math.sin(ang) * dist;
  if (!onStand(s, x, y)) return false;
  const slot = s.puddings.find((p) => !p.alive);
  if (slot) {
    Object.assign(slot, makePudding(s, x, y), { id: slot.id });
  } else s.puddings.push(makePudding(s, x, y));
  j.ghostCd = GAME.ghost.cooldown;
  j.puddings += 1;
  return true;
}

function aiDrop(s: MatchState, j: Jelly): void {
  if (j.ghostCd > 0) return;
  let enemy: Jelly | null = null;
  let best = 1e9;
  for (const o of s.jellies) {
    if (o === j || !o.alive) continue;
    const d = Math.hypot(o.x - j.x, o.y - j.y);
    if (d < best) {
      best = d;
      enemy = o;
    }
  }
  if (!enemy) return;
  // 朝对手所在方位放布丁（tryPlace 会按摇杆方向选落点）
  const ang = Math.atan2(enemy.y, enemy.x);
  tryPlace(s, j, { x: Math.cos(ang), y: Math.sin(ang), charge: true });
}

/** 幽灵冷却；电脑幽灵自动放布丁；布丁摩擦与出界回收 */
export function tickGhost(s: MatchState, dt: number, inputs: Record<number, InputCmd>): void {
  for (const j of s.jellies) {
    if (j.alive) continue;
    if (j.ghostCd > 0) j.ghostCd = Math.max(0, j.ghostCd - dt);
    if (j.human) {
      const cmd = inputs[j.id];
      // 按住冲 = 放布丁（幽灵不再蓄力）
      if (cmd?.charge) tryPlace(s, j, cmd);
    } else aiDrop(s, j);
  }

  const fr = Math.exp(-GAME.physics.friction * dt);
  const limit = s.platformRadius + GAME.physics.fallMargin;
  for (const p of s.puddings) {
    if (!p.alive) continue;
    p.prevX = p.x;
    p.prevY = p.y;
    p.vx *= fr;
    p.vy *= fr;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0 || Math.hypot(p.x, p.y) > limit) p.alive = false;
  }
}

/** 果冻与布丁弹性碰撞（布丁不造成击飞/降级） */
export function collidePuddings(s: MatchState): void {
  const r = GAME.ghost.puddingRadius;
  const m = GAME.ghost.puddingMass;
  for (const j of s.jellies) {
    if (!j.alive) continue;
    for (const p of s.puddings) {
      if (!p.alive) continue;
      const dx = p.x - j.x;
      const dy = p.y - j.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const min = j.radius + r;
      if (dist > min) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = min - dist;
      const inv = 1 / (j.mass + m);
      j.x -= nx * overlap * m * inv;
      j.y -= ny * overlap * m * inv;
      p.x += nx * overlap * j.mass * inv;
      p.y += ny * overlap * j.mass * inv;
      const rel = (p.vx - j.vx) * nx + (p.vy - j.vy) * ny;
      if (rel > 0) continue;
      const impulse = (-(1 + GAME.physics.restitution) * rel) / (1 / j.mass + 1 / m);
      j.vx -= (impulse * nx) / j.mass;
      j.vy -= (impulse * ny) / j.mass;
      p.vx += (impulse * nx) / m;
      p.vy += (impulse * ny) / m;
    }
  }
}
