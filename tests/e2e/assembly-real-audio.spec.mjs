// Optional local acceptance with an authorized original recording. Audio is not
// uploaded, committed, embedded in artifacts, or replaced by a synthetic fixture.
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('real recording section exports match native reference at early, middle and late cuts',async({page},testInfo)=>{
 test.skip(!process.env.PHASE_REAL_AUDIO,'Set PHASE_REAL_AUDIO to an authorized local recording');
 test.setTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 await page.locator('#source-files').setInputFiles(process.env.PHASE_REAL_AUDIO);
 await expect(page.locator('.add')).toBeEnabled({timeout:90000});
 const refs=await page.evaluate(async()=>{
  const file=document.querySelector('#source-files').files[0];
  const {indexAudioPeaks}=await import('./js/assembly-peak-indexer.js');
  const index=await indexAudioPeaks(file),context=new AudioContext({sampleRate:index.sampleRate});
  const buffer=await context.decodeAudioData(await file.arrayBuffer());
  const cuts=[.08,.46,.91].map(f=>Math.round(buffer.duration*f*buffer.sampleRate)/buffer.sampleRate);
  const segments=cuts.map(cut=>({cut,channels:Array.from({length:buffer.numberOfChannels},(_,ch)=>
   Array.from(buffer.getChannelData(ch).subarray(Math.round((cut+.1)*buffer.sampleRate),Math.round((cut+1.1)*buffer.sampleRate))))}));
  file.arrayBuffer=()=>{throw Error('Unexpected whole-recording decode by application')};
  await context.close();return {rate:buffer.sampleRate,duration:buffer.duration,segments};
 });
 const reports=[];
 for(const ref of refs.segments){
  await page.locator('.range-in').fill('0');await page.locator('.range-in').dispatchEvent('change');
  await page.locator('.range-out').fill(String(ref.cut+1.2));await page.locator('.range-out').dispatchEvent('change');
  await page.locator('.range-in').fill(String(ref.cut));await page.locator('.range-in').dispatchEvent('change');
  await page.locator('.add').click();await page.locator('#section-in').fill('.1');await page.locator('#section-out').fill('1.1');
  const pending=page.waitForEvent('download');await page.locator('#export-section').click();
  const download=await pending,bytes=await readFile(await download.path()),frames=bytes.readUInt32LE(40)/4;
  expect(bytes.readUInt32LE(24)).toBe(refs.rate);expect(frames).toBe(refs.rate);
  let sum=0,xy=0,xx=0,yy=0,peak=0,clipped=0,count=0;
  for(let ch=0;ch<2;ch++)for(let i=0;i<frames;i++){
   const actual=bytes.readInt16LE(44+4*i+2*ch)/32768,target=.92*ref.channels[Math.min(ch,ref.channels.length-1)][i];
   sum+=(actual-target)**2;xy+=actual*target;xx+=actual*actual;yy+=target*target;
   peak=Math.max(peak,Math.abs(actual));if(Math.abs(actual)>=.9999)clipped++;count++;
  }
  const report={cutSec:ref.cut,frames,rmse:Math.sqrt(sum/count),correlation:xy/Math.sqrt(xx*yy),peakDbfs:20*Math.log10(peak),clippedSamples:clipped};
  expect(report.rmse).toBeLessThan(.00015);expect(report.correlation).toBeGreaterThan(.99999);expect(clipped).toBe(0);reports.push(report);
  await page.locator('#sample-view').click();await expect(page.locator('#notice')).toContainText('bounded original PCM windows');
  await page.locator('#undo').click();
 }
 expect(errors).toEqual([]);
 const evidence={sampleRate:refs.rate,sourceDurationSec:refs.duration,exports:reports,subjectiveListening:'not performed'};
 console.log('REAL_AUDIO_ACCEPTANCE',JSON.stringify(evidence));
 await testInfo.attach('real-audio-objective-evidence',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
});
