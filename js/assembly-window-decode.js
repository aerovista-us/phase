// Read only the PCM samples occupied by a Master Assembly clip.
// Never use display waveform peaks as a substitute for original audio.
import {readWavMetadata,readPcmSample,StreamingUnavailable} from './assembly-peak-indexer.js';
import {decodeMp3Window} from './assembly-mp3-window.js';

export const MAX_WINDOW_BYTES=96*1024*1024;
const META=new WeakMap();
export async function wavInfo(file){
 if(!file?.slice||!Number.isFinite(file.size))throw Error('Original local audio file required');
 if(!META.has(file))META.set(file,readWavMetadata(file).catch(e=>{META.delete(file);throw e}));
 return META.get(file);
}
export function sampleWindow(info,startSec,endSec){
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 if(!finite(startSec)||!finite(endSec)||startSec<0||endSec<=startSec)
  throw Error('Invalid original PCM window');
 const count=info.size/info.align;
 const start=Math.round(startSec*info.sampleRate),end=Math.round(endSec*info.sampleRate);
 if(start<0||end>count||end<=start)throw Error('Window extends outside original audio');
 return {firstSample:start,lastSample:end,frames:end-start,
  startSec:start/info.sampleRate,endSec:end/info.sampleRate};
}
export async function decodeWavWindow(file,{startSec,endSec,context,chunkBytes=262144,maxDecodedBytes=MAX_WINDOW_BYTES}={}){
 if(!context?.createBuffer)throw Error('AudioContext is required');
 const m=await wavInfo(file);
 const w=sampleWindow(m,startSec,endSec);
 const decodedBytes=w.frames*m.channels*4;
 if(decodedBytes>maxDecodedBytes)
  throw new StreamingUnavailable('Selected PCM clip exceeds 96 MiB decoding budget. Split it into shorter clips.');
 const result=context.createBuffer(m.channels,w.frames,m.sampleRate);
 const planes=Array.from({length:m.channels},(_,i)=>result.getChannelData(i));
 const bytesPerSample=m.bits/8;
 const framesPerChunk=Math.max(1,Math.floor(Math.max(m.align,chunkBytes)/m.align));
 for(let frame=0;frame<w.frames;frame+=framesPerChunk){
  const batch=Math.min(framesPerChunk,w.frames-frame);
  const begin=m.offset+(w.firstSample+frame)*m.align;
  const data=await file.slice(begin,begin+batch*m.align).arrayBuffer();
  if(data.byteLength!==batch*m.align)throw Error('Unexpected end of source audio');
  const view=new DataView(data);
  for(let i=0;i<batch;i++){
   const base=i*m.align;
   for(let ch=0;ch<m.channels;ch++){
    const value=readPcmSample(view,base+ch*bytesPerSample,m.bits,m.type);
    if(!Number.isFinite(value))throw Error('Invalid PCM sample encountered');
    planes[ch][frame+i]=value;
   }
  }
 }
 return {buffer:result,...w,sampleRate:m.sampleRate,channels:m.channels,
  decodedBytes,mode:'windowed-original-pcm-wav'};
}

// Share the same original-sample decoder between master playback, snap and detail.
// A compatibility decoder remains explicit and is guarded BEFORE full-file reads.
export async function decodeSourceWindow(source,{startSec,endSec,context,loadFullBuffer,
 maxFullBytes=240*1024*1024}={}){
 if(!source?.file)throw Error('Relink missing original audio: '+(source?.name||'unknown'));
 const rate=source.sampleRate;
 if(!Number.isFinite(rate)||rate<=0||!Number.isFinite(source.duration)||source.duration<=0||
    !Number.isFinite(startSec)||!Number.isFinite(endSec)||startSec<0||endSec>source.duration||endSec<=startSec)
  throw Error('Invalid source detail window');
 const start=Math.round(startSec*rate)/rate,end=Math.round(endSec*rate)/rate;
 if(end<=start)throw Error('Detail window must contain original samples');
 let segment;
 if(source.indexMode==='streamed-pcm-wav'){
  segment=await decodeWavWindow(source.file,{startSec:start,endSec:end,context});
 }else if(source.indexMode==='streamed-webcodecs-mp3'){
  try{segment=await decodeMp3Window(source.file,{startSec:start,endSec:end,context})}
  catch(error){if(!(error instanceof StreamingUnavailable))throw error}
 }
 if(segment)return {...segment,startSec:start,endSec:end};
 const bytes=Math.ceil(source.duration*rate*Math.max(2,source.channels||2)*4);
 if(!Number.isSafeInteger(bytes)||bytes>maxFullBytes)
  throw Error('Full-decode compatibility source exceeds detail memory budget. Use PCM WAV or supported MP3.');
 if(typeof loadFullBuffer!=='function')throw Error('Native compatibility decoder required');
 const buffer=await loadFullBuffer(source);
 return {buffer,startSec:0,endSec:buffer.duration,mode:'compatibility-full-source'};
}

function commonClipItem(c){
 return {gain:Math.pow(10,(Number(c.gainDb)||0)/20),group:'master',
  fadeInCurve:c.fadeInCurve||c.fadeCurve||'linear',
  fadeOutCurve:c.fadeOutCurve||c.fadeCurve||'linear'};
}
export function activeClipWindow(c,from=0,to=Infinity){
 const begin=Math.max(c.masterStart,from),end=Math.min(c.masterStart+(c.sourceOut-c.sourceIn),to);
 if(!(end>begin))return null;
 return {begin,end,sourceStart:c.sourceIn+(begin-c.masterStart),sourceEnd:c.sourceIn+(end-c.masterStart)};
}
export async function prepareAssemblyItems(clips,getSource,{
 context,loadFullBuffer,from=0,to=Infinity,maxTotalBytes=320*1024*1024
}={}){
 if(typeof getSource!=='function'||!context?.createBuffer||typeof loadFullBuffer!=='function')
  throw Error('Source resolver, AudioContext and fallback decoder required');
 const active=clips.map(c=>({c,w:activeClipWindow(c,from,to)})).filter(x=>x.w);
 const seenFull=new Set();let plannedBytes=0;
 // Reject excessive aggregate decoding before allocating sample buffers.
 for(const {c,w} of active){
  const s=getSource(c.sourceId);
  if(!s?.file)throw Error('Relink missing original audio: '+(s?.name||c.sourceId));
  if(s.indexMode==='streamed-pcm-wav'){
   const m=await wavInfo(s.file);
   plannedBytes+=(Math.round(w.sourceEnd*m.sampleRate)-Math.round(w.sourceStart*m.sampleRate))*m.channels*4;
  }else if(s.indexMode==='streamed-webcodecs-mp3'){
   const frames=Math.round(w.sourceEnd*s.sampleRate)-Math.round(w.sourceStart*s.sampleRate);
   plannedBytes+=frames*Math.max(1,s.channels||2)*4;
  }else if(!seenFull.has(c.sourceId)){
   seenFull.add(c.sourceId);
   plannedBytes+=Math.ceil(s.duration*s.sampleRate*8); // Conservative two-channel fallback.
  }
  if(plannedBytes>maxTotalBytes)throw new Error('Assembly decode budget exceeded. Use shorter source clips.');
 }
 const result=[];
 const asFullItem=(c,s,buffer)=>({clipId:c.id,buffer,offset:c.masterStart-c.sourceIn,
  sourceIn:c.sourceIn,sourceOut:c.sourceOut,...commonClipItem(c),
  fadeInStart:c.sourceIn,fadeInEnd:c.sourceIn+c.fadeInSec,
  fadeOutStart:c.sourceOut-c.fadeOutSec,fadeOutEnd:c.sourceOut,
  mode:'compatibility-full-source'});
 const asWindowItem=(c,w,segment)=>({clipId:c.id,buffer:segment.buffer,
  offset:w.begin,sourceIn:0,sourceOut:segment.buffer.duration,...commonClipItem(c),
  fadeInStart:c.masterStart-w.begin,fadeInEnd:c.masterStart+c.fadeInSec-w.begin,
  fadeOutStart:c.masterStart+(c.sourceOut-c.sourceIn)-c.fadeOutSec-w.begin,
  fadeOutEnd:c.masterStart+(c.sourceOut-c.sourceIn)-w.begin,
  mode:segment.mode});
 for(const {c,w} of active){
  const s=getSource(c.sourceId);
  if(s.indexMode==='streamed-pcm-wav'){
   const segment=await decodeWavWindow(s.file,{startSec:w.sourceStart,endSec:w.sourceEnd,context});
   result.push(asWindowItem(c,w,segment));
  }else if(s.indexMode==='streamed-webcodecs-mp3'){
   try{
    const segment=await decodeMp3Window(s.file,{startSec:w.sourceStart,endSec:w.sourceEnd,context});
    result.push(asWindowItem(c,w,segment));
   }catch(error){
    // Unsupported browser/unknown gapless tag: preserve native decode authority.
    if(!(error instanceof StreamingUnavailable))throw error;
    const bytes=Math.ceil(s.duration*s.sampleRate*Math.max(2,s.channels||2)*4);
    if(bytes>maxTotalBytes||plannedBytes+bytes>maxTotalBytes)
     throw new Error('Unsupported MP3 window decoder and full native fallback exceeds memory budget. Convert source to PCM WAV.');
    const buffer=await loadFullBuffer(s);
    result.push(asFullItem(c,s,buffer));
   }
  }else{
   const buffer=await loadFullBuffer(s);
   result.push(asFullItem(c,s,buffer));
  }
 }
 return {items:result,plannedBytes};
}
