/** 换装 3D 占位：只贴头饰。眼睛和嘴巴用模型原有的。 */
import * as THREE from 'three';
import type { GearId } from '../data/cosmetics';

function std(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.08, ...extra });
}

function add(
  g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material,
  x: number, y: number, z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

/** 头上 / 额前道具（含旧皮肤配件） */
export function buildGear(type: GearId, h: number, d: number): THREE.Group | null {
  if (type === 'none') return null;
  const g = new THREE.Group();
  const top = h * 0.97;
  const front = d * 0.47;
  const gold = std(0xffc928, { metalness: 0.6, roughness: 0.25 });

  if (type === 'crown') {
    const band = add(g, new THREE.CylinderGeometry(0.17, 0.19, 0.1, 20, 1, true), gold, 0, top, 0);
    (band.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      add(g, new THREE.ConeGeometry(0.045, 0.1, 8), gold, Math.sin(a) * 0.17, top + 0.09, Math.cos(a) * 0.17);
    }
  } else if (type === 'sprout') {
    const green = std(0x4cc94a);
    add(g, new THREE.CylinderGeometry(0.015, 0.02, 0.12, 8), green, 0, top + 0.05, 0);
    const leaf = new THREE.SphereGeometry(0.08, 12, 8);
    add(g, leaf, green, -0.07, top + 0.11, 0).scale.set(1, 0.35, 0.6);
    add(g, leaf.clone(), green, 0.07, top + 0.11, 0).scale.set(1, 0.35, 0.6);
  } else if (type === 'glasses') {
    const black = std(0x15151c, { roughness: 0.15, metalness: 0.4 });
    const lens = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20);
    add(g, lens, black, -0.12, h * 0.55, front).rotation.x = Math.PI / 2;
    add(g, lens.clone(), black, 0.12, h * 0.55, front).rotation.x = Math.PI / 2;
    add(g, new THREE.BoxGeometry(0.1, 0.02, 0.02), black, 0, h * 0.58, front);
  } else if (type === 'wizard') {
    const purple = std(0x6b3fd8);
    add(g, new THREE.CylinderGeometry(0.26, 0.26, 0.025, 24), purple, 0, top, 0);
    add(g, new THREE.ConeGeometry(0.17, 0.36, 20), purple, 0, top + 0.18, 0).rotation.z = 0.15;
  } else if (type === 'star') {
    add(g, starGeo(0.075), std(0xffd84a, { emissive: 0x806000 }), 0.17, h * 0.6, front + 0.02);
  } else if (type === 'tophat') {
    const blue = std(0x2f5fd6);
    add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.025, 24), blue, 0, top, 0);
    add(g, new THREE.CylinderGeometry(0.13, 0.14, 0.2, 24), blue, 0, top + 0.1, 0);
  } else if (type === 'cat') {
    const ear = new THREE.ConeGeometry(0.09, 0.16, 12);
    add(g, ear, std(0xff3d55), -0.2, top - 0.02, 0).rotation.z = 0.45;
    add(g, ear.clone(), std(0xff3d55), 0.2, top - 0.02, 0).rotation.z = -0.45;
  } else if (type === 'horn') {
    add(g, new THREE.ConeGeometry(0.05, 0.24, 16), gold, 0, top + 0.08, 0.1).rotation.x = 0.35;
  } else if (type === 'bow') {
    const pink = std(0xff6aad);
    add(g, new THREE.SphereGeometry(0.07, 12, 8), pink, -0.08, top + 0.02, 0.05).scale.set(1, 0.55, 0.4);
    add(g, new THREE.SphereGeometry(0.07, 12, 8), pink, 0.08, top + 0.02, 0.05).scale.set(1, 0.55, 0.4);
    add(g, new THREE.SphereGeometry(0.035, 10, 8), std(0xffd84a), 0, top + 0.02, 0.08);
  } else if (type === 'antenna') {
    const metal = std(0x9aa4b8, { metalness: 0.7, roughness: 0.25 });
    add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), metal, -0.08, top + 0.1, 0);
    add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), metal, 0.08, top + 0.1, 0);
    add(g, new THREE.SphereGeometry(0.04, 10, 8), std(0xff4a4a, { emissive: 0x801010 }), -0.08, top + 0.22, 0);
    add(g, new THREE.SphereGeometry(0.04, 10, 8), std(0x4ac8ff, { emissive: 0x104880 }), 0.08, top + 0.22, 0);
  } else if (type === 'nightcap') {
    const blue = std(0x5a6fd8);
    add(g, new THREE.ConeGeometry(0.2, 0.32, 16), blue, 0.05, top + 0.12, 0).rotation.z = -0.4;
    add(g, new THREE.SphereGeometry(0.05, 10, 8), std(0xfff0a8), 0.18, top + 0.02, 0.05);
  }
  return g;
}

function starGeo(r: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
}
