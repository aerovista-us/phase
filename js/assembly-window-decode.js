// Read only the PCM samples occupied by a Master Assembly clip.
// Never use display waveform peaks as a substitute for original audio.
import {readWavMetadata,readPcmSample,StreamingUnavailable} from './assembly-peak-indexer.js';

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
