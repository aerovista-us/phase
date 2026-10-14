import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeWavWindow,decodeSourceWindow,prepareAssemblyItems,activeClipWindow,sampleWindow,wavInfo} from '../js/assembly-window-decode.js';
import {findQuietZeroCrossing} from '../js/splice-precision.js';
import {envelopeGainAtLocal} from '../js/fade-model.js';

const rate=48000,channels=2;
function fileFixture({seconds=22,sampleRate=rate,tail=false}={}){
 const frames=seconds*sampleRate,bytes=frames*channels*2;
 const out=new ArrayBuffer(44+bytes),v=new DataView(out);
 const str=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j))};
 str(0,'RIFF');v.setUint32(4,out.byteLength-8,true);str(8,'WAVEfmt ');
 v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);
 v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*channels*2,true);
 v.setUint16(32,channels*2,true);v.setUint16(34,16,true);
 str(36,'data');v.setUint32(40,bytes,true);
 for(let i=0;i<frames;i++)for(let ch=0;ch<channels;ch++){
  const amplitude=Math.round(16000*Math.sin(2*Math.PI*(ch===0?80:120)*i/sampleRate));
  v.setInt16(44+i*4+ch*2,amplitude,true);
 }
 return new File([out],'original.wav',{type:'audio/wav'});
}
function context(){
 return {createBuffer:(ch,frames,sampleRate)=>{
  const arrays=Array.from({length:ch},()=>new Float32Array(frames));
  return {numberOfChannels:ch,length:frames,sampleRate,duration:frames/sampleRate,getChannelData:i=>arrays[i]};
 }};
}
test('WAV windows load original PCM without reading the entire 22s recording',async()=>{
 const f=fileFixture(),meta=await wavInfo(f);
 let maxSlice=0,reads=0;
 const original=f.slice.bind(f);
 f.slice=(start,end)=>{maxSlice=Math.max(maxSlice,end-start);reads++;return original(start,end)};
 f.arrayBuffer=()=>{throw Error('Full file read prohibited')};
 const result=await decodeWavWindow(f,{startSec:18.25,endSec:19.5,context:context(),chunkBytes:2048});
 assert.equal(result.mode,'windowed-original-pcm-wav');
 assert.equal(result.buffer.length,60000);
 assert.equal(result.buffer.numberOfChannels,2);
 assert.equal(result.firstSample,18.25*rate);
 assert.ok(maxSlice<=2048,'peak read size must be bounded');
 assert.ok(reads>25);
 assert.ok(Math.abs(result.buffer.getChannelData(0)[12]-Math.sin(2*Math.PI*80*12/rate)*16000/32768)<.0002);
 assert.ok(meta.size>result.decodedBytes*3,'large original is not fully decoded');
});
test('render items rebase clip sample offset and fade envelopes correctly',async()=>{
 const f=fileFixture({seconds:24});
 const source={id:'one',file:f,indexMode:'streamed-pcm-wav',duration:24,sampleRate:rate};
 const clip={id:'clip1',sourceId:'one',sourceIn:18,sourceOut:20,masterStart:4,
  fadeInSec:.1,fadeOutSec:.2,gainDb:-3,fadeInCurve:'equalPower',fadeOutCurve:'linear'};
 const result=await prepareAssemblyItems([clip],id=>id==='one'?source:null,{
  context:context(),loadFullBuffer:()=>{throw Error('Fallback must not decode original file')}});
 const item=result.items[0];
 assert.equal(item.buffer.length,96000);assert.equal(item.offset,4);
 assert.equal(item.sourceIn,0);assert.equal(item.sourceOut,2);
 assert.equal(item.fadeInStart,0);assert.ok(Math.abs(item.fadeOutStart-1.8)<.0000001);
 assert.equal(item.fadeInCurve,'equalPower');
 assert.ok(Math.abs(envelopeGainAtLocal(.05,item)-Math.SQRT1_2)<.000001);
 assert.ok(result.plannedBytes<=2*rate*2*4);
});
test('transport seeks only the needed source window and preserves original fade placement',async()=>{
 const f=fileFixture({seconds:24});
 const s={id:'one',file:f,indexMode:'streamed-pcm-wav',duration:24,sampleRate:rate};
 const c={id:'clip1',sourceId:'one',sourceIn:18,sourceOut:23,masterStart:1,fadeInSec:.5,fadeOutSec:.5};
 const result=await prepareAssemblyItems([c],()=>s,{
  context:context(),loadFullBuffer:()=>{throw Error('No full decode')},from:3,to:4});
 assert.equal(result.items.length,1);
 const item=result.items[0];
 assert.equal(item.buffer.length,rate);
 assert.equal(item.offset,3);
 assert.equal(item.fadeInStart,-2);
 assert.equal(item.fadeInEnd,-1.5);
 assert.equal(item.fadeOutEnd,3);
 assert.equal(envelopeGainAtLocal(0,item),1);
});
test('full-source compatibility stays source-relative and does not pretend to be partial',async()=>{
 const f=new File([new Uint8Array(2048)],'legacy.mp3',{type:'audio/mpeg'});
 const s={id:'mp3',file:f,indexMode:'streamed-webcodecs-mp3',duration:20,sampleRate:rate};
 const c={id:'c',sourceId:'mp3',sourceIn:10,sourceOut:11,masterStart:4,fadeInSec:.05,fadeOutSec:.05};
 let calls=0;
 const prepared=await prepareAssemblyItems([c],()=>s,{context:context(),
  loadFullBuffer:async()=>{calls++;return {duration:20}}});
 const item=prepared.items[0];
 assert.equal(calls,1);assert.equal(item.mode,'compatibility-full-source');
 assert.equal(item.offset,-6);assert.equal(item.sourceIn,10);
 assert.equal(item.fadeInStart,10);
});
test('memory preflight rejects large clips before any decoded audio allocation',async()=>{
 const file=new File([new Uint8Array(1024)],'fake.mp3');
 const s={id:'a',file,indexMode:'full-decode-fallback',duration:1800,sampleRate:48000};
 const c={id:'c',sourceId:'a',sourceIn:0,sourceOut:1,masterStart:0};
 let called=false;
 await assert.rejects(prepareAssemblyItems([c],()=>s,{
  context:context(),loadFullBuffer:()=>{called=true},maxTotalBytes:1024*1024}),/budget/);
 assert.equal(called,false);
});
test('invalid windows reject and empty timeline produces no items',async()=>{
 const file=fileFixture({seconds:2});
 const meta=await wavInfo(file);
 assert.throws(()=>sampleWindow(meta,1.7,2.1),/outside/);
 assert.throws(()=>sampleWindow(meta,-1,1),/Invalid/);
 assert.equal(activeClipWindow({masterStart:8,sourceIn:0,sourceOut:2},1,2),null);
 const p=await prepareAssemblyItems([],()=>null,{context:context(),loadFullBuffer:()=>null});
 assert.equal(p.items.length,0);
});

test('splice detail retains only the requested native samples and maps snap back exactly',async()=>{
 const file=fileFixture(),ctx=context(),s={file,name:'original.wav',duration:22,sampleRate:rate,indexMode:'streamed-pcm-wav'};
 const full=await decodeWavWindow(file,{startSec:0,endSec:22,context:ctx});
 file.arrayBuffer=()=>{throw Error('Full source decode forbidden')};
 const at=18.231,start=Math.max(0,at-.012-2/rate),end=at+.012+2/rate;
 const part=await decodeSourceWindow(s,{startSec:start,endSec:end,context:ctx,
  loadFullBuffer:()=>{throw Error('No full fallback')}});
 assert.ok(part.buffer.length<1200);
 assert.equal(part.startSec,Math.round(start*rate)/rate);
 const native=findQuietZeroCrossing(full.buffer,at),bounded=findQuietZeroCrossing(part.buffer,at-part.startSec);
 assert.ok(native&&bounded);
 assert.equal(Math.round((part.startSec+bounded.timeSec)*rate),native.sampleIndex);
 assert.equal(bounded.shiftMs,native.shiftMs);
 assert.equal(bounded.rmsAtBoundary,native.rmsAtBoundary);
});
test('unsupported detail sources use labeled native compatibility and preflight rejects huge sources',async()=>{
 const ctx=context(),file=new File([new Uint8Array(100)],'other.ogg');
 const s={file,duration:1,sampleRate:rate,channels:2,indexMode:'full-decode-fallback'};
 let calls=0;
 const part=await decodeSourceWindow(s,{startSec:.25,endSec:.3,context:ctx,loadFullBuffer:async()=>{calls++;return ctx.createBuffer(2,rate,rate)}});
 assert.equal(part.mode,'compatibility-full-source');assert.equal(part.startSec,0);assert.equal(calls,1);
 await assert.rejects(decodeSourceWindow({...s,duration:1000},{startSec:.25,endSec:.3,context:ctx,maxFullBytes:1024,loadFullBuffer:()=>{calls++}}),/memory budget/);
 assert.equal(calls,1);
});
test('source detail validates bounds before decoder or fallback allocations',async()=>{
 const s={file:new File(['x'],'x.ogg'),duration:1,sampleRate:rate};let allocations=0;
 for(const [a,b]of[[-1,.1],[.5,.4],[0,2],[NaN,.1],[0,Infinity]])
  await assert.rejects(decodeSourceWindow(s,{startSec:a,endSec:b,context:context(),loadFullBuffer:()=>allocations++}),/Invalid/);
 assert.equal(allocations,0);
});
