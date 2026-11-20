/* vewr – Hunnyhive standard service worker: network first, offline fallback. */
const CACHE='vewr-v37';
const SHELL=['/vewr/','/vewr/manifest.json','/vewr/icons/icon-192.png','/vewr/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE&&x.indexOf('vewr-')===0).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{if(r.ok&&new URL(e.request.url).origin===location.origin){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{});}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/vewr/'))));});
