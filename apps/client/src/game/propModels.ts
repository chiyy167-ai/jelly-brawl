/** 道具 glb：神秘箱 / 手持物 / 地面装置。失败时返回 null，战斗里走几何体兜底。 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { HazardKind, ItemKind } from './types';

export type PropId = 'box' | ItemKind;

const FILES: Record<PropId, string> = {
  box: '01_mystery_crate.glb',
  rocket: '02_dash_rocket.glb',
  shield: '03_shield_bubble.glb',
  pad: '04_jump_pad.glb',
  grow: '05_growth_cube.glb',
  magnet: '06_magnet.glb',
  banana: '07_banana_peel.glb',
  mine: '08_spike_mine.glb',
  snow: '09_freeze_snowball.glb',
  star: '10_energy_star.glb',
  glove: '11_boxing_glove.glb',
  cake: '12_recovery_cake.glb',
};

/**
 * 这批 glb 的朝向不统一：问号在 -Y，跳板和星星的正面在 XY。
 * 先转到俯视能看见的一面（Three 里 Y 朝上），再归一化。
 */
const TURN: Partial<Record<PropId, [number, number, number]>> = {
  box: [Math.PI, 0, 0],
  grow: [Math.PI, 0, 0],
  pad: [-Math.PI / 2, 0, 0],
  star: [-Math.PI / 2, 0, 0],
  cake: [-Math.PI / 2, 0, 0],
};

/** 场上显示的目标包围盒最长边（世界单位）。根节点缩放保持 1。 */
const FIT: Record<PropId, number> = {
  box: 2.1,
  rocket: 1.35,
  shield: 2.4,
  pad: 2.2,
  grow: 1.2,
  magnet: 1.2,
  banana: 1.5,
  mine: 1.5,
  snow: 1.15,
  star: 1.25,
  glove: 1.35,
  cake: 1.25,
};

const templates = new Map<PropId, THREE.Object3D>();
let pending: Promise<void> | null = null;

function propUrl(file: string): string {
  return `${import.meta.env.BASE_URL}models/props/${file}`;
}

function freshenMaterial(src: THREE.Material): THREE.Material {
  const mat = src.clone();
  const std = mat as THREE.MeshStandardMaterial;
  std.side = THREE.DoubleSide;
  if (std.color && std.emissive) {
    std.emissive.copy(std.color);
    std.emissiveIntensity = Math.max(std.emissiveIntensity ?? 0, 0.35);
  }
  return mat;
}

/** 烘焙世界变换、补法线，底部贴地，根缩放为 1。 */
function normalize(root: THREE.Object3D, fit: number, turn?: [number, number, number]): THREE.Object3D {
  const src = root.clone(true);
  if (turn) src.rotation.set(turn[0], turn[1], turn[2]);
  src.updateMatrixWorld(true);
  const wrap = new THREE.Group();
  src.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeVertexNormals();
    const mats = Array.isArray(mesh.material) ? mesh.material.map(freshenMaterial) : freshenMaterial(mesh.material);
    const copy = new THREE.Mesh(geo, mats);
    copy.castShadow = true;
    copy.receiveShadow = true;
    wrap.add(copy);
  });
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const s = fit / Math.max(size.x, size.y, size.z, 0.001);
  wrap.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.translate(-center.x, -box.min.y, -center.z);
    mesh.geometry.scale(s, s, s);
  });
  return wrap;
}

async function loadOne(loader: GLTFLoader, id: PropId): Promise<void> {
  const file = FILES[id];
  try {
    const gltf = await loader.loadAsync(propUrl(file));
    const model = normalize(gltf.scene, FIT[id], TURN[id]);
    if (model.children.length === 0) throw new Error('模型里没有网格');
    templates.set(id, model);
  } catch (err) {
    console.warn(`[props] 加载失败 ${file}`, err);
  }
}

/** 加载全部道具模板（可与果冻模型并行）。 */
export function loadPropModels(): Promise<void> {
  if (templates.size >= Object.keys(FILES).length) return Promise.resolve();
  if (pending) return pending;
  const loader = new GLTFLoader();
  pending = Promise.all((Object.keys(FILES) as PropId[]).map((id) => loadOne(loader, id)))
    .then(() => undefined)
    .finally(() => { pending = null; });
  return pending;
}

export function propsReady(): boolean {
  return templates.has('box');
}

/** 克隆一份道具；未加载则 null。材质单独克隆，避免实例互相改透明度。 */
export function cloneProp(id: PropId): THREE.Object3D | null {
  const tpl = templates.get(id);
  if (!tpl) return null;
  const copy = tpl.clone(true);
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
  });
  copy.userData.propId = id;
  return copy;
}

export function hazardPropId(kind: HazardKind): PropId {
  return kind;
}
