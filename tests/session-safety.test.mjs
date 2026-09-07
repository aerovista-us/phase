import test from'node:test';
import assert from'node:assert/strict';
import{SESSION_STORE,hasSessionContent,persistSession,installSessionSafety}from'../js/session-safety.js';

const project=()=>({bpm:120,meter:'4/4',beatsPerBar:4,viewDuration:60,pxPerSecond:8,tracks:[{label:'TRACK A',fileName:'a.wav',sourceBpm:120,pitch:0,timelineOffset:0,markers:[],stems:{}},{label:'TRACK B',sourceBpm:120,pitch:0,timelineOffset:0,markers:[],stems:{}}]});

test('session safety detects whether a project has source content',()=>{assert.equal(hasSessionContent({tracks:[{},{}]}),false);assert.equal(hasSessionContent(project()),true)});

test('session safety persists a normal Phase project snapshot',()=>{const writes=[];const storage={setItem:(key,value)=>writes.push([key,value])};assert.equal(persistSession(project(),storage),true);assert.equal(writes.length,1);assert.equal(writes[0][0],SESSION_STORE);const saved=JSON.parse(writes[0][1]);assert.equal(saved.app,'EchoVerse Phase');assert.equal(saved.version,12);assert.equal(saved.tracks[0].fileName,'a.wav')});

test('session safety skips empty projects and unavailable storage',()=>{assert.equal(persistSession({tracks:[{},{}]},{setItem(){throw new Error('should not write')}}),false);assert.equal(persistSession(project(),null),false)});

test('lifecycle installer registers pagehide hidden and freeze hooks once',()=>{const winEvents=[],docEvents=[];const win={addEventListener:(name)=>winEvents.push(name)};const doc={addEventListener:(name)=>docEvents.push(name),visibilityState:'visible'};assert.equal(installSessionSafety(win,doc),true);assert.deepEqual(winEvents,['pagehide']);assert.deepEqual(docEvents,['visibilitychange','freeze']);assert.equal(installSessionSafety(win,doc),false);assert.deepEqual(winEvents,['pagehide']);assert.deepEqual(docEvents,['visibilitychange','freeze'])});
