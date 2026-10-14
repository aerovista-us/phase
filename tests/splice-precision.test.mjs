import test from 'node:test';
import assert from 'node:assert/strict';
import {findQuietZeroCrossing,autoCrossfade,snapOutgoingEnd,slipIncomingStart} from '../js/splice-precision.js';
import {newClip,clipEnd,projectDuration} from '../js/assembly-model.js';
import {envelopeGainAtLocal,envelopePoints} from '../js/fade-model.js';

const source={id:'a',name:'tone.wav',duration:12,sampleRate:48000};
const a=newClip(source,0,2,0,'out');
const b=newClip(source,2,5,2,'in');
const c=newClip(source,5,7,5,'later');

test('quiet zero crossing respects full original sample rate and maximum search window',()=>{
 const sr=48000,pcm=Float32Array.from({length:sr},(_,i)=>Math.sin(2*Math.PI*440*i/sr)*.3);
 const buffer={sampleRate:sr,length:pcm.length,numberOfChannels:1,getChannelData:()=>pcm};
 const candidate=findQuietZeroCrossing(buffer,.5,12);
 assert.ok(candidate);
 assert.ok(Math.abs(candidate.timeSec-.5)<=.0121);
 assert.ok(Number.isInteger(candidate.sampleIndex));
 assert.ok(candidate.rmsAtBoundary<.1);
});
test('stereo analysis uses both channels to avoid cancelling opposing PCM samples',()=>{
 const sampleRate=48000,first=new Float32Array(24000),second=new Float32Array(24000);
 for(let i=0;i<24000;i++){first[i]=Math.sin(2*Math.PI*100*i/sampleRate)*.5;second[i]=-first[i];}
 const buffer={sampleRate,length:first.length,numberOfChannels:2,getChannelData:i=>i?second:first};
 const result=findQuietZeroCrossing(buffer,.2,10);
 assert.ok(result && result.rmsAtBoundary>=0);
});
test('equal-power crossfade ripples later clips and preserves sources',()=>{
 const before=[a,b,c];
 const result=autoCrossfade(before,'out',.05);
 assert.equal(result.find(x=>x.id==='in').masterStart,1.95);
 assert.equal(result.find(x=>x.id==='later').masterStart,4.95);
 assert.equal(result.find(x=>x.id==='out').fadeOutSec,.05);
 assert.equal(result.find(x=>x.id==='in').fadeInSec,.05);
 assert.equal(result.find(x=>x.id==='out').fadeCurve,'equalPower');
 assert.ok(Math.abs(projectDuration(result)-6.95)<1e-6);
 assert.equal(before[1].masterStart,2);
});
test('equal power reaches 0.707 gain on each source at midpoint',()=>{
 const f=autoCrossfade([a,b,c],'out',.05);
 const out=f.find(x=>x.id==='out'),incoming=f.find(x=>x.id==='in');
 assert.ok(Math.abs(envelopeGainAtLocal(1.975,{fadeOutStart:out.sourceOut-.05,fadeOutEnd:out.sourceOut,fadeCurve:out.fadeCurve})-Math.SQRT1_2)<.0001);
 assert.ok(Math.abs(envelopeGainAtLocal(2.025,{fadeInStart:incoming.sourceIn,fadeInEnd:incoming.sourceIn+.05,fadeCurve:incoming.fadeCurve})-Math.SQRT1_2)<.0001);
 const pts=envelopePoints({offset:0,fadeInStart:0,fadeInEnd:.05,fadeCurve:'equalPower'},0,.06);
 assert.ok(pts.length>=20);
});
test('refuse gap, duplicate crossfade and oversize overlap',()=>{
 const bad=[a,{...b,masterStart:2.25}];
 assert.throws(()=>autoCrossfade(bad,'out',.05),/adjacent/);
 assert.throws(()=>autoCrossfade([a,b],'out',.6),/between/);
 const f=autoCrossfade([a,b],'out',.05);
 assert.throws(()=>autoCrossfade(f,'out',.05),/adjacent|already/);
});
test('outgoing snap ripples and incoming slip preserves timeline length',()=>{
 const snapped=snapOutgoingEnd([a,b,c],'out',1.999);
 assert.ok(Math.abs(snapped.find(x=>x.id==='in').masterStart-1.999)<.00003);
 const slipped=slipIncomingStart([a,b,c],'out',2.004,source.duration);
 assert.equal(slipped.find(x=>x.id==='in').masterStart,2);
 assert.equal(clipEnd(slipped.find(x=>x.id==='in')),5);
 assert.ok(Math.abs(slipped.find(x=>x.id==='in').sourceOut-5.004)<1e-6);
});
test('source reference invalid and absent candidate handled without modifying edit map',()=>{
 assert.throws(()=>findQuietZeroCrossing(null,.1),/PCM/);
 assert.throws(()=>snapOutgoingEnd([a,b,c],'out',2.2),/valid/);
 assert.throws(()=>slipIncomingStart([a,b,c],'out',20,source.duration),/slip/);
});
