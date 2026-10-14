import test from'node:test';import assert from'node:assert/strict';import{mixRegionWindow,regionFrameCount}from'../js/export.js';
import{sectionRange}from'../js/assembly-section.js';

test('mix region trims a track that started before the loop',()=>assert.deepEqual(mixRegionWindow(2,20,8,12),{delay:0,sourceOffset:6,duration:4}));
test('mix region delays a track that enters inside the loop',()=>assert.deepEqual(mixRegionWindow(10,20,8,16),{delay:2,sourceOffset:0,duration:6}));
test('mix region ignores non-overlapping tracks',()=>assert.equal(mixRegionWindow(20,4,8,16),null));
test('mix region honors source IN and OUT boundaries',()=>{assert.deepEqual(mixRegionWindow(4,20,0,30,3,9),{delay:7,sourceOffset:3,duration:6});assert.deepEqual(mixRegionWindow(4,20,8,12,3,9),{delay:0,sourceOffset:4,duration:4})});
test('mix region ignores a loop outside the trimmed source',()=>assert.equal(mixRegionWindow(4,20,0,6,3,9),null));
test('validated selection frames never gain a floating-point trailing frame',()=>{
 for(const sr of[44100,48000,96000])for(const [a,b]of[[0,.005],[.301,.307],[1.7,1.711]]){
  const range=sectionRange(a,b,10,sr);
  assert.equal(regionFrameCount(range.end-range.start,sr,range.frames),range.last-range.first);
 }
 assert.equal(sectionRange(0,.005,10,44100).frames,221);
});
test('invalid or mismatched explicit region frame counts fail closed',()=>{
 for(const n of[0,-1,1.5,NaN,Infinity,999])assert.throws(()=>regionFrameCount(.1,44100,n),/frame count/);
 assert.throws(()=>regionFrameCount(0,44100,1),/empty/);
});
