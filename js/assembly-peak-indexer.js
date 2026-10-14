// Bounded-memory peak indexing. Peak summaries are never used to render audio.
import {pyramidFromBuckets} from './assembly-waveform.js';
export class StreamingUnavailable extends Error { constructor(s){super(s);this.name='StreamingUnavailable'} }
const read=(f,a,b)=>f.slice(a,b).arrayBuffer();
const LIMIT=2000000;
function collector(block=128){
 let mins=[],maxs=[],lo=1,hi=-1,used=0,total=0;
 return {
  sample(v){for(const x of v){if(!Number.isFinite(x))throw Error('Invalid PCM');lo=Math.min(lo,x);hi=Math.max(hi,x)}
   if(++used===block){mins.push(lo);maxs.push(hi);lo=1;hi=-1;used=0}
   if(++total>block*LIMIT)throw new StreamingUnavailable('Track exceeds waveform memory limit')},
  finish(rate){if(used){mins.push(lo);maxs.push(hi)}
   if(!total)throw Error('Empty decoded audio');
   const a=Float32Array.from(mins),b=Float32Array.from(maxs);
   return {pyramid:pyramidFromBuckets(a,b,block,rate,total),sampleRate:rate,sampleCount:total,
    duration:total/rate,peakBytes:a.byteLength+b.byteLength}}
 }
}
const four=(v,p)=>String.fromCharCode(...Array.from({length:4},(_,i)=>v.getUint8(p+i)));
async function wavMeta(f){
 if(f.size<44)throw new StreamingUnavailable('WAV header too small');
 const head=new DataView(await read(f,0,12));
 if(four(head,0)!=='RIFF'||four(head,8)!=='WAVE')throw new StreamingUnavailable('Not RIFF WAV');
 let pos=12,fmt=null,data=null;
 while(pos+8<=f.size){
  const h=new DataView(await read(f,pos,pos+8)),size=h.getUint32(4,true),tag=four(h,0),start=pos+8;
  if(size>f.size-start)throw Error('Truncated WAV chunk '+tag);
  if(tag==='fmt '){
   if(size<16)throw Error('Invalid WAV format');
   const v=new DataView(await read(f,start,start+Math.min(40,size)));
   let type=v.getUint16(0,true);
   if(type===65534&&size>=40)type=v.getUint16(24,true);
   fmt={type,channels:v.getUint16(2,true),sampleRate:v.getUint32(4,true),align:v.getUint16(12,true),bits:v.getUint16(14,true)};
  }
  if(tag==='data')data={offset:start,size};
  if(fmt&&data)break;
  pos=start+size+(size&1);
 }
 if(!fmt||!data)throw Error('Missing WAV fmt/data');
 const {type,channels,sampleRate,align,bits}=fmt;
 if(![1,3].includes(type)||channels<1||channels>8||sampleRate<8000||sampleRate>384000||
  !(type===3?[32,64].includes(bits):[8,16,24,32].includes(bits))||
  align!==channels*bits/8||!data.size||data.size%align)
  throw new StreamingUnavailable('Unsupported WAV layout');
 if(Math.ceil(data.size/align/128)>LIMIT)throw new StreamingUnavailable('Waveform peak budget exceeded');
 return {...fmt,...data};
}
function pcm(v,at,bits,type){
 if(type===3)return bits===32?v.getFloat32(at,true):v.getFloat64(at,true);
 if(bits===8)return (v.getUint8(at)-128)/128;
 if(bits===16)return v.getInt16(at,true)/32768;
 if(bits===24){let x=v.getUint8(at)|(v.getUint8(at+1)<<8)|(v.getUint8(at+2)<<16);
  if(x&0x800000)x-=0x1000000;return x/8388608}
 return v.getInt32(at,true)/2147483648;
}
export async function indexWav(f,{chunkBytes=262144,onProgress}={}){
 const m=await wavMeta(f),peaks=collector(),count=m.size/m.align,n=Math.max(1,Math.floor(chunkBytes/m.align)),size=m.bits/8;
 for(let at=0;at<count;at+=n){
  const frames=Math.min(n,count-at);
  const v=new DataView(await read(f,m.offset+at*m.align,m.offset+(at+frames)*m.align));
  for(let i=0;i<frames;i++){
   const values=[];for(let c=0;c<m.channels;c++)values.push(pcm(v,i*m.align+c*size,m.bits,m.type));
   peaks.sample(values);
  }
  if(onProgress)onProgress((at+frames)/count);
 }
 return {...peaks.finish(m.sampleRate),mode:'streamed-pcm-wav',channels:m.channels,bytesRead:m.size};
}
const V1=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
const V2=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0];
export function mp3Header(u,i=0){
 if(i+4>u.length||u[i]!==255||(u[i+1]&224)!==224)return null;
 const ver=(u[i+1]>>3)&3,layer=(u[i+1]>>1)&3;
 if(ver===1||layer!==1)return null;
 const bi=(u[i+2]>>4)&15,ri=(u[i+2]>>2)&3;
 if(!bi||bi===15||ri===3)return null;
 const sr=[44100,48000,32000][ri]/(ver===3?1:ver===2?2:4);
 const len=Math.floor((ver===3?144000:72000)*(ver===3?V1:V2)[bi]/sr+((u[i+2]>>1)&1));
 if(len<24||len>2048)return null;
 return {length:len,sampleRate:sr,channels:((u[i+3]>>6)&3)===3?1:2,frameSamples:ver===3?1152:576};
}
// Frame-accurate MP3 native timeline mapping for recognized Xing/Info + LAME/Lavc tags.
// Unrecognized gapless headers fail closed rather than producing time-shifted master audio.
export function mp3GaplessInfo(header,bytes){
 const ver=(bytes[1]>>3)&3,mono=((bytes[3]>>6)&3)===3;
 const crc=(bytes[1]&1)?0:2;
 const side=ver===3?(mono?17:32):(mono?9:17);
 const at=4+crc+side;
 const ascii=i=>String.fromCharCode(...bytes.subarray(i,i+4));
 if(at+8>bytes.length||!['Xing','Info'].includes(ascii(at)))
  return {leadSamples:0,tailSamples:0,nativeSampleCount:null,mode:'raw-mp3'};
 if(ver!==3||header.frameSamples!==1152)
  throw new StreamingUnavailable('Gapless MPEG version has no verified native time mapping');
 const flags=((bytes[at+4]<<24)>>>0)|(bytes[at+5]<<16)|(bytes[at+6]<<8)|bytes[at+7];
 let pos=at+8,frames=null;
 if(flags&1){if(pos+4>bytes.length)throw new StreamingUnavailable('Incomplete Xing frame count');
  frames=((bytes[pos]<<24)>>>0)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3];pos+=4}
 if(flags&2)pos+=4;
 if(flags&4)pos+=100;
 if(flags&8)pos+=4;
 if(pos+24>bytes.length)throw new StreamingUnavailable('Missing Xing encoder gapless metadata');
 const encoder=ascii(pos);
 if(!['LAME','Lavc','Lavf'].includes(encoder))
  throw new StreamingUnavailable('Unknown MP3 gapless encoder; use native full decode');
 const delay=(bytes[pos+21]<<4)|(bytes[pos+22]>>4);
 const padding=((bytes[pos+22]&15)<<8)|bytes[pos+23];
 if(delay<1||delay>2000||padding<529||padding>4095||!frames||frames>10000000)
  throw new StreamingUnavailable('Unverified Xing encoder delay or padding');
 // Native browser decoder removes the Xing header frame plus 529 synthesis
 // delay samples from the head, with the corresponding 529 removed from pad.
 const leadSamples=1152+delay+529,tailSamples=padding-529;
 const nativeSampleCount=(frames+1)*1152-leadSamples-tailSamples;
 if(nativeSampleCount<=0)throw new StreamingUnavailable('Invalid gapless duration');
 return {leadSamples,tailSamples,nativeSampleCount,encoder,mode:'xing-gapless-verified'};
}


async function id3Offset(f){
 const h=new Uint8Array(await read(f,0,Math.min(10,f.size)));
 if(h.length<10||String.fromCharCode(...h.subarray(0,3))!=='ID3')return 0;
 if(h.slice(6,10).some(x=>x&128))throw Error('Invalid ID3 size');
 return 10+((h[6]<<21)|(h[7]<<14)|(h[8]<<7)|h[9])+((h[5]&16)?10:0);
}
export async function indexMp3(f,{chunkBytes=262144,onProgress}={}){
 if(typeof AudioDecoder==='undefined'||typeof EncodedAudioChunk==='undefined')
  throw new StreamingUnavailable('WebCodecs unavailable');
 let cursor=0,offset=await id3Offset(f),pending=new Uint8Array(0),decoder=null,err=null,rate=0,channels=0,frames=0,rawDecoded=0,gapless=null;
 const peaks=collector();
 const output=a=>{
  try{
   const planes=[];
   for(let c=0;c<a.numberOfChannels;c++){const d=new Float32Array(a.numberOfFrames);a.copyTo(d,{planeIndex:c,format:'f32-planar'});planes.push(d)}
   for(let i=0;i<a.numberOfFrames;i++){
    const frame=rawDecoded+i;
    if(frame<gapless.leadSamples)continue;
    if(gapless.nativeSampleCount!=null&&
      frame>=gapless.leadSamples+gapless.nativeSampleCount)continue;
    peaks.sample(planes.map(v=>v[i]));
   }
   rawDecoded+=a.numberOfFrames;
  }catch(e){err=e}finally{a.close()}
 };
 try{
  while(offset<f.size||cursor<pending.length){
   if(offset<f.size&&pending.length-cursor<4096){
    const piece=new Uint8Array(await read(f,offset,Math.min(f.size,offset+chunkBytes)));offset+=piece.length;
    const combined=new Uint8Array(pending.length-cursor+piece.length);
    combined.set(pending.subarray(cursor));combined.set(piece,pending.length-cursor);pending=combined;cursor=0;
   }
   if(cursor+4>pending.length){if(offset>=f.size)break;continue}
   const h=mp3Header(pending,cursor);
   if(!h){cursor++;continue}
   if(cursor+h.length>pending.length){
    if(offset>=f.size)break;
    const piece=new Uint8Array(await read(f,offset,Math.min(f.size,offset+chunkBytes)));offset+=piece.length;
    const combined=new Uint8Array(pending.length-cursor+piece.length);
    combined.set(pending.subarray(cursor));combined.set(piece,pending.length-cursor);pending=combined;cursor=0;continue;
   }
   if(!decoder){
    const config={codec:'mp3',sampleRate:h.sampleRate,numberOfChannels:h.channels};
    if(!(await AudioDecoder.isConfigSupported(config)).supported)
     throw new StreamingUnavailable('Native MP3 decoder unsupported');
    rate=h.sampleRate;channels=h.channels;
    gapless=mp3GaplessInfo(h,pending.slice(cursor,cursor+h.length));
    decoder=new AudioDecoder({output,error:e=>{err=e}});decoder.configure(config);
   }
   if(h.sampleRate!==rate||h.channels!==channels)throw new Error('MP3 sample configuration changed');
   const timestamp=Math.round(frames*h.frameSamples*1e6/rate);
   decoder.decode(new EncodedAudioChunk({type:'key',timestamp,data:pending.subarray(cursor,cursor+h.length)}));
   cursor+=h.length;frames++;
   if(frames%24===0){
    // Preserve bit-reservoir continuity: flush only once, at end of stream.
    while(decoder.decodeQueueSize>8){
     await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{decoder.removeEventListener('dequeue',done);
       reject(new Error('MP3 peak index decoder stalled'))},5000);
      const done=()=>{clearTimeout(timeout);decoder.removeEventListener('dequeue',done);resolve()};
      decoder.addEventListener('dequeue',done,{once:true});
      if(decoder.decodeQueueSize<=8)done();
     });
    }
    if(err)throw err;
    if(onProgress)onProgress(offset/f.size);
   }
  }
  if(!decoder||frames<2)throw Error('No MP3 frames decoded');
  await decoder.flush();if(err)throw err;if(onProgress)onProgress(1);
  const indexed=peaks.finish(rate);
  if(gapless.nativeSampleCount!=null&&indexed.sampleCount!==gapless.nativeSampleCount)
   throw new StreamingUnavailable('MP3 gapless sample count differs from Xing metadata');
  return {...indexed,mode:'streamed-webcodecs-mp3',channels,
   compressedFrames:frames,bytesRead:f.size,gapless};
 }finally{if(decoder&&decoder.state!=='closed')decoder.close()}
}
export async function indexAudioPeaks(file,opts={}){
 const b=new Uint8Array(await read(file,0,Math.min(12,file.size)));
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'
  &&String.fromCharCode(...b.slice(8,12))==='WAVE')return indexWav(file,opts);
 if(b.length>=3&&(String.fromCharCode(...b.slice(0,3))==='ID3'||mp3Header(b)))
  return indexMp3(file,opts);
 throw new StreamingUnavailable('No streaming indexer for audio container');
}

// Shared RIFF parser and native sample converter for bounded PCM clip loading.
export {wavMeta as readWavMetadata, pcm as readPcmSample};
