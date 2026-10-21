/**
 * 离线缓存：加载过一次之后，再打开直接从手机里读资源。
 * - assets/ 下的文件名带内容哈希，内容变了名字就变 → 缓存优先，永不过期
 * - 模型等固定名字的文件 → 先用缓存秒开，后台再悄悄更新
 * - 页面本身 → 先联网拿最新版（这样发布更新能马上看到），网络慢或断网时用缓存
 */
const CACHE = 'jb-app-v1';
const NAV_TIMEOUT_MS = 2500;
const scope = new URL(self.registration.scope);
const INDEX = new URL('./', scope).href;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 删掉旧版（原生 JS 版）在根目录留下的缓存
    const old = (await caches.keys()).filter((k) => k !== CACHE && k.startsWith('jelly-brawl-'));
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    // 旧版缓存里的页面可能还开着，刷新一次换成新版
    if (old.length) {
      const list = await self.clients.matchAll({ type: 'window' });
      list.forEach((c) => isOurs(new URL(c.url)) && c.navigate(c.url));
    }
  })());
});

/** 页面加载完把它用到的文件列表发过来，补进缓存（这些文件刚下载过，会直接从浏览器缓存里拿） */
self.addEventListener('message', (event) => {
  const urls = event.data && event.data.cache;
  if (!Array.isArray(urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of urls) {
      if (!isOurs(new URL(url))) continue;
      const key = url.startsWith(INDEX + '?') ? INDEX : url;
      if (await cache.match(key)) continue;
      try {
        const res = await fetch(url);
        if (res.ok) await put(cache, key, res);
      } catch {
        // 网络失败下次再补
      }
    }
  })());
});

/** 只管本站新版的文件；/legacy/ 旧版和联机服务器不碰 */
function isOurs(url) {
  return url.origin === scope.origin && url.href.startsWith(scope.href) && !url.pathname.includes('/legacy/');
}

/** 存入缓存；带哈希的文件更新后，把同名的旧版本删掉，避免越存越多 */
async function put(cache, key, res) {
  await cache.put(key, res);
  const m = /^(.*\/assets\/.+)-[\w-]{8}(\.\w+)$/.exec(key);
  if (!m) return;
  for (const req of await cache.keys()) {
    const u = req.url;
    if (u !== key && u.startsWith(m[1] + '-') && u.endsWith(m[2]) && u.length === key.length) await cache.delete(req);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!isOurs(url)) return;
  if (req.mode === 'navigate') event.respondWith(page(req));
  else if (url.pathname.includes('/assets/')) event.respondWith(cacheFirst(req));
  else event.respondWith(staleWhileRevalidate(req, event));
});

async function page(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(async (res) => {
    if (res.ok) await cache.put(INDEX, res.clone());
    return res;
  });
  const cached = await cache.match(INDEX);
  if (!cached) return net;
  // 有缓存时最多等网络 2.5 秒
  const timeout = new Promise((ok) => setTimeout(() => ok(null), NAV_TIMEOUT_MS));
  const res = await Promise.race([net.catch(() => null), timeout]);
  return res || cached;
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await put(cache, req.url, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(async (res) => {
    if (res.ok) await cache.put(req.url.split('?')[0], res.clone());
    return res;
  });
  if (hit) {
    event.waitUntil(net.catch(() => undefined));
    return hit;
  }
  return net;
}
