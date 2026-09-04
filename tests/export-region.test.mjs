import test from'node:test';import assert from'node:assert/strict';import{mixRegionWindow}from'../js/export.js';

test('mix region trims a track that started before the loop',()=>assert.deepEqual(mixRegionWindow(2,20,8,12),{delay:0,sourceOffset:6,duration:4}));
test('mix region delays a track that enters inside the loop',()=>assert.deepEqual(mixRegionWindow(10,20,8,16),{delay:2,sourceOffset:0,duration:6}));
test('mix region ignores non-overlapping tracks',()=>assert.equal(mixRegionWindow(20,4,8,16),null));
