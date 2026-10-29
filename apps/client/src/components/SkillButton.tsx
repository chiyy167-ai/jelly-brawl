/** 右侧技能键：有手持道具时点一下释放；SVG 图标 + 名称。 */
import type { InputSource } from '../game/input';
import { itemName, itemTip } from '../game/itemCatalog';
import type { ItemKind } from '../game/types';
import { ItemIcon } from './itemIcons';

export function SkillButton({
  input, name, kind,
}: {
  input: InputSource;
  name: string;
  kind?: ItemKind | null;
}) {
  const label = kind ? itemName(kind) : name;
  const tip = kind ? itemTip(kind) : '';
  return (
    <button
      type="button"
      className="skill-btn"
      title={tip || label}
      onPointerDown={(e) => {
        e.preventDefault();
        input.useQueued = true;
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`释放${label}`}
    >
      {kind ? <ItemIcon kind={kind} size={30} className="skill-ico" /> : <span className="skill-emoji">✨</span>}
      <b>释放 E</b>
      <span className="skill-name">{label}</span>
    </button>
  );
}
