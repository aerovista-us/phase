import test from'node:test';import assert from'node:assert/strict';
import{tempoOctaveTarget,applyTempoOctave}from'../js/tempo-model.js';

const track=()=>({sourceBpm:100,beatsPerBar:4,gridMode:'detected',markers:Array.from({length:9},(_,i)=>({beat:i,sourceTime:i*.6,targetTime:i*.6,downbeat:i%4===0,locked:i===0,confidence:1})),analysis:{bpm:100,rawBpm:100,beatsPerBar:4,downbeatPhase:0,beats:Array.from({length:9},(_,i)=>({time:i*.6,accent:i%4===0?1:.2,lowAccent:i%4===0?1:.1}))}});

test('tempo octave target respects supported BPM range',()=>{assert.equal(tempoOctaveTarget(100,.5),50);assert.equal(tempoOctaveTarget(100,2),200);assert.equal(tempoOctaveTarget(50,.5),null);assert.equal(tempoOctaveTarget(130,2),null)});

test('half tempo thins detected markers and preserves times',()=>{const t=track(),r=applyTempoOctave(t,.5);assert.equal(r.bpm,50);assert.equal(t.markers.length,5);assert.deepEqual(t.markers.map(m=>m.sourceTime),[0,1.2,2.4,3.6,4.8]);assert.equal(t.markers[4].downbeat,true);assert.equal(t.analysis.beats.length,5)});

test('double tempo interpolates markers without changing timeline duration',()=>{const t=track(),r=applyTempoOctave(t,2);assert.equal(r.bpm,200);assert.equal(t.markers.length,17);assert.equal(t.markers[1].sourceTime,.3);assert.equal(t.markers[1].targetTime,.3);assert.equal(t.markers.at(-1).sourceTime,4.8);assert.equal(t.markers[4].downbeat,true);assert.equal(t.gridMode,'tempo-corrected')});
