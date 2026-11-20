/* Merkuri service worker — offline-first */
const VERSION = 'merkuri-v2.0.2';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './privacy.html',
  './terms.html',
  './img/logo-emblem.png',
  './img/hero-rider.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-48.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('merkuri-') && k !== VERSION).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // external (e.g. maps) goes straight to network

  // Pages: network first (fresh when online), cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const pre = await e.preloadResponse;
        const res = pre || await fetch(req);
        const c = await caches.open(VERSION); c.put(req, res.clone());
        return res;
      } catch {
        const c = await caches.open(VERSION);
        return (await c.match(req, {ignoreSearch: true})) || (await c.match('./index.html')) || (await c.match('./'));
      }
    })());
    return;
  }

  // Assets: cache first, refresh in background
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req, {ignoreSearch: true});
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('', {status: 504, statusText: 'Offline'});
  })());
});
