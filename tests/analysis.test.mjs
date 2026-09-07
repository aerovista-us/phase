import test from 'node:test';
import assert from 'node:assert/strict';
import { detectBeatGrid, detectKey, detectMeter } from '../js/analysis.js';

function synthBeatTrack({sr=8000,seconds=24,bpm=90,offset=.25}={}){
  const n=Math.floor(sr*seconds),ch=new Float32Array(n),beat=60/bpm;
  const addTone=(time,hz,amp,dur=.09)=>{const start=Math.floor(time*sr),len=Math.floor(dur*sr);for(let i=0;i<len&&start+i<n;i++){const env=Math.exp(-i/(sr*.025));ch[start+i]+=Math.sin(2*Math.PI*hz*i/sr)*amp*env}};
  for(let b=0;;b++){const t=offset+b*beat;if(t>=seconds)break;const phase=b%4;if(phase===0)addTone(t,80,1,.14);else if(phase===2)addTone(t,95,.62,.1);else addTone(t,1100,.38,.05)}
  return{buffer:{numberOfChannels:1,sampleRate:sr,getChannelData:()=>ch},duration:seconds};
}
function accentBeats(meter,cycles=8){return Array.from({length:meter*cycles},(_,i)=>{const strong=i%meter===0;return{accent:strong?1:.08,lowAccent:strong?1:.06,highAccent:strong?.05:.12}})}

test('detects a 90 BPM four-four pulse and kick-led downbeat',()=>{
  const result=detectBeatGrid(synthBeatTrack());
  assert.ok(result.bpm>86&&result.bpm<94,`BPM ${result.bpm}`);
  assert.ok(result.beats.length>25);
  assert.equal(result.downbeatPhase,0);
  assert.equal(result.beatsPerBar,4);
  assert.equal(result.meter,'4/4');
  assert.ok(Math.abs(result.beats[0].time-.25)<.12,`first beat ${result.beats[0].time}`);
});

test('meter scorer separates three-beat and six-beat accent cycles',()=>{
  const three=detectMeter(accentBeats(3));assert.equal(three.meter,3);assert.equal(three.name,'3/4');assert.equal(three.phase,0);
  const six=detectMeter(accentBeats(6));assert.equal(six.meter,6);assert.equal(six.name,'6/8');assert.equal(six.phase,0);
});

test('meter can be forced without rerunning tempo analysis',()=>{
  const forced=detectMeter(accentBeats(4),'3/4');assert.equal(forced.meter,3);assert.equal(forced.name,'3/4');assert.equal(forced.forced,true);
});

test('detects a sustained C major triad',()=>{
  const sr=8000,seconds=8,n=sr*seconds,ch=new Float32Array(n),freqs=[261.6256,329.6276,391.9954];
  for(let i=0;i<n;i++){const t=i/sr;ch[i]=freqs.reduce((s,f)=>s+Math.sin(2*Math.PI*f*t),0)/3*.7}
  const key=detectKey({numberOfChannels:1,sampleRate:sr,getChannelData:()=>ch});
  assert.equal(key.mode,'major');
  assert.equal(key.root,0,`key ${key.name}`);
});
