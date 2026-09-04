export function makeTrack(id,label){return{id,label,name:label,buffer:null,renderedBuffer:null,renderedAt:null,peaks:null,duration:0,sourceBpm:120,pitch:0,markers:[],file:null,analysis:null,gridMode:'manual',timelineOffset:0,renderedOffset:0}}
export const state={mode:'select',bpm:120,dirty:false,playing:false,audioCtx:null,sources:[],selected:null,showBeats:true,showDownbeats:true,installPrompt:null,rendering:false,viewDuration:60,pxPerSecond:8,tracks:[makeTrack(0,'TRACK A'),makeTrack(1,'TRACK B')]};
export const $=s=>document.querySelector(s);
export const $$=s=>[...document.querySelectorAll(s)];
export function fmt(t){if(!Number.isFinite(t))return'—';const m=Math.floor(t/60),s=t-m*60;return`${m}:${s.toFixed(3).padStart(6,'0')}`}
export function markDirty(){state.dirty=true;$('#renderDot').classList.add('pending');$('#renderState').textContent='VISUAL CHANGES PENDING'}
export function markCurrent(){state.dirty=false;$('#renderDot').classList.remove('pending');$('#renderState').textContent='AUDIO CURRENT'}