/* Hejje service worker — makes the app work fully offline.
   Everything the app needs is precached on first visit; afterwards requests are
   served from the cache instantly and refreshed in the background. */
const VERSION = 'hejje-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/data/india.js',
  'js/data/world.js',
  'fonts/fraunces-latin-opsz-normal.woff2',
  'fonts/fraunces-latin-wght-italic.woff2',
  'fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  'fonts/TwemojiCountryFlags.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate';
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(isPage ? 'index.html' : req, { ignoreSearch: isPage });
    const network = fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(isPage ? 'index.html' : req, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(network); // stale-while-revalidate
      return cached;
    }
    const res = await network;
    return res || new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
