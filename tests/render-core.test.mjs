import test from 'node:test';
import assert from 'node:assert/strict';
import { outputDuration, renderGranular } from '../js/render-core.js';

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

test('time stretch roughly preserves pitch', () => {
  const sr=8000,input=sine(sr,1,220);
  const result=renderGranular({sampleRate:sr,channels:[input],duration:1,markers:[{sourceTime:0,targetTime:0},{sourceTime:1,targetTime:1.25}],pitch:0,grainSize:512,hop:128});
  assert.ok(Math.abs(result.duration-1.25)<.001);
  const hz=estimateHz(result.channels[0],sr,Math.floor(sr*.2),Math.floor(sr*1.05));
  assert.ok(hz>205&&hz<235,`expected ~220 Hz, got ${hz}`);
});

test('pitch shifts independently of duration', () => {
  const sr=8000,input=sine(sr,1,220);
  const result=renderGranular({sampleRate:sr,channels:[input],duration:1,markers:[{sourceTime:0,targetTime:0},{sourceTime:1,targetTime:1}],pitch:12,grainSize:512,hop:128});
  assert.ok(Math.abs(result.duration-1)<.001);
  const hz=estimateHz(result.channels[0],sr,Math.floor(sr*.2),Math.floor(sr*.8));
  assert.ok(hz>400&&hz<480,`expected ~440 Hz, got ${hz}`);
});
