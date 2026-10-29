/** 联机平滑：远端按服务器时间插值，本地先按同一套物理走，高延迟时自己的角色也能立刻动。 */
import { GAME } from './config';
import { integrate, steer } from './physics';
import type { InputCmd, Jelly } from './types';

export interface NetPose {
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fallY: number;
}

const EXTRAP = 0.12;

/** 在两份快照之间插值；快照还没到时最多外推一小段，避免一顿一顿地跳 */
export function samplePose(poses: NetPose[], time: number): { x: number; y: number; fallY: number } | null {
  if (!poses.length) return null;
  const first = poses[0];
  if (time <= first.time) return { x: first.x, y: first.y, fallY: first.fallY };
  const last = poses[poses.length - 1];
  if (time >= last.time) {
    const dt = Math.min(EXTRAP, time - last.time);
    return { x: last.x + last.vx * dt, y: last.y + last.vy * dt, fallY: last.fallY };
  }
  let i = 1;
  while (i < poses.length && poses[i].time < time) i += 1;
  const a = poses[i - 1];
  const b = poses[i];
  const span = b.time - a.time || 0.001;
  const t = (time - a.time) / span;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    fallY: a.fallY + (b.fallY - a.fallY) * t,
  };
}

export function pushPose(list: NetPose[], pose: NetPose): void {
  const prev = list[list.length - 1];
  if (prev && pose.time <= prev.time) return;
  list.push(pose);
  if (list.length > 12) list.shift();
}

/** 服务器权威字段覆盖到预测体上，位置和速度留给 reconcile */
export function adoptServer(pred: Jelly, server: Jelly): void {
  pred.alive = server.alive;
  pred.ghosting = server.ghosting;
  pred.freezeT = server.freezeT;
  pred.rocket = server.rocket;
  pred.star = server.star;
  pred.item = server.item;
  pred.itemB = server.itemB;
  pred.gloveMul = server.gloveMul;
  pred.level = server.level;
  pred.radius = server.radius;
  pred.speed = server.speed;
  pred.mass = server.mass;
  pred.impact = server.impact;
  pred.resist = server.resist;
  pred.dizzy = server.dizzy;
  pred.fallY = server.fallY;
  pred.airT = server.airT;
}

/** 偏差很大才瞬间对齐。平时只做一点点修正，避免把玩家拉回延迟中的旧位置。 */
export function reconcile(pred: Jelly, server: Jelly): void {
  const dead = !pred.alive || !server.alive;
  const err = Math.hypot(server.x - pred.x, server.y - pred.y);
  const hard = dead || (pred.dashT <= 0 && err > GAME.online.predictSnap);
  if (hard) {
    pred.x = server.x;
    pred.y = server.y;
    pred.vx = server.vx;
    pred.vy = server.vy;
    pred.facing = server.facing;
    pred.fallY = server.fallY;
    return;
  }
  const k = GAME.online.predictBlend;
  pred.x += (server.x - pred.x) * k;
  pred.y += (server.y - pred.y) * k;
  if (pred.dashT <= 0) {
    pred.vx += (server.vx - pred.vx) * k;
    pred.vy += (server.vy - pred.vy) * k;
  }
}

export function predictStep(pred: Jelly, cmd: InputCmd, dt: number, frictionScale: number): void {
  if (!pred.alive || pred.freezeT > 0) return;
  steer(pred, cmd, dt);
  integrate(pred, dt, frictionScale);
}
