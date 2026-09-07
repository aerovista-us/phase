let loadPromise=null;
const OPTIONAL=['./stems-ui.js','./diagnostics-ui.js','./help-ui.js'];

export function loadOptionalUi(){
  if(loadPromise)return loadPromise;
  loadPromise=Promise.all(OPTIONAL.map(path=>import(path))).then(modules=>{window.dispatchEvent(new CustomEvent('phase:optional-ui-ready'));return modules}).catch(err=>{console.error('Phase optional UI failed to load',err);window.dispatchEvent(new CustomEvent('phase:optional-ui-error',{detail:{message:String(err?.message||err)}}));throw err});
  return loadPromise;
}

function schedule(){
  if('requestIdleCallback'in window)requestIdleCallback(()=>loadOptionalUi(),{timeout:900});
  else setTimeout(()=>loadOptionalUi(),250);
}

// A user asking for help should not have to wait for idle loading.
window.addEventListener('keydown',event=>{
  if(event.key==='?'&&!event.ctrlKey&&!event.metaKey&&!event.altKey)loadOptionalUi();
},{once:true,capture:true});

if(document.readyState==='complete')schedule();else window.addEventListener('load',schedule,{once:true});
