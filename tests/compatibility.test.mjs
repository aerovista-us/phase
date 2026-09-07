import test from'node:test';import assert from'node:assert/strict';
import{keyRelation,bestKeyShift,tempoCompatibility,meterCompatibility,mashupCompatibility,suggestAlignmentPairs}from'../js/compatibility.js';

const key=(root,mode)=>({keyRoot:root,keyMode:mode});
const phraseTrack=({root=0,mode='major',bpm=120,bpb=4,boostBar=17}={})=>{
  const bars=40,beats=[];for(let bar=0;bar<bars;bar++)for(let beat=0;beat<bpb;beat++){const hit=bar===boostBar-1&&beat===0;beats.push({time:(bar*bpb+beat)*60/bpm,accent:hit?2:.25,lowAccent:hit?2:.18,highAccent:hit?.6:.12})}
  return{sourceBpm:bpm,beatsPerBar:bpb,analysis:{bpm,beatsPerBar:bpb,downbeatPhase:0,keyRoot:root,keyMode:mode,beats},markers:beats.map((b,i)=>({beat:i,sourceTime:b.time,targetTime:b.time,downbeat:i%bpb===0,locked:i===0}))};
};

test('relative keys score as fully compatible',()=>{const r=keyRelation(key(0,'major'),key(9,'minor'));assert.equal(r.kind,'relative key');assert.equal(r.score,1)});
test('best key shift prefers the smallest strong correction',()=>{const r=bestKeyShift(key(0,'major'),key(2,'major'));assert.equal(r.shift,-2);assert.equal(r.relation.kind,'same key')});
test('tempo and meter compatibility reward close musical grids',()=>{assert.ok(tempoCompatibility(120,122).score>.9);assert.equal(meterCompatibility({beatsPerBar:4},{beatsPerBar:4}).score,1);assert.ok(meterCompatibility({beatsPerBar:3},{beatsPerBar:6}).score>.5)});
test('mashup score combines key tempo and meter without mutating tracks',()=>{const a=phraseTrack(),b=phraseTrack({root:9,mode:'minor',bpm:121}),before=b.sourceBpm,r=mashupCompatibility(a,b);assert.ok(r.score>.9);assert.equal(r.key.kind,'relative key');assert.equal(b.sourceBpm,before)});
test('phrase pair suggestions return existing beat indices and favor structural entrances',()=>{const a=phraseTrack({boostBar:17}),b=phraseTrack({boostBar:17}),pairs=suggestAlignmentPairs(a,b,{maxPairs:3});assert.ok(pairs.length>0);assert.ok(Number.isInteger(pairs[0].a.beatIndex));assert.ok(Number.isInteger(pairs[0].b.beatIndex));assert.ok(a.markers[pairs[0].a.beatIndex]);assert.ok(b.markers[pairs[0].b.beatIndex]);assert.ok(pairs[0].score>=pairs.at(-1).score)});
