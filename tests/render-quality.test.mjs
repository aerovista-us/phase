import test from'node:test';import assert from'node:assert/strict';
import{normalizeRenderQuality,renderSettings}from'../js/render-quality.js';

test('unknown render quality falls back to balanced',()=>assert.equal(normalizeRenderQuality('ultra'),'balanced'));
test('high quality increases overlap work',()=>{const fast=renderSettings('fast',48000),balanced=renderSettings('balanced',48000),high=renderSettings('high',48000);assert.equal(fast.grainSize,1024);assert.equal(balanced.grainSize,2048);assert.ok(high.hop<balanced.hop);assert.ok(high.searchRadius>balanced.searchRadius)});
