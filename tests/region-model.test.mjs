import test from'node:test';import assert from'node:assert/strict';
import{normalizeRegion,snapRegionTime,regionFromDrag}from'../js/region-model.js';

test('region normalizes reverse drags',()=>assert.deepEqual(normalizeRegion(12,4,60),{start:4,end:12,duration:8}));
test('region clamps to project view',()=>assert.deepEqual(normalizeRegion(-4,90,60),{start:0,end:60,duration:60}));
test('tiny region is ignored',()=>assert.equal(normalizeRegion(4,4.005,60),null));
test('region snap follows phrase snap modes',()=>{assert.equal(snapRegionTime(9.1,120,'beat'),9);assert.equal(snapRegionTime(9.1,120,'bar'),10);assert.equal(snapRegionTime(17,120,'8bar'),16)});
test('shift/free drag bypasses snap',()=>assert.deepEqual(regionFromDrag(4.13,9.77,{viewDuration:60,bpm:120,snapMode:'bar',free:true}),{start:4.13,end:9.77,duration:5.639999999999999}));
