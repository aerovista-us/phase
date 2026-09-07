import test from'node:test';import assert from'node:assert/strict';
import{ensureStemState,setStemBuffer,setUseStems}from'../js/stems.js';
import{eligibleTracks,playbackParts,exportItemsForTrack}from'../js/source-model.js';
import{mixNormalizationCount}from'../js/export.js';

const buf=duration=>({duration});
const track=(id=0)=>({id,label:`TRACK ${id?'B':'A'}`,buffer:buf(10),renderedBuffer:null,renderedOffset:1,timelineOffset:1,gainDb:0,trimIn:0,trimOut:null,mute:false,solo:false});

test('source routing uses the original mix until stem mode is enabled',()=>{const t=track();ensureStemState(t);setStemBuffer(t,'vocals',buf(10));assert.deepEqual(playbackParts(t).map(x=>x.id),['mix']);setUseStems(t,true);assert.deepEqual(playbackParts(t).map(x=>x.id),['vocals'])});
test('stem mute removes only that source part',()=>{const t=track();setStemBuffer(t,'vocals',buf(10));setStemBuffer(t,'drums',buf(10));setUseStems(t,true);t.stems.vocals.mute=true;assert.deepEqual(playbackParts(t).map(x=>x.id),['drums'])});
test('track solo and mute semantics remain track-level with stems',()=>{const a=track(0),b=track(1);setStemBuffer(a,'vocals',buf(10));setUseStems(a,true);b.solo=true;assert.deepEqual(eligibleTracks([a,b]).map(t=>t.id),[1]);b.solo=false;a.mute=true;assert.deepEqual(eligibleTracks([a,b]).map(t=>t.id),[1])});
test('four stems export as one normalization group',()=>{const t=track();for(const id of['vocals','drums','bass','other'])setStemBuffer(t,id,buf(10));setUseStems(t,true);const items=exportItemsForTrack(t);assert.equal(items.length,4);assert.equal(new Set(items.map(x=>x.group)).size,1);assert.equal(mixNormalizationCount(items),1);const other=exportItemsForTrack(track(1));assert.equal(mixNormalizationCount([...items,...other]),2)});
