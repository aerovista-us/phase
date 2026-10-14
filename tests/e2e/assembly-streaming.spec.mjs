import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {indexAudioPeaks} from '../../js/assembly-peak-indexer.js';

function wav({rate=44100,seconds=4}={}){
 const n=rate*seconds,bytes=n*4,out=Buffer.alloc(44+bytes);
 out.write('RIFF',0);out.writeUInt32LE(bytes+36,4);out.write('WAVEfmt ',8);
 out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);
 out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);
 out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);
 out.write('data',36);out.writeUInt32LE(bytes,40);
 for(let i=0;i<n;i++){
  const v=i===370?32767:Math.round(Math.sin(2*Math.PI*95*i/rate)*11000);
  out.writeInt16LE(v,44+i*4);out.writeInt16LE(i===380?-32768:-v,46+i*4);
 }
 return out;
}
test('small and large WAVs use min/max streaming, preserving transients',async({page})=>{
 const source=wav({seconds:5});
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 await page.locator('#source-files').setInputFiles([{name:'precise-wave.wav',mimeType:'audio/wav',buffer:source}]);
 await expect(page.locator('.source-status')).toContainText('streamed-pcm-wav',{timeout:18000});
 const measured=await page.evaluate(async()=>{
  const {indexAudioPeaks}=await import('./js/assembly-peak-indexer.js');
  const i=document.querySelector('#source-files').files[0];
  i.arrayBuffer=()=>{throw Error('Full-file reading disallowed in waveform indexing')};
  let largest=0;const oldSlice=i.slice.bind(i);
  i.slice=(start,end)=>{largest=Math.max(largest,end-start);return oldSlice(start,end)};
  const result=await indexAudioPeaks(i,{chunkBytes:8192});
  const min=result.pyramid.levels[0].min,max=result.pyramid.levels[0].max;
  return {mode:result.mode,largest,peakMax:Math.max(...max),
   peakMin:Math.min(...min),duration:result.duration,peakBytes:result.peakBytes};
 });
 expect(measured.mode).toBe('streamed-pcm-wav');
 expect(measured.largest).toBeLessThanOrEqual(8192);
 expect(measured.peakMax).toBeGreaterThan(.99);
 expect(measured.peakMin).toBeLessThan(-.99);
 expect(measured.duration).toBe(5);
 expect(measured.peakBytes).toBeLessThan(source.byteLength/50);
});
test('compressed MP3 uses WebCodecs in supporting browsers and still exports original audio',async({page})=>{
 test.setTimeout(60000);
 const source=wav({seconds:4});
 const mp3=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i','pipe:0',
  '-f','mp3','-codec:a','libmp3lame','-b:a','128k','pipe:1'],{input:source,maxBuffer:4*1024*1024});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 const codecSupported=await page.evaluate(async()=>typeof AudioDecoder!=='undefined'&&
  (await AudioDecoder.isConfigSupported({codec:'mp3',sampleRate:44100,numberOfChannels:2})).supported);
 await page.locator('#source-files').setInputFiles([{name:'compressed.mp3',mimeType:'audio/mpeg',buffer:mp3}]);
 await expect(page.locator('.source-card .add')).toBeEnabled({timeout:25000});
 const label=await page.locator('.source-status').textContent();
 if(codecSupported)expect(label).toContain('streamed-webcodecs-mp3');
 else expect(label).toContain('compatibility decode');
 const comparison=await page.evaluate(async()=>{
  const file=document.querySelector('#source-files').files[0];
  const {indexAudioPeaks}=await import('./js/assembly-peak-indexer.js');
  const streamed=await indexAudioPeaks(file);
  const context=new AudioContext({sampleRate:streamed.sampleRate});
  const native=await context.decodeAudioData(await file.arrayBuffer());
  let nativePeak=0;
  for(let ch=0;ch<native.numberOfChannels;ch++)
   for(const v of native.getChannelData(ch))nativePeak=Math.max(nativePeak,Math.abs(v));
  const l=streamed.pyramid.levels[0];
  let streamedPeak=0;
  for(let i=0;i<l.max.length;i++)streamedPeak=Math.max(streamedPeak,Math.abs(l.max[i]),Math.abs(l.min[i]));
  await context.close();
  return {durationGap:Math.abs(streamed.duration-native.duration),
   nativePeak,streamedPeak,compressedBytes:file.size,
   peakBytes:streamed.peakBytes,decodedBytes:native.length*native.numberOfChannels*4};
 });
 expect(comparison.durationGap).toBeLessThan(.16);
 expect(Math.abs(comparison.nativePeak-comparison.streamedPeak)).toBeLessThan(.10);
 expect(comparison.streamedPeak).toBeGreaterThan(.1);
 expect(comparison.peakBytes).toBeLessThan(comparison.decodedBytes*.2);
 await page.locator('.source-card .add').click();
 await expect(page.locator('.master-clip')).toHaveCount(1);
 const download=page.waitForEvent('download');
 await page.locator('#export-master').click();
 const output=await download;
 expect(output.suggestedFilename()).toBe('phase-master-assembly.wav');
 const fs=await import('node:fs/promises');
 const rendered=await fs.readFile(await output.path());
 expect(rendered.toString('ascii',0,4)).toBe('RIFF');
 expect(rendered.length).toBeGreaterThan(400000);
 expect(errors).toEqual([]);
});
