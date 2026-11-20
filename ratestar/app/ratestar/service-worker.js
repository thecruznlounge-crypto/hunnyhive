const CACHE_NAME = 'ratestar-fyi-hardening-v1';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./config.js','./icons/icon-192.svg','./icons/icon-512.svg'];
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  event.respondWith((async()=>{
    const cached = await caches.match(event.request);
    if(cached) return cached;
    try{
      const response = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request,response.clone()).catch(()=>{});
      return response;
    }catch(err){
      return (await caches.match('./index.html')) || new Response('RateStar offline shell unavailable',{status:503});
    }
  })());
});
