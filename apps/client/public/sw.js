/** 旧版在站点根目录注册过缓存优先的 Service Worker，会一直显示旧页面。这个文件替换它：清空缓存、注销自己、刷新页面。 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('jelly-brawl-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach((c) => c.navigate(c.url));
  })());
});
