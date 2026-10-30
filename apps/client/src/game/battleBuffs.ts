/**
 * 果冻身上的道具显示：头顶小图标 = 手里拿着、还没释放；
 * 生效中的效果另画（护盾罩住身体、磁力地面范围圈、火箭在身后等），
 * 这样释放前后看得出区别。
 */
import * as THREE from 'three';
import { GAME } from './config';
import { ITEM_COLORS } from './maps';
import { cloneProp, propsReady, type PropId } from './propModels';
import type { Jelly, MatchState } from './types';

/** 手持图标相对道具原尺寸的缩放 */
const HELD_SCALE = 0.55;
/** 护盾罩相对果冻半径的横向 / 竖向缩放与透明度 */
const SHIELD_WIDE = 1.1;
const SHIELD_TALL = 1.75;
const SHIELD_ALPHA = 0.45;

interface Slot {
  id: PropId;
  root: THREE.Object3D;
}

export class BattleBuffLayer {
  private held = new Map<number, Slot>();
  private active = new Map<number, Slot>();
  private rings = new Map<number, THREE.Mesh>();
  private ringGeo: THREE.RingGeometry;
  private owned: { dispose(): void }[] = [];

  constructor(private scene: THREE.Scene) {
    const r = GAME.items.magnet.radius;
    this.ringGeo = new THREE.RingGeometry(r - 0.14, r, 64);
    this.owned.push(this.ringGeo);
  }

  update(s: MatchState, time: number, topY: number): void {
    for (const j of s.jellies) {
      const x = j.prevX + (j.x - j.prevX) * 0.5;
      const z = j.prevY + (j.y - j.prevY) * 0.5;
      const bob = Math.sin(time * 5 + j.id) * 0.12;
      const heldId = j.alive ? j.item : null;
      const held = this.sync(this.held, j.id, heldId);
      if (held) {
        held.scale.setScalar(HELD_SCALE);
        held.position.set(x, topY + j.fallY + j.radius * 1.55 + bob, z);
        held.rotation.y = time * 2;
      }
      const fxId = j.alive ? activeProp(j) : null;
      const fx = this.sync(this.active, j.id, fxId);
      if (fx) this.placeActive(fx, fxId!, j, x, z, topY, bob, time);
      this.syncRing(j, x, z, topY, time);
    }
  }

  dispose(): void {
    for (const m of [this.held, this.active]) {
      for (const e of m.values()) this.scene.remove(e.root);
      m.clear();
    }
    for (const ring of this.rings.values()) this.scene.remove(ring);
    this.rings.clear();
    this.owned.forEach((o) => o.dispose());
  }

  /** 按需创建 / 替换 / 移除一个道具模型 */
  private sync(map: Map<number, Slot>, jid: number, id: PropId | null): THREE.Object3D | null {
    let entry = map.get(jid);
    if (!id) {
      if (entry) {
        this.scene.remove(entry.root);
        map.delete(jid);
      }
      return null;
    }
    const stale = entry && entry.id === id && entry.root.userData.propId !== id && propsReady();
    if (!entry || entry.id !== id || stale) {
      if (entry) this.scene.remove(entry.root);
      entry = { id, root: this.make(id) };
      this.scene.add(entry.root);
      map.set(jid, entry);
    }
    return entry.root;
  }

  private make(id: PropId): THREE.Object3D {
    const glb = cloneProp(id);
    if (glb) return glb;
    const color = ITEM_COLORS[id] ?? 0xffffff;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 });
    this.owned.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.propId = 'fallback';
    return mesh;
  }

  private placeActive(
    o: THREE.Object3D, id: PropId, j: Jelly, x: number, z: number, topY: number, bob: number, time: number,
  ): void {
    const y = topY + j.fallY;
    if (id === 'shield') {
      // 护盾罩住整只果冻：模型偏扁，竖向拉高到盖过果冻头顶，半透明露出身体
      if (!o.userData.bubble) {
        o.userData.bubble = true;
        o.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => { m.transparent = true; m.opacity = SHIELD_ALPHA; m.depthWrite = false; });
          mesh.castShadow = false;
        });
      }
      const p = 1 + Math.sin(time * 8) * 0.03;
      o.scale.set(j.radius * SHIELD_WIDE * p, j.radius * SHIELD_TALL * p, j.radius * SHIELD_WIDE * p);
      o.position.set(x, y, z);
      o.rotation.y = time * 0.6;
    } else if (id === 'rocket') {
      o.scale.setScalar(1);
      o.position.set(
        x - Math.cos(j.facing) * (j.radius + 0.55),
        y + j.radius * 0.6 + bob,
        z - Math.sin(j.facing) * (j.radius + 0.55),
      );
      o.rotation.y = -j.facing + Math.PI / 2;
    } else {
      // 能量星 / 磁力 / 被冻住：比手持图标更高、更大，并且转得快
      o.scale.setScalar(1);
      o.position.set(x, y + j.radius * 2.35 + bob, z);
      o.rotation.y = time * 4;
    }
  }

  /** 磁力生效时在地上画出吸附范围 */
  private syncRing(j: Jelly, x: number, z: number, topY: number, time: number): void {
    let ring = this.rings.get(j.id);
    const on = j.alive && j.magnet > 0;
    if (!on) {
      if (ring) ring.visible = false;
      return;
    }
    if (!ring) {
      const mat = new THREE.MeshBasicMaterial({
        color: ITEM_COLORS.magnet ?? 0xff5a5a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
      });
      this.owned.push(mat);
      ring = new THREE.Mesh(this.ringGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
      this.rings.set(j.id, ring);
    }
    ring.visible = true;
    ring.position.set(x, topY + 0.06, z);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(time * 6);
  }
}

/** 正在生效的效果（不看手里拿的） */
function activeProp(j: Jelly): PropId | null {
  if (j.shield > 0) return 'shield';
  if (j.rocket > 0) return 'rocket';
  if (j.star > 0) return 'star';
  if (j.magnet > 0) return 'magnet';
  if (j.freezeT > 0) return 'snow';
  return null;
}
