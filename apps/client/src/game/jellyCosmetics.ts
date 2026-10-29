/** 换装 3D 占位：眼睛 / 嘴巴 / 头饰。用基础几何体，后续可换成 glb。 */
import * as THREE from 'three';
import type { EyeId, GearId, MouthId } from '../data/cosmetics';

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

/** 眼白 + 瞳孔，盖住原模型贴图五官 */
export function buildEyes(style: EyeId, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const z = d * 0.52;
  const y = h * 0.58;
  const white = std(0xfff8f0);
  const black = std(0x1a1520, { roughness: 0.2 });
  const gap = style === 'big' ? 0.16 : 0.13;
  const r = style === 'big' ? 0.11 : style === 'square' ? 0.09 : 0.085;

  if (style === 'cool') {
    const frame = std(0x15151c, { roughness: 0.15, metalness: 0.45 });
    const lens = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20);
    add(g, lens, frame, -gap, y, z).rotation.x = Math.PI / 2;
    add(g, lens.clone(), frame, gap, y, z).rotation.x = Math.PI / 2;
    add(g, new THREE.BoxGeometry(0.1, 0.02, 0.02), frame, 0, y + 0.02, z);
    return g;
  }

  const makeEye = (sx: number, closed = false) => {
    if (closed) {
      add(g, new THREE.BoxGeometry(0.14, 0.025, 0.02), black, sx, y, z);
      return;
    }
    if (style === 'square') {
      add(g, new THREE.BoxGeometry(r * 2, r * 2, 0.04), std(0x7dffb0, { emissive: 0x1a6040 }), sx, y, z);
      add(g, new THREE.BoxGeometry(r * 0.7, r * 0.7, 0.045), black, sx, y, z + 0.01);
      return;
    }
    if (style === 'sleepy') {
      add(g, new THREE.SphereGeometry(r, 14, 10), white, sx, y, z).scale.set(1, 0.45, 0.7);
      add(g, new THREE.SphereGeometry(r * 0.35, 10, 8), black, sx, y - 0.01, z + 0.03);
      return;
    }
    const sclera = add(g, new THREE.SphereGeometry(r, 14, 10), white, sx, y, z);
    if (style === 'angry') sclera.scale.set(1, 0.75, 0.85);
    const pr = style === 'cat' ? r * 0.28 : r * 0.42;
    const pupil = add(g, new THREE.SphereGeometry(pr, 10, 8), black, sx, y, z + 0.035);
    if (style === 'cat') pupil.scale.set(0.55, 1.35, 1);
    if (style === 'star' || style === 'sparkle') {
      add(g, starGeo(r * 0.45), std(0xffd84a, { emissive: 0x806000 }), sx + 0.02, y + 0.02, z + 0.05);
    }
    if (style === 'sparkle') {
      add(g, new THREE.SphereGeometry(0.015, 6, 6), std(0xffffff), sx - 0.03, y + 0.03, z + 0.05);
    }
  };

  makeEye(-gap, style === 'wink');
  makeEye(gap, false);
  if (style === 'angry') {
    add(g, new THREE.BoxGeometry(0.12, 0.025, 0.02), black, -gap, y + 0.08, z).rotation.z = 0.35;
    add(g, new THREE.BoxGeometry(0.12, 0.025, 0.02), black, gap, y + 0.08, z).rotation.z = -0.35;
  }
  return g;
}

export function buildMouth(style: MouthId, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const z = d * 0.5;
  const y = h * 0.36;
  const lip = std(0x2a1830);
  const pink = std(0xff6b8a);

  if (style === 'flat') {
    add(g, new THREE.BoxGeometry(0.16, 0.025, 0.02), lip, 0, y, z);
  } else if (style === 'ooh') {
    add(g, new THREE.TorusGeometry(0.05, 0.018, 8, 16), lip, 0, y, z);
  } else if (style === 'open' || style === 'grin') {
    const w = style === 'grin' ? 0.18 : 0.14;
    add(g, new THREE.SphereGeometry(0.07, 12, 8), lip, 0, y, z).scale.set(w / 0.07, 0.7, 0.5);
    add(g, new THREE.SphereGeometry(0.045, 10, 6), pink, 0, y - 0.01, z + 0.02).scale.set(1.2, 0.6, 0.5);
  } else if (style === 'frown') {
    add(g, new THREE.TorusGeometry(0.07, 0.016, 8, 12, Math.PI), lip, 0, y + 0.04, z).rotation.z = Math.PI;
  } else if (style === 'cat') {
    add(g, new THREE.SphereGeometry(0.035, 10, 8), lip, 0, y, z).scale.set(1.4, 0.7, 0.6);
    add(g, new THREE.BoxGeometry(0.04, 0.015, 0.015), lip, -0.05, y + 0.02, z).rotation.z = 0.5;
    add(g, new THREE.BoxGeometry(0.04, 0.015, 0.015), lip, 0.05, y + 0.02, z).rotation.z = -0.5;
  } else if (style === 'tongue') {
    add(g, new THREE.SphereGeometry(0.06, 12, 8), lip, 0, y, z).scale.set(1.5, 0.55, 0.5);
    add(g, new THREE.SphereGeometry(0.035, 10, 8), pink, 0, y - 0.04, z + 0.02).scale.set(0.8, 1.2, 0.6);
  } else if (style === 'smirk') {
    add(g, new THREE.TorusGeometry(0.07, 0.015, 8, 12, Math.PI * 0.7), lip, 0.02, y, z).rotation.z = -0.2;
  } else if (style === 'shy') {
    add(g, new THREE.TorusGeometry(0.05, 0.014, 8, 12, Math.PI), lip, 0, y, z);
    add(g, new THREE.SphereGeometry(0.03, 8, 6), std(0xff8aaa), -0.14, y + 0.02, z - 0.02);
    add(g, new THREE.SphereGeometry(0.03, 8, 6), std(0xff8aaa), 0.14, y + 0.02, z - 0.02);
  } else {
    // smile
    add(g, new THREE.TorusGeometry(0.08, 0.016, 8, 14, Math.PI), lip, 0, y, z);
  }
  return g;
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
