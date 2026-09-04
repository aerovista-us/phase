import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackWindow } from '../js/audio.js';

test('positive track offset delays playback without trimming source',()=>{
  assert.deepEqual(playbackWindow(2.5,10),{start:2.5,sourceOffset:0,remaining:10,end:12.5});
});

test('negative track offset trims source into project time zero',()=>{
  assert.deepEqual(playbackWindow(-2.5,10),{start:0,sourceOffset:2.5,remaining:7.5,end:7.5});
});

test('track completely before zero has no playable duration',()=>{
  assert.deepEqual(playbackWindow(-12,10),{start:0,sourceOffset:12,remaining:0,end:0});
});
