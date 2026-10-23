/** 圆形刚体物理：移动、蓄力冲刺、碰撞、吃块、出界。只改 state，不碰渲染。 */
import { GAME } from './config';
import type { FxEvent, InputCmd, Jelly, MatchState } from './types';

export function applyLevel(j: Jelly): void {
  const s = GAME.levels[j.level - 1];
  j.radius = s.radius;
  j.mass = s.mass;
  j.speed = s.speed;
  j.impact = s.impact;
  j.resist = s.resist;
}

/** 根据指令转向、加速、蓄力和松手冲刺。fx 可选，用于通知渲染/音效。 */
export function steer(j: Jelly, cmd: InputCmd, dt: number, fx?: FxEvent[]): void {
  const c = GAME.charge;
  if (cmd.x || cmd.y) j.facing = Math.atan2(cmd.y, cmd.x);
  if (cmd.charge && j.cool <= 0 && j.dashT <= 0) {
    j.charging = true;
    j.charge = Math.min(c.maxTime, j.charge + dt);
  } else if (!cmd.charge && j.charging) {
    launch(j, fx);
  }
  j.cool = Math.max(0, j.cool - dt);
  const scale = (j.charging ? c.moveScale : 1) * (j.dizzy > 0 ? 0.45 : 1);
  const a = j.speed * scale * dt * GAME.physics.accel;
  j.vx += cmd.x * a;
  j.vy += cmd.y * a;
}

function launch(j: Jelly, fx?: FxEvent[]): void {
  const c = GAME.charge;
  const amount = j.charge / c.maxTime;
  const force = c.minForce + (c.maxForce - c.minForce) * amount;
  j.vx += Math.cos(j.facing) * force;
  j.vy += Math.sin(j.facing) * force;
  j.charge = 0;
  j.charging = false;
  j.cool = c.cooldown;
  j.dashT = c.dashTime;
  fx?.push({ type: 'dash', id: j.id });
}

/** 摩擦、限速、积分位置、计时器递减。 */
export function integrate(j: Jelly, dt: number): void {
  const friction = Math.exp(-GAME.physics.friction * dt);
  j.vx *= friction;
  j.vy *= friction;
  const speed = Math.hypot(j.vx, j.vy);
  const max = GAME.physics.maxSpeed;
  if (speed > max) {
    j.vx *= max / speed;
    j.vy *= max / speed;
  }
  j.x += j.vx * dt;
  j.y += j.vy * dt;
  j.dashT = Math.max(0, j.dashT - dt);
  j.hurtCd = Math.max(0, j.hurtCd - dt);
  j.dizzy = Math.max(0, j.dizzy - dt);
}

/** 两两检测碰撞并弹开。 */
export function collideAll(s: MatchState): void {
  const live = s.jellies.filter((j) => j.alive);
  for (let i = 0; i < live.length; i += 1) {
    for (let k = i + 1; k < live.length; k += 1) bounce(s, live[i], live[k]);
  }
}

function bounce(s: MatchState, a: Jelly, b: Jelly): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const min = a.radius + b.radius;
  if (dist > min) return;
  const nx = dx / dist;
  const ny = dy / dist;
  // 先按质量比例把重叠推开
  const overlap = min - dist;
  const inv = 1 / (a.mass + b.mass);
  a.x -= nx * overlap * b.mass * inv;
  a.y -= ny * overlap * b.mass * inv;
  b.x += nx * overlap * a.mass * inv;
  b.y += ny * overlap * a.mass * inv;

  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel > 0) return;

  // 冲刺一方更“硬”，对撞时更容易把对方撞开，而不是力量抵消卡住
  let ma = a.mass;
  let mb = b.mass;
  const scale = GAME.physics.dashMassScale;
  if (a.dashT > 0 && b.dashT <= 0) mb *= scale;
  if (b.dashT > 0 && a.dashT <= 0) ma *= scale;

  const approach = -rel;
  const clash = approach >= GAME.physics.clashSpeed;
  const rest = clash ? Math.min(0.85, GAME.physics.restitution + 0.18) : GAME.physics.restitution;
  let impulse = (-(1 + rest) * rel) / (1 / ma + 1 / mb);

  // 硬撞额外弹开，避免“力气一样就顶死”
  if (clash) impulse *= 1.25;

  a.vx -= (impulse * nx) / ma / a.resist;
  a.vy -= (impulse * ny) / ma / a.resist;
  b.vx += (impulse * nx) / mb / b.resist;
  b.vy += (impulse * ny) / mb / b.resist;

  // 侧滑：正面顶牛时沿切线甩开，两只果冻会错身而过
  const tx = -ny;
  const ty = nx;
  const side = ((a.id * 17 + b.id * 31 + Math.floor(s.time * 20)) & 1) === 0 ? 1 : -1;
  const slip = GAME.physics.clashSlip * Math.min(1, approach / (GAME.physics.clashSpeed * 1.4)) * side;
  const wa = mb / (ma + mb);
  const wb = ma / (ma + mb);
  a.vx += tx * slip * wa;
  a.vy += ty * slip * wa;
  b.vx -= tx * slip * wb;
  b.vy -= ty * slip * wb;

  // 保证沿法线至少有最低分离速度，彻底杜绝贴住抖
  const rel2 = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  const need = GAME.physics.minSepSpeed;
  if (rel2 < need) {
    const fix = (need - rel2) / (1 / ma + 1 / mb);
    a.vx -= (fix * nx) / ma;
    a.vy -= (fix * ny) / ma;
    b.vx += (fix * nx) / mb;
    b.vy += (fix * ny) / mb;
  }

  if (a.hurtCd > 0 || b.hurtCd > 0) return;
  a.hurtCd = b.hurtCd = clash ? 0.4 : 0.35;
  const stun = clash ? GAME.physics.clashStun : 0.35;
  a.dizzy = Math.max(a.dizzy, stun);
  b.dizzy = Math.max(b.dizzy, stun);
  a.lastHitBy = b.id;
  b.lastHitBy = a.id;
  a.lastHitTime = b.lastHitTime = s.time;
  const power = Math.abs(impulse) * 0.5 * a.impact * b.impact;
  const heavy = power > GAME.charge.heavyImpact || (clash && (a.dashT > 0 || b.dashT > 0));
  s.fx.push({ type: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, heavy });
  if (!heavy) return;
  s.hitStop = GAME.charge.hitStop;
  s.shake = GAME.charge.shake * (clash ? 1.15 : 1);
  shrinkOnHit(s, a);
  shrinkOnHit(s, b);
}

/** 重击降一级，并在身旁掉出一块果冻。 */
function shrinkOnHit(s: MatchState, j: Jelly): void {
  if (j.level <= 1) return;
  j.level -= 1;
  applyLevel(j);
  const blob = s.blobs.find((b) => !b.alive);
  if (!blob) return;
  blob.alive = true;
  blob.x = j.x - Math.cos(j.facing) * (j.radius + 0.6);
  blob.y = j.y - Math.sin(j.facing) * (j.radius + 0.6);
}

/** 碰到果冻块就吃掉并升级（最高 3 级）。 */
export function eatBlobs(s: MatchState): void {
  const r = GAME.blobs.radius;
  for (const j of s.jellies) {
    if (!j.alive) continue;
    for (const b of s.blobs) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - j.x, b.y - j.y) > j.radius + r) continue;
      b.alive = false;
      j.eaten += 1;
      if (j.level < GAME.levels.length) {
        j.level += 1;
        applyLevel(j);
      }
      s.fx.push({ type: 'eat', x: b.x, y: b.y, id: j.id });
    }
  }
}

/** 离开平台边缘一小段距离后淘汰，并记最后一击。 */
export function eliminate(s: MatchState): void {
  for (const j of s.jellies) {
    if (!j.alive) continue;
    const dist = Math.hypot(j.x, j.y);
    if (dist <= s.platformRadius + j.radius * 0.25 + GAME.physics.fallMargin) continue;
    j.alive = false;
    j.charging = false;
    j.elimTime = s.time;
    s.fx.push({ type: 'fall', id: j.id });
    const killer = s.jellies.find((k) => k.id === j.lastHitBy);
    if (killer && s.time - j.lastHitTime <= GAME.score.lastHitWindow) killer.kos += 1;
  }
}

/** 已淘汰的果冻继续往下掉，只是给渲染看的。 */
export function fallDown(j: Jelly, dt: number): void {
  j.fallVy -= GAME.fall.gravity * dt;
  j.fallY += j.fallVy * dt;
  j.x += j.vx * dt * 0.5;
  j.y += j.vy * dt * 0.5;
}
