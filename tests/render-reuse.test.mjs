import test from'node:test';import assert from'node:assert/strict';
import{renderSignature,trackHasDspEdits,trackNeedsRender,trackRenderedAudioMatchesEdits}from'../js/render.js';

function track(){return{buffer:{duration:10},duration:10,pitch:0,renderQuality:'balanced',timelineOffset:0,markers:[{sourceTime:0,targetTime:0},{sourceTime:5,targetTime:6},{sourceTime:10,targetTime:11}]}}

test('rendered warp is reused for placement-only edits',()=>{const t=track();assert.equal(trackHasDspEdits(t),true);t.renderedBuffer={};t.renderedSignature=renderSignature(t,'balanced');t.renderStats={quality:'balanced'};assert.equal(trackNeedsRender(t),false);assert.equal(trackRenderedAudioMatchesEdits(t),true);t.timelineOffset=42;assert.equal(trackNeedsRender(t),false);assert.equal(trackRenderedAudioMatchesEdits(t),true)});
test('changing warp invalidates rendered audio',()=>{const t=track();t.renderedBuffer={};t.renderedSignature=renderSignature(t,'balanced');t.renderStats={quality:'balanced'};t.markers[1].targetTime=6.2;assert.equal(trackNeedsRender(t),true);assert.equal(trackRenderedAudioMatchesEdits(t),false)});
test('changing requested final quality does not make an otherwise edit-current preview stale',()=>{const t=track();t.renderedBuffer={};t.renderedSignature=renderSignature(t,'fast');t.renderStats={quality:'fast'};t.renderQuality='high';assert.equal(trackRenderedAudioMatchesEdits(t),true);assert.equal(trackNeedsRender(t,.0005,'high'),true)});
test('changing render quality invalidates final-quality render requirement',()=>{const t=track();t.renderedBuffer={};t.renderedSignature=renderSignature(t,'balanced');t.renderStats={quality:'balanced'};t.renderQuality='high';assert.equal(trackNeedsRender(t),true);assert.equal(trackRenderedAudioMatchesEdits(t),true)});
test('identity map does not need DSP',()=>{const t=track();t.markers.forEach(m=>m.targetTime=m.sourceTime);assert.equal(trackHasDspEdits(t),false);assert.equal(trackNeedsRender(t),false)});
