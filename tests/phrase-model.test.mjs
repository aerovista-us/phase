import test from'node:test';import assert from'node:assert/strict';
import{barFeatures,phraseBoundaryScore,suggestPhraseBoundaries,nearestPhraseSuggestion}from'../js/phrase-model.js';

function makeTrack({bars=16,bpb=4,changeBar=9}={}){const beats=[];for(let bar=1;bar<=bars;bar++)for(let beat=0;beat<bpb;beat++){const high=bar>=changeBar,down=beat===0,base=high?.9:.18;beats.push({time:beats.length*.5,accent:base+(down?.18:0),lowAccent:base*(high?.9:.45),highAccent:base*(high?.6:.25)})}return{beatsPerBar:bpb,analysis:{beatsPerBar:bpb,downbeatPhase:0,beats},markers:beats.map((b,i)=>({sourceTime:b.time,targetTime:b.time,downbeat:i%bpb===0}))}}

test('bar features follow detected meter',()=>{const f=barFeatures(makeTrack({bars:10,bpb:3}));assert.equal(f.length,10);assert.equal(f[1].beatIndex,3);assert.equal(f[4].bar,5)});
test('novelty rises at a strong section energy change',()=>{const f=barFeatures(makeTrack());assert.ok(phraseBoundaryScore(f,8)>.2);assert.ok(phraseBoundaryScore(f,3)<phraseBoundaryScore(f,8))});
test('phrase suggestions include a prominent bar-nine entrance',()=>{const s=suggestPhraseBoundaries(makeTrack());const hit=s.find(x=>x.bar===9);assert.ok(hit,JSON.stringify(s));assert.ok(hit.confidence>.3)});
test('nearest phrase navigation moves forward and backward',()=>{const s=[{time:8},{time:16},{time:24}];assert.equal(nearestPhraseSuggestion(s,13).time,16);assert.equal(nearestPhraseSuggestion(s,16,{direction:1}).time,24);assert.equal(nearestPhraseSuggestion(s,16,{direction:-1}).time,8)});
