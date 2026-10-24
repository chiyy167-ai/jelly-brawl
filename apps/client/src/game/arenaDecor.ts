/** 决斗场周边地标：糖果棒棒糖 / 火山口，只做外观。 */
import * as THREE from 'three';
import type { MapTheme } from './maps';
import { makeRng } from './rng';
import type { MapId } from './types';

export interface DecorBundle {
  group: THREE.Group;
  owned: { dispose(): void }[];
  /** 需要每帧动起来的节点 */
  pulse: { mesh: THREE.Mesh; base: number }[];
}

/** 在擂台外围摆主题地标。 */
export function buildMapDecor(mapId: MapId, seed: number, theme: MapTheme): DecorBundle {
  if (mapId === 'volcano') return buildVolcano(seed);
  return buildCandyLand(seed, theme);
}

function buildCandyLand(seed: number, theme: MapTheme): DecorBundle {
  const group = new THREE.Group();
  const owned: { dispose(): void }[] = [];
  const pulse: DecorBundle['pulse'] = [];
  const rng = makeRng(seed + 42);
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.6 });
  const candyMats = theme.tiles.map((c) => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.25, metalness: 0.05, emissive: c, emissiveIntensity: 0.12,
  }));
  const stickGeo = new THREE.CylinderGeometry(0.12, 0.14, 1, 8);
  const headGeo = new THREE.SphereGeometry(0.55, 14, 12);
  const caneGeo = new THREE.TorusGeometry(0.7, 0.16, 8, 18, Math.PI * 1.2);
  owned.push(stickMat, stickGeo, headGeo, caneGeo, ...candyMats);

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    const d = 12.2 + rng.range(0, 1.8);
    const mat = candyMats[i % candyMats.length];
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.scale.set(1, 3.2 + rng.range(0, 1.5), 1);
    stick.position.set(Math.cos(a) * d, stick.scale.y / 2 - 0.2, Math.sin(a) * d - 2);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(stick.position.x, stick.scale.y + 0.2, stick.position.z);
    head.scale.setScalar(0.9 + rng.range(0, 0.4));
    group.add(stick, head);
    pulse.push({ mesh: head, base: head.position.y });

    const cane = new THREE.Mesh(caneGeo, candyMats[(i + 2) % candyMats.length]);
    const ca = a + 0.35;
    cane.position.set(Math.cos(ca) * (d + 1.2), 1.2, Math.sin(ca) * (d + 1.2) - 2);
    cane.rotation.set(0.2, -ca, Math.PI / 2);
    group.add(cane);
  }

  // 远处棉花糖堆
  const puffMat = new THREE.MeshStandardMaterial({ color: 0xffe8f4, roughness: 0.8 });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  owned.push(puffMat, puffGeo);
  for (let i = 0; i < 4; i += 1) {
    const a = i * 1.7 + 0.5;
    const puff = new THREE.Mesh(puffGeo, puffMat);
    puff.scale.set(1.4 + rng.range(0, 0.8), 1.1, 1.4);
    puff.position.set(Math.cos(a) * 22, 0.4, Math.sin(a) * 22 - 6);
    group.add(puff);
  }
  return { group, owned, pulse };
}

function buildVolcano(seed: number): DecorBundle {
  const group = new THREE.Group();
  const owned: { dispose(): void }[] = [];
  const pulse: DecorBundle['pulse'] = [];
  const rng = makeRng(seed + 99);

  // 偏亮岩色 + 轮廓感，俯视时也能认出锥体
  const rock = new THREE.MeshStandardMaterial({ color: 0xa87868, roughness: 0.85, emissive: 0x3a1810, emissiveIntensity: 0.35 });
  const lava = new THREE.MeshStandardMaterial({
    color: 0xff7a28, emissive: 0xff4500, emissiveIntensity: 1.35, roughness: 0.3,
  });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0x8a7078, transparent: true, opacity: 0.55, roughness: 1, depthWrite: false,
  });
  const coneGeo = new THREE.ConeGeometry(5.2, 8.5, 8);
  const craterGeo = new THREE.CylinderGeometry(1.5, 2, 1.1, 10);
  const glowGeo = new THREE.SphereGeometry(1.9, 12, 10);
  const smokeGeo = new THREE.SphereGeometry(1.15, 8, 6);
  const flowGeo = new THREE.BoxGeometry(1.05, 0.32, 4.8);
  owned.push(rock, lava, smokeMat, coneGeo, craterGeo, glowGeo, smokeGeo, flowGeo);

  /** 在擂台侧后方摆一座可见火山（避开正后方被平台挡住）。 */
  const placeVolcano = (x: number, z: number, scale: number) => {
    const volcano = new THREE.Group();
    volcano.position.set(x, -1.2, z);
    volcano.scale.setScalar(scale);
    const cone = new THREE.Mesh(coneGeo, rock);
    cone.position.y = 4;
    const crater = new THREE.Mesh(craterGeo, lava);
    crater.position.y = 8;
    const glow = new THREE.Mesh(glowGeo, lava);
    glow.position.y = 8.7;
    glow.scale.set(1.1, 0.7, 1.1);
    volcano.add(cone, crater, glow);
    pulse.push({ mesh: glow, base: glow.position.y });
    for (let i = 0; i < 3; i += 1) {
      const flow = new THREE.Mesh(flowGeo, lava);
      const fx = -1.6 + i * 1.6;
      flow.position.set(fx, 3.2 + (i % 2) * 0.9, 2.2);
      flow.rotation.set(0.95, fx * 0.05, 0);
      volcano.add(flow);
      pulse.push({ mesh: flow, base: flow.position.y });
    }
    for (let i = 0; i < 4; i += 1) {
      const puff = new THREE.Mesh(smokeGeo, smokeMat);
      puff.position.set(rng.range(-1, 1), 9.2 + i * 1.15, rng.range(-0.6, 0.6));
      puff.scale.setScalar(0.8 + i * 0.25);
      volcano.add(puff);
      pulse.push({ mesh: puff, base: puff.position.y });
    }
    group.add(volcano);
  };

  // 左右侧明显露出锥体（z 别太负，否则被平台挡住）
  placeVolcano(-14.5, -5.5, 1.25);
  placeVolcano(14.5, -5.5, 1.15);
  // 正后方远景
  placeVolcano(0, -16, 1.4);

  // 擂台外缘熔岩河
  const riverGeo = new THREE.BoxGeometry(1.4, 0.22, 7);
  owned.push(riverGeo);
  for (let i = 0; i < 4; i += 1) {
    const river = new THREE.Mesh(riverGeo, lava);
    const a = -1.25 + i * 0.32;
    river.position.set(Math.cos(a) * 13.5, 0.12, Math.sin(a) * 13.5 - 4);
    river.rotation.y = -a;
    group.add(river);
    pulse.push({ mesh: river, base: river.position.y });
  }
  return { group, owned, pulse };
}

/** 火山光晕与烟雾轻微起伏。 */
export function tickDecor(bundle: DecorBundle, time: number): void {
  for (let i = 0; i < bundle.pulse.length; i += 1) {
    const p = bundle.pulse[i];
    const bob = Math.sin(time * 2.2 + i) * 0.18;
    p.mesh.position.y = p.base + bob;
    const mat = p.mesh.material as THREE.MeshStandardMaterial;
    if (mat.emissiveIntensity != null) {
      mat.emissiveIntensity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(time * 3 + i));
    }
  }
}
