import test from 'node:test';
import assert from 'node:assert/strict';
import {indexAudioPeaks,indexWav,mp3Header,StreamingUnavailable} from '../js/assembly-peak-indexer.js';
import {buildWavePyramid} from '../js/assembly-waveform.js';

function wavFixture({sampleRate=48000,channels=2,bits=16,kind=1,frames=4001,padChunk=false}={}){
 const bytes=bits/8,align=channels*bytes;
 const pre=padChunk?22:0,offset=44+pre;
 const ab=new ArrayBuffer(offset+frames*align),v=new DataView(ab);
 const str=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j))};
 str(0,'RIFF');v.setUint32(4,ab.byteLength-8,true);str(8,'WAVE');
 if(padChunk){str(12,'JUNK');v.setUint32(16,14,true)}
 const fmt=12+pre;
 str(fmt,'fmt ');v.setUint32(fmt+4,16,true);
 v.setUint16(fmt+8,kind,true);v.setUint16(fmt+10,channels,true);
 v.setUint32(fmt+12,sampleRate,true);v.setUint32(fmt+16,sampleRate*align,true);
 v.setUint16(fmt+20,align,true);v.setUint16(fmt+22,bits,true);
 str(fmt+24,'data');v.setUint32(fmt+28,frames*align,true);
 const planar=Array.from({length:channels},()=>new Float32Array(frames));
 for(let i=0;i<frames;i++)for(let ch=0;ch<channels;ch++){
   const s=i===137? (ch===0?.999:-.987) :i===3000?(ch===0?-.99:.97) : Math.sin(2*Math.PI*(73+ch*50)*i/sampleRate)*.45;
   const dest=offset+(i*channels+ch)*bytes;
   if(kind===3&&bits===32){v.setFloat32(dest,s,true);planar[ch][i]=s}
   else{const k=Math.round(s*32767);v.setInt16(dest,k,true);planar[ch][i]=k/32768}
 }
 return {file:new File([ab],'fixture.wav',{type:'audio/wav'}),planar,sampleRate,frames};
}
function ref(f){
 const {planar,frames,sampleRate}=f;
 return buildWavePyramid({length:frames,numberOfChannels:planar.length,sampleRate,
   getChannelData:i=>planar[i]});
}
test('16-bit WAV streaming peaks equal full PCM reference across all levels',async()=>{
 const f=wavFixture({padChunk:true}),record={maxRead:0,total:0},originalSlice=f.file.slice.bind(f.file);
 f.file.slice=(a,b)=>{record.maxRead=Math.max(record.maxRead,b-a);record.total+=b-a;return originalSlice(a,b)};
 const result=await indexAudioPeaks(f.file,{chunkBytes:512});
 assert.equal(result.mode,'streamed-pcm-wav');
 assert.equal(result.sampleCount,f.frames);assert.equal(result.sampleRate,48000);
 const expected=ref(f);
 for(let i=0;i<expected.levels.length;i++){
  assert.deepEqual(result.pyramid.levels[i].min,expected.levels[i].min);
  assert.deepEqual(result.pyramid.levels[i].max,expected.levels[i].max);
 }
 assert.ok(record.maxRead<=512,'no full-file reads');
 assert.ok(record.total<=f.file.size+150,'metadata may require small independent reads');
 assert.ok(result.peakBytes<f.file.size);
});
test('32-bit floating-point WAV and partial final block preserve extrema',async()=>{
 const f=wavFixture({channels:1,kind:3,bits:32,frames:258});
 const out=await indexWav(f.file,{chunkBytes:257});
 const expected=ref(f);
 assert.equal(out.sampleCount,258);assert.equal(out.pyramid.levels[0].min.length,3);
 for(let i=0;i<3;i++){
  assert.ok(Math.abs(out.pyramid.levels[0].min[i]-expected.levels[0].min[i])<1e-6);
  assert.ok(Math.abs(out.pyramid.levels[0].max[i]-expected.levels[0].max[i])<1e-6);
 }
});
test('corrupt chunk sizes reject without unbounded allocations',async()=>{
 const f=wavFixture();
 const data=await f.file.arrayBuffer();
 new DataView(data).setUint32(40,0xffffffff,true);
 await assert.rejects(indexWav(new File([data],'bad.wav')),/Truncated WAV/);
});
test('MP3 header recognizes common MPEG-1 layer 3 and rejects garbage',()=>{
 const b=new Uint8Array([0xff,0xfb,0x90,0x64]);const h=mp3Header(b);
 assert.equal(h.sampleRate,44100);assert.equal(h.channels,2);assert.equal(h.frameSamples,1152);
 assert.equal(h.length,417);
 assert.equal(mp3Header(new Uint8Array([0,0,0,0])),null);
});
test('unsupported container is declared, not misrepresented as streaming',async()=>{
 await assert.rejects(indexAudioPeaks(new File([new Uint8Array(256)],'track.mp4')),
  e=>e instanceof StreamingUnavailable);
});
