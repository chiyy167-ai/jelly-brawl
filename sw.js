/** 改 CACHE 这一行即可让旧缓存失效。 */
const CACHE = 'jelly-brawl-v1';
const ASSETS = [
  './', './index.html', './manifest.json', './icons/icon.svg', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-maskable.png', './icons/apple-touch-icon.png',
  './src/main.js', './src/game.js', './src/physics.js', './src/input.js', './src/render.js',
  './src/net.js', './src/events.js', './src/items.js', './src/ui.js', './src/audio.js',
  './src/rng.js', './src/config.js', './src/ai.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
