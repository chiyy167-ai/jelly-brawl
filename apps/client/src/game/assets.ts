/** 资源加载：下载红色果冻模型，进度来自真实的下载字节数。 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { loadPropModels } from './propModels';

export const MODEL_URL = `${import.meta.env.BASE_URL}models/red-jelly.glb`;
const PREVIEW_URL = `${import.meta.env.BASE_URL}models/red-jelly-lite.glb`;

export interface LoadProgress {
  /** 0~1；无法得知总大小时为 null */
  ratio: number | null;
  loadedBytes: number;
  label: string;
}

/** 归一化后的果冻模板：底部在 y=0，水平居中，宽度 = 1 */
export interface JellyTemplate {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  height: number;
  depth: number;
}

let template: JellyTemplate | null = null;
let pending: Promise<JellyTemplate> | null = null;
const listeners = new Set<(p: LoadProgress) => void>();
let lastProgress: LoadProgress | null = null;

export function getJellyTemplate(): JellyTemplate {
  if (!template) throw new Error('果冻模型还没加载');
  return template;
}

export function isLoaded(): boolean {
  return template !== null;
}

let preview: Promise<JellyTemplate> | null = null;

/** 加载页专用的低模果冻（约 56KB），先于正式模型下载，让等待时就有 3D 果冻可看。 */
export function loadPreviewJelly(): Promise<JellyTemplate> {
  if (!preview) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    preview = loader.loadAsync(PREVIEW_URL).then((gltf) => buildTemplate(gltf.scene));
    preview.catch(() => (preview = null));
  }
  return preview;
}

/** 加载所有必要资源。重复调用只会下载一次。 */
export function loadAssets(onProgress: (p: LoadProgress) => void): Promise<JellyTemplate> {
  if (template) {
    onProgress({ ratio: 1, loadedBytes: 0, label: '资源已就绪' });
    return Promise.resolve(template);
  }
  // 重复调用时（比如开发模式下 effect 跑两次）每个调用者都能收到进度
  listeners.add(onProgress);
  if (pending) {
    if (lastProgress) onProgress(lastProgress);
    return pending;
  }
  const emit = (p: LoadProgress) => {
    lastProgress = p;
    listeners.forEach((fn) => fn(p));
  };
  // 道具 glb 与果冻并行下载
  void loadPropModels();
  pending = new Promise<JellyTemplate>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        emit({ ratio: 0.92, loadedBytes: 0, label: '正在准备果冻与道具...' });
        template = buildTemplate(gltf.scene);
        void loadPropModels().finally(() => {
          emit({ ratio: 1, loadedBytes: 0, label: '加载完成！' });
          listeners.clear();
          resolve(template!);
        });
      },
      (e) => {
        // 下载占进度的 0~90%，解析贴图占剩下部分
        const ratio = e.lengthComputable && e.total > 0 ? (e.loaded / e.total) * 0.9 : null;
        emit({ ratio, loadedBytes: e.loaded, label: '正在加载果冻模型...' });
      },
      (err) => {
        pending = null;
        lastProgress = null;
        listeners.clear();
        reject(err instanceof Error ? err : new Error('模型加载失败'));
      },
    );
  });
  return pending;
}

function buildTemplate(root: THREE.Object3D): JellyTemplate {
  let mesh: THREE.Mesh | null = null;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  if (!mesh) throw new Error('模型里没有网格');
  const found = mesh as THREE.Mesh;
  const geometry = found.geometry.clone();
  geometry.applyMatrix4(found.matrixWorld);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  // 平移到底部中心，再缩放到宽度 1
  geometry.translate(-center.x, -box.min.y, -center.z);
  const s = 1 / size.x;
  geometry.scale(s, s, s);
  geometry.computeBoundingSphere();
  const src = found.material as THREE.MeshStandardMaterial;
  const material = new THREE.MeshStandardMaterial({
    map: src.map,
    normalMap: src.normalMap,
    roughnessMap: src.roughnessMap,
    metalnessMap: src.metalnessMap,
    roughness: 0.35,
    metalness: 0,
  });
  return { geometry, material, height: size.y * s, depth: size.z * s };
}
