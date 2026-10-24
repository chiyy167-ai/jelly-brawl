/** 决斗场外观主题：只改天空 / 雾 / 灯光 / 地砖色，不改物理。 */
import type { MapId } from './types';

export interface MapTheme {
  id: MapId;
  name: string;
  skyClass: string;
  fog: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  base: number;
  islandRock: number;
  islandTop: number;
  tiles: number[];
}

export const MAPS: Record<MapId, MapTheme> = {
  candy: {
    id: 'candy',
    name: '糖果天空',
    skyClass: 'sky-candy',
    fog: 0xbfe4ff,
    hemiSky: 0xe6f6ff,
    hemiGround: 0x7a5fa8,
    sun: 0xffffff,
    base: 0x8c7fb0,
    islandRock: 0x9a86c4,
    islandTop: 0x7ddc6a,
    tiles: [0xff7eb6, 0x4fb8ff, 0xffd84a, 0x6fdc6a, 0xb07cff, 0xff9f4a],
  },
  volcano: {
    id: 'volcano',
    name: '火山熔岩',
    skyClass: 'sky-volcano',
    fog: 0x4a1810,
    hemiSky: 0xffc48a,
    hemiGround: 0x3a1018,
    sun: 0xffd0a0,
    base: 0x3a2428,
    islandRock: 0x4a3038,
    islandTop: 0xc45a28,
    tiles: [0xff4a2a, 0xff8a2a, 0xffd24a, 0x8a3030, 0xff6a3a, 0xc04020],
  },
};

export const MAP_IDS: MapId[] = ['candy', 'volcano'];

export function resolveMap(id: string | undefined | null): MapId {
  return id === 'volcano' ? 'volcano' : 'candy';
}

/** HUD / 开箱提示中文名 */
export const ITEM_NAMES: Record<string, string> = {
  rocket: '冲刺火箭',
  shield: '护盾',
  pad: '弹跳跳板',
  grow: '体型果块',
  magnet: '磁力糖果',
  banana: '香蕉皮',
  mine: '地雷',
  snow: '冰冻雪球',
  star: '能量星',
  glove: '拳击手套',
  cake: '美味蛋糕',
  box: '神秘道具箱',
};

/** 场上箱子 / 装置着色 */
export const ITEM_COLORS: Record<string, number> = {
  box: 0xffc83a,
  rocket: 0xff4a3a,
  shield: 0x4fb8ff,
  pad: 0xb07cff,
  grow: 0x6fdc6a,
  magnet: 0xff5a5a,
  banana: 0xffe14a,
  mine: 0x8a40c8,
  snow: 0xa8e8ff,
  star: 0xffd84a,
  glove: 0xff3a4a,
  cake: 0xff8fc1,
};

export const HAZARD_COLORS: Record<string, number> = {
  pad: 0xb07cff,
  banana: 0xffe14a,
  mine: 0x8a40c8,
};
