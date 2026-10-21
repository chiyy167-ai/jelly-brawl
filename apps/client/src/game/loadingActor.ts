/** 加载页小剧场里的一只果冻：走路、跳、空翻、被撞变小、落地压扁、头顶表情。 */
import * as THREE from 'three';
import { getSkin } from '../data/skins';
import type { JellyTemplate } from './assets';
import type { Emote, EmoteKit, EmoteKind } from './emotes';
import { makeSkinMaterial } from './jellyModel';

// 单位 = 启动插画上的像素
export const S = 78; // 果冻宽度
export const GROUND = 480; // 脚底所在高度：压在进度条上沿
const GRAVITY = 1500;

export interface Actor {
  root: THREE.Group;
  body: THREE.Group;
  shadow: THREE.Mesh;
  material: THREE.Material;
  x: number;
  y: number;
  vy: number;
  /** 水平移动目标和速度 */
  target: number;
  speed: number;
  face: number;
  size: number;
  sizeGoal: number;
  spin: number;
  spinAngle: number;
  squash: number;
  walkT: number;
  phase: number;
  /** 往右推进度条时身体前倾 */
  pushing: boolean;
  emotes: Emote[];
}

export function makeActor(
  scene: THREE.Scene, tpl: JellyTemplate, outline: THREE.Material, shadow: THREE.Mesh, skinId: string, x: number, phase: number,
): Actor {
  const material = makeSkinMaterial(getSkin(skinId), tpl.material);
  const mesh = new THREE.Mesh(tpl.geometry, material);
  // 网格中心挪到原点，空翻时绕身体中心转
  mesh.position.y = -tpl.height / 2;
  // 白色描边（放大的背面），让小果冻在花哨的插画上也看得清
  const edge = new THREE.Mesh(tpl.geometry, outline);
  edge.scale.setScalar(1.08);
  edge.position.y = (-tpl.height / 2) * 1.08;
  const body = new THREE.Group();
  body.add(edge, mesh);
  const root = new THREE.Group();
  root.add(body);
  scene.add(root, shadow);
  return {
    root, body, shadow, material, x, y: 0, vy: 0, target: x, speed: 160, face: 0.3,
    size: 1, sizeGoal: 1, spin: 0, spinAngle: 0, squash: 0, walkT: 0, phase, pushing: false, emotes: [],
  };
}

export function jump(a: Actor, v: number, flip = false): void {
  if (a.y > 1) return;
  a.vy = v;
  if (flip) a.spin = Math.PI * 2;
}

export function addEmote(kit: EmoteKit, a: Actor, kind: EmoteKind, life: number): void {
  // 同一种表情不叠加
  a.emotes = a.emotes.filter((e) => {
    if (e.kind !== kind) return true;
    a.root.remove(e.group);
    return false;
  });
  const e = kit.make(kind, life);
  a.root.add(e.group);
  a.emotes.push(e);
}

/** 当前头顶高度（相对脚底） */
export function headHeight(a: Actor, tpl: JellyTemplate): number {
  return S * a.size * tpl.height;
}

export function updateActor(a: Actor, kit: EmoteKit, tpl: JellyTemplate, time: number, dt: number): void {
  const dx = a.target - a.x;
  const moving = Math.abs(dx) > 1.5;
  if (moving) {
    a.x += Math.sign(dx) * Math.min(Math.abs(dx), a.speed * dt);
    a.walkT += dt * (8 + a.speed / 40);
  }
  // 走路时侧身朝前进方向，停下来转回来看镜头
  const faceGoal = moving ? Math.sign(dx) * 0.75 : 0.25 * Math.sin(time * 0.7 + a.phase);
  a.face += (faceGoal - a.face) * (1 - Math.exp(-8 * dt));
  if (a.y > 0 || a.vy > 0) {
    a.vy -= GRAVITY * dt;
    a.y += a.vy * dt;
    if (a.y <= 0) {
      a.y = 0;
      a.vy = 0;
      a.squash = 0.35;
    }
  }
  a.squash *= Math.exp(-7 * dt);
  a.size += (a.sizeGoal - a.size) * (1 - Math.exp(-4 * dt));
  if (a.spin > 0) {
    const step = Math.min(a.spin, dt * 13);
    a.spin -= step;
    a.spinAngle -= step * Math.sign(a.face || 1);
  } else {
    a.spinAngle = 0;
  }
  // 呼吸 + 跳起拉长 + 落地压扁
  const breath = Math.sin(time * 3 + a.phase) * 0.04;
  const stretch = a.y > 0 ? THREE.MathUtils.clamp(a.vy / 2500, -0.12, 0.2) : 0;
  const sy = 1 - a.squash * 0.5 + breath + stretch;
  const sxz = 1 + a.squash * 0.35 - breath - stretch * 0.5;
  const k = S * a.size;
  const hop = moving && a.y === 0 ? Math.abs(Math.sin(a.walkT)) * 5 : 0;
  const lean = a.pushing && moving && dx > 0 ? -0.16 : 0;
  a.body.scale.set(k * sxz, k * sy, k * sxz);
  a.body.position.y = (k * sy * tpl.height) / 2;
  a.body.rotation.set(0.22, a.face, (moving ? Math.sin(a.walkT) * 0.12 : 0) + lean + a.spinAngle);
  a.root.position.set(a.x, -GROUND + a.y + hop, 0);
  const shrink = Math.max(0.35, 1 - a.y / 220);
  a.shadow.position.set(a.x, -GROUND - 3, -60);
  a.shadow.scale.set(k * 0.46 * shrink, k * 0.1 * shrink, 1);
  const headY = k * sy * tpl.height;
  a.emotes = a.emotes.filter((e) => {
    const alive = kit.update(e, dt);
    if (!alive) a.root.remove(e.group);
    e.group.position.set(0, headY, 40);
    e.group.scale.setScalar(S);
    return alive;
  });
}
