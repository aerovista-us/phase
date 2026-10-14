import test from 'node:test';
import assert from 'node:assert/strict';
import {dragSeconds,draggedBeyondThreshold,timelinePixelsPerSecond}from'../js/drag-motion.js';
import {sectionRange,sectionFilename}from'../js/assembly-section.js';

test('pixel drag geometry is stable at any timeline zoom',()=>{
 assert.equal(dragSeconds(4,80,40),6);
 assert.equal(dragSeconds(4,-100,40,{min:0}),1.5);
 assert.equal(dragSeconds(0,-100,40,{min:0}),0);
 assert.equal(timelinePixelsPerSecond(1000,25),40);
 assert.throws(()=>dragSeconds(1,10,0),/geometry/);
 assert.throws(()=>timelinePixelsPerSecond(0,20),/dimensions/);
});
test('subthreshold pointer movement cannot accidentally relocate clips',()=>{
 assert.equal(draggedBeyondThreshold(5),false);
 assert.equal(draggedBeyondThreshold(-5),false);
 assert.equal(draggedBeyondThreshold(6),true);
});
test('PCM section export range uses exact output sample grid',()=>{
 const range=sectionRange(.301,1.109,12,44100);
 assert.equal(range.first,Math.round(.301*44100));
 assert.equal(range.last,Math.round(1.109*44100));
 assert.equal(range.frames,range.last-range.first);
 assert.equal(range.outputBytes,range.frames*12);
 assert.equal(sectionFilename(.3,1.1),'phase-master-0-300_to_1-100.wav');
});
test('section rejects negative, reversed, beyond-master and unsafe jobs',()=>{
 for(const [a,b] of [[-1,1],[2,1],[0,0],[0,20]])assert.throws(()=>sectionRange(a,b,10,44100),/Selection/);
 assert.throws(()=>sectionRange(0,10,10,44100,{maxOutputBytes:1000}),/too large/);
 assert.throws(()=>sectionRange(NaN,2,10,44100),/valid/);
});
