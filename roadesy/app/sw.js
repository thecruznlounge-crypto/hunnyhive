/* Roadesy service worker
   - app files: network-first (updates show on the next open), cached for offline
   - map tiles: from any saved copy first (incl. "Save offline" areas), recent ones kept automatically
   - listings / EV / routing / api/*.php: straight to the network (the app keeps its own offline copy) */
const V = 'roadesy-v23';
const TILES = 'roadbudz-tiles-v1';
const OFFLINE_PREFIX = 'roadbudz-offline';
const MAX_TILES = 600;
const SHELL = ['./', 'index.html', 'app.js?v=23', 'config.js?v=23', 'ev-mobile.js?v=23', 'providers.json', 'states.js?v=23', 'manifest.json', 'icon.svg', 'privacy.html', 'pro-live.js?v=23',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
const CDN = ['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
const TILE_RE = /\/\d{1,2}\/\d+\/\d+(@2x)?\.(png|jpe?g|webp)(\?|$)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(async c => {
    await c.addAll(SHELL);
    await Promise.all(CDN.map(u => c.add(new Request(u, {mode: 'cors'})).catch(() => {})));
  }));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V && k !== TILES && !k.startsWith(OFFLINE_PREFIX)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

let trimming = false;
async function trimTiles(){
  if (trimming) return; trimming = true;
  try{ const c = await caches.open(TILES), keys = await c.keys(); for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]); }
  finally{ trimming = false; }
}
function timeout(p, ms){ return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), ms))]); }

self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET') return;

  // Map tiles (any provider): saved copy first, else network and keep a copy
  if (u.origin !== location.origin && TILE_RE.test(u.pathname)){
    e.respondWith((async () => {
      const hit = await caches.match(req.url); if (hit) return hit;
      try{
        const r = await fetch(req);
        if (r.ok || r.type === 'opaque'){ const c = await caches.open(TILES); c.put(req.url, r.clone()); trimTiles(); }
        return r;
      }catch{ return new Response('', {status: 504}); }
    })());
    return;
  }
  // Leaflet from CDN: cache-first
  if (u.hostname === 'cdnjs.cloudflare.com'){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const cl = r.clone(); caches.open(V).then(c => c.put(req, cl)); return r; })));
    return;
  }
  if (u.origin !== location.origin) return;            // Overpass, DOE, routing, geocoding: network only
  if (u.pathname.includes('/api/')) return;            // your listings cache: network only

  // App files and pages: network-first so updates show right away; saved copy when offline or slow
  e.respondWith((async () => {
    try{
      const r = await timeout(fetch(req, {cache: 'no-cache'}), 4000);   // ask the server every time (304 if unchanged)
      if (r.ok){ const cl = r.clone(); caches.open(V).then(c => c.put(req.mode === 'navigate' ? 'index.html' : req, cl)); }
      return r;
    }catch{
      return (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('index.html') : new Response('', {status: 504}));
    }
  })());
});
