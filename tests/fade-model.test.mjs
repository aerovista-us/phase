import test from'node:test';import assert from'node:assert/strict';
import{regionOnTrack,envelopeGainAtLocal,envelopePoints}from'../js/fade-model.js';

test('project region clips into track-local fade range',()=>assert.deepEqual(regionOnTrack(10,20,8,18),{start:0,end:8,duration:8,projectStart:10,projectEnd:18}));
test('fade in rises from zero to unity',()=>{const f={fadeInStart:2,fadeInEnd:6};assert.equal(envelopeGainAtLocal(1,f),0);assert.equal(envelopeGainAtLocal(4,f),.5);assert.equal(envelopeGainAtLocal(8,f),1)});
test('fade out falls from unity to zero',()=>{const f={fadeOutStart:4,fadeOutEnd:8};assert.equal(envelopeGainAtLocal(2,f),1);assert.equal(envelopeGainAtLocal(6,f),.5);assert.equal(envelopeGainAtLocal(10,f),0)});
test('envelope points include fade boundaries in project time',()=>assert.deepEqual(envelopePoints({offset:10,fadeInStart:2,fadeInEnd:6},10,20),[{projectTime:10,time:0,gain:0},{projectTime:12,time:2,gain:0},{projectTime:16,time:6,gain:1},{projectTime:20,time:10,gain:1}]));
