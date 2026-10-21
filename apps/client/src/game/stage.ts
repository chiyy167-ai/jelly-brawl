/** 小型展示舞台：大厅、皮肤页、结算页用它显示果冻（不是战斗场景）。 */
import * as THREE from 'three';
import { createJelly, type JellyObject } from './jellyModel';

export interface StageItem {
  skinId: string;
  x: number;
  z: number;
  /** 果冻宽度（世界单位） */
  size: number;
  yaw?: number;
  /** 站在第几名的领奖台上（1~3） */
  podium?: number;
}

export interface StageView {
  y: number;
  z: number;
  lookY: number;
  fov: number;
  /** 脚下铺一圈彩色六边形地砖（半径） */
  floor?: number;
}

const FLOOR_COLORS = [0xff7eb6, 0x4fb8ff, 0xffd84a, 0x6fdc6a, 0xb07cff, 0xff9f4a];

/** 展示用的小擂台地面 */
function buildFloor(radius: number): THREE.InstancedMesh {
  const R = 0.8;
  const spots: THREE.Vector3[] = [];
  const n = Math.ceil(radius / R) + 1;
  for (let q = -n; q <= n; q += 1) {
    for (let r = -n; r <= n; r += 1) {
      const x = R * Math.sqrt(3) * (q + r / 2);
      const z = R * 1.5 * r;
      if (Math.hypot(x, z) < radius) spots.push(new THREE.Vector3(x, -0.3, z));
    }
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(R * 0.94, R * 0.9, 0.6, 6),
    new THREE.MeshStandardMaterial({ roughness: 0.3 }),
    spots.length,
  );
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  spots.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(FLOOR_COLORS[(i * 7 + (i >> 2)) % FLOOR_COLORS.length]));
  });
  return mesh;
}

const PODIUM = [
  { h: 1.1, color: 0xffcf3f, x: 0 },
  { h: 0.75, color: 0x9fb4d8, x: -2.3 },
  { h: 0.55, color: 0xb08a72, x: 2.3 },
];

export function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x8a6fb0, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xa8d8ff, 1.2);
  rim.position.set(-4, 3, -4);
  scene.add(rim);
}

/** 领奖台高度，供角色站位 */
export function podiumHeight(place: number): number {
  return PODIUM[place - 1]?.h ?? 0;
}

export class JellyStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private jellies: { obj: JellyObject; item: StageItem; phase: number }[] = [];
  private extras: THREE.Mesh[] = [];
  private raf = 0;
  private startedAt = performance.now();
  private view: StageView;
  private floor: THREE.InstancedMesh | null = null;
  /** 手指拖动带来的额外旋转 */
  dragYaw = 0;

  constructor(private host: HTMLElement, view: StageView) {
    this.view = view;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(view.fov, 1, 0.1, 100);
    addLights(this.scene);
    if (view.floor) {
      this.floor = buildFloor(view.floor);
      this.scene.add(this.floor);
    }
    this.resize();
    this.loop();
  }

  setItems(items: StageItem[]): void {
    this.jellies.forEach((j) => {
      this.scene.remove(j.obj.root);
      j.obj.dispose();
    });
    this.extras.forEach((m) => {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.extras = [];
    this.jellies = items.map((item, i) => {
      const obj = createJelly(item.skinId);
      obj.root.position.set(item.x, item.podium ? podiumHeight(item.podium) : 0, item.z);
      obj.root.scale.setScalar(item.size);
      this.scene.add(obj.root);
      if (item.podium) this.addPodium(item.podium);
      return { obj, item, phase: i * 1.7 };
    });
  }

  private addPodium(place: number): void {
    const p = PODIUM[place - 1];
    const geo = new THREE.CylinderGeometry(1.05, 1.1, p.h, 6);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.4, metalness: place === 1 ? 0.3 : 0.1 }));
    mesh.position.set(p.x, p.h / 2, 0);
    mesh.rotation.y = Math.PI / 6;
    this.scene.add(mesh);
    this.extras.push(mesh);
    const label = numberSprite(place);
    label.position.set(p.x, p.h * 0.5, 1.0);
    this.scene.add(label);
    this.extras.push(label);
  }

  resize(): void {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 竖屏时往后拉一点，保证都能看到
    const back = this.camera.aspect < 1 ? 1 / Math.max(this.camera.aspect, 0.5) : 1;
    this.camera.position.set(0, this.view.y, this.view.z * back);
    this.camera.lookAt(0, this.view.lookY, 0);
    this.camera.updateProjectionMatrix();
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const t = (performance.now() - this.startedAt) / 1000;
    for (const { obj, item, phase } of this.jellies) {
      // 果冻呼吸感：上下压扁拉伸
      const k = Math.sin(t * 3 + phase) * 0.04;
      obj.body.scale.set(1 + k, 1 - k, 1 + k);
      obj.body.rotation.y = (item.yaw ?? 0) + this.dragYaw + Math.sin(t * 0.8 + phase) * 0.12;
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.setItems([]);
    if (this.floor) {
      this.floor.geometry.dispose();
      (this.floor.material as THREE.Material).dispose();
      this.floor.dispose();
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

function numberSprite(n: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.font = '900 96px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(80,60,40,0.55)';
  ctx.strokeText(String(n), 64, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(n), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), mat);
  return mesh;
}

const thumbCache = new Map<string, string>();

/** 给皮肤格子生成缩略图（只渲染一次，之后走缓存）。 */
export function renderThumbnails(skinIds: string[]): Record<string, string> {
  const todo = skinIds.filter((id) => !thumbCache.has(id));
  if (todo.length) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(256, 256, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    addLights(scene);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, 1.0, 2.6);
    cam.lookAt(0, 0.4, 0);
    for (const id of todo) {
      const obj = createJelly(id);
      obj.body.rotation.y = -0.35;
      scene.add(obj.root);
      renderer.render(scene, cam);
      thumbCache.set(id, renderer.domElement.toDataURL('image/png'));
      scene.remove(obj.root);
      obj.dispose();
    }
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return Object.fromEntries(skinIds.map((id) => [id, thumbCache.get(id) ?? '']));
}
