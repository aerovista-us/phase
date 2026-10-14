import test from 'node:test';
import assert from 'node:assert/strict';
import {mp3Frames,decodeMp3Window,mp3GaplessInfo}from'../js/assembly-mp3-window.js';

const rate=44100,FRAME=417,SAMPLES=1152;
function fixture(frames=70){
 const all=new Uint8Array(frames*FRAME);
 for(let i=0;i<frames;i++)all.set([0xff,0xfb,0x90,0x64],i*FRAME);
 return new File([all],'synthetic.mp3',{type:'audio/mpeg'});
}
const fakeContext={createBuffer:(ch,n,sr)=>{
 const tracks=Array.from({length:ch},()=>new Float32Array(n));
 return{duration:n/sr,length:n,numberOfChannels:ch,sampleRate:sr,getChannelData:i=>tracks[i]};
}};
test('frame parser reads compressed MP3 chunks, not whole original file',async()=>{
 const file=fixture(65);
 let reads=0,max=0;const original=file.slice.bind(file);
 file.slice=(a,b)=>{reads++;max=Math.max(max,b-a);return original(a,b)};
 file.arrayBuffer=()=>{throw Error('Never call full file arrayBuffer')};
 const indexes=[];for await(const frame of mp3Frames(file,{chunkBytes:2048})){
  indexes.push(frame.index);assert.equal(frame.header.sampleRate,rate);
 }
 assert.equal(indexes.length,65);assert.equal(indexes[64],64);
 assert.ok(max<=2048);assert.ok(reads>12);
});
test('MP3 decoder retains only source selection, with correct absolute sample positions',async()=>{
 const original=globalThis.AudioDecoder,encoded=globalThis.EncodedAudioChunk;
 let nextFrame=0,closed=false;
 globalThis.EncodedAudioChunk=class{constructor(o){Object.assign(this,o)}};
 globalThis.AudioDecoder=class{
  static async isConfigSupported(){return{supported:true}}
  constructor({output,error}){this.output=output;this.error=error;this.state='unconfigured'}
  configure(){this.state='configured'}
  decode(){
   const index=nextFrame++;
   this.output({sampleRate:rate,numberOfChannels:2,numberOfFrames:SAMPLES,
    copyTo:(dst,{planeIndex})=>{for(let i=0;i<SAMPLES;i++)dst[i]=(index*SAMPLES+i+planeIndex)/100000},
    close(){closed=true}});
  }
  async flush(){}
  close(){this.state='closed'}
 };
 try{
  const startFrame=12*SAMPLES+123,endFrame=15*SAMPLES+45;
  const result=await decodeMp3Window(fixture(70),{
   startSec:startFrame/rate,endSec:endFrame/rate,context:fakeContext,chunkBytes:2048});
  assert.equal(result.buffer.length,endFrame-startFrame);
  assert.equal(result.buffer.getChannelData(0)[0],Math.fround(startFrame/100000));
  assert.equal(result.buffer.getChannelData(1)[endFrame-startFrame-1],Math.fround(endFrame/100000));
  assert.ok(result.compressedFramesFed<70);
  assert.equal(result.decodedBytes,(endFrame-startFrame)*8);
  assert.equal(closed,true);
 }finally{globalThis.AudioDecoder=original;globalThis.EncodedAudioChunk=encoded}
});
test('reject oversized selection before decoder allocation',async()=>{
 const original=globalThis.AudioDecoder,encoded=globalThis.EncodedAudioChunk;
 globalThis.AudioDecoder=class{static async isConfigSupported(){return{supported:true}}};
 globalThis.EncodedAudioChunk=class{};
 try{
  await assert.rejects(decodeMp3Window(fixture(),{startSec:0,endSec:45,context:fakeContext,maxDecodedBytes:1024}),/budget/);
 }finally{globalThis.AudioDecoder=original;globalThis.EncodedAudioChunk=encoded}
});
test('reject unsupported native decoder without using a lossy peak proxy',async()=>{
 const original=globalThis.AudioDecoder;
 delete globalThis.AudioDecoder;
 try{await assert.rejects(decodeMp3Window(fixture(),{startSec:0,endSec:1,context:fakeContext}),/unavailable/)}
 finally{globalThis.AudioDecoder=original}
});

test('recognized Xing/Lavc gapless tag derives exact native sample offset',()=>{
 const first=new Uint8Array(FRAME);
 first.set([0xff,0xfb,0x90,0x64]);
 const xing=36;first.set([88,105,110,103],xing); // Xing
 first.set([0,0,0,15],xing+4); // frames, bytes, TOC, vbr scale
 first.set([0,0,0,40],xing+8);
 const encoder=xing+8+4+4+100+4;
 first.set([76,97,118,99],encoder); // Lavc
 const delay=576,padding=1404;
 first[encoder+21]=delay>>4;
 first[encoder+22]=((delay&15)<<4)|(padding>>8);
 first[encoder+23]=padding&255;
 const h={frameSamples:1152};
 const metadata=mp3GaplessInfo(h,first);
 assert.equal(metadata.leadSamples,2257);
 assert.equal(metadata.tailSamples,875);
 assert.equal(metadata.nativeSampleCount,44100);
 assert.equal(metadata.mode,'xing-gapless-verified');
 first[encoder]=0;assert.throws(()=>mp3GaplessInfo(h,first),/Unknown/);
});
