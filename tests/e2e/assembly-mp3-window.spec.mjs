import{test,expect}from'@playwright/test';
import{execFileSync}from'node:child_process';
import{mkdtempSync,writeFileSync,readFileSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';
import{join}from'node:path';
function wave(sec=12,rate=44100){
 const n=sec*rate,out=Buffer.alloc(44+n*4);
 out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);
 out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);
 out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);
 out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);
 out.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){
  const t=i/rate;
  const x=.25*Math.sin(2*Math.PI*(82*t+6*t*t))+.18*Math.sin(2*Math.PI*233*t);
  const y=.28*Math.sin(2*Math.PI*(138*t+3*t*t))+.15*Math.sin(2*Math.PI*311*t);
  out.writeInt16LE(Math.round(x*32767),44+i*4);
  out.writeInt16LE(Math.round(y*32767),46+i*4);
 }
 return out;
}
const encode=(wav,options)=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error',
 '-i','pipe:0','-c:a','libmp3lame',...options,'-f','mp3','pipe:1'],
 {input:wav,maxBuffer:8*1024*1024});
for(const [label,opts]of[['CBR',['-b:a','192k']],['VBR',['-q:a','3']],['VBR-gapless-file',['-q:a','3']]]){
 test('MP3 window decoded audio offset vs native decode — '+label,async({page})=>{
  test.setTimeout(90000);
  let mp3;
  if(label==='VBR-gapless-file'){
   const dir=mkdtempSync(join(tmpdir(),'phase-mp3-'));
   try{
    writeFileSync(join(dir,'source.wav'),wave());
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',join(dir,'source.wav'),'-c:a','libmp3lame',...opts,join(dir,'song.mp3')]);
    mp3=readFileSync(join(dir,'song.mp3'));
   }finally{rmSync(dir,{recursive:true,force:true})}
  }else mp3=encode(wave(),opts);
  await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
  await page.locator('#source-files').setInputFiles([{name:'comparison.mp3',mimeType:'audio/mpeg',buffer:mp3}]);
  await expect(page.locator('.source-status')).toContainText('streamed-webcodecs-mp3',{timeout:30000});
  const report=await page.evaluate(async()=>{
   const file=document.querySelector('#source-files').files[0];
   const {decodeMp3Window}=await import('./js/assembly-mp3-window.js');
   const context=new AudioContext({sampleRate:44100});
   const native=await context.decodeAudioData(await file.arrayBuffer());
   const {indexAudioPeaks}=await import('./js/assembly-peak-indexer.js');
   const {buildWavePyramid}=await import('./js/assembly-waveform.js');
   const indexed=await indexAudioPeaks(file),reference=buildWavePyramid(native);
   let peakError=0;
   const have=indexed.pyramid.levels[0],want=reference.levels[0];
   for(let i=0;i<Math.min(have.min.length,want.min.length);i++){
    peakError=Math.max(peakError,Math.abs(have.min[i]-want.min[i]),
     Math.abs(have.max[i]-want.max[i]));
   }
   const waveform={durationGap:Math.abs(indexed.duration-native.duration),
    sampleCountGap:indexed.sampleCount-native.length,
    peakError,mode:indexed.gapless?.mode||'none'};
   const selected=[{from:.03,to:.35},{from:2.31,to:2.80},{from:7.13,to:7.62},{from:11.40,to:11.88}];
   const evidence=[];
   for(const{from,to}of selected){
    let maxRead=0;
    const old=file.slice.bind(file);
    file.slice=(a,b)=>{maxRead=Math.max(maxRead,b-a);return old(a,b)};
    const seg=await decodeMp3Window(file,{startSec:from,endSec:to,context,chunkBytes:8192});
    file.slice=old;
    const a=native.getChannelData(0),b=seg.buffer.getChannelData(0),loc=Math.round(from*44100);
    const stride=Math.max(1,Math.floor(b.length/8192));
    let best={corr:-2,shift:0,rmse:0};
    for(let shift=-2304;shift<=2304;shift+=2){
     let xy=0,xx=0,yy=0,error=0,n=0;
     for(let j=0;j<b.length;j+=stride*2){
      const pos=loc+j+shift;if(pos<0||pos>=a.length)continue;
      const x=a[pos],y=b[j];xy+=x*y;xx+=x*x;yy+=y*y;error+=(x-y)*(x-y);n++;
     }
     const corr=xy/Math.sqrt(Math.max(1e-20,xx*yy));
     if(corr>best.corr)best={corr,shift,rmse:Math.sqrt(error/n)};
    }
    evidence.push({...best,decodedSamples:b.length,readLimit:maxRead,
     framesFed:seg.compressedFramesFed,sourceFramesDecoded:seg.sourceFramesDecoded});
   }
   const head=new Uint8Array(await file.slice(0,4096).arrayBuffer());
   const latin=String.fromCharCode(...head);
   const tags=['Xing','Info','LAME','Lavc','Lavf'].map(t=>({tag:t,at:latin.indexOf(t)}));
   const x=tags.find(t=>(t.tag==='Xing'||t.tag==='Info')&&t.at>=0);
   const marker=x?Array.from(head.subarray(x.at,x.at+180)):null;
   await context.close();
   return{nativeDuration:native.duration,evidence,waveform,tags,marker};
  });
  console.log(label,JSON.stringify(report));
  for(const c of report.evidence)expect(c.readLimit).toBeLessThanOrEqual(8192);
  expect(report.evidence[0].decodedSamples).toBeLessThan(44100);
  // Offset is recorded as evidence; a sample-exact final-export gate is separate.
  for(const c of report.evidence)expect(c.corr).toBeGreaterThan(.9999);
  expect(report.waveform.sampleCountGap).toBe(0);
  expect(report.waveform.durationGap).toBeLessThan(1/44100);
  expect(report.waveform.peakError).toBeLessThan(0.00001);
 });
}

test('Master Assembly exports a late MP3 segment without decoding the full source',async({page})=>{
 test.setTimeout(95000);
 const dir=mkdtempSync(join(tmpdir(),'phase-integration-'));
 let mp3;
 try{
  writeFileSync(join(dir,'source.wav'),wave());
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',join(dir,'source.wav'),
   '-c:a','libmp3lame','-q:a','3',join(dir,'song.mp3')]);
  mp3=readFileSync(join(dir,'song.mp3'));
 }finally{rmSync(dir,{recursive:true,force:true})}
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 await page.locator('#source-files').setInputFiles([{name:'gapless-song.mp3',mimeType:'audio/mpeg',buffer:mp3}]);
 await expect(page.locator('.source-status')).toContainText('streamed-webcodecs-mp3',{timeout:30000});
 await page.locator('.range-out').fill('7.63');
 await page.locator('.range-out').dispatchEvent('change');
 await page.locator('.range-in').fill('7.13');
 await page.locator('.range-in').dispatchEvent('change');
 await page.evaluate(async()=>{
  const file=document.querySelector('#source-files').files[0],context=new AudioContext({sampleRate:44100});
  window.__masterNativeReference=await context.decodeAudioData(await file.arrayBuffer());
  file.arrayBuffer=()=>{throw Error('Unexpected whole MP3 source decode')};
 });
 await page.locator('.add').click();
 await expect(page.locator('.master-clip')).toHaveCount(1);
 await page.locator('#play-master').click();
 await expect(page.locator('#notice')).toContainText('1 original PCM windows',{timeout:30000});
 await page.locator('#stop-master').click();
 const pending=page.waitForEvent('download');
 await page.locator('#export-master').click();
 const download=await pending;
 const {readFile}=await import('node:fs/promises');
 const output=await readFile(await download.path());
 expect(output.toString('ascii',0,4)).toBe('RIFF');
 expect(output.readUInt32LE(24)).toBe(44100);
 expect(output.length).toBeGreaterThan(85000);
 expect(output.length).toBeLessThan(89000);
 const reference=await page.evaluate(()=>{
  const buffer=window.__masterNativeReference,from=Math.round(7.13*44100),at=Math.round(.20*44100);
  return Array.from(buffer.getChannelData(0).subarray(from+at,from+at+4096));
 });
 let delta=0,energy=0;
 for(let i=0;i<reference.length;i++){
  const actual=output.readInt16LE(44+(Math.round(.20*44100)+i)*4)/32768;
  const target=.92*reference[i];
  delta+=(actual-target)**2;energy+=target*target;
 }
 const rmse=Math.sqrt(delta/reference.length);
 expect(rmse).toBeLessThan(.00015);
 expect(pageErrors).toEqual([]);
});
