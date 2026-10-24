/** 右侧技能键：有手持道具时点一下释放。 */
import type { InputSource } from '../game/input';

export function SkillButton({ input, name }: { input: InputSource; name: string }) {
  return (
    <button
      type="button"
      className="skill-btn"
      onPointerDown={(e) => {
        e.preventDefault();
        input.useQueued = true;
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`释放${name}`}
    >
      <b>释放</b>
      <span>{name}</span>
    </button>
  );
}
