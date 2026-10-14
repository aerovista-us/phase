// Phase experimental MP3 window decoder. Sequential scan: bounded decoded PCM,
// not random access. Native decoder gapless/sample alignment needs independent proof.
import {mp3Header,mp3GaplessInfo,StreamingUnavailable} from './assembly-peak-indexer.js';
import {MAX_WINDOW_BYTES} from './assembly-window-decode.js';

async function read(file,a,b){return new Uint8Array(await file.slice(a,b).arrayBuffer())}
async function id3End(file){
 const h=await read(file,0,Math.min(file.size,10));
 if(h.length<10||String.fromCharCode(...h.subarray(0,3))!=='ID3')return 0;
 if(h.subarray(6,10).some(x=>x&128))throw Error('Invalid ID3 header');
 return 10+((h[6]<<21)|(h[7]<<14)|(h[8]<<7)|h[9])+((h[5]&16)?10:0);
}
export async function* mp3Frames(file,{chunkBytes=65536,maxScannedBytes=256*1024*1024}={}){
 if(!file?.slice||!Number.isFinite(file.size))throw Error('Original MP3 required');
 if(!Number.isInteger(chunkBytes)||chunkBytes<2048||chunkBytes>1048576)throw Error('Invalid chunk size');
 const start=await id3End(file);
 let offset=start,pending=new Uint8Array(0),cursor=0,index=0;
 while(offset<file.size||cursor<pending.length){
  if(offset-start>maxScannedBytes)throw new StreamingUnavailable('Compressed scan budget exceeded');
  if(offset<file.size&&pending.length-cursor<4096){
   const part=await read(file,offset,Math.min(file.size,offset+chunkBytes));
   offset+=part.length;
   const joined=new Uint8Array(pending.length-cursor+part.length);
   joined.set(pending.subarray(cursor));joined.set(part,pending.length-cursor);
   pending=joined;cursor=0;
  }
  if(cursor+4>pending.length){if(offset>=file.size)break;continue}
  const h=mp3Header(pending,cursor);
  if(!h){cursor++;continue}
  if(cursor+h.length>pending.length){
   if(offset>=file.size)break;
   const part=await read(file,offset,Math.min(file.size,offset+chunkBytes));
   offset+=part.length;
   const joined=new Uint8Array(pending.length-cursor+part.length);
   joined.set(pending.subarray(cursor));joined.set(part,pending.length-cursor);
   pending=joined;cursor=0;continue;
  }
  yield {index,header:h,bytes:pending.slice(cursor,cursor+h.length)};
  index++;cursor+=h.length;
 }
 if(!index)throw new StreamingUnavailable('No valid MP3 frames');
}
export {mp3GaplessInfo} from './assembly-peak-indexer.js';
export async function decodeMp3Window(file,{startSec,endSec,context,chunkBytes=65536,
 maxDecodedBytes=MAX_WINDOW_BYTES,maxScannedBytes=256*1024*1024,onProgress}={}){
 if(!Number.isFinite(startSec)||!Number.isFinite(endSec)||startSec<0||endSec<=startSec)
  throw Error('Invalid MP3 window');
 if(!context?.createBuffer)throw Error('AudioContext required');
 if(typeof AudioDecoder==='undefined'||typeof EncodedAudioChunk==='undefined')
  throw new StreamingUnavailable('WebCodecs unavailable');
 let decoder=null,error=null,produced=0,framesFed=0,buffer=null,planes=null;
 let first=0,last=0,rate=0,channels=0,frameSamples=0,gapless=null;
 const output=a=>{
  try{
   if(error)return;
   if(a.sampleRate!==rate||a.numberOfChannels!==channels)throw Error('MP3 channel/rate changed');
   const start=produced,end=produced+a.numberOfFrames;
   const lo=Math.max(first,start),hi=Math.min(last,end);
   if(hi>lo)for(let ch=0;ch<channels;ch++){
    const pcm=new Float32Array(a.numberOfFrames);
    a.copyTo(pcm,{planeIndex:ch,format:'f32-planar'});
    planes[ch].set(pcm.subarray(lo-start,hi-start),lo-first);
   }
   produced=end;
  }catch(e){error=e}finally{a.close()}
 };
 try{
  for await(const frame of mp3Frames(file,{chunkBytes,maxScannedBytes})){
   if(!decoder){
    rate=frame.header.sampleRate;channels=frame.header.channels;
    frameSamples=frame.header.frameSamples;
    gapless=mp3GaplessInfo(frame.header,frame.bytes);
    const requestedFirst=Math.round(startSec*rate),requestedEnd=Math.round(endSec*rate);
    if(gapless.nativeSampleCount!=null&&requestedEnd>gapless.nativeSampleCount)
     throw new StreamingUnavailable('MP3 selection exceeds gapless-trimmed original duration');
    first=requestedFirst+gapless.leadSamples;
    last=requestedEnd+gapless.leadSamples;
    const frames=last-first;
    if(frames<=0||frames*channels*4>maxDecodedBytes)
     throw new StreamingUnavailable('MP3 selection exceeds PCM budget');
    const config={codec:'mp3',sampleRate:rate,numberOfChannels:channels};
    if(!(await AudioDecoder.isConfigSupported(config)).supported)
     throw new StreamingUnavailable('MP3 WebCodecs decoder unsupported');
    buffer=context.createBuffer(channels,frames,rate);
    planes=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
    decoder=new AudioDecoder({output,error:e=>{error=e}});
    decoder.configure(config);
   }
   if(frame.header.sampleRate!==rate||frame.header.channels!==channels||
     frame.header.frameSamples!==frameSamples)
    throw new StreamingUnavailable('MP3 format changed during song');
   decoder.decode(new EncodedAudioChunk({type:'key',
    timestamp:Math.round(framesFed*frameSamples*1e6/rate),data:frame.bytes}));
   framesFed++;
   if(framesFed%24===0){
    // flush() resets codec state in some MP3 WebCodecs implementations; do
    // not flush repeatedly across dependent frame boundaries.
    while(decoder.decodeQueueSize>8){
     await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{decoder.removeEventListener('dequeue',ready);
        reject(new Error('MP3 decoder stalled'))},5000);
      const ready=()=>{clearTimeout(timeout);
       decoder.removeEventListener('dequeue',ready);resolve()};
      decoder.addEventListener('dequeue',ready,{once:true});
      if(decoder.decodeQueueSize<=8)ready();
     });
    }
    if(error)throw error;
    onProgress?.(Math.min(1,produced/last));
    if(produced>=last)break;
   }
  }
  if(!decoder)throw new StreamingUnavailable('No frames decoded');
  await decoder.flush();if(error)throw error;
  if(produced<last)throw new StreamingUnavailable('MP3 shorter than requested interval');
  onProgress?.(1);
  return {buffer,firstSample:first,lastSample:last,sampleRate:rate,channels,
   decodedBytes:buffer.length*channels*4,sourceFramesDecoded:produced,
   compressedFramesFed:framesFed,gapless,mode:'sequential-webcodecs-mp3-window'};
 }finally{if(decoder&&decoder.state!=='closed')decoder.close()}
}
