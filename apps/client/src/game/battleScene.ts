/** 战斗场景渲染：只读 MatchState，负责插值、镜头、果冻形变和特效。 */
import * as THREE from 'three';
import { Arena } from './arena';
import { playFx } from './audio';
import { GAME } from './config';
import { createJelly, type JellyObject } from './jellyModel';
import type { MatchState } from './types';

const BLOB_COLORS = [0xff6fa8, 0x45b6ff, 0xffd84a, 0x6fdc6a, 0xb07cff, 0xff9f4a];
const RED = new THREE.Color(0xff2030);

interface JellyView {
  obj: JellyObject;
  size: number;
  yaw: number;
  wobble: number;
}

interface Spark {
  mesh: THREE.Mesh;
  vx: number; vy: number; vz: number;
  life: number;
}

export class BattleScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(GAME.camera.fov, 1, 0.1, 200);
  private arena: Arena;
  private views = new Map<number, JellyView>();
  private blobs: THREE.Mesh[] = [];
  private sparks: Spark[] = [];
  private marker: THREE.Mesh;
  private chargeRing: THREE.Mesh;
  private camPos = new THREE.Vector3();
  private owned: { dispose(): void }[] = [];
  private portrait = false;

  constructor(private host: HTMLElement, s: MatchState) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0xbfe4ff, 75, 160);

    this.scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x7a5fa8, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(8, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -13;
    sc.right = sc.top = 13;
    sc.near = 1;
    sc.far = 50;
    this.scene.add(sun);

    this.arena = new Arena(s.seed);
    this.scene.add(this.arena.group);

    for (const j of s.jellies) {
      const obj = createJelly(j.skinId);
      this.scene.add(obj.root);
      this.views.set(j.id, { obj, size: j.radius * 2, yaw: 0, wobble: 0 });
    }
    const blobGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
    for (let i = 0; i < s.blobs.length; i += 1) {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.15, transparent: true, opacity: 0.88, emissiveIntensity: 0.35 });
      const mesh = new THREE.Mesh(blobGeo, mat);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.blobs.push(mesh);
      this.owned.push(mat);
    }
    const sparkGeo = new THREE.OctahedronGeometry(0.16);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfffbe0 });
    for (let i = 0; i < 48; i += 1) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparks.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    // 玩家头顶的小箭头 + 脚下蓄力圈
    const markerMat = new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0x7a5500 });
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 4), markerMat);
    this.marker.rotation.x = Math.PI;
    this.scene.add(this.marker);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a4a, transparent: true, opacity: 0.8, depthWrite: false });
    this.chargeRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), ringMat);
    this.chargeRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.chargeRing);
    this.owned.push(blobGeo, sparkGeo, sparkMat, markerMat, this.marker.geometry, ringMat, this.chargeRing.geometry);
    this.resize();
  }

  resize(): void {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.portrait = this.camera.aspect < 1;
    this.camera.updateProjectionMatrix();
  }

  /** alpha：固定步长之间的插值系数 */
  render(s: MatchState, alpha: number, dt: number, time: number): void {
    this.consumeFx(s);
    this.arena.update(s, dt, time);
    const topY = GAME.tile.height / 2;
    let player = s.jellies[0];
    for (const j of s.jellies) {
      if (j.isPlayer) player = j;
      const v = this.views.get(j.id);
      if (!v) continue;
      const root = v.obj.root;
      root.visible = j.fallY > -40;
      const x = j.prevX + (j.x - j.prevX) * alpha;
      const z = j.prevY + (j.y - j.prevY) * alpha;
      v.size += (j.radius * 2 - v.size) * Math.min(1, dt * 8);
      const speed = Math.hypot(j.vx, j.vy);
      const hop = j.alive && speed > 1 ? Math.abs(Math.sin(time * 11 + j.id)) * 0.12 * v.size : 0;
      root.position.set(x, topY + j.fallY + hop, z);
      root.scale.setScalar(v.size);
      // 平滑转向
      const target = Math.atan2(Math.cos(j.facing), Math.sin(j.facing));
      let d = target - v.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      v.yaw += d * Math.min(1, dt * 10);
      v.obj.body.rotation.y = v.yaw;
      // 蓄力压扁、被撞抖动、冲刺拉长
      const c = j.charge / GAME.charge.maxTime;
      if (j.dizzy > 0) v.wobble = 1;
      v.wobble = Math.max(0, v.wobble - dt * 2.5);
      const wob = Math.sin(time * 30) * 0.12 * v.wobble;
      const dash = j.dashT > 0 ? 0.15 : 0;
      v.obj.body.scale.set(1 + c * 0.18 + wob, 1 - c * 0.25 - wob - dash * 0.5, 1 + dash);
      v.obj.material.emissive.copy(RED).multiplyScalar(c * 0.6);
      if (!j.alive) root.rotation.z += dt * 4;
    }
    s.blobs.forEach((b, i) => {
      const m = this.blobs[i];
      m.visible = b.alive;
      if (!b.alive) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.setHex(BLOB_COLORS[b.color]);
      mat.emissive.setHex(BLOB_COLORS[b.color]);
      m.position.set(b.x, topY + 0.55 + Math.sin(time * 3 + i) * 0.12, b.y);
      m.rotation.set(time * 0.7 + i, time + i, 0);
    });
    this.updateSparks(dt);
    this.updatePlayerMarks(player, time, topY);
    this.updateCamera(player, s.shake);
    this.renderer.render(this.scene, this.camera);
  }

  private updatePlayerMarks(p: MatchState['jellies'][number], time: number, topY: number): void {
    const v = this.views.get(p.id);
    if (!v) return;
    const pos = v.obj.root.position;
    this.marker.visible = p.alive;
    this.marker.position.set(pos.x, pos.y + v.size * 0.95 + 0.4 + Math.sin(time * 4) * 0.1, pos.z);
    this.marker.rotation.y = time * 2;
    const c = p.charge / GAME.charge.maxTime;
    this.chargeRing.visible = p.alive && p.charging;
    this.chargeRing.position.set(pos.x, topY + 0.04, pos.z);
    this.chargeRing.scale.setScalar(p.radius * (1.1 + c * 0.5));
  }

  private updateCamera(p: MatchState['jellies'][number], shake: number): void {
    const cam = GAME.camera;
    const k = this.portrait ? Math.max(1, cam.portraitFit / this.camera.aspect) : 1;
    const tilt = this.portrait ? cam.portraitTilt : 1;
    const back = (cam.back * k) / tilt;
    const fx = p.alive ? p.x * cam.follow : 0;
    const fz = p.alive ? p.y * cam.follow : 0;
    const goal = new THREE.Vector3(fx, cam.height * k * tilt, fz + back);
    if (this.camPos.lengthSq() === 0) this.camPos.copy(goal);
    else this.camPos.lerp(goal, 0.08);
    this.camera.position.copy(this.camPos);
    if (shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
    }
    this.camera.lookAt(this.camPos.x, 0, this.camPos.z - back + 1.5);
  }

  private consumeFx(s: MatchState): void {
    for (const e of s.fx) {
      playFx(e);
      if (e.type === 'hit') this.burst(e.x, e.y, e.heavy ? 12 : 5, e.heavy ? 9 : 5);
      else if (e.type === 'eat') this.burst(e.x, e.y, 4, 3);
    }
    s.fx.length = 0;
  }

  private burst(x: number, z: number, count: number, power: number): void {
    let made = 0;
    for (const sp of this.sparks) {
      if (sp.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      sp.vx = Math.cos(a) * power * (0.5 + Math.random());
      sp.vz = Math.sin(a) * power * (0.5 + Math.random());
      sp.vy = 3 + Math.random() * power;
      sp.life = 0.45;
      sp.mesh.position.set(x, 1.2, z);
      sp.mesh.visible = true;
      made += 1;
      if (made >= count) break;
    }
  }

  private updateSparks(dt: number): void {
    for (const sp of this.sparks) {
      if (sp.life <= 0) continue;
      sp.life -= dt;
      sp.vy -= 18 * dt;
      sp.mesh.position.x += sp.vx * dt;
      sp.mesh.position.y += sp.vy * dt;
      sp.mesh.position.z += sp.vz * dt;
      sp.mesh.scale.setScalar(Math.max(0.01, sp.life / 0.45));
      if (sp.life <= 0) sp.mesh.visible = false;
    }
  }

  dispose(): void {
    this.views.forEach((v) => v.obj.dispose());
    this.arena.dispose();
    this.owned.forEach((o) => o.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
