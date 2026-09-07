import{state,$}from'./state.js';
import{estimateRenderPeakBytes,estimateSeparationPeakBytes,classifyResourceUse}from'./resource-preflight.js';

const MB=1024*1024;
const fmt=n=>{const v=Number(n)||0;return v>=1024*MB?`${(v/(1024*MB)).toFixed(2)} GB`:`${(v/MB).toFixed(0)} MB`};
function deviceMemory(){return Number(navigator.deviceMemory)||null}
function message(kind,estimate,classification){
  const action=kind==='separate'?'stem separation':'rendering',severity=classification.level==='severe'?'HIGH MEMORY PRESSURE':'MEMORY CAUTION';
  return`${severity}\n\nPhase estimates ${action} could temporarily use about ${fmt(estimate.projectedBytes)} of decoded/working audio memory on this device.\n\nResident now: ${fmt(estimate.residentBytes)}\nTemporary working estimate: ${fmt(estimate.workingBytes)}\nCaution threshold: ${fmt(classification.cautionBytes)}\n\nContinue anyway?`;
}
function shouldContinue(kind,estimate){
  const classification=classifyResourceUse(estimate,{deviceMemoryGB:deviceMemory()});
  if(classification.level==='ok')return true;
  const ok=confirm(message(kind,estimate,classification));
  const status=$('#engineState');if(status)status.textContent=ok?`${kind==='separate'?'STEM SEPARATION':'RENDER'} · MEMORY PREFLIGHT ACKNOWLEDGED`:`${kind==='separate'?'STEM SEPARATION':'RENDER'} CANCELLED · MEMORY PREFLIGHT`;
  return ok;
}
function onClick(event){
  const target=event.target?.closest?.('button');if(!target)return;
  if(target.id==='render'){
    const estimate=estimateRenderPeakBytes(state);if(!shouldContinue('render',estimate)){event.preventDefault();event.stopImmediatePropagation()}
    return;
  }
  if(target.id==='stemSeparate'&&String(target.textContent||'').trim().toUpperCase()==='SEPARATE'){
    const trackId=$('#stemTrack1')?.classList.contains('active')?1:0,track=state.tracks[trackId];if(!track?.buffer)return;
    const estimate=estimateSeparationPeakBytes(state,track);if(!shouldContinue('separate',estimate)){event.preventDefault();event.stopImmediatePropagation()}
  }
}

document.addEventListener('click',onClick,true);
