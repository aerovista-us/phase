const LOG_KEY='echoverse.phase.runtimeLog.v1',BOOT_KEY='echoverse.phase.boot.v1',MAX=24;
const now=()=>new Date().toISOString();
const timing=window.__phaseBootTiming=window.__phaseBootTiming||{};
timing.guardStartMs=Number.isFinite(timing.guardStartMs)?timing.guardStartMs:performance.now();
function safeParse(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function version(){return(document.querySelector('.brand .tag')?.textContent||document.querySelector('.footer span')?.textContent||'').replace(/ALPHA|PHASE/gi,'').trim()}
export function readRuntimeLog(){try{const list=safeParse(localStorage.getItem(LOG_KEY),[]);return Array.isArray(list)?list:[]}catch{return[]}}
export function clearRuntimeLog(){try{localStorage.removeItem(LOG_KEY)}catch{}}
export function appendRuntimeEvent(event){try{const list=readRuntimeLog();list.push({at:now(),version:version(),path:location.pathname,...event});localStorage.setItem(LOG_KEY,JSON.stringify(list.slice(-MAX)))}catch{}}
export function bootState(){try{return safeParse(sessionStorage.getItem(BOOT_KEY),null)}catch{return null}}
function setBoot(state,extra={}){try{sessionStorage.setItem(BOOT_KEY,JSON.stringify({state,at:now(),version:version(),path:location.pathname,...extra}))}catch{}}

const previous=bootState();
if(previous?.state==='starting')appendRuntimeEvent({type:'previous_boot_incomplete',message:`Previous Phase launch did not reach ready state (${previous.version||'unknown version'})`,previous});
setBoot('starting');

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{timing.domContentLoadedMs=performance.now()},{once:true});
else timing.domContentLoadedMs=performance.now();
window.addEventListener('load',()=>{timing.loadMs=performance.now()},{once:true});
window.addEventListener('error',event=>appendRuntimeEvent({type:'error',message:String(event.message||'Window error'),source:event.filename||null,line:event.lineno||null,column:event.colno||null}));
window.addEventListener('unhandledrejection',event=>{const reason=event.reason;appendRuntimeEvent({type:'unhandledrejection',message:String(reason?.message||reason||'Unhandled promise rejection'),stack:typeof reason?.stack==='string'?reason.stack.slice(0,3000):null})});
window.addEventListener('pageshow',()=>setTimeout(()=>{timing.runtimeReadyMs=performance.now();setBoot('ready',{readyMs:Number(timing.runtimeReadyMs.toFixed(1))});window.dispatchEvent(new CustomEvent('phase:runtime-ready'))},2500),{once:true});
window.addEventListener('pagehide',()=>{const b=bootState();if(b?.state==='ready')setBoot('closed')});
