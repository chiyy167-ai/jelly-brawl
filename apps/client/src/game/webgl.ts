/** WebGL 创建与绘制。iPhone 横屏旋转时上下文容易被系统丢掉，这里统一兜住。 */
import * as THREE from 'three';

const lost = new WeakSet<THREE.WebGLRenderer>();

/** iPhone / iPad，含桌面模式的 iPad */
export function isAppleTouch(): boolean {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function makeRenderer(extra?: THREE.WebGLRendererParameters): THREE.WebGLRenderer {
  const apple = isAppleTouch();
  const renderer = new THREE.WebGLRenderer({
    antialias: !apple,
    alpha: true,
    powerPreference: 'high-performance',
    ...extra,
  });
  const ratio = Math.min(window.devicePixelRatio || 1, apple ? 1.25 : 2);
  renderer.setPixelRatio(ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 阴影在 iOS 横屏上容易撑爆显存，整页报错
  renderer.shadowMap.enabled = !apple;
  renderer.domElement.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    lost.add(renderer);
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    lost.delete(renderer);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, apple ? 1.25 : 2));
  });
  return renderer;
}

export function renderIfOk(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
  if (lost.has(renderer)) return;
  try {
    renderer.render(scene, camera);
  } catch {
    // 旋转瞬间上下文失效，等 restored 后再画
  }
}
