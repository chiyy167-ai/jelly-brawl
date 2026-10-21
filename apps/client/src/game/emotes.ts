/** 果冻头顶的小表情，全部用基础几何体拼出来：晕、爱心、生气、流汗、音符、感叹号。 */
import * as THREE from 'three';

export type EmoteKind = 'dizzy' | 'heart' | 'angry' | 'sweat' | 'note' | 'wow';

export interface Emote {
  kind: EmoteKind;
  /** 挂在果冻头顶，缩放 = 果冻宽度，所以里面的尺寸都以“果冻宽度”为 1 */
  group: THREE.Group;
  inner: THREE.Group;
  t: number;
  life: number;
}

function easeOutBack(x: number): number {
  const c = 1.9;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

function starShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}

function heartShape(): THREE.Shape {
  const h = new THREE.Shape();
  h.moveTo(0, -0.5);
  h.bezierCurveTo(-0.15, -0.32, -0.55, -0.1, -0.55, 0.18);
  h.bezierCurveTo(-0.55, 0.45, -0.2, 0.55, 0, 0.3);
  h.bezierCurveTo(0.2, 0.55, 0.55, 0.45, 0.55, 0.18);
  h.bezierCurveTo(0.55, -0.1, 0.15, -0.32, 0, -0.5);
  return h;
}

/** 表情工具箱：几何体和材质只建一次，所有表情共用。 */
export class EmoteKit {
  private geo = {
    star: new THREE.ExtrudeGeometry(starShape(0.09), { depth: 0.03, bevelEnabled: false }),
    heart: new THREE.ExtrudeGeometry(heartShape(), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }),
    arc: new THREE.TorusGeometry(0.1, 0.036, 6, 10, Math.PI / 2),
    ball: new THREE.SphereGeometry(1, 14, 10),
    cone: new THREE.ConeGeometry(1, 1, 14),
    box: new THREE.BoxGeometry(1, 1, 1),
  };

  private mat = {
    star: this.std(0xffd84a, 0x7a5a00),
    heart: this.std(0xff4f8b, 0x601030),
    angry: this.std(0xff2b3d, 0x500010),
    sweat: this.std(0x7fd4ff, 0x103050, { transparent: true, opacity: 0.85 }),
    note: this.std(0x7a4dff, 0x200a60),
    wow: this.std(0xffc928, 0x604000),
  };

  private std(color: number, emissive: number, extra: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.3, metalness: 0.05, ...extra });
  }

  private add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, sx = 1, sy = sx, sz = sx) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, 0);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }

  make(kind: EmoteKind, life: number): Emote {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    const g = this.geo;
    const m = this.mat;
    if (kind === 'dizzy') {
      // 三颗星星绕着头顶转圈
      inner.position.y = 0.1;
      inner.rotation.x = 0.35;
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        const s = this.add(inner, g.star, m.star, Math.cos(a) * 0.32, 0);
        s.position.z = Math.sin(a) * 0.32;
      }
    } else if (kind === 'heart') {
      inner.position.set(0.3, 0.1, 0);
      this.add(inner, g.heart, m.heart, 0, 0, 0.22);
    } else if (kind === 'angry') {
      // 漫画里的“青筋”符号：四段四分之一圆弧，凸起朝中心
      inner.position.set(0.4, -0.1, 0);
      for (let k = 0; k < 4; k += 1) {
        const q = Math.PI / 4 + (k * Math.PI) / 2;
        const arc = this.add(inner, g.arc, m.angry, Math.cos(q) * 0.125, Math.sin(q) * 0.125);
        arc.rotation.z = q + (3 * Math.PI) / 4;
      }
    } else if (kind === 'sweat') {
      inner.position.set(-0.42, -0.16, 0);
      this.add(inner, g.ball, m.sweat, 0, 0, 0.085);
      this.add(inner, g.cone, m.sweat, 0, 0.105, 0.082, 0.14, 0.082);
    } else if (kind === 'note') {
      inner.position.set(0.34, 0.02, 0);
      [[0, 0], [0.17, 0.12]].forEach(([x, y]) => {
        const head = this.add(inner, g.ball, m.note, x, y, 0.06, 0.045, 0.04);
        head.rotation.z = 0.4;
        this.add(inner, g.box, m.note, x + 0.05, y + 0.09, 0.016, 0.18, 0.016);
        this.add(inner, g.box, m.note, x + 0.08, y + 0.17, 0.06, 0.022, 0.016);
      });
    } else {
      // 感叹号
      inner.position.set(0, 0.12, 0);
      this.add(inner, g.box, m.wow, 0, 0.17, 0.06, 0.2, 0.06);
      this.add(inner, g.ball, m.wow, 0, 0.02, 0.04);
    }
    return { kind, group, inner, t: 0, life };
  }

  /** 推进动画；返回 false 表示这个表情结束了 */
  update(e: Emote, dt: number): boolean {
    e.t += dt;
    const { t, life, inner } = e;
    if (t >= life) return false;
    // 弹出 + 结尾缩回
    const pop = t < 0.18 ? easeOutBack(t / 0.18) : t > life - 0.2 ? Math.max(0, (life - t) / 0.2) : 1;
    inner.scale.setScalar(Math.max(0.001, pop));
    if (e.kind === 'dizzy') {
      inner.rotation.y += dt * 5;
      inner.children.forEach((c) => (c.rotation.z += dt * 6));
    } else if (e.kind === 'heart') {
      inner.position.y = 0.1 + t * 0.35;
      inner.rotation.z = Math.sin(t * 6) * 0.25;
    } else if (e.kind === 'angry') {
      inner.scale.multiplyScalar(1 + Math.sin(t * 16) * 0.15);
    } else if (e.kind === 'sweat') {
      inner.position.y = -0.16 - t * 0.18;
    } else if (e.kind === 'note') {
      inner.position.y = 0.02 + Math.abs(Math.sin(t * 7)) * 0.08;
      inner.rotation.z = Math.sin(t * 5) * 0.2;
    } else {
      inner.rotation.z = Math.sin(t * 20) * Math.max(0, 0.3 - t) * 1.5;
    }
    return true;
  }

  dispose(): void {
    Object.values(this.geo).forEach((g) => g.dispose());
    Object.values(this.mat).forEach((m) => m.dispose());
  }
}
