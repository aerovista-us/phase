import test from 'node:test';
import assert from 'node:assert/strict';
import { detectBeatGrid, detectKey } from '../js/analysis.js';

function synthBeatTrack({sr=8000,seconds=24,bpm=90,offset=.25}={}){
  const n=Math.floor(sr*seconds),ch=new Float32Array(n),beat=60/bpm;
  const addTone=(time,hz,amp,dur=.09)=>{const start=Math.floor(time*sr),len=Math.floor(dur*sr);for(let i=0;i<len&&start+i<n;i++){const env=Math.exp(-i/(sr*.025));ch[start+i]+=Math.sin(2*Math.PI*hz*i/sr)*amp*env}};
  for(let b=0;;b++){const t=offset+b*beat;if(t>=seconds)break;const phase=b%4;if(phase===0)addTone(t,80,1,.14);else if(phase===2)addTone(t,95,.62,.1);else addTone(t,1100,.38,.05)}
  return{buffer:{numberOfChannels:1,sampleRate:sr,getChannelData:()=>ch},duration:seconds};
}

test('detects a 90 BPM four-four pulse and kick-led downbeat',()=>{
  const result=detectBeatGrid(synthBeatTrack());
  assert.ok(result.bpm>86&&result.bpm<94,`BPM ${result.bpm}`);
  assert.ok(result.beats.length>25);
  assert.equal(result.downbeatPhase,0);
  assert.ok(Math.abs(result.beats[0].time-.25)<.12,`first beat ${result.beats[0].time}`);
});

test('detects a sustained C major triad',()=>{
  const sr=8000,seconds=8,n=sr*seconds,ch=new Float32Array(n),freqs=[261.6256,329.6276,391.9954];
  for(let i=0;i<n;i++){const t=i/sr;ch[i]=freqs.reduce((s,f)=>s+Math.sin(2*Math.PI*f*t),0)/3*.7}
  const key=detectKey({numberOfChannels:1,sampleRate:sr,getChannelData:()=>ch});
  assert.equal(key.mode,'major');
  assert.equal(key.root,0,`key ${key.name}`);
});
