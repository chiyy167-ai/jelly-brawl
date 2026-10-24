/** 道具拾取 / 释放：同色粒子炸开，脚下扩散一圈。 */
import * as THREE from 'three';

interface Bit {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface Ring {
  mesh: THREE.Mesh;
  life: number;
}

export class ItemFx {
  private bits: Bit[] = [];
  private rings: Ring[] = [];
  private owned: { dispose(): void }[] = [];

  constructor(scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(0.14, 8, 6);
    this.owned.push(geo);
    for (let i = 0; i < 40; i += 1) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.bits.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
      this.owned.push(mat);
    }
    const ringGeo = new THREE.RingGeometry(0.35, 0.55, 40);
    this.owned.push(ringGeo);
    for (let i = 0; i < 6; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0 });
      this.owned.push(mat);
    }
  }

  /** x/z 是擂台平面坐标，groundY 是台面高度 */
  spawn(x: number, z: number, color: number, groundY: number): void {
    let n = 0;
    for (const bit of this.bits) {
      if (bit.life > 0) continue;
      const ang = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 4;
      bit.vx = Math.cos(ang) * speed;
      bit.vz = Math.sin(ang) * speed;
      bit.vy = 3.2 + Math.random() * 3;
      bit.life = 0.55;
      bit.mesh.position.set(x, groundY + 0.8, z);
      bit.mesh.visible = true;
      bit.mesh.scale.setScalar(1);
      (bit.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      n += 1;
      if (n >= 12) break;
    }
    const ring = this.rings.find((r) => r.life <= 0);
    if (!ring) return;
    ring.life = 0.42;
    ring.mesh.visible = true;
    ring.mesh.position.set(x, groundY + 0.06, z);
    ring.mesh.scale.setScalar(0.35);
    const mat = ring.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = 0.9;
  }

  update(dt: number): void {
    for (const bit of this.bits) {
      if (bit.life <= 0) continue;
      bit.life -= dt;
      bit.vy -= 16 * dt;
      bit.mesh.position.x += bit.vx * dt;
      bit.mesh.position.y += bit.vy * dt;
      bit.mesh.position.z += bit.vz * dt;
      bit.mesh.scale.setScalar(Math.max(0.05, bit.life / 0.55));
      if (bit.life <= 0) bit.mesh.visible = false;
    }
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      const t = 1 - ring.life / 0.42;
      ring.mesh.scale.setScalar(0.35 + t * 3.2);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      if (ring.life <= 0) ring.mesh.visible = false;
    }
  }

  dispose(): void {
    for (const bit of this.bits) bit.mesh.removeFromParent();
    for (const ring of this.rings) ring.mesh.removeFromParent();
    this.owned.forEach((o) => o.dispose());
  }
}
