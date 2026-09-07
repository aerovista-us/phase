import{state}from'./state.js';
import{snapshotProject}from'./project-model.js';

export const SESSION_STORE='echoverse.phase.session.v5';
export function hasSessionContent(projectState=state){return(projectState?.tracks||[]).some(t=>t?.file||t?.fileName||t?.buffer)}
export function persistSession(projectState=state,storage=globalThis.localStorage){
  if(!hasSessionContent(projectState)||!storage?.setItem)return false;
  try{storage.setItem(SESSION_STORE,JSON.stringify(snapshotProject(projectState)));return true}catch{return false}
}

window.addEventListener('pagehide',()=>persistSession(),{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistSession()},{capture:true});
document.addEventListener('freeze',()=>persistSession(),{capture:true});
