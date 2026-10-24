/** 战斗里道具 glb 的放置与兜底几何体。 */
import * as THREE from 'three';
import { GAME } from './config';
import { HAZARD_COLORS, ITEM_COLORS } from './maps';
import { cloneProp, hazardPropId, propsReady, type PropId } from './propModels';
import type { Jelly, MatchState } from './types';

export class BattlePropLayer {
  private boxes: THREE.Object3D[] = [];
  private hazards: THREE.Object3D[] = [];
  private buffs = new Map<number, { id: PropId; root: THREE.Object3D }>();
  private pudMeshes: THREE.Mesh[] = [];
  private pudGeo = new THREE.SphereGeometry(GAME.ghost.puddingRadius, 14, 10);
  private owned: { dispose(): void }[] = [this.pudGeo];

  constructor(private scene: THREE.Scene) {}

  update(s: MatchState, time: number, topY: number): void {
    this.syncBoxes(s, time, topY);
    this.syncHazards(s, time, topY);
    this.syncBuffs(s, time, topY);
    this.syncPuds(s, topY);
  }

  dispose(): void {
    for (const o of [...this.boxes, ...this.hazards]) this.scene.remove(o);
    for (const b of this.buffs.values()) this.scene.remove(b.root);
    this.buffs.clear();
    this.pudMeshes.forEach((m) => this.scene.remove(m));
    this.owned.forEach((o) => o.dispose());
  }

  private ensure(pool: THREE.Object3D[], n: number, make: () => THREE.Object3D): void {
    while (pool.length < n) {
      const o = make();
      this.scene.add(o);
      pool.push(o);
    }
    pool.forEach((o, i) => { o.visible = i < n; });
  }

  private makeProp(id: PropId, fallbackColor: number): THREE.Object3D {
    const glb = cloneProp(id);
    if (glb) {
      glb.userData.propId = id;
      return glb;
    }
    const geo = new THREE.BoxGeometry(1.35, 1.35, 1.35);
    const mat = new THREE.MeshStandardMaterial({
      color: fallbackColor, emissive: fallbackColor, emissiveIntensity: 0.7, roughness: 0.35,
    });
    this.owned.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.userData.propId = 'fallback';
    mesh.userData.want = id;
    return mesh;
  }

  /** 模型后到时，把占位方块换成 glb。 */
  private upgrade(pool: THREE.Object3D[], index: number, id: PropId, color: number): THREE.Object3D {
    const cur = pool[index];
    if (cur.userData.propId === id || !propsReady()) return cur;
    const next = cloneProp(id);
    if (!next) return cur;
    this.scene.remove(cur);
    next.userData.propId = id;
    this.scene.add(next);
    pool[index] = next;
    void color;
    return next;
  }

  private syncBoxes(s: MatchState, time: number, topY: number): void {
    const list = s.candies.filter((c) => c.alive);
    this.ensure(this.boxes, list.length, () => this.makeProp('box', ITEM_COLORS.box));
    list.forEach((c, i) => {
      const o = this.upgrade(this.boxes, i, 'box', ITEM_COLORS.box);
      const bob = Math.sin(time * 4 + i) * 0.16;
      o.position.set(c.x, topY + bob + (1 - c.t) * 3.5, c.y);
      o.rotation.y = time * 1.2 + i;
    });
  }

  private syncHazards(s: MatchState, time: number, topY: number): void {
    this.ensure(this.hazards, s.hazards.length, () => this.makeProp('banana', HAZARD_COLORS.banana));
    s.hazards.forEach((h, i) => {
      const want = hazardPropId(h.kind);
      const o = this.upgrade(this.hazards, i, want, HAZARD_COLORS[h.kind] ?? 0xffffff);
      o.visible = true;
      o.position.set(h.x, topY, h.y);
      o.rotation.y = h.kind === 'mine' ? time * 2 : 0;
    });
    for (let i = s.hazards.length; i < this.hazards.length; i += 1) this.hazards[i].visible = false;
  }

  private syncBuffs(s: MatchState, time: number, topY: number): void {
    const live = new Set<number>();
    for (const j of s.jellies) {
      const id = buffProp(j);
      if (!id || !j.alive) {
        const old = this.buffs.get(j.id);
        if (old) {
          this.scene.remove(old.root);
          this.buffs.delete(j.id);
        }
        continue;
      }
      live.add(j.id);
      let entry = this.buffs.get(j.id);
      const stale = entry && entry.id === id && entry.root.userData.propId !== id && propsReady();
      if (!entry || entry.id !== id || stale) {
        if (entry) this.scene.remove(entry.root);
        const root = this.makeProp(id, ITEM_COLORS[id] ?? 0xffffff);
        this.scene.add(root);
        entry = { id, root };
        this.buffs.set(j.id, entry);
      }
      const bob = Math.sin(time * 5 + j.id) * 0.12;
      const x = j.prevX + (j.x - j.prevX) * 0.5;
      const z = j.prevY + (j.y - j.prevY) * 0.5;
      if (id === 'shield') {
        entry.root.position.set(x, topY + j.fallY, z);
      } else if (id === 'rocket') {
        entry.root.position.set(
          x - Math.cos(j.facing) * (j.radius + 0.55),
          topY + j.fallY + j.radius * 0.6 + bob,
          z - Math.sin(j.facing) * (j.radius + 0.55),
        );
        entry.root.rotation.y = -j.facing + Math.PI / 2;
      } else {
        entry.root.position.set(x, topY + j.fallY + j.radius * 1.6 + bob, z);
        entry.root.rotation.y = time * 2;
      }
    }
    for (const id of [...this.buffs.keys()]) {
      if (live.has(id)) continue;
      const e = this.buffs.get(id)!;
      this.scene.remove(e.root);
      this.buffs.delete(id);
    }
  }

  private syncPuds(s: MatchState, topY: number): void {
    const puds = s.puddings.filter((p) => p.alive);
    while (this.pudMeshes.length < puds.length) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffc86b, transparent: true, opacity: 0.85, roughness: 0.35 });
      const mesh = new THREE.Mesh(this.pudGeo, mat);
      this.scene.add(mesh);
      this.pudMeshes.push(mesh);
      this.owned.push(mat);
    }
    this.pudMeshes.forEach((m, i) => {
      m.visible = i < puds.length;
      if (i >= puds.length) return;
      const p = puds[i];
      m.position.set(p.prevX + (p.x - p.prevX) * 0.5, topY + 0.55, p.prevY + (p.y - p.prevY) * 0.5);
    });
  }
}

function buffProp(j: Jelly): PropId | null {
  if (j.item) return j.item;
  if (j.shield > 0) return 'shield';
  if (j.rocket > 0) return 'rocket';
  if (j.star > 0) return 'star';
  if (j.magnet > 0) return 'magnet';
  if (j.freezeT > 0) return 'snow';
  return null;
}
