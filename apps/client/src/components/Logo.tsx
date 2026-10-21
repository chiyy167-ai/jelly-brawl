/** 游戏 Logo：黄色描边大字 + 皇冠 + 蓝色中文副标题（用 CSS 还原，不用截图）。 */
export function Logo({ size = 'big' }: { size?: 'big' | 'small' }) {
  return (
    <div className={`logo logo-${size}`} aria-label="Jelly Brawl 果冻擂台">
      <span className="logo-crown" aria-hidden>👑</span>
      <span className="logo-en">Jelly·Brawl</span>
      <span className="logo-cn">果冻擂台</span>
    </div>
  );
}
