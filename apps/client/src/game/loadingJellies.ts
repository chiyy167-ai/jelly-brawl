/** 加载页的 3D 果冻小剧场：红果冻推着进度条往前走，蓝果冻时不时来捣乱，点它们也会有反应。 */
import * as THREE from 'three';
import type { JellyTemplate } from './assets';
import { EmoteKit, type EmoteKind } from './emotes';
import { addEmote, GROUND, headHeight, jump, makeActor, S, updateActor, type Actor } from './loadingActor';
import { makeRng, type Rng } from './rng';
import { addLights } from './stage';
import { makeRenderer, renderIfOk } from './webgl';

// 坐标单位 = 启动插画上的像素（插画 1024×576），世界 y = -插画 y；和 CSS 的 .loading-stage 一致
const REGION = { x0: 200, x1: 774, y0: 270, y1: 530 };
const FILL_L = 330.5; // 进度条内部填充区的左端和宽度
const FILL_W = 363;
const HOME_B = 282; // 蓝果冻平时待在进度条左边

const RED_LINES = ['嘿嘿～', '好痒！', '别戳我啦！', '我在努力加载呢！', '再戳我就变大！'];
const CHEER_LINES = ['冲呀！', '加油加油！', '马上就好～'];

export class LoadingJellies {
  private renderer = makeRenderer();
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(REGION.x0, REGION.x1, -REGION.y0, -REGION.y1, -1000, 1000);
  private kit = new EmoteKit();
  private shadowGeo = new THREE.CircleGeometry(1, 24);
  private shadowMat = new THREE.MeshBasicMaterial({ color: 0x1b2a78, transparent: true, opacity: 0.28, depthWrite: false });
  private outlineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
  private red: Actor;
  private blue: Actor;
  private rng: Rng = makeRng(20261021);
  private raf = 0;
  private last = performance.now();
  private time = 0;
  private ratio: number | null = 0;
  private changedAt = 0;
  private stallSaid = false;
  private label = '';
  private sayText = '';
  private sayUntil = 0;
  private shown = '';
  private bubbleW = 0;
  private redFollow = true;
  private steps: { at: number; fn: () => void }[] = [];
  private nextEvent = 2.2;
  private done = false;
  private doneHop = 0;
  private ro: ResizeObserver;
  private rect = new DOMRect();

  constructor(private host: HTMLElement, private bubble: HTMLElement, private tpl: JellyTemplate) {
    this.renderer.toneMappingExposure = 1.4;
    host.prepend(this.renderer.domElement);
    this.camera.position.z = 500;
    addLights(this.scene);
    this.red = makeActor(this.scene, tpl, this.outlineMat, this.newShadow(), 'classic', this.edgeX(), 0);
    this.red.pushing = true;
    this.blue = makeActor(this.scene, tpl, this.outlineMat, this.newShadow(), 'blue', HOME_B, 1.7);
    this.renderer.domElement.addEventListener('pointerdown', this.onTap);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
    // 开发调试用
    if (import.meta.env.DEV) (window as unknown as { __jbLoading: LoadingJellies }).__jbLoading = this;
  }

  setProgress(ratio: number | null, label: string): void {
    if (ratio !== this.ratio) {
      this.ratio = ratio;
      this.changedAt = this.time;
      this.stallSaid = false;
    }
    this.label = label;
  }

  /** 加载完成：两只果冻一起蹦跶庆祝 */
  finish(): void {
    this.done = true;
    this.steps = [];
    this.redFollow = true;
    this.red.sizeGoal = 1;
    Object.assign(this.blue, { target: FILL_L + FILL_W - S * 1.1, speed: 420 });
    this.say('加载完成！出发！', 99);
  }

  private newShadow(): THREE.Mesh {
    return new THREE.Mesh(this.shadowGeo, this.shadowMat);
  }

  private emote(a: Actor, kind: EmoteKind, life: number): void {
    addEmote(this.kit, a, kind, life);
  }

  private say(text: string, secs: number): void {
    this.sayText = text;
    this.sayUntil = this.time + secs;
  }

  /** 进度条最前端（红果冻站的位置）；不知道总大小时来回走 */
  private edgeX(): number {
    if (this.ratio === null) return FILL_L + (0.5 + 0.5 * Math.sin(this.time * 0.6)) * FILL_W;
    return FILL_L + Math.max(20, this.ratio * FILL_W) + S * 0.15;
  }

  private plan(steps: [number, () => void][]): void {
    this.steps = steps.map(([at, fn]) => ({ at: this.time + at, fn }));
  }

  /** 随机挑一段小剧情 */
  private startEvent(): void {
    const { red, blue } = this;
    const r = this.rng.next();
    if (r < 0.35) {
      // 蓝果冻冲过来撞红果冻：红果冻被撞飞、变小、头晕
      const tx = red.x - S * 0.95;
      const t = Math.abs(tx - blue.x) / 520;
      Object.assign(blue, { target: tx, speed: 520 });
      this.plan([
        [t, () => {
          jump(red, 340, true);
          red.sizeGoal = 0.7;
          this.redFollow = false;
          Object.assign(red, { target: red.x + 34, speed: 220 });
          this.emote(red, 'dizzy', 1.9);
          this.say('哎呀！被撞小了…', 1.7);
          this.emote(blue, 'note', 1.4);
          jump(blue, 220);
        }],
        [t + 1.4, () => Object.assign(blue, { target: HOME_B, speed: 200 })],
        [t + 2.0, () => {
          red.sizeGoal = 1;
          this.redFollow = true;
          this.say('哼，又长回来了！', 1.3);
        }],
        [t + 2.8, () => undefined],
      ]);
    } else if (r < 0.6) {
      // 红果冻开心空翻
      jump(red, 470, true);
      this.emote(red, 'heart', 1.4);
      this.say(CHEER_LINES[this.rng.int(CHEER_LINES.length)], 1.4);
      this.plan([[1.5, () => undefined]]);
    } else if (r < 0.82) {
      // 蓝果冻偷偷戳一下，红果冻生气追过去
      const tx = red.x - S * 0.8;
      const t = Math.abs(tx - blue.x) / 300;
      Object.assign(blue, { target: tx, speed: 300 });
      this.plan([
        [t, () => {
          jump(blue, 160);
          this.emote(red, 'angry', 1.7);
          this.say('别闹！', 1.2);
        }],
        [t + 0.5, () => {
          Object.assign(blue, { target: HOME_B, speed: 400 });
          this.emote(blue, 'sweat', 1.4);
          this.redFollow = false;
          Object.assign(red, { target: Math.max(HOME_B + S * 1.1, red.x - 120), speed: 260 });
        }],
        [t + 1.5, () => (this.redFollow = true)],
        [t + 2.4, () => undefined],
      ]);
    } else {
      // 蓝果冻一个大跳吓红果冻一跳
      jump(blue, 480);
      this.emote(blue, 'wow', 1.2);
      this.plan([
        [0.35, () => {
          this.emote(red, 'wow', 1);
          this.say('什么情况？', 1.1);
          red.squash = 0.3;
        }],
        [1.4, () => undefined],
      ]);
    }
  }

  private onTap = (ev: PointerEvent): void => {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ux = REGION.x0 + ((ev.clientX - r.left) / r.width) * (REGION.x1 - REGION.x0);
    const uy = REGION.y0 + ((ev.clientY - r.top) / r.height) * (REGION.y1 - REGION.y0);
    for (const a of [this.red, this.blue]) {
      const top = GROUND - a.y - headHeight(a, this.tpl);
      if (Math.abs(ux - a.x) > S * 0.6 || uy < top - 8 || uy > GROUND - a.y + 8) continue;
      jump(a, 380, this.rng.next() < 0.3);
      const kinds: EmoteKind[] = ['heart', 'note', 'angry', 'wow'];
      this.emote(a, kinds[this.rng.int(kinds.length)], 1.2);
      if (a === this.red && !this.done) this.say(RED_LINES[this.rng.int(RED_LINES.length)], 1.2);
      return;
    }
  };

  private updateBubble(): void {
    const text = this.sayUntil > this.time ? this.sayText : this.label;
    if (text !== this.shown) {
      this.shown = text;
      this.bubble.textContent = text;
      this.bubble.classList.remove('pop');
      void this.bubble.offsetWidth;
      this.bubble.classList.add('pop');
      this.bubbleW = this.bubble.offsetWidth;
    }
    const { red } = this;
    const W = this.rect.width || 1;
    const H = this.rect.height || 1;
    // 跳起时气泡只跟一点点，方便看清字
    const headTop = GROUND - red.y * 0.35 - headHeight(red, this.tpl) - 4;
    let px = ((red.x - REGION.x0) / (REGION.x1 - REGION.x0)) * W;
    const half = this.bubbleW / 2 + 6;
    px = Math.min(Math.max(px, half - this.rect.left), window.innerWidth - this.rect.left - half);
    const py = ((headTop - REGION.y0) / (REGION.y1 - REGION.y0)) * H;
    this.bubble.style.left = `${px}px`;
    this.bubble.style.top = `${py}px`;
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    while (this.steps.length && this.steps[0].at <= this.time) this.steps.shift()!.fn();
    if (this.done) {
      // 庆祝：轮流蹦
      this.doneHop -= dt;
      if (this.doneHop <= 0) {
        this.doneHop = 0.5;
        const a = this.rng.next() < 0.5 ? this.red : this.blue;
        jump(a, 420, this.rng.next() < 0.4);
        this.emote(a, 'heart', 1);
      }
    } else if (!this.steps.length) {
      this.nextEvent -= dt;
      if (this.nextEvent <= 0) {
        this.startEvent();
        this.nextEvent = this.rng.range(2.2, 3.8);
      } else if (this.ratio !== null && this.time - this.changedAt > 2.2 && !this.stallSaid) {
        // 进度卡住了：流汗
        this.stallSaid = true;
        this.emote(this.red, 'sweat', 1.8);
        this.say('网速有点慢…再等等～', 2);
      }
    }
    if (this.redFollow) Object.assign(this.red, { target: this.edgeX(), speed: 170 });
    updateActor(this.red, this.kit, this.tpl, this.time, dt);
    updateActor(this.blue, this.kit, this.tpl, this.time, dt);
    this.updateBubble();
    renderIfOk(this.renderer, this.scene, this.camera);
  };

  private resize(): void {
    this.rect = this.host.getBoundingClientRect();
    this.renderer.setSize(Math.max(2, this.host.clientWidth), Math.max(2, this.host.clientHeight), false);
    this.bubbleW = this.bubble.offsetWidth;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onTap);
    this.red.material.dispose();
    this.blue.material.dispose();
    this.kit.dispose();
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
    this.outlineMat.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
