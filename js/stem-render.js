import{trackHasDspEdits,trackNeedsRender,renderTrack}from'./render.js';
import{ensureStemState,loadedStems}from'./stems.js';

const directStats=()=>({quality:'direct',processedGrains:0,totalGrains:0,workRatio:0,dirtyRanges:[],reused:false});
function proxy(track,stem){return{buffer:stem.buffer,duration:stem.buffer?.duration||track.duration,pitch:track.pitch||0,markers:track.markers||[],renderQuality:track.renderQuality,renderedBuffer:stem.renderedBuffer||null,renderedSignature:stem.renderedSignature||null,renderStats:stem.renderStats||null}}
function commit(stem,p,buffer){stem.renderedBuffer=buffer;stem.renderedSignature=p.renderedSignature||null;stem.renderStats=p.renderStats||null;return buffer}
export function usingStemSources(track){ensureStemState(track);return!!track.useStems&&loadedStems(track).length>0}
export function stemSourcesNeedRender(track,quality){
  if(!track?.buffer)return false;
  if(!usingStemSources(track))return trackNeedsRender(track,.0005,quality);
  if(!trackHasDspEdits(track))return false;
  return loadedStems(track).some(stem=>trackNeedsRender(proxy(track,stem),.0005,quality));
}
export async function renderTrackSources(track,onProgress,options={}){
  if(!usingStemSources(track))return renderTrack(track,onProgress,options);
  const stems=loadedStems(track);if(!stems.length)throw new Error('Track has no loaded stems');
  if(!trackHasDspEdits(track)){for(const stem of stems){stem.renderedBuffer=null;stem.renderedSignature=null;stem.renderStats=directStats()}onProgress?.(1);return stems.map(s=>s.buffer)}
  let done=0;const results=[];
  for(const stem of stems){const p=proxy(track,stem);if(trackNeedsRender(p,.0005,options.quality)){const out=await renderTrack(p,x=>onProgress?.((done+x)/stems.length),options);commit(stem,p,out);results.push(out)}else{stem.renderedBuffer=p.renderedBuffer;stem.renderedSignature=p.renderedSignature;stem.renderStats={...(p.renderStats||{}),reused:true};results.push(stem.renderedBuffer||stem.buffer)}done++;onProgress?.(done/stems.length)}
  return results;
}
export function clearInactiveRenderState(track){
  ensureStemState(track);
  if(usingStemSources(track)){if(!trackHasDspEdits(track))for(const stem of loadedStems(track)){stem.renderedBuffer=null;stem.renderedSignature=null;stem.renderStats=directStats()}else for(const stem of loadedStems(track))if(stem.renderStats)stem.renderStats={...stem.renderStats,reused:true};return}
  if(!trackHasDspEdits(track)){track.renderedBuffer=null;track.renderedSignature=null;track.renderStats=directStats()}else if(track.renderStats)track.renderStats={...track.renderStats,reused:true};
}
export function sourceRenderStats(track){ensureStemState(track);if(usingStemSources(track))return loadedStems(track).map(s=>s.renderStats).filter(Boolean);return track.renderStats?[track.renderStats]:[]}
