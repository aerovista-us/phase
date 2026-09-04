import test from 'node:test';
import assert from 'node:assert/strict';
import{snapStepSeconds,snapTrackOffset,alignByMarkers}from'../js/arrangement.js';

const mkTrack=(count=16,step=.5)=>({sourceBpm:120,markers:Array.from({length:count},(_,i)=>({beat:i,sourceTime:i*step,targetTime:i*step,downbeat:i%4===0,locked:i===0}))});

test('phrase snap uses beat, bar and phrase lengths',()=>{
  assert.equal(snapStepSeconds(120,'beat'),.5);
  assert.equal(snapStepSeconds(120,'bar'),2);
  assert.equal(snapStepSeconds(120,'8bar'),16);
  assert.equal(snapStepSeconds(120,'16bar'),32);
  assert.equal(snapStepSeconds(120,'32bar'),64);
});

test('track offset snaps chosen local anchor to project phrase boundary',()=>{
  const anchor=2;
  assert.equal(snapTrackOffset(14.2,anchor,120,'8bar'),14);
  assert.equal(snapTrackOffset(29.2,anchor,120,'16bar'),30);
});

test('explicit marker alignment maps selected B marker to selected A marker',()=>{
  const a=mkTrack(20,.5),b=mkTrack(20,.55);
  const result=alignByMarkers(a,b,8,4);
  assert.equal(result.masterIndex,8);
  assert.equal(result.followerIndex,4);
  assert.equal(b.markers[4].targetTime,a.markers[8].targetTime);
  assert.equal(b.markers[5].targetTime,a.markers[9].targetTime);
  assert.equal(b.markers[4].locked,true);
});
