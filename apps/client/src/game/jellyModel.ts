/** 根据皮肤 + 换装生成果冻 3D 对象：共用模型网格，换色 + 五官/头饰。 */
import * as THREE from 'three';
import { cleanLook, DEFAULT_LOOK, type CosmeticLook, type GearId } from '../data/cosmetics';
import { getSkin, type Accessory, type Skin } from '../data/skins';
import type { JellyLook } from './types';
import { getJellyTemplate } from './assets';
import { buildEyes, buildGear, buildMouth } from './jellyCosmetics';

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

/** 无自定义换装时，沿用皮肤自带配件当头饰 */
export function lookForSkin(skinId: string, look?: CosmeticLook | JellyLook | null): CosmeticLook {
  if (look) return cleanLook(look as Partial<CosmeticLook>);
  const acc = getSkin(skinId).accessory as GearId | Accessory;
  const gear = (acc === 'none' ? 'none' : acc) as GearId;
  return { ...DEFAULT_LOOK, gear: gear === 'none' ? 'none' : gear };
}

/** 创建一个果冻：root 摆位置，body 朝向/形变；look 控制五官与头饰。 */
export function createJelly(skinId: string, look?: CosmeticLook | JellyLook | null): JellyObject {
  const tpl = getJellyTemplate();
  const skin = getSkin(skinId);
  const material = makeSkinMaterial(skin);
  const mesh = new THREE.Mesh(tpl.geometry, material);
  mesh.rotation.y = MODEL_YAW;
  mesh.castShadow = true;
  const body = new THREE.Group();
  body.add(mesh);
  const resolved = lookForSkin(skinId, look);
  const parts = [
    buildEyes(resolved.eye, tpl.height, tpl.depth),
    buildMouth(resolved.mouth, tpl.height, tpl.depth),
    buildGear(resolved.gear, tpl.height, tpl.depth),
  ];
  for (const p of parts) if (p) body.add(p);
  const root = new THREE.Group();
  root.add(body);
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [material];
  for (const p of parts) {
    p?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) owned.push(m.geometry, m.material as THREE.Material);
    });
  }
  return { root, body, material, dispose: () => owned.forEach((x) => x.dispose()) };
}
