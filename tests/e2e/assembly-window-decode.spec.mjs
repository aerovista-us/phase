import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

function wav({seconds=38,rate=44100}={}){
 const n=Math.round(seconds*rate),out=Buffer.alloc(44+n*4);
 out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);
 out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);
 out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);
 out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);
 out.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){
  const left=Math.round(12000*Math.sin(2*Math.PI*70*i/rate));
  const right=Math.round(9000*Math.sin(2*Math.PI*130*i/rate));
  out.writeInt16LE(left,44+4*i);out.writeInt16LE(right,46+4*i);
 }
 return out;
}
test('Master Assembly reads only the original late WAV clip for playback and export',async({page})=>{
 test.setTimeout(75000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 await page.locator('#source-files').setInputFiles([{
  name:'long-original.wav',mimeType:'audio/wav',buffer:wav()
 }]);
 await expect(page.locator('.source-status')).toContainText('streamed-pcm-wav',{timeout:30000});
 await page.locator('.range-out').fill('32.75');
 await page.locator('.range-out').dispatchEvent('change');
 await page.locator('.range-in').fill('31.25');
 await page.locator('.range-in').dispatchEvent('change');
 await expect(page.locator('.range-in')).toHaveValue('31.250000');
 await expect(page.locator('.range-out')).toHaveValue('32.750000');
 await page.locator('.add').click();
 await expect(page.locator('.master-clip')).toHaveCount(1);
 await page.evaluate(()=>{
  const file=document.querySelector('#source-files').files[0];
  const slice=file.slice.bind(file);
  window.__maxWindowRead=0;window.__fullFileReadCount=0;
  file.slice=(a,b)=>{window.__maxWindowRead=Math.max(window.__maxWindowRead,b-a);return slice(a,b)};
  file.arrayBuffer=()=>{window.__fullFileReadCount++;throw Error('Full original WAV decode forbidden in windowed master path')};
 });
 await page.locator('#play-master').click();
 await expect(page.locator('#notice')).toContainText('1 original PCM windows',{timeout:15000});
 await page.locator('#stop-master').click();
 const pending=page.waitForEvent('download');
 await page.locator('#export-master').click();
 const download=await pending;
 expect(download.suggestedFilename()).toBe('phase-master-assembly.wav');
 const output=await readFile(await download.path());
 expect(output.toString('ascii',0,4)).toBe('RIFF');
 expect(output.readUInt32LE(24)).toBe(44100);
 expect(output.length).toBeGreaterThan(260000);
 expect(output.length).toBeLessThan(270000);
 const telemetry=await page.evaluate(()=>({max:window.__maxWindowRead,whole:window.__fullFileReadCount}));
 expect(telemetry.max).toBeLessThanOrEqual(262144);
 expect(telemetry.whole).toBe(0);
 expect(errors).toEqual([]);
});
