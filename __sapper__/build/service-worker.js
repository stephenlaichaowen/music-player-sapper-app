!function(){"use strict";const e=["client/client.9cbf6cd4.js","client/index.cec4f5de.js","client/client.56d6143c.js"].concat(["service-worker-index.html","logo-192.png","logo-512.png","manifest.json","music-player/img/1.jpg","music-player/img/2.jpg","music-player/img/3.jpg","music-player/img/4.jpg","music-player/img/5.jpg","music-player/img/6.jpg","music-player/img/7.jpg","music-player/img/8.jpg","music-player/mp3/1.mp3","music-player/mp3/2.mp3","music-player/mp3/3.mp3","music-player/mp3/4.mp3","music-player/mp3/5.mp3","music-player/mp3/6.mp3","music-player/mp3/7.mp3","music-player/mp3/8.mp3"]),t=new Set(e);self.addEventListener("install",t=>{t.waitUntil(caches.open("cache1589800497227").then(t=>t.addAll(e)).then(()=>{self.skipWaiting()}))}),self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(async e=>{for(const t of e)"cache1589800497227"!==t&&await caches.delete(t);self.clients.claim()}))}),self.addEventListener("fetch",e=>{if("GET"!==e.request.method||e.request.headers.has("range"))return;const c=new URL(e.request.url);c.protocol.startsWith("http")&&(c.hostname===self.location.hostname&&c.port!==self.location.port||(c.host===self.location.host&&t.has(c.pathname)?e.respondWith(caches.match(e.request)):"only-if-cached"!==e.request.cache&&e.respondWith(caches.open("offline1589800497227").then(async t=>{try{const c=await fetch(e.request);return t.put(e.request,c.clone()),c}catch(c){const s=await t.match(e.request);if(s)return s;throw c}}))))})}();
