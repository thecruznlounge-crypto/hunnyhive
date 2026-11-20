/* ONEDRFUL service worker
   - Precaches the full app shell so the app opens with no connection.
   - Pages: network first, falls back to the cached shell, then offline.html.
   - Static files: cache first, refreshed in the background.
   - API GETs: network first, cached copy when offline. API writes are never cached
     (the app queues them in its outbox and resends when back online).
   Bump VERSION on every deploy so phones pick up the new files. */
const VERSION = '2.0.0';
const SHELL = 'onedrful-shell-' + VERSION;
const RUNTIME = 'onedrful-runtime-' + VERSION;
const DATA = 'onedrful-data';

const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './privacy.html',
  './terms.html',
  './delete-account.html',
  './manifest.webmanifest',
  './css/styles.css',
  './css/pages.css',
  './js/config.js',
  './js/qr.js',
  './js/data.js',
  './js/app.js',
  './assets/fonts/InterDisplay-ExtraBold.woff',
  './assets/onedrful-logo.svg',
  './assets/icons/icon.svg',
  './assets/icons/icon-96.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // cache: 'reload' bypasses the HTTP cache so a deploy never precaches stale files
      Promise.all(PRECACHE.map((url) =>
        fetch(new Request(url, { cache: 'reload' })).then((res) => { if (res.ok) return cache.put(url, res); })
      ))
    )
  );
  // Wait for the page to ask before activating, so an open session isn't swapped mid-use.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('onedrful-') && k !== SHELL && k !== RUNTIME && k !== DATA).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (e) {} }
    await self.clients.claim();
  })());
});

function isApi(url) {
  return url.pathname.includes('/api/') || url.hostname.startsWith('api.');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // writes go straight to the network
  const url = new URL(req.url);

  // Page navigations
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        const res = preload || await fetch(req);
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return res;
      } catch (e) {
        const cache = await caches.open(SHELL);
        return (await caches.match(req, { ignoreSearch: true })) ||
               (url.pathname.endsWith('.html') ? null : await cache.match('./index.html')) ||
               await cache.match('./offline.html');
      }
    })());
    return;
  }

  // API reads
  if (isApi(url)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(req, copy)); }
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // Only handle our own static files
  if (url.origin !== self.location.origin) return;

  // Static: cache first, update in background
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    return res || new Response('', { status: 504, statusText: 'Offline' });
  })());
});
