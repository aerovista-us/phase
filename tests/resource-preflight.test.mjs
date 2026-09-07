import test from'node:test';
import assert from'node:assert/strict';
import{resourceThresholds,projectResidentBytes,activeSourceBuffers,estimatedOutputRatio,estimateRenderPeakBytes,estimateSeparationPeakBytes,classifyResourceUse}from'../js/resource-preflight.js';

const audio=(mb=100)=>({length:Math.round(mb*1024*1024/(2*4)),numberOfChannels:2,duration:60,sampleRate:44100});
const track=(mb=100)=>({buffer:audio(mb),markers:[{sourceTime:0,targetTime:0},{sourceTime:60,targetTime:60}],stems:{}});

test('resource thresholds scale with reported device memory',()=>{const low=resourceThresholds(4),high=resourceThresholds(16);assert.ok(low.cautionBytes<high.cautionBytes);assert.ok(low.severeBytes<high.severeBytes);assert.ok(low.severeBytes>low.cautionBytes)});
test('resident memory counts decoded track and stem buffers',()=>{const t=track(100);t.stems={vocals:{buffer:audio(25)}};const bytes=projectResidentBytes({tracks:[t]});assert.ok(bytes>120*1024*1024)});
test('active stem source routing honors solo state',()=>{const t=track();t.useStems=true;t.stems={vocals:{buffer:audio(20),solo:true,mute:false},drums:{buffer:audio(30),solo:false,mute:false},bass:{buffer:audio(10),solo:true,mute:true}};assert.equal(activeSourceBuffers(t).length,1);assert.equal(activeSourceBuffers(t)[0],t.stems.vocals.buffer)});
test('render output ratio follows warp duration and stays bounded',()=>{const t=track();t.markers=[{sourceTime:0,targetTime:0},{sourceTime:60,targetTime:90}];assert.equal(estimatedOutputRatio(t),1.5);t.markers[1].targetTime=600;assert.equal(estimatedOutputRatio(t),4)});
test('render preflight includes resident memory plus one peak worker job',()=>{const t=track(100),e=estimateRenderPeakBytes({tracks:[t]});assert.ok(e.residentBytes>=100*1024*1024);assert.ok(e.workingBytes>=300*1024*1024);assert.equal(e.projectedBytes,e.residentBytes+e.workingBytes)});
test('separation preflight anticipates four decoded stems plus provider overhead',()=>{const t=track(100),e=estimateSeparationPeakBytes({tracks:[t]},t);assert.ok(e.workingBytes>=500*1024*1024);assert.equal(e.projectedBytes,e.residentBytes+e.workingBytes)});
test('resource classification exposes ok caution and severe states',()=>{const limits=resourceThresholds(4);assert.equal(classifyResourceUse({projectedBytes:limits.cautionBytes-1},{deviceMemoryGB:4}).level,'ok');assert.equal(classifyResourceUse({projectedBytes:limits.cautionBytes},{deviceMemoryGB:4}).level,'caution');assert.equal(classifyResourceUse({projectedBytes:limits.severeBytes},{deviceMemoryGB:4}).level,'severe')});
