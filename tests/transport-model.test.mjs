import test from'node:test';import assert from'node:assert/strict';
import{projectPlaybackWindow,phraseLoopAt,clampPlayhead}from'../js/transport-model.js';

test('project playback trims material before seek point',()=>{assert.deepEqual(projectPlaybackWindow(2,10,5,9),{delay:0,sourceOffset:3,duration:4,projectStart:5,projectEnd:9})});

test('project playback delays a later track after seek point',()=>{assert.deepEqual(projectPlaybackWindow(8,5,5,12),{delay:3,sourceOffset:0,duration:4,projectStart:8,projectEnd:12})});

test('project playback returns null outside a track',()=>assert.equal(projectPlaybackWindow(20,5,0,10),null));

test('project playback honors non-destructive source trim',()=>{assert.deepEqual(projectPlaybackWindow(4,20,0,30,3,9),{delay:7,sourceOffset:3,duration:6,projectStart:7,projectEnd:13});assert.deepEqual(projectPlaybackWindow(4,20,10,12,3,9),{delay:0,sourceOffset:6,duration:2,projectStart:10,projectEnd:12})});

test('phrase loop snaps to the containing phrase',()=>{const loop=phraseLoopAt(34,120,8);assert.equal(loop.duration,16);assert.equal(loop.start,32);assert.equal(loop.end,48)});

test('playhead clamps to project view',()=>{assert.equal(clampPlayhead(-2,60),0);assert.equal(clampPlayhead(70,60),60);assert.equal(clampPlayhead(12,60),12)});
