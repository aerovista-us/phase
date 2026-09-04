const CACHE='echoverse-phase-shell-v7';
const BASE=self.registration.scope;
const asset=path=>new URL(path,BASE).href;
const CORE=['./','./styles.css','./manifest.webmanifest','./icons/phase.svg','./js/state.js','./js/audio.js','./js/analysis.js','./js/warp.js','./js/render-core.js','./js/render-worker.js','./js/render.js','./js/export.js','./js/app.js'].map(asset);

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(
    caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
      if(response&&response.ok&&new URL(event.request.url).origin===self.location.origin){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }).catch(()=>event.request.mode==='navigate'?caches.match(asset('./')):undefined))
  );
});
