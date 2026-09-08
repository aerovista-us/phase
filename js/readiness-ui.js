import{state,$}from'./state.js';
import{SESSION_STORE}from'./session-safety.js';

const set=(id,text,tone='')=>{const el=$(id);if(!el)return;el.textContent=text;el.dataset.tone=tone};
const version=()=>($('.brand .tag')?.textContent||'').replace(/ALPHA/gi,'').trim();

function audioStatus(){
  if(state.rendering)return['FINAL RENDER','busy'];
  if(state.previewRendering)return['PREVIEW BUILD','busy'];
  if(state.dirty&&state.previewCurrent)return['PREVIEW CURRENT','ok'];
  if(state.dirty)return['PREVIEW CATCHUP','watch'];
  return['CURRENT','ok'];
}
function sessionStatus(){
  try{
    const raw=localStorage.getItem(SESSION_STORE);
    if(!raw)return state.tracks.some(t=>t.file||t.fileName||t.buffer)?['UNSAVED','watch']:['READY','neutral'];
    const map=JSON.parse(raw),age=Date.now()-Date.parse(map.savedAt||0);
    return Number.isFinite(age)&&age<120000?['SAVED','ok']:['SAVED · STALE','watch'];
  }catch{return['STORAGE ISSUE','error']}
}
function perfStatus(){
  try{
    const nav=performance.getEntriesByType?.('navigation')?.[0],timing=window.__phaseBootTiming||{};
    const interactive=Number(nav?.domInteractive),ready=Number(timing.runtimeReadyMs??nav?.loadEventEnd??nav?.duration);
    if(!Number.isFinite(interactive)&&!Number.isFinite(ready))return['MEASURING','neutral'];
    const slow=(Number.isFinite(interactive)&&interactive>3000)||(Number.isFinite(ready)&&ready>5000);
    const watch=(Number.isFinite(interactive)&&interactive>1500)||(Number.isFinite(ready)&&ready>3000);
    return slow?['PRESSURE','error']:watch?['WATCH','watch']:['READY','ok'];
  }catch{return['UNKNOWN','neutral']}
}
function refresh(){
  const[a,at]=audioStatus(),[s,st]=sessionStatus(),[p,pt]=perfStatus();
  set('#readyAudio',a,at);set('#readySession',s,st);set('#readyPerf',p,pt);
}
async function buildStatus(){
  set('#readyBuild',navigator.onLine?'CHECKING':'OFFLINE','neutral');
  try{
    const res=await fetch(`./build.json?ts=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)throw new Error('build metadata unavailable');
    const build=await res.json(),same=String(build.version||'')===version();
    set('#readyBuild',same&&build.validated===true?'LIVE':'UPDATE',same&&build.validated===true?'ok':'watch');
    const el=$('#readyBuild');if(el)el.title=`${build.commit?.slice(0,10)||'unknown commit'} · ${build.builtAt||'unknown build time'}`;
  }catch{set('#readyBuild',navigator.onLine?'UNKNOWN':'OFFLINE',navigator.onLine?'watch':'neutral')}
}
async function openDiag(){
  const existing=$('#diagPanel');
  if(existing){existing.click();return}
  try{await import('./diagnostics-ui.js');$('#diagPanel')?.click()}catch{set('#readyPerf','DIAG ERROR','error')}
}

window.addEventListener('phase:render-dirty',refresh);
window.addEventListener('phase:preview-ready',refresh);
window.addEventListener('phase:render-current',refresh);
window.addEventListener('phase:history-applied',refresh);
window.addEventListener('phase:project-applied',refresh);
window.addEventListener('phase:session-saved',refresh);
window.addEventListener('phase:optional-ui-ready',refresh);
window.addEventListener('online',()=>{refresh();buildStatus()});
window.addEventListener('offline',()=>{refresh();buildStatus()});
window.addEventListener('load',()=>{refresh();buildStatus();setTimeout(refresh,800)},{once:true});
$('#readinessDiag')?.addEventListener('click',openDiag);
refresh();
