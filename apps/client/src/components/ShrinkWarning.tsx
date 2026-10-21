/** 04 缩圈警告：战斗页内的动态提示（红色横幅 + 倒计时 + 屏幕边缘红光）。 */
export function ShrinkWarning({ secondsLeft }: { secondsLeft: number | null }) {
  if (secondsLeft === null) return null;
  return (
    <>
      <div className="danger-vignette" aria-hidden />
      <div className="shrink-banner" role="alert">
        <span className="shrink-icon">!</span>
        <span>平台即将缩小！</span>
        <b key={secondsLeft} className="shrink-count">{secondsLeft}</b>
      </div>
    </>
  );
}
