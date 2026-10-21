/** 根据皮肤生成一个果冻 3D 对象：共用模型网格，换色 + 小配件。 */
import * as THREE from 'three';
import { getSkin, type Accessory, type Skin } from '../data/skins';
import { getJellyTemplate } from './assets';

/** 模型正面朝向修正（弧度），让果冻默认面向 +Z */
export const MODEL_YAW = 0;

export interface JellyObject {
  root: THREE.Group;
  body: THREE.Group;
  material: THREE.MeshStandardMaterial;
  dispose(): void;
}

// 在片元着色器里做 HSV 换色，眼睛等深色部分会保持深色
const HSV_GLSL = /* glsl */ `
uniform float uHue; uniform float uSat; uniform float uBright;
vec3 jbRgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.0e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 jbHsv2rgb(vec3 c){vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}
`;

export function makeSkinMaterial(skin: Skin, base?: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const mat = (base ?? getJellyTemplate().material).clone();
  const uniforms = {
    uHue: { value: skin.hue / 360 },
    uSat: { value: skin.sat },
    uBright: { value: skin.bright },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HSV_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 jbHsv = jbRgb2hsv(diffuseColor.rgb);
        jbHsv.x = fract(jbHsv.x + uHue);
        jbHsv.y = clamp(jbHsv.y * uSat, 0., 1.);
        jbHsv.z = clamp(jbHsv.z * uBright, 0., 1.);
        diffuseColor.rgb = jbHsv2rgb(jbHsv);`,
      );
  };
  mat.customProgramCacheKey = () => 'jelly-hsv';
  return mat;
}

/** 创建一个果冻：root 用来摆位置，body 用来做朝向和形变。 */
export function createJelly(skinId: string): JellyObject {
  const tpl = getJellyTemplate();
  const skin = getSkin(skinId);
  const material = makeSkinMaterial(skin);
  const mesh = new THREE.Mesh(tpl.geometry, material);
  mesh.rotation.y = MODEL_YAW;
  mesh.castShadow = true;
  const body = new THREE.Group();
  body.add(mesh);
  const extra = buildAccessory(skin.accessory, tpl.height, tpl.depth);
  if (extra) body.add(extra);
  const root = new THREE.Group();
  root.add(body);
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [material];
  extra?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) owned.push(m.geometry, m.material as THREE.Material);
  });
  return { root, body, material, dispose: () => owned.forEach((x) => x.dispose()) };
}

function std(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, ...extra });
}

function add(group: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

/** 用基础几何体拼出配件；h 为模型高度，d 为深度（宽度为 1）。 */
function buildAccessory(type: Accessory, h: number, d: number): THREE.Group | null {
  if (type === 'none') return null;
  const g = new THREE.Group();
  const top = h * 0.97;
  const front = d * 0.47;
  const gold = std(0xffc928, { metalness: 0.6, roughness: 0.25 });
  if (type === 'crown') {
    add(g, new THREE.CylinderGeometry(0.17, 0.19, 0.1, 20, 1, true), gold, 0, top, 0).material.side = THREE.DoubleSide;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      add(g, new THREE.ConeGeometry(0.045, 0.1, 8), gold, Math.sin(a) * 0.17, top + 0.09, Math.cos(a) * 0.17);
    }
    add(g, new THREE.SphereGeometry(0.03, 10, 8), std(0xff3d7f), 0, top + 0.01, 0.19);
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
    add(g, new THREE.SphereGeometry(0.035, 10, 8), gold, -0.02, top + 0.12, 0.15);
  } else if (type === 'star') {
    add(g, starGeometry(0.075), std(0xffd84a, { emissive: 0x806000 }), 0.17, h * 0.6, front + 0.02);
  } else if (type === 'tophat') {
    const blue = std(0x2f5fd6);
    add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.025, 24), blue, 0, top, 0);
    add(g, new THREE.CylinderGeometry(0.13, 0.14, 0.2, 24), blue, 0, top + 0.1, 0);
    add(g, new THREE.CylinderGeometry(0.142, 0.142, 0.04, 24), std(0xe23b3b), 0, top + 0.03, 0);
  } else if (type === 'cat') {
    const ear = new THREE.ConeGeometry(0.09, 0.16, 12);
    add(g, ear, std(0xff3d55), -0.2, top - 0.02, 0).rotation.z = 0.45;
    add(g, ear.clone(), std(0xff3d55), 0.2, top - 0.02, 0).rotation.z = -0.45;
  } else if (type === 'horn') {
    add(g, new THREE.ConeGeometry(0.05, 0.24, 16), gold, 0, top + 0.08, 0.1).rotation.x = 0.35;
    add(g, new THREE.SphereGeometry(0.06, 12, 8), std(0xff9ad5), -0.12, top - 0.02, -0.02);
    add(g, new THREE.SphereGeometry(0.06, 12, 8), std(0x9ad5ff), 0.12, top - 0.02, -0.02);
  }
  return g;
}

function starGeometry(r: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
}
