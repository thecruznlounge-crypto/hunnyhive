/* Bloop service worker — offline app shell + cached map tiles */
const VERSION = 'bloop-v2.16.0';
const SHELL = `${VERSION}-shell`;
const TILES = 'bloop-tiles-v3'; // new name clears old CARTO map tiles
const MAX_TILES = 800;

const SHELL_FILES = [
  './', 'index.html', 'styles.css', 'icons.js', 'app.js', 'manifest.json', 'offline.html', 'privacy.html', 'terms.html', 'legal.css',
  'icons/logo.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILES); const keys = await c.keys();
  if (keys.length > MAX_TILES) await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((k) => c.delete(k)));
}

const isTile = (url) => /\/\d+\/\d+\/\d+(@2x)?\.(png|jpg|webp)/.test(url.pathname) &&
  /(cartocdn\.com|tile\.openstreetmap\.org|stadiamaps\.com|maptiler\.com)$/.test(url.hostname);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Live data and search: always network (the app keeps its own offline copy)
  if (url.hostname.endsWith('.supabase.co') && !url.pathname.includes('/object/public/')) return;
  if (url.hostname.includes('overpass') || url.pathname.includes('/overpass/') || url.hostname.includes('nominatim') || url.hostname.startsWith('routing.') || url.hostname === 'api.geoapify.com') return;

  // The tour video streams straight from the server (phones request it in pieces)
  if (url.origin === location.origin && url.pathname.includes('/media/') && url.pathname.endsWith('.mp4')) return;

  // Map tiles + approved photos: cache-first
  if (isTile(url) || url.pathname.includes('/storage/v1/object/public/')) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trimTiles(); }
        return res;
      } catch { return new Response('', { status: 504 }); }
    }));
    return;
  }

  // Settings: network-first so new keys apply right away
  if (url.origin === location.origin && url.pathname.endsWith('/config.js')) {
    e.respondWith(fetch(req).then((res) => { const cp = res.clone(); caches.open(SHELL).then((c) => c.put(req, cp)); return res; }).catch(() => caches.match(req)));
    return;
  }

  // Pages: network-first, fall back to cached app, then offline page
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const cp = res.clone(); caches.open(SHELL).then((c) => c.put('index.html', cp)); return res; })
      .catch(async () => (await caches.match('index.html')) || caches.match('offline.html')));
    return;
  }

  // App files + Leaflet: stale-while-revalidate
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res.ok && (url.origin === location.origin || url.hostname === 'unpkg.com')) { const cp = res.clone(); caches.open(SHELL).then((c) => c.put(req, cp)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
