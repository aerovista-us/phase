import test from'node:test';import assert from'node:assert/strict';
import{ensureStemState,setStemBuffer,clearStem,setUseStems,activeAudioParts,stemDurationCompatible,stemProjectMetadata,applyStemProjectMetadata}from'../js/stems.js';

const buf=duration=>({duration});
const track=()=>({duration:10,buffer:buf(10),renderedBuffer:null});

test('stem state initializes four canonical slots',()=>{const t=track();ensureStemState(t);assert.deepEqual(Object.keys(t.stems),['vocals','drums','bass','other']);assert.equal(t.useStems,false)});
test('manual stems can replace the mix as playback parts',()=>{const t=track();setStemBuffer(t,'vocals',buf(10),{fileName:'vocals.wav'});setStemBuffer(t,'drums',buf(10));assert.equal(setUseStems(t,true),true);assert.deepEqual(activeAudioParts(t).map(x=>x.id),['vocals','drums']);t.stems.vocals.mute=true;assert.deepEqual(activeAudioParts(t).map(x=>x.id),['drums'])});
test('stem mode falls back to the original mix when no stems are loaded',()=>{const t=track();t.useStems=true;assert.deepEqual(activeAudioParts(t).map(x=>x.id),['mix']);assert.equal(setUseStems(t,true),false)});
test('stem duration validation tolerates normal separator padding only',()=>{const t=track();assert.equal(stemDurationCompatible(t,buf(10.2)),true);assert.equal(stemDurationCompatible(t,buf(11)),false)});
test('stem metadata persists without embedding audio buffers',()=>{const t=track();setStemBuffer(t,'bass',buf(10),{fileName:'bass.wav'});t.stems.bass.gainDb=-3;t.stems.bass.mute=true;setUseStems(t,true);const meta=stemProjectMetadata(t);assert.equal(meta.useStems,true);assert.equal(meta.stems.bass.fileName,'bass.wav');assert.equal('buffer'in meta.stems.bass,false);const restored=track();applyStemProjectMetadata(restored,meta);assert.equal(restored.stems.bass.fileName,'bass.wav');assert.equal(restored.stems.bass.gainDb,-3);assert.equal(restored.stems.bass.mute,true);assert.equal(restored.useStems,false);clearStem(t,'bass');assert.equal(t.stems.bass.buffer,null)});
