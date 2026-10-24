/** 3D 擂台：六边形彩色地砖、石头底座、缩圈红色警戒圈、远处浮空岛。 */
import * as THREE from 'three';
import { buildMapDecor, tickDecor, type DecorBundle } from './arenaDecor';
import { GAME } from './config';
import { MAPS, type MapTheme } from './maps';
import { makeRng } from './rng';
import type { MapId, MatchState } from './types';

const DANGER = new THREE.Color(0xff2a3a);

interface Tile {
  x: number;
  z: number;
  dist: number;
  color: THREE.Color;
  fallY: number;
  fallV: number;
  spin: number;
  gone: boolean;
}

export class Arena {
  readonly group = new THREE.Group();
  private tiles: Tile[] = [];
  private tileMesh: THREE.InstancedMesh;
  private base: THREE.Mesh;
  private ring: THREE.Mesh;
  private wall: THREE.Mesh;
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();
  private owned: { dispose(): void }[] = [];
  private decor: DecorBundle;

  constructor(seed: number, mapId: MapId = 'candy') {
    const theme: MapTheme = MAPS[mapId] ?? MAPS.candy;
    const R = GAME.tile.radius;
    const H = GAME.tile.height;
    // 尖顶六边形网格（CylinderGeometry 6 段的尖角朝 +Z）
    const max = GAME.platform.maxRadius;
    const n = Math.ceil(max / R) + 1;
    const rng = makeRng(seed ^ 0x9e3779b9);
    for (let q = -n; q <= n; q += 1) {
      for (let r = -n; r <= n; r += 1) {
        const x = R * Math.sqrt(3) * (q + r / 2);
        const z = R * 1.5 * r;
        const dist = Math.hypot(x, z);
        if (dist > max - R * 0.2) continue;
        const color = new THREE.Color(theme.tiles[rng.int(theme.tiles.length)]);
        this.tiles.push({ x, z, dist, color, fallY: 0, fallV: 0, spin: rng.next() - 0.5, gone: false });
      }
    }
    const tileGeo = new THREE.CylinderGeometry(R * 0.94, R * 0.9, H, 6);
    const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 });
    this.tileMesh = new THREE.InstancedMesh(tileGeo, tileMat, this.tiles.length);
    this.tileMesh.receiveShadow = true;
    this.tileMesh.castShadow = true;
    this.tiles.forEach((t, i) => this.tileMesh.setColorAt(i, t.color));
    this.group.add(this.tileMesh);

    // 石头底座：随平台半径缩放，边缘就是真实的淘汰边界
    const baseGeo = new THREE.CylinderGeometry(1, 0.82, 3.2, 48);
    const baseMat = new THREE.MeshStandardMaterial({ color: theme.base, roughness: 0.85 });
    this.base = new THREE.Mesh(baseGeo, baseMat);
    this.base.position.y = -H / 2 - 1.6 + 0.05;
    this.base.receiveShadow = true;
    this.group.add(this.base);

    // 缩圈警戒：地面红圈 + 半透明红色光墙
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff1f35, transparent: true, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022, 8, 128), ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = H / 2 + 0.05;
    this.group.add(this.ring);
    const wallMat = new THREE.MeshBasicMaterial({
      map: gradientTexture(), color: 0xff2a40, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 96, 1, true), wallMat);
    this.wall.position.y = H / 2 + 0.7;
    this.group.add(this.wall);

    this.addIslands(seed, theme, mapId);
    this.decor = buildMapDecor(mapId, seed, theme);
    this.group.add(this.decor.group);
    this.owned.push(
      tileGeo, tileMat, baseGeo, baseMat, ringMat, this.ring.geometry, wallMat, wallMat.map!, this.wall.geometry,
      ...this.decor.owned,
    );
  }

  private addIslands(seed: number, theme: MapTheme, mapId: MapId): void {
    const rock = new THREE.MeshStandardMaterial({ color: theme.islandRock, roughness: 0.9 });
    const grass = new THREE.MeshStandardMaterial({ color: theme.islandTop, roughness: 0.7 });
    const rockGeo = new THREE.CylinderGeometry(1, 0.6, 1, 7);
    const grassGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.25, 7);
    const rng = makeRng(seed + 7);
    for (let i = 0; i < 11; i += 1) {
      const a = (i / 11) * Math.PI * 2 + rng.next() * 0.5;
      // 火山图留出正后方空档，避免挡主火山口
      if (mapId === 'volcano') {
        const nz = Math.sin(a);
        if (nz < -0.35) continue;
      }
      const d = 21 + rng.range(0, 9);
      const s = rng.range(1.4, 3.4);
      const tall = rng.range(2, 8);
      const y = -3 - rng.range(0, 8);
      const pillar = new THREE.Mesh(rockGeo, rock);
      pillar.scale.set(s, tall, s);
      pillar.position.set(Math.cos(a) * d, y, Math.sin(a) * d - 4);
      const top = new THREE.Mesh(grassGeo, grass);
      top.scale.set(s, 1, s);
      top.position.set(pillar.position.x, y + tall / 2 + 0.1, pillar.position.z);
      this.group.add(pillar, top);
    }
    this.owned.push(rock, grass, rockGeo, grassGeo);
  }

  /** 每帧根据对局状态更新：掉落地砖、危险闪烁、警戒圈、地标动画。 */
  update(s: MatchState, dt: number, time: number): void {
    tickDecor(this.decor, time);
    const R = GAME.tile.radius;
    const warn = s.warn;
    const flash = 0.5 + 0.5 * Math.sin(time * 14);
    let colorDirty = false;
    this.tiles.forEach((t, i) => {
      if (t.gone) return;
      const falling = t.dist - R * 0.35 > s.platformRadius;
      if (falling) {
        t.fallV -= 22 * dt;
        t.fallY += t.fallV * dt;
        if (t.fallY < -40) t.gone = true;
      }
      const danger = !falling && warn && t.dist - R * 0.35 > warn.targetRadius;
      this.tmpColor.copy(t.color);
      if (danger) this.tmpColor.lerp(DANGER, 0.35 + 0.5 * flash);
      if (danger || falling) colorDirty = true;
      this.tileMesh.setColorAt(i, this.tmpColor);
      this.dummy.position.set(t.x, t.gone ? -999 : t.fallY, t.z);
      this.dummy.rotation.set(t.fallY * 0.04 * t.spin, 0, t.fallY * 0.05 * t.spin);
      this.dummy.updateMatrix();
      this.tileMesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.tileMesh.instanceMatrix.needsUpdate = true;
    if (this.tileMesh.instanceColor && (colorDirty || warn === null)) this.tileMesh.instanceColor.needsUpdate = true;

    const r = s.platformRadius;
    this.base.scale.set(r, 1, r);
    const show = warn !== null;
    this.ring.visible = this.wall.visible = show;
    if (warn) {
      const tr = warn.targetRadius;
      this.ring.scale.set(tr, tr, 1);
      this.wall.scale.set(tr, 1, tr);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * flash;
      (this.wall.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.35 * flash;
    }
  }

  dispose(): void {
    this.owned.forEach((o) => o.dispose());
    this.tileMesh.dispose();
  }
}

/** 从下到上逐渐透明的竖向渐变，用于光墙 */
function gradientTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}
