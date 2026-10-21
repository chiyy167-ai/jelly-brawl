/** 01 加载页：整张启动插画做背景，上面叠真实的加载进度和 3D 果冻小剧场，完成后自动进入大厅。 */
import { useEffect, useRef, useState } from 'react';
import bgUrl from '../assets/loading-bg.jpg';
import { loadAssets, loadPreviewJelly, type JellyTemplate, type LoadProgress } from '../game/assets';
import { LoadingJellies } from '../game/loadingJellies';
import { useApp } from '../state/AppState';
import { rememberLoadedFiles } from '../state/offlineCache';
import { hasLoadedBefore, markLoaded } from '../state/storage';

function waitForImage(src: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = img.onerror = done;
    img.src = src;
    window.setTimeout(done, timeoutMs);
  });
}

const TIPS = ['小心！被撞到会变小！', '吃果冻块可以变大，最多 3 级。', '按住冲撞键蓄力，松手冲出去！', '平台会缩小，别站在红圈外面！'];

export function LoadingPage() {
  const { dispatch } = useApp();
  const [p, setP] = useState<LoadProgress>({ ratio: 0, loadedBytes: 0, label: '正在加载资源...' });
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [firstTime] = useState(() => !hasLoadedBefore());
  const [preview, setPreview] = useState<JellyTemplate | null>(null);
  const [done, setDone] = useState(false);
  const stageHost = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLParagraphElement>(null);
  const stage = useRef<LoadingJellies | null>(null);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    setError(null);
    // 顺序：启动插画（最多等 4 秒）→ 低模果冻（失败就不演小剧场）→ 正式模型
    waitForImage(bgUrl, 4000)
      .then(() => loadPreviewJelly().then((tpl) => alive && setPreview(tpl), () => undefined))
      .then(() => loadAssets((next) => alive && setP(next)))
      .then(() => {
        if (!alive) return;
        markLoaded();
        rememberLoadedFiles();
        setDone(true);
        // 让玩家看一会儿庆祝再进入大厅
        timer = window.setTimeout(() => dispatch({ type: 'loaded' }), 1100);
      })
      .catch((e: Error) => alive && setError(e.message || '加载失败'));
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [attempt, dispatch]);

  useEffect(() => {
    if (!preview || !stageHost.current || !bubble.current) return;
    const s = new LoadingJellies(stageHost.current, bubble.current, preview);
    stage.current = s;
    return () => {
      s.dispose();
      stage.current = null;
    };
  }, [preview]);

  useEffect(() => {
    stage.current?.setProgress(p.ratio, p.label);
  }, [p, preview]);

  useEffect(() => {
    if (done) stage.current?.finish();
  }, [done, preview]);

  const pct = p.ratio === null ? null : Math.round(p.ratio * 100);
  return (
    <div className="page loading-page">
      {/* 插画按 16:9 铺满屏幕，进度条的位置以插画为基准，正好盖住图里原有的进度条 */}
      <div className="loading-art" role="img" aria-label="Jelly Brawl 果冻擂台">
        {error ? (
          <div className="loading-error">
            <span>资源加载失败：{error}</span>
            <button className="btn btn-yellow" onClick={() => setAttempt((a) => a + 1)}>重试</button>
          </div>
        ) : (
          <>
            <div className={`loading-bar ${pct === null ? 'progress-unknown' : ''}`}>
              <div className="progress-fill" style={{ width: `${pct ?? 100}%` }} />
            </div>
            <span className="progress-num">{pct === null ? `${(p.loadedBytes / 1048576).toFixed(1)}MB` : `${pct}%`}</span>
          </>
        )}
        {/* 3D 果冻小剧场；气泡跟着红果冻走，平时显示加载状态 */}
        <div className="loading-stage" ref={stageHost} hidden={!!error}>
          <p className={`loading-bubble ${preview ? '' : 'static'}`} ref={bubble}>{preview ? '' : p.label}</p>
        </div>
      </div>
      {!error && (firstTime ? (
        <p className="loading-tip first"><span aria-hidden>⏳</span>首次打开要下载约 2 MB 资源，可能稍慢，请耐心等待～下次打开会快很多</p>
      ) : (
        <p className="loading-tip"><span aria-hidden>💡</span>{tip}</p>
      ))}
    </div>
  );
}
