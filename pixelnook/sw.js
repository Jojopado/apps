// PixelNook 離線快取：有網路時先拿最新版（3 秒內），沒網路時用快取；雲端資料（Firebase）不經過快取
const CACHE = 'pixelnook-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './js/raster.js', './js/models.js', './js/scene.js', './js/sfx.js', './js/quests.js', './js/explore.js', './js/world.js',
  './js/cafejob.js', './js/jobs2.js', './js/cloud.js', './js/game.js', './js/art/city.js', './js/art/cafe.js', './js/art/park.js', './js/art/shops.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // 雲端資料直接走網路
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const net = await Promise.race([fetch(e.request), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
      if (net && net.ok) cache.put(e.request, net.clone());
      return net;
    } catch (err) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
