'use strict';
const CACHE = 'teacher-homework-local-v6';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('teacher-homework-local-')&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET')return;
  const requested=new URL(event.request.url);
  const allowed=ASSETS.some(asset=>new URL(asset,self.registration.scope).href===requested.href);
  if(!allowed)return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request)));
});
