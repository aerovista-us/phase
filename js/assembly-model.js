export const ASSEMBLY_VERSION=1;
const finite=n=>Number.isFinite(Number(n));
export const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export const quantize=(seconds,rate=48000)=>Math.round(Number(seconds)*rate)/rate;
export function validateSourceRange(source,inSec,outSec){
  if(!source||!finite(source.duration)||!finite(source.sampleRate))throw Error('Source metadata unavailable');
  const a=quantize(clamp(Number(inSec),0,source.duration),source.sampleRate);
  const b=quantize(clamp(Number(outSec),0,source.duration),source.sampleRate);
  if(!(b>a))throw Error('Selection must contain audio');
  return {sourceIn:a,sourceOut:b};
}
export function newClip(source,inSec,outSec,masterStart=0,id=null){
  const range=validateSourceRange(source,inSec,outSec);
  return {id:id||('clip_'+Math.random().toString(36).slice(2,11)),sourceId:source.id,...range,
    masterStart:quantize(Math.max(0,masterStart)),sourceRate:source.sampleRate,gainDb:0,fadeInSec:0.012,fadeOutSec:0.012};
}
export const clipDuration=c=>Math.max(0,c.sourceOut-c.sourceIn);
export const clipEnd=c=>c.masterStart+clipDuration(c);
export const projectDuration=clips=>Math.max(0,...clips.map(clipEnd));
export function insertClip(clips,newItem,at=projectDuration(clips),ripple=true){
  const t=quantize(Math.max(0,at)),duration=clipDuration(newItem);
  if(duration<=0)throw Error('Empty clip');
  const shifted=clips.flatMap(c=>{
    if(!ripple)return [c];
    if(c.masterStart>=t-0.000001)return [{...c,masterStart:quantize(c.masterStart+duration)}];
    if(clipEnd(c)>t+0.000001){
      const atSource=quantize(c.sourceIn+t-c.masterStart,c.sourceRate||48000);
      return [{...c,sourceOut:atSource},
        {...c,id:'clip_'+Math.random().toString(36).slice(2,11),
          sourceIn:atSource,masterStart:quantize(t+duration)}];
    }
    return [c];
  });
  return [...shifted,{...newItem,masterStart:t}].sort((a,b)=>a.masterStart-b.masterStart);
}
export function splitClip(clips,id,at){
  const c=clips.find(x=>x.id===id);if(!c)throw Error('No selected clip');
  const rate=c.sourceRate||48000,t=quantize(at,rate),delta=t-c.masterStart;
  if(delta<=1/rate||delta>=clipDuration(c)-1/rate)throw Error('Split must be inside clip');
  const cut=quantize(c.sourceIn+delta,rate);
  return clips.flatMap(x=>x.id===id?[
    {...x,sourceOut:cut,fadeOutSec:0.005},
    {...x,id:'clip_'+Math.random().toString(36).slice(2,11),sourceIn:cut,masterStart:t,fadeInSec:0.005}
  ]:[x]);
}
export function removeClip(clips,id,ripple=false){
  const c=clips.find(x=>x.id===id);if(!c)return clips;
  const dur=clipDuration(c),end=clipEnd(c);
  return clips.filter(x=>x.id!==id).map(x=>ripple&&x.masterStart>=end-1e-6?
    {...x,masterStart:quantize(x.masterStart-dur)}:x);
}
export function moveClip(clips,id,newStart){const t=quantize(Math.max(0,newStart));
 return clips.map(c=>c.id===id?{...c,masterStart:t}:c).sort((a,b)=>a.masterStart-b.masterStart);}
export function updateFade(clips,id,inSec,outSec){return clips.map(c=>{
  if(c.id!==id)return c;
  const max=clipDuration(c);
  return {...c,fadeInSec:clamp(Number(inSec)||0,0,max),fadeOutSec:clamp(Number(outSec)||0,0,max)};
});}
export function saveAssembly(sources,clips,options={}){
 return {app:'EchoVerse Phase Master Assembly',version:ASSEMBLY_VERSION,
   savedAt:new Date().toISOString(),
   sources:sources.map(s=>({id:s.id,name:s.name,duration:s.duration,
     sampleRate:s.sampleRate,size:s.file?.size??s.size??null,type:s.file?.type??s.type??null})),
   clips:clips.map(c=>({...c})),...options};
}
export function restoreAssembly(doc){if(doc?.app!=='EchoVerse Phase Master Assembly'||doc?.version!==ASSEMBLY_VERSION
 ||!Array.isArray(doc.sources)||!Array.isArray(doc.clips))throw Error('Unsupported assembly project format');
 const ids=new Set(doc.sources.map(s=>s.id));for(const c of doc.clips){
   if(!ids.has(c.sourceId)||!finite(c.sourceIn)||!finite(c.sourceOut)||!finite(c.masterStart)||c.sourceOut<=c.sourceIn||c.masterStart<0)
     throw Error('Invalid source reference or clip timing');
 }
 return doc;
}
