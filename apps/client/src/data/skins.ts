/** 首版静态皮肤数据。全部基于同一个红色果冻模型，通过换色 + 小配件区分。 */
export type SkinRarity = 'normal' | 'rare' | 'epic' | 'legend';
export type Accessory = 'none' | 'crown' | 'sprout' | 'glasses' | 'wizard' | 'star' | 'tophat' | 'cat' | 'horn';

export interface Skin {
  id: string;
  name: string;
  desc: string;
  rarity: SkinRarity;
  /** 色相偏移（度），0 = 原模型的红色 */
  hue: number;
  /** 饱和度倍率 */
  sat: number;
  /** 亮度倍率 */
  bright: number;
  accessory: Accessory;
  /** UI 里用的主色（按钮、名牌等） */
  color: string;
}

export const RARITY_LABEL: Record<SkinRarity, string> = {
  normal: '普通',
  rare: '稀有',
  epic: '史诗',
  legend: '传说',
};

export const SKINS: Skin[] = [
  { id: 'classic', name: '经典红果冻', desc: '擂台上最常见的倔强小红！', rarity: 'normal', hue: 0, sat: 1, bright: 1, accessory: 'none', color: '#ff4f7b' },
  { id: 'crown', name: '王冠果冻', desc: '我是擂台上最靓的仔！', rarity: 'legend', hue: -12, sat: 0.9, bright: 1.1, accessory: 'crown', color: '#ff6fa8' },
  { id: 'blue', name: '蓝莓果冻', desc: '软软弹弹，冲起来超快。', rarity: 'normal', hue: 205, sat: 1, bright: 1.05, accessory: 'none', color: '#2ea8ff' },
  { id: 'sprout', name: '青芽果冻', desc: '头上的小芽是它的天线。', rarity: 'normal', hue: 115, sat: 0.95, bright: 1.05, accessory: 'sprout', color: '#5fd35a' },
  { id: 'cool', name: '墨镜柠檬', desc: '戴上墨镜，谁也不怕。', rarity: 'rare', hue: 52, sat: 1, bright: 1.25, accessory: 'glasses', color: '#ffd23a' },
  { id: 'wizard', name: '魔法葡萄', desc: '据说会一点点魔法。', rarity: 'epic', hue: 268, sat: 0.95, bright: 1, accessory: 'wizard', color: '#9b5cff' },
  { id: 'star', name: '夜空果冻', desc: '眼睛里藏着一颗星星。', rarity: 'epic', hue: 0, sat: 0.08, bright: 0.32, accessory: 'star', color: '#3a3446' },
  { id: 'snow', name: '雪人果冻', desc: '冷静、冷静，再冷静。', rarity: 'legend', hue: 200, sat: 0.12, bright: 1.45, accessory: 'tophat', color: '#e9f3ff' },
  { id: 'cat', name: '猫耳草莓', desc: '喵！撞你一下。', rarity: 'rare', hue: 4, sat: 1.15, bright: 1, accessory: 'cat', color: '#ff3d55' },
  { id: 'unicorn', name: '独角兽果冻', desc: '梦幻又能打的传说果冻。', rarity: 'legend', hue: 300, sat: 0.25, bright: 1.4, accessory: 'horn', color: '#f6e9ff' },
];

export const DEFAULT_SKIN = 'classic';

/** 电脑对手按顺序使用的皮肤 */
export const BOT_SKINS = ['blue', 'cool', 'sprout', 'wizard', 'cat', 'star'];

export function getSkin(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
