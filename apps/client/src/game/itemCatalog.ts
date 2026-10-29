/** 道具图鉴 / 商城 / HUD 共用：名称、说明、售价与强度档位。 */
import type { ItemKind } from './types';

export type ItemTier = 'C' | 'B' | 'A' | 'S';
export type ShopCurrency = 'coins' | 'gems';

export interface ItemDef {
  id: ItemKind;
  name: string;
  emoji: string;
  /** 局内短提示 */
  tip: string;
  /** 图鉴完整说明 */
  desc: string;
  tier: ItemTier;
  currency: ShopCurrency;
  price: number;
  color: number;
}

/**
 * 强度与售价对应关系（数值已在 config 里下调）：
 * C/B 金币常见；A 偏贵金币；S 仅宝石，开局携带会明显占优。
 */
export const ITEM_DEFS: ItemDef[] = [
  {
    id: 'grow', name: '体型果块', emoji: '🍇', tip: '立刻升 1 级体型',
    desc: '立刻升 1 个体型等级（已满无效）。适合开局抢先变大。',
    tier: 'B', currency: 'coins', price: 45, color: 0x6fdc6a,
  },
  {
    id: 'cake', name: '美味蛋糕', emoji: '🎂', tip: '立刻升 1 级体型',
    desc: '立刻升 1 个体型等级（已满无效）。效果与果块相同，外观不同。',
    tier: 'B', currency: 'coins', price: 50, color: 0xff8fc1,
  },
  {
    id: 'magnet', name: '磁力糖果', emoji: '🧲', tip: '短时吸附附近果冻块',
    desc: '约 4 秒内把周围的果冻块吸向自己，方便升级。',
    tier: 'C', currency: 'coins', price: 30, color: 0xff5a5a,
  },
  {
    id: 'banana', name: '香蕉皮', emoji: '🍌', tip: '脚下陷阱，踩到会滑倒',
    desc: '放在脚下。对手踩到会短暂失控打滑。',
    tier: 'C', currency: 'coins', price: 35, color: 0xffe14a,
  },
  {
    id: 'pad', name: '弹跳跳板', emoji: '🟣', tip: '脚下跳板，踩上弹起躲撞',
    desc: '放在脚下。踩上会弹起一小段，离地时不参与碰撞。',
    tier: 'B', currency: 'coins', price: 40, color: 0xb07cff,
  },
  {
    id: 'shield', name: '护盾', emoji: '🛡️', tip: '短时减免击飞与降级',
    desc: '约 2.6 秒护盾，减轻被撞飞和重击降级。',
    tier: 'A', currency: 'coins', price: 55, color: 0x4fb8ff,
  },
  {
    id: 'star', name: '能量星', emoji: '⭐', tip: '短时加速并加强撞击',
    desc: '约 3 秒移速与撞击提升。强势但持续时间短。',
    tier: 'A', currency: 'coins', price: 70, color: 0xffd84a,
  },
  {
    id: 'rocket', name: '冲刺火箭', emoji: '🚀', tip: '高速直线冲刺（宝石）',
    desc: '约 1.6 秒高速冲刺，转向变钝。容易冲出平台，谨慎使用。',
    tier: 'S', currency: 'gems', price: 2, color: 0xff4a3a,
  },
  {
    id: 'glove', name: '拳击手套', emoji: '🥊', tip: '下一次冲刺击退增强（宝石）',
    desc: '武装后，下一次蓄力冲刺的击退大幅增强。',
    tier: 'S', currency: 'gems', price: 3, color: 0xff3a4a,
  },
  {
    id: 'snow', name: '冰冻雪球', emoji: '❄️', tip: '下一次冲刺冻结对手（宝石）',
    desc: '武装后，下一次冲刺命中会短暂冻结对方。',
    tier: 'S', currency: 'gems', price: 3, color: 0xa8e8ff,
  },
  {
    id: 'mine', name: '地雷', emoji: '💣', tip: '脚下爆炸陷阱（宝石）',
    desc: '放在脚下。踩到会爆炸并击退附近果冻，威力大但容易误伤节奏。',
    tier: 'S', currency: 'gems', price: 4, color: 0x8a40c8,
  },
];

export const ITEM_BY_ID: Record<ItemKind, ItemDef> = Object.fromEntries(
  ITEM_DEFS.map((d) => [d.id, d]),
) as Record<ItemKind, ItemDef>;

export function itemName(id: string): string {
  return ITEM_BY_ID[id as ItemKind]?.name ?? id;
}

export function itemEmoji(id: string): string {
  return ITEM_BY_ID[id as ItemKind]?.emoji ?? '❓';
}

export function itemTip(id: string): string {
  return ITEM_BY_ID[id as ItemKind]?.tip ?? '';
}

export function itemColor(id: string): number {
  return ITEM_BY_ID[id as ItemKind]?.color ?? 0xffffff;
}

export const TIER_LABEL: Record<ItemTier, string> = {
  C: '普通', B: '精良', A: '稀有', S: '传说',
};
