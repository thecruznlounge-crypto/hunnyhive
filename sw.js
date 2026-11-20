/* Hunnyhive (formerly mypwa.store) service worker v57 */
const CACHE = 'hunnyhive-store-v57';
const SHELL = ['/', '/index.html', '/app.html', '/offline.html', '/assets/store.css', '/assets/store.js', '/sdk/install.js', '/apps.json', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/assets/hero-comb.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => (x.startsWith('mypwa-store-') || x.startsWith('hunnyhive-store-')) && x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (/^\/(api|_manage|data)\//.test(u.pathname)) return;                       // never cache private/dynamic endpoints
  /* sub-apps have their own service workers; only handle store pages and shared assets */
  const own = u.pathname === '/' || u.pathname === '/index.html' || u.pathname === '/app.html' || u.pathname.startsWith('/apps/') || u.pathname.startsWith('/assets/') || u.pathname.startsWith('/icons/') || u.pathname.startsWith('/shots/') || u.pathname.startsWith('/sdk/') || u.pathname === '/apps.json' || u.pathname.startsWith('/developers') || u.pathname.startsWith('/submit') || u.pathname === '/offline.html';
  if (!own) return;
  const isImg = /\.(png|jpg|jpeg|webp|svg)$/.test(u.pathname);
  if (isImg) {                                                                   // images: cache first, refresh in background
    e.respondWith(caches.match(r).then(c => { const f = fetch(r).then(x => { if (x.ok) { const y = x.clone(); caches.open(CACHE).then(k => k.put(r, y)); } return x; }).catch(() => c); return c || f; }));
    return;
  }
  e.respondWith(fetch(r).then(x => { if (x.ok) { const y = x.clone(); caches.open(CACHE).then(k => k.put(r, y)); } return x; })
    .catch(() => caches.match(r).then(c => c || (u.pathname.startsWith('/apps/') ? caches.match('/app.html') : null) || caches.match('/offline.html'))));
});
