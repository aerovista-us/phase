import test from 'node:test';
import assert from 'node:assert/strict';
import { outputDuration, dirtyRenderRanges, dirtyBlendWeight, renderGranular } from '../js/render-core.js';
import { alignTrackToMaster, correctGridMarker } from '../js/warp.js';

function sine(sr, seconds, hz) {
  const n = Math.floor(sr * seconds), a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.sin(2 * Math.PI * hz * i / sr);
  return a;
}
function estimateHz(a, sr, start = 0, end = a.length) {
  let crossings = 0;
  for (let i = Math.max(1,start); i < end; i++) if (a[i-1] <= 0 && a[i] > 0) crossings++;
  return crossings / ((end-start)/sr);
}

test('output duration follows final warp offset', () => {
  assert.equal(outputDuration(10,[{sourceTime:0,targetTime:0},{sourceTime:8,targetTime:10}]),12);
  assert.equal(outputDuration(10,[{sourceTime:0,targetTime:0},{sourceTime:8,targetTime:6}]),8);
});

test('dirty render plan marks only genuinely stretched intervals',()=>{
  const markers=[{sourceTime:0,targetTime:0},{sourceTime:1,targetTime:1.5},{sourceTime:2,targetTime:2.5},{sourceTime:3,targetTime:3.5}];
  assert.deepEqual(dirtyRenderRanges(markers,3,0),[{start:0,end:1.5}]);
  assert.deepEqual(dirtyRenderRanges(markers.map(m=>({...m,targetTime:m.sourceTime+1})),3,0),[]);
  assert.deepEqual(dirtyRenderRanges(markers,3,2),[{start:0,end:3.5}]);
});

test('dirty boundary blend ramps smoothly',()=>{
  const r=[{start:1,end:2}],fade=.1;
  assert.equal(dirtyBlendWeight(.9,r,fade),0);
  assert.ok(Math.abs(dirtyBlendWeight(.95,r,fade)-.5)<1e-9);
  assert.equal(dirtyBlendWeight(1,r,fade),1);
  assert.ok(Math.abs(dirtyBlendWeight(2.05,r,fade)-.5)<1e-9);
  assert.ok(dirtyBlendWeight(2.1,r,fade)<1e-12);
});

test('time stretch roughly preserves pitch', () => {
  const sr=8000,input=sine(sr,1,220);
  const result=renderGranular({sampleRate:sr,channels:[input],duration:1,markers:[{sourceTime:0,targetTime:0},{sourceTime:1,targetTime:1.25}],pitch:0,grainSize:512,hop:128});
  assert.ok(Math.abs(result.duration-1.25)<.001);
  const hz=estimateHz(result.channels[0],sr,Math.floor(sr*.2),Math.floor(sr*1.05));
  assert.ok(hz>205&&hz<235,`expected ~220 Hz, got ${hz}`);
});

test('hybrid render preserves clean PCM and skips clean-region grain work',()=>{
  const sr=8000,input=sine(sr,1.2,173),markers=[{sourceTime:0,targetTime:0},{sourceTime:.5,targetTime:.75},{sourceTime:1,targetTime:1.25}];
  const result=renderGranular({sampleRate:sr,channels:[input],duration:1.2,markers,pitch:0,grainSize:512,hop:128});
  const outIndex=Math.round(1.0*sr),sourceIndex=Math.round(.75*sr);
  assert.ok(Math.abs(result.channels[0][outIndex]-input[sourceIndex])<1e-4,`clean section drifted: ${result.channels[0][outIndex]} vs ${input[sourceIndex]}`);
  assert.ok(result.processedGrains<result.totalGrains,`expected sparse work, processed ${result.processedGrains}/${result.totalGrains}`);
  assert.ok(result.workRatio<.9,`expected meaningful skipped work, ratio ${result.workRatio}`);
});

test('constant-offset timing map uses direct PCM without granular work',()=>{
  const sr=8000,input=sine(sr,1,137),markers=[{sourceTime:0,targetTime:.2},{sourceTime:.5,targetTime:.7},{sourceTime:1,targetTime:1.2}];
  const result=renderGranular({sampleRate:sr,channels:[input],duration:1,markers,pitch:0,grainSize:512,hop:128});
  assert.equal(result.processedGrains,0);
  const oi=Math.round(.6*sr),si=Math.round(.4*sr);
  assert.ok(Math.abs(result.channels[0][oi]-input[si])<1e-4);
});

test('pitch shifts independently of duration', () => {
  const sr=8000,input=sine(sr,1,220);
  const result=renderGranular({sampleRate:sr,channels:[input],duration:1,markers:[{sourceTime:0,targetTime:0},{sourceTime:1,targetTime:1}],pitch:12,grainSize:512,hop:128});
  assert.ok(Math.abs(result.duration-1)<.001);
  assert.equal(result.processedGrains,result.totalGrains);
  const hz=estimateHz(result.channels[0],sr,Math.floor(sr*.2),Math.floor(sr*.8));
  assert.ok(hz>400&&hz<480,`expected ~440 Hz, got ${hz}`);
});

test('follower alignment uses the master edited target grid',()=>{
  const master={sourceBpm:100,markers:[{targetTime:0,downbeat:true},{targetTime:.6},{targetTime:1.22},{targetTime:1.8},{targetTime:2.41}]};
  const follower={markers:Array.from({length:5},(_,i)=>({targetTime:i*.5,downbeat:i===0,locked:i===0}))};
  alignTrackToMaster(master,follower);
  assert.deepEqual(follower.markers.map(m=>Number(m.targetTime.toFixed(2))),[0,.6,1.22,1.8,2.41]);
  assert.equal(follower.markers[0].locked,true);
});

test('grid correction moves one detector tick while preserving its warp offset',()=>{
  const track={duration:4,markers:[
    {sourceTime:0,targetTime:0},{sourceTime:1,targetTime:1.1},{sourceTime:2,targetTime:2.2},{sourceTime:3,targetTime:3.3}
  ]};
  const ss=track.markers.map(m=>m.sourceTime),ts=track.markers.map(m=>m.targetTime);
  correctGridMarker(track,1,1.18,ss,ts);
  assert.ok(Math.abs(track.markers[1].sourceTime-1.08)<1e-9);
  assert.ok(Math.abs(track.markers[1].targetTime-1.18)<1e-9);
  assert.ok(Math.abs((track.markers[1].targetTime-track.markers[1].sourceTime)-.1)<1e-9);
  assert.equal(track.markers[2].targetTime,2.2);
});
