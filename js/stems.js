import{normalizeIdentity}from'./source-identity.js';
export const STEM_TYPES=['vocals','drums','bass','other'];
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export function ensureStemState(track){
  if(!track)return track;
  track.useStems=!!track.useStems;
  track.stems=track.stems&&typeof track.stems==='object'?track.stems:{};
  for(const id of STEM_TYPES){const s=track.stems[id]&&typeof track.stems[id]==='object'?track.stems[id]:{};track.stems[id]={id,label:id.toUpperCase(),buffer:s.buffer||null,renderedBuffer:s.renderedBuffer||null,renderedSignature:s.renderedSignature||null,fileName:s.fileName||null,identity:normalizeIdentity(s.identity),gainDb:clamp(num(s.gainDb,0),-24,12),mute:!!s.mute,solo:!!s.solo,renderStats:s.renderStats||null,durationWarning:!!s.durationWarning}}
  return track;
}
export function loadedStems(track){ensureStemState(track);return STEM_TYPES.map(id=>track.stems[id]).filter(s=>s.buffer)}
export function hasLoadedStems(track){return loadedStems(track).length>0}
export function stemDurationCompatible(track,buffer,tolerance=.35){if(!track?.duration||!buffer?.duration)return true;return Math.abs(Number(buffer.duration)-Number(track.duration))<=Math.max(.02,Number(tolerance)||.35)}
export function setStemBuffer(track,id,buffer,{fileName=null,identity=null,durationWarning=false}={}){if(!STEM_TYPES.includes(id))throw new Error(`Unknown stem: ${id}`);ensureStemState(track);const s=track.stems[id];s.buffer=buffer||null;s.fileName=fileName||s.fileName||null;s.identity=normalizeIdentity(identity)||s.identity||null;s.renderedBuffer=null;s.renderedSignature=null;s.renderStats=null;s.durationWarning=!!durationWarning;return s}
export function clearStem(track,id){if(!STEM_TYPES.includes(id))return;ensureStemState(track);track.stems[id]={id,label:id.toUpperCase(),buffer:null,renderedBuffer:null,renderedSignature:null,fileName:null,identity:null,gainDb:0,mute:false,solo:false,renderStats:null,durationWarning:false}}
export function stemGainLinear(stem){return Math.pow(10,num(stem?.gainDb,0)/20)}
export function setUseStems(track,value){ensureStemState(track);track.useStems=!!value&&hasLoadedStems(track);return track.useStems}

export function activeAudioParts(track,{preferRendered=true,includeMuted=false}={}){
  ensureStemState(track);
  if(track.useStems&&hasLoadedStems(track)){const stems=loadedStems(track),solo=stems.some(s=>s.solo&&!s.mute);return stems.filter(s=>(includeMuted||!s.mute)&&(!solo||s.solo)).map(s=>({id:s.id,label:s.label,buffer:preferRendered?(s.renderedBuffer||s.buffer):s.buffer,gain:stemGainLinear(s),stem:s})).filter(x=>x.buffer)}
  const buffer=preferRendered?(track.renderedBuffer||track.buffer):track.buffer;return buffer?[{id:'mix',label:'MIX',buffer,gain:1,stem:null}]:[];
}
export function trackHasPlayableAudio(track){return activeAudioParts(track).length>0}

export function stemProjectMetadata(track){ensureStemState(track);return{useStems:!!track.useStems,stems:Object.fromEntries(STEM_TYPES.map(id=>{const s=track.stems[id];return[id,{fileName:s.fileName||null,identity:normalizeIdentity(s.identity),gainDb:num(s.gainDb,0),mute:!!s.mute,solo:!!s.solo}]}))}}
export function applyStemProjectMetadata(track,meta){ensureStemState(track);if(!meta)return track;track.useStems=!!meta.useStems;for(const id of STEM_TYPES){const src=meta.stems?.[id];if(!src)continue;const s=track.stems[id];s.fileName=src.fileName||s.fileName||null;s.identity=normalizeIdentity(src.identity)||s.identity||null;s.gainDb=clamp(num(src.gainDb,s.gainDb),-24,12);s.mute=!!src.mute;s.solo=!!src.solo}if(track.useStems&&!hasLoadedStems(track))track.useStems=false;return track}
