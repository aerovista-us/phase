let loadPromise=null;
const OPTIONAL=['./demo-ui.js','./stems-ui.js','./diagnostics-ui.js','./support-ui.js','./help-ui.js','./resource-preflight-ui.js'];
const timing=window.__phaseBootTiming=window.__phaseBootTiming||{};

export function loadOptionalUi(){
  if(loadPromise)return loadPromise;
  timing.optionalRequestedMs=performance.now();
  loadPromise=Promise.all(OPTIONAL.map(path=>import(path))).then(modules=>{timing.optionalReadyMs=performance.now();window.dispatchEvent(new CustomEvent('phase:optional-ui-ready',{detail:{readyMs:timing.optionalReadyMs}}));return modules}).catch(err=>{timing.optionalErrorMs=performance.now();console.error('Phase optional UI failed to load',err);window.dispatchEvent(new CustomEvent('phase:optional-ui-error',{detail:{message:String(err?.message||err)}}));throw err});
  return loadPromise;
}

function schedule(){
  timing.optionalScheduledMs=performance.now();
  if('requestIdleCallback'in window)requestIdleCallback(()=>loadOptionalUi(),{timeout:900});
  else setTimeout(()=>loadOptionalUi(),250);
}

// A user asking for help should not have to wait for idle loading.
window.addEventListener('keydown',event=>{
  if(event.key==='?'&&!event.ctrlKey&&!event.metaKey&&!event.altKey)loadOptionalUi();
},{once:true,capture:true});

if(document.readyState==='complete')schedule();else window.addEventListener('load',schedule,{once:true});
