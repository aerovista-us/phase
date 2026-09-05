const CACHE='echoverse-phase-shell-v15';
const BASE=self.registration.scope;
const asset=path=>new URL(path,BASE).href;
const CORE=['./','./styles.css','./manifest.webmanifest','./icons/phase.svg','./js/state.js','./js/audio.js','./js/analysis.js','./js/warp.js','./js/arrangement.js','./js/render-core.js','./js/render-worker.js','./js/render.js','./js/export.js','./js/app.js','./js/arrange-ui.js','./js/mix-ui.js','./js/project-model.js','./js/project-ui.js','./js/history-ui.js','./js/visual-guides.js','./js/transport-model.js','./js/transport-ui.js','./js/export-loop-ui.js'].map(asset);

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok&&new URL(request.url).origin===self.location.origin){
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));
    }
    return response;
  }catch{
    return (await caches.match(request)) || (request.mode==='navigate'?await caches.match(asset('./')):Response.error());
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),dest=event.request.destination;
  const dynamic=event.request.mode==='navigate'||dest==='script'||dest==='style'||url.pathname.endsWith('.js')||url.pathname.endsWith('.css');
  if(dynamic){event.respondWith(networkFirst(event.request));return}
  event.respondWith(caches.match(event.request).then(hit=>hit||networkFirst(event.request)));
});
