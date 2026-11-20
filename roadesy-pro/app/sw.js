/* Roadesy Pro service worker: app files network-first (updates show on next open), saved copy offline */
const V = 'roadesy-pro-v2';
const SHELL = ['./', 'index.html', 'app.js?v=2', 'manifest.json', 'icon.svg', 'logo.svg', 'privacy.html', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
const CDN = ['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(async c => { await c.addAll(SHELL); await Promise.all(CDN.map(u => c.add(new Request(u, {mode: 'cors'})).catch(() => {}))); }));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET') return;
  if (u.hostname === 'cdnjs.cloudflare.com'){ e.respondWith(caches.match(req).then(h => h || fetch(req))); return; }
  if (u.origin !== location.origin || u.pathname.includes('/api/')) return;
  e.respondWith(fetch(req, {cache: 'no-cache'}).then(r => { if (r.ok){ const cl = r.clone(); caches.open(V).then(c => c.put(req.mode === 'navigate' ? 'index.html' : req, cl)); } return r; })
    .catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('index.html') : new Response('', {status: 504}))));
});
// tapping a "new request" notification brings the app back
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
