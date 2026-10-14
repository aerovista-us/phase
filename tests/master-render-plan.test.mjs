import test from 'node:test';
import assert from 'node:assert/strict';
import{
 PCM16_STEREO_BYTES_PER_FRAME,CLASSIC_RIFF_MAX_DATA_BYTES,
 projectOutputFrameCount,globalMixNormalizationCount,createMasterRenderPlan,
 masterFrameChunks,validateMasterChunkSequence
}from '../js/master-render-plan.js';

const clips=[
 {id:'a',sourceId:'s1',masterStart:0,sourceIn:0,sourceOut:10,group:'A'},
 {id:'b',sourceId:'s2',masterStart:9.1,sourceIn:2,sourceOut:10,group:'B'},
 {id:'c',sourceId:'s1',masterStart:19,sourceIn:0,sourceOut:1,group:'A'}
];
test('full arrangement defines one integer project sample grid',()=>{
 const p=createMasterRenderPlan(clips,{sampleRate:48000,chunkSeconds:3});
 assert.equal(p.totalFrames,20*48000);
 assert.equal(p.chunkFrames,3*48000);
 assert.equal(p.chunks,7);
 assert.equal(p.totalSeconds,20);
 assert.equal(p.outputDataBytes,20*48000*PCM16_STEREO_BYTES_PER_FRAME);
 assert.equal(p.normalizationCount,2);
 assert.equal(p.masterGain,.92);
 const chunks=[...masterFrameChunks(p)];
 assert.equal(validateMasterChunkSequence(p,chunks),true);
 assert.equal(chunks[6].frameCount,2*48000);
 assert.equal(chunks[6].endFrame,p.totalFrames);
 assert.equal(chunks.filter(x=>x.final).length,1);
});
test('short selections and fractional durations never add or drop output frames',()=>{
 const p=createMasterRenderPlan([{masterStart:0,sourceIn:0,sourceOut:.005}],{
  sampleRate:44100,chunkSeconds:.001
 });
 assert.equal(p.totalFrames,221);
 assert.deepEqual([...masterFrameChunks(p)].map(c=>c.frameCount),[44,44,44,44,44,1]);
 assert.equal([...masterFrameChunks(p)].reduce((sum,c)=>sum+c.frameCount,0),221);
});
test('global mix normalization does not depend on which track is audible in a chunk',()=>{
 const p=createMasterRenderPlan([
  {masterStart:0,sourceIn:0,sourceOut:2,group:'A'},
  {masterStart:5,sourceIn:0,sourceOut:2,group:'B'},
  {masterStart:9,sourceIn:0,sourceOut:2,group:'A'}
 ]);
 assert.equal(p.normalizationCount,2);
 assert.equal(globalMixNormalizationCount([{}]),1);
 assert.equal(globalMixNormalizationCount([{group:null},{group:null}]),2);
});
test('the generator forbids gaps, duplicate frames and frame-overlaps',()=>{
 const p=createMasterRenderPlan(clips,{sampleRate:48000,chunkSeconds:2});
 const chunks=[...masterFrameChunks(p)];
 assert.throws(()=>validateMasterChunkSequence(p,chunks.slice(1)),/Missing/);
 assert.throws(()=>validateMasterChunkSequence(p,chunks.slice(0,-1)),/missing final/);
 const duplicate=chunks.map(c=>({...c}));
 duplicate[1].startFrame--;assert.throws(()=>validateMasterChunkSequence(p,duplicate),/Missing/);
});
test('classic RIFF limit, invalid geometry, invalid chunk budget fail closed',()=>{
 assert.equal(CLASSIC_RIFF_MAX_DATA_BYTES,0xffffffff-36);
 assert.throws(()=>createMasterRenderPlan([{masterStart:0,sourceIn:0,sourceOut:4*3600}],{
  sampleRate:48000}),/4 GiB/);
 assert.throws(()=>projectOutputFrameCount([{masterStart:0,sourceIn:9,sourceOut:2}],48000),/geometry/);
 assert.throws(()=>projectOutputFrameCount([{masterStart:0,sourceIn:0,sourceOut:2}],0),/sample rate/);
 assert.throws(()=>createMasterRenderPlan(clips,{chunkSeconds:0}),/chunk duration/);
 assert.throws(()=>createMasterRenderPlan(clips,{chunkSeconds:11}),/chunk duration/);
 assert.throws(()=>createMasterRenderPlan(clips,{channels:0}),/PCM format/);
});
test('plan metadata is immutable to downstream stage',()=>{
 const p=createMasterRenderPlan(clips);
 assert.equal(Object.isFrozen(p),true);
 assert.equal(Object.isFrozen([...masterFrameChunks(p)][0]),true);
});
