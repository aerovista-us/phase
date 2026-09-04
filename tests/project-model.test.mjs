import test from'node:test';import assert from'node:assert/strict';
import{snapshotProject,applyProjectSnapshot,applyTrackSnapshot,editableFingerprint,validateProject}from'../js/project-model.js';

const makeState=()=>({bpm:98,viewDuration:180,pxPerSecond:12,snapMode:'16bar',playheadTime:42.5,loopBars:16,loopEnabled:true,tracks:[{label:'TRACK A',name:'a.wav',file:{name:'a.wav'},buffer:{},sourceBpm:97.5,pitch:0,timelineOffset:1.25,gridMode:'detected',alignMarker:8,gainDb:-2.5,mute:false,solo:true,analysis:{key:'Am',keyRoot:9,keyMode:'minor',keyConfidence:.8},markers:[{beat:0,sourceTime:0,targetTime:0,downbeat:true,locked:true,confidence:1},{beat:1,sourceTime:.6,targetTime:.62,downbeat:false,locked:false,confidence:.5}]}]});

test('Phase project snapshots preserve arrangement, transport and mix metadata',()=>{const s=makeState(),p=snapshotProject(s);assert.equal(p.version,6);assert.equal(p.snapMode,'16bar');assert.equal(p.playheadTime,42.5);assert.equal(p.loopBars,16);assert.equal(p.loopEnabled,true);assert.equal(p.tracks[0].fileName,'a.wav');assert.equal(p.tracks[0].alignMarker,8);assert.equal(p.tracks[0].gainDb,-2.5);assert.equal(p.tracks[0].analysis.key,'Am');assert.equal(p.tracks[0].markers[1].targetTime,.62)});

test('project snapshot applies to loaded track without replacing audio object',()=>{const source=snapshotProject(makeState()),target=makeState(),audio=target.tracks[0].buffer;target.bpm=120;target.playheadTime=0;target.loopEnabled=false;target.tracks[0].timelineOffset=0;target.tracks[0].markers[1].targetTime=.6;applyProjectSnapshot(target,source,{loadedOnly:true});assert.equal(target.bpm,98);assert.equal(target.playheadTime,42.5);assert.equal(target.loopEnabled,true);assert.equal(target.tracks[0].timelineOffset,1.25);assert.equal(target.tracks[0].markers[1].targetTime,.62);assert.equal(target.tracks[0].buffer,audio)});

test('unloaded tracks can defer marker restoration',()=>{const src=snapshotProject(makeState()).tracks[0],track={label:'TRACK A',buffer:null,markers:[{beat:0,sourceTime:0,targetTime:0}],sourceBpm:120,pitch:0,timelineOffset:0};applyTrackSnapshot(track,src,{applyMarkers:false});assert.equal(track.timelineOffset,1.25);assert.equal(track.markers.length,1);assert.equal(track.fileName,'a.wav')});

test('editable fingerprint ignores file identity and analysis summary',()=>{const a=makeState(),b=makeState();b.tracks[0].file={name:'renamed.wav'};b.tracks[0].analysis.key='C';assert.equal(editableFingerprint(a),editableFingerprint(b));b.tracks[0].pitch=2;assert.notEqual(editableFingerprint(a),editableFingerprint(b))});

test('validation rejects non Phase maps',()=>assert.throws(()=>validateProject({app:'other',tracks:[]})));
