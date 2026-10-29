/** 横屏提示：游戏默认横屏，手机竖屏打开时提示一次，可一键切横屏（不支持的浏览器改为提示手动旋转）。 */
import { useEffect, useState } from 'react';

const PORTRAIT_PHONE = '(orientation: portrait) and (pointer: coarse)';

// 微信 / QQ 等 App 内置浏览器，以及 iPhone Safari，都不能可靠地锁横屏
const IN_APP = /MicroMessenger|QQ\/|WeiBo|DingTalk|AlipayClient/i.test(navigator.userAgent);
const IS_WECHAT = /MicroMessenger/i.test(navigator.userAgent);
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };

async function goLandscape(): Promise<boolean> {
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (!orientation?.lock) return false;
  let enteredFullscreen = false;
  try {
    // 大多数安卓浏览器要求先全屏才允许锁定方向
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      enteredFullscreen = true;
    }
    await orientation.lock('landscape');
    return true;
  } catch {
    if (enteredFullscreen) await document.exitFullscreen().catch(() => undefined);
    return false;
  }
}

export function RotateHint() {
  // 只在打开页面时判断一次
  const [open, setOpen] = useState(() => window.matchMedia(PORTRAIT_PHONE).matches);
  const [manual, setManual] = useState(IN_APP || IOS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(orientation: landscape)');
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open]);

  if (!open) return null;

  const rotate = async () => {
    setBusy(true);
    const ok = await goLandscape();
    setBusy(false);
    if (ok) setOpen(false);
    else setManual(true);
  };

  return (
    <div className="modal-mask rotate-mask" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
      <div className="rotate-card">
        <div className="rotate-phone" aria-hidden>
          <span />
        </div>
        <h2 id="rotate-title">横屏体验更好！</h2>
        <p>果冻擂台是横屏游戏，横过来视野更大、操作更顺手。</p>
        {manual && (
          <p className="rotate-manual">
            {IS_WECHAT
              ? '微信里不能自动切换横屏。请关闭手机的“竖排方向锁定”，然后把手机横过来；也可以点右上角「…」选择用浏览器打开。'
              : '当前浏览器不支持自动切换（如 iPhone Safari），请关闭手机的“竖排方向锁定”，然后把手机横过来。'}
          </p>
        )}
        {IN_APP || IOS ? (
          <button className="btn btn-yellow btn-big" onClick={() => setOpen(false)}>知道了</button>
        ) : (
          <button className="btn btn-yellow btn-big" onClick={rotate} disabled={busy}>
            {manual ? '再试一次' : '切换横屏'}
          </button>
        )}
        {!(IN_APP || IOS) && <button className="rotate-skip" onClick={() => setOpen(false)}>继续竖屏玩</button>}
      </div>
    </div>
  );
}
