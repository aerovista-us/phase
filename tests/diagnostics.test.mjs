import test from'node:test';import assert from'node:assert/strict';
import{markerGridIssues,trackDiagnostics,projectDiagnostics,diagnosticSeverity}from'../js/diagnostics.js';

const track=()=>({id:0,label:'TRACK A',file:{name:'a.wav'},buffer:{duration:10,sampleRate:44100,numberOfChannels:2},duration:10,sourceBpm:100,meter:'4/4',gridMode:'detected',markers:[{sourceTime:0,targetTime:0},{sourceTime:.6,targetTime:.6}],analysis:{bpm:100,meter:'4/4',key:'Am',tempoConfidence:.8,meterConfidence:.7,downbeatConfidence:.6,keyConfidence:.9},timelineOffset:0,renderedOffset:0,gainDb:0,stems:{}});

test('healthy marker grid has no diagnostic issues',()=>assert.deepEqual(markerGridIssues(track()),[]));
test('diagnostics catch non-increasing target time',()=>{const t=track();t.markers[1].targetTime=0;assert.deepEqual(markerGridIssues(t),['TARGET_TIME_NOT_INCREASING@2'])});
test('track diagnostics summarize audio analysis and warnings',()=>{const t=track(),d=trackDiagnostics(t);assert.equal(d.loaded,true);assert.equal(d.fileName,'a.wav');assert.equal(d.sampleRate,44100);assert.equal(d.analysis.key,'Am');assert.deepEqual(d.warnings,[])});
test('project diagnostics includes pending visual changes as warning',()=>{const s={bpm:100,meter:'4/4',dirty:true,rendering:false,playing:false,viewDuration:60,pxPerSecond:8,tracks:[track()]},r=projectDiagnostics(s,{version:'0.12',serviceWorker:true,worker:true,webAudio:true,offlineAudio:true});assert.equal(r.healthy,false);assert.ok(r.warnings.includes('VISUAL_CHANGES_PENDING'));assert.equal(diagnosticSeverity(r),'warning')});
test('missing required browser engine is error severity',()=>{const r=projectDiagnostics({tracks:[]},{serviceWorker:true,worker:false,webAudio:true,offlineAudio:true});assert.equal(diagnosticSeverity(r),'error');assert.ok(r.warnings.includes('WEB_WORKER_UNAVAILABLE'))});
