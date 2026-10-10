import test from 'node:test';
import assert from 'node:assert/strict';
import{newClip,insertClip,splitClip,removeClip,moveClip,projectDuration,saveAssembly,restoreAssembly,updateFade}from '../js/assembly-model.js';
import{buildWavePyramid,levelForView}from '../js/assembly-waveform.js';
const source={id:'source_1',name:'single.wav',duration:20,sampleRate:48000,size:1234};
test('single source is sufficient and original source remains immutable',()=>{
 const copy={...source},c=newClip(source,2,5,0,'one');assert.equal(c.sourceIn,2);assert.equal(c.sourceOut,5);
 assert.deepEqual(source,copy);assert.equal(projectDuration([c]),3);
});
test('split preserves source chronology, timing and combined length',()=>{
 const c=newClip(source,1,9,4,'one');const a=splitClip([c],c.id,7.125);
 assert.equal(a.length,2);assert.equal(a[0].sourceOut,a[1].sourceIn);
 assert.equal(a[1].masterStart,7.125);assert.ok(Math.abs(projectDuration(a)-12)<1e-5);
});
test('ripple insert shifts following clips without rewriting originals',()=>{
 const a=newClip(source,0,2,0,'a'),b=newClip(source,2,4,2,'b'),newOne=newClip(source,7,8,0,'c');
 const next=insertClip([a,b],newOne,2,true);
 assert.equal(next.find(c=>c.id==='b').masterStart,3);
 assert.equal(next.find(c=>c.id==='c').masterStart,2);
 assert.equal(b.masterStart,2);
});
test('insert in the middle of a clip splits it and ripples the tail',()=>{
 const original=newClip(source,1,9,0,'a'),inserted=newClip(source,10,12,3,'new');
 const result=insertClip([original],inserted,3,true);
 assert.equal(result.length,3);
 assert.equal(result.find(x=>x.id==='a').sourceOut,4);
 const tail=result.find(x=>x.sourceId==='source_1'&&x.id!=='a'&&x.id!=='new');
 assert.equal(tail.masterStart,5);assert.equal(tail.sourceIn,4);assert.equal(tail.sourceOut,9);
 assert.equal(projectDuration(result),10);
});
test('move and delete clips do not change sample source',()=>{
 const a=newClip(source,1,5,0,'a'),b=newClip(source,5,6,4,'b');
 const moved=moveClip([a,b],'b',7.12);assert.equal(moved.find(x=>x.id==='b').masterStart,7.12);
 const remaining=removeClip(moved,'a');assert.equal(remaining.length,1);
});
test('crossfade values clamp to clip and reference offsets',()=>{
 const c=newClip(source,1,2,0,'a');
 const [next]=updateFade([c],'a',3,3);
 assert.equal(next.fadeInSec,1);assert.equal(next.fadeOutSec,1);
});
test('project map excludes bytes and validates references',()=>{
 const c=newClip(source,1,5,0,'a');
 const doc=saveAssembly([source],[c]);assert.equal(doc.sources[0].name,source.name);
 assert.equal(restoreAssembly(doc).clips[0].sourceId,'source_1');
 const bad=structuredClone(doc);bad.clips[0].sourceId='missing';
 assert.throws(()=>restoreAssembly(bad),/Invalid source/);
});
test('pyramid retains extreme transient despite overview grouping',()=>{
 const data=new Float32Array(1024);data[351]=.991;data[370]=-.7;
 const buffer={length:data.length,numberOfChannels:1,sampleRate:48000,getChannelData:()=>data};
 const p=buildWavePyramid(buffer,16);assert.ok(Math.abs(p.levels[0].max[Math.floor(351/16)]-.991)<1e-6);
 assert.ok(Math.abs(p.levels.at(-1).max[0]-.991)<1e-6);
 assert.ok(p.levels.at(-1).min[0]<-.69);
 assert.equal(levelForView(p,1).levels,undefined);
});
