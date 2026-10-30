/**
 * 换装数据：眼睛 / 嘴巴 / 头上道具，以及 10 套预设。
 * 首版用程序化几何体占位；以后可换成 public/models/cosmetics/*.glb。
 */
export type EyeId =
  | 'round' | 'big' | 'angry' | 'sleepy' | 'star' | 'cat' | 'cool' | 'square' | 'sparkle' | 'wink';
export type MouthId =
  | 'smile' | 'grin' | 'smirk' | 'frown' | 'open' | 'ooh' | 'cat' | 'flat' | 'tongue' | 'shy';
/** 头上装饰（与局内道具 ItemKind 无关） */
export type GearId =
  | 'none' | 'crown' | 'sprout' | 'glasses' | 'wizard' | 'star' | 'tophat' | 'cat' | 'horn' | 'bow' | 'antenna' | 'nightcap';

export interface CosmeticPart<T extends string> {
  id: T;
  name: string;
}

export interface Outfit {
  id: string;
  name: string;
  desc: string;
  eye: EyeId;
  mouth: MouthId;
  gear: GearId;
}

export interface CosmeticLook {
  eye: EyeId;
  mouth: MouthId;
  gear: GearId;
}

export const EYES: CosmeticPart<EyeId>[] = [
  { id: 'round', name: '圆眼睛' },
  { id: 'big', name: '水汪汪' },
  { id: 'angry', name: '怒目' },
  { id: 'sleepy', name: '眯眯眼' },
  { id: 'star', name: '星星眼' },
  { id: 'cat', name: '猫瞳' },
  { id: 'cool', name: '墨镜眼' },
  { id: 'square', name: '方块眼' },
  { id: 'sparkle', name: '闪闪眼' },
  { id: 'wink', name: '眨眼' },
];

export const MOUTHS: CosmeticPart<MouthId>[] = [
  { id: 'smile', name: '微笑' },
  { id: 'grin', name: '大笑' },
  { id: 'smirk', name: '坏笑' },
  { id: 'frown', name: '嘟嘴' },
  { id: 'open', name: '张嘴' },
  { id: 'ooh', name: '惊讶' },
  { id: 'cat', name: '猫嘴' },
  { id: 'flat', name: '一字嘴' },
  { id: 'tongue', name: '吐舌' },
  { id: 'shy', name: '害羞' },
];

export const GEARS: CosmeticPart<GearId>[] = [
  { id: 'none', name: '无' },
  { id: 'crown', name: '王冠' },
  { id: 'sprout', name: '小芽' },
  { id: 'glasses', name: '墨镜' },
  { id: 'wizard', name: '巫师帽' },
  { id: 'star', name: '星星' },
  { id: 'tophat', name: '礼帽' },
  { id: 'cat', name: '猫耳' },
  { id: 'horn', name: '独角' },
  { id: 'bow', name: '蝴蝶结' },
  { id: 'antenna', name: '天线' },
  { id: 'nightcap', name: '睡帽' },
];

/** 10 套完整换装预设 */
export const OUTFITS: Outfit[] = [
  { id: 'classic', name: '经典脸', desc: '圆眼微笑，干干净净。', eye: 'round', mouth: 'smile', gear: 'none' },
  { id: 'cool', name: '酷盖', desc: '墨镜一戴，谁也不怕。', eye: 'cool', mouth: 'smirk', gear: 'none' },
  { id: 'rage', name: '暴脾气', desc: '怒目 + 角，冲锋专用。', eye: 'angry', mouth: 'frown', gear: 'horn' },
  { id: 'sweet', name: '甜甜圈', desc: '水汪汪大眼和蝴蝶结。', eye: 'big', mouth: 'open', gear: 'bow' },
  { id: 'sleepy', name: '瞌睡虫', desc: '眯眼打哈欠，头上睡帽。', eye: 'sleepy', mouth: 'ooh', gear: 'nightcap' },
  { id: 'starry', name: '星空仔', desc: '星星眼，闪闪发光。', eye: 'star', mouth: 'grin', gear: 'star' },
  { id: 'kitty', name: '喵喵脸', desc: '猫瞳猫嘴配猫耳。', eye: 'cat', mouth: 'cat', gear: 'cat' },
  { id: 'mage', name: '小法师', desc: '惊讶脸 + 巫师帽。', eye: 'sparkle', mouth: 'ooh', gear: 'wizard' },
  { id: 'bot', name: '小机器人', desc: '方块眼一字嘴，头顶天线。', eye: 'square', mouth: 'flat', gear: 'antenna' },
  { id: 'royal', name: '果冻王', desc: '闪闪眼微笑，戴上王冠。', eye: 'sparkle', mouth: 'smile', gear: 'crown' },
];

export const DEFAULT_LOOK: CosmeticLook = { eye: 'round', mouth: 'smile', gear: 'none' };

export function getOutfit(id: string): Outfit {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
}

export function lookFromOutfit(id: string): CosmeticLook {
  const o = getOutfit(id);
  return { eye: o.eye, mouth: o.mouth, gear: o.gear };
}

export function cleanLook(raw: Partial<CosmeticLook> | undefined | null): CosmeticLook {
  const eye = EYES.some((e) => e.id === raw?.eye) ? raw!.eye! : DEFAULT_LOOK.eye;
  const mouth = MOUTHS.some((m) => m.id === raw?.mouth) ? raw!.mouth! : DEFAULT_LOOK.mouth;
  const gear = GEARS.some((p) => p.id === raw?.gear) ? raw!.gear! : DEFAULT_LOOK.gear;
  return { eye, mouth, gear };
}

export function lookKey(look: CosmeticLook): string {
  return `${look.mouth}:${look.gear}`;
}
