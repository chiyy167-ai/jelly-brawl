/** 离线缓存（Service Worker）：只在正式构建里启用，开发时不注册，免得影响热更新。 */

export function registerOfflineCache(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}

/** 加载完成后，把这次下载过的文件交给 Service Worker 存起来，下次打开直接用 */
export function rememberLoadedFiles(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const urls = [
    location.href,
    ...performance.getEntriesByType('resource').map((e) => e.name),
  ].filter((u) => u.startsWith(location.origin));
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ cache: urls }))
    .catch(() => undefined);
}
