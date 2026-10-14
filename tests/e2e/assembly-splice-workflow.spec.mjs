import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

function wav(seconds=9,rate=48000){
 const n=Math.round(seconds*rate),b=Buffer.alloc(44+n*4);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);
 b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){b.writeInt16LE(Math.round(14000*Math.sin(i*2*Math.PI*111/rate)),44+i*4);b.writeInt16LE(Math.round(13000*Math.sin(i*2*Math.PI*137/rate)),46+i*4)}
 return b;
}
async function load(page){
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 await page.locator('#source-files').setInputFiles([{name:'splice-original.wav',mimeType:'audio/wav',buffer:wav()}]);
 await expect(page.locator('.add')).toBeEnabled();
}
test('bounded sample inspection and snap never full-decode original WAV',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await load(page);
 await page.locator('.range-out').fill('8.25');await page.locator('.range-out').dispatchEvent('change');
 await page.locator('.range-in').fill('7.23');await page.locator('.range-in').dispatchEvent('change');
 await page.locator('.add').click();await page.locator('.add').click();await page.locator('.master-clip').first().click();
 await page.evaluate(()=>{document.querySelector('#source-files').files[0].arrayBuffer=()=>{throw Error('Whole-file decode forbidden for inspector')}});
 await page.locator('#sample-view').click();
 await expect(page.locator('#notice')).toContainText('bounded original PCM windows');
 await page.locator('#snap-out').click();await expect(page.locator('#notice')).toContainText('Applied OUT snap');
 await page.locator('#snap-in').click();await expect(page.locator('#notice')).toContainText('Applied IN snap');
 expect(errors).toEqual([]);
});
test('source deck drag inserts at the pointer and ripples once; Undo restores',async({page},testInfo)=>{
 await load(page);await page.locator('.add').click();
 const lane=page.locator('#master-lane');
 await page.locator('.place-source').dragTo(lane,{targetPosition:{x:150,y:65}});
 await expect(page.locator('.master-clip')).toHaveCount(3);
 await expect(page.locator('#notice')).toContainText('later audio rippled');
 await page.screenshot({path:testInfo.outputPath('desktop-source-insertion.png'),fullPage:true});
 await page.locator('#undo').click();await expect(page.locator('.master-clip')).toHaveCount(1);
 await expect(page.locator('#cancel-placement')).toBeHidden();
});
test('phone tap-to-place, cancel, original endpoints and narrow layout are safe',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await load(page);
 await page.locator('.range-out').fill('2');await page.locator('.range-out').dispatchEvent('change');
 await page.locator('.range-in').fill('1');await page.locator('.range-in').dispatchEvent('change');
 await page.locator('.place-source').click();await expect(page.locator('#cancel-placement')).toBeVisible();
 await page.locator('#cancel-placement').click();await expect(page.locator('.master-clip')).toHaveCount(0);
 await page.locator('.place-source').click();await page.locator('#master-lane').click({position:{x:30,y:65}});
 await expect(page.locator('.master-clip')).toHaveCount(1);
 await expect(page.locator('.range-in')).toHaveValue('1.000000');await expect(page.locator('.range-out')).toHaveValue('2.000000');
 await page.screenshot({path:testInfo.outputPath('phone-source-placement.png'),fullPage:true});
 await page.locator('#undo').click();await expect(page.locator('.master-clip')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('losing pointer capture cancels both editors without committing offsets',async({page})=>{
 await load(page);await page.locator('.add').click();const clip=page.locator('.master-clip');
 await clip.scrollIntoViewIfNeeded();const r=await clip.boundingBox();
 await page.mouse.move(r.x+30,r.y+45);await page.mouse.down();await page.mouse.move(r.x+90,r.y+45,{steps:4});
 await expect(clip).toHaveClass(/dragging/);
 await clip.dispatchEvent('lostpointercapture');await page.mouse.up();await expect(clip).not.toHaveClass(/dragging/);
 await expect(page.locator('#clip-start')).toHaveValue('0.000000');
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.locator('#demoProject').click();
 await expect(page.locator('#engineState')).toContainText('DEMO READY');await page.locator('.mode[data-mode="move"]').click();
 const lane=page.locator('#lane-0'),a=await lane.boundingBox(),offset=await page.locator('#offset-0').inputValue();
 const x=a.x+a.width*.42,y=a.y+a.height*.68;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,y,{steps:4});
 await expect(lane).toHaveClass(/move-active/);await lane.dispatchEvent('lostpointercapture');await page.mouse.up();
 await expect(lane).not.toHaveClass(/move-active/);await expect(page.locator('#offset-0')).toHaveValue(offset);
});

test('native touch source placement inserts once and cancellation is nondestructive',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844}});
 const page=await context.newPage();
 try{
  await load(page);const handle=page.locator('.place-source');await handle.scrollIntoViewIfNeeded();
  let r=await handle.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  await expect(page.locator('#cancel-placement')).toBeVisible();
  r=await page.locator('#master-lane').boundingBox();await page.touchscreen.tap(r.x+40,r.y+65);
  await expect(page.locator('.master-clip')).toHaveCount(1);await expect(page.locator('#cancel-placement')).toBeHidden();
  await page.locator('#undo').click();await expect(page.locator('.master-clip')).toHaveCount(0);
 }finally{await context.close()}
});

test('async splice inspection cannot overwrite a newer selection',async({page})=>{
 await load(page);await page.locator('.add').click();await page.locator('.add').click();await page.locator('.master-clip').first().click();
 await page.evaluate(()=>{
  const file=document.querySelector('#source-files').files[0],slice=file.slice.bind(file);
  file.slice=(...args)=>({arrayBuffer:async()=>{await new Promise(r=>setTimeout(r,200));return slice(...args).arrayBuffer()}});
 });
 await page.locator('#sample-view').click();await page.locator('.master-clip').last().click();
 await expect(page.locator('#notice')).toContainText('Selection changed while loading');
 await expect(page.locator('#join-message')).toHaveText('No next clip. Add one to compare incoming audio.');
});

test('direct Assembly launch installs its offline shell without visiting Mix & Sync first',async({page,context})=>{
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)
  await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}))});
 expect(await page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('.eyebrow').first()).toContainText('0.14.6');
 await expect(page.locator('#play-master')).toBeVisible();await expect(page.getByRole('link',{name:'APP RECOVERY'})).toBeVisible();
 await context.setOffline(false);
});

test('tablet source deck and exact-time inputs remain contained and readable',async({page},testInfo)=>{
 await page.setViewportSize({width:1024,height:800});await load(page);await page.locator('.add').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await page.locator('.range-in').boundingBox()).width).toBeGreaterThanOrEqual(100);
 await page.screenshot({path:testInfo.outputPath('tablet-assembly.png'),fullPage:true});
});

test('section export preserves 221 validated frames and exports an interior silent gap',async({page})=>{
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 await page.locator('#source-files').setInputFiles([{name:'sample-grid.wav',mimeType:'audio/wav',buffer:wav(1,44100)}]);
 await expect(page.locator('.add')).toBeEnabled();await page.locator('.add').click();
 await page.locator('#section-in').fill('0');await page.locator('#section-out').fill('.005');
 let pending=page.waitForEvent('download');await page.locator('#export-section').click();
 let bytes=await readFile(await (await pending).path());expect(bytes.readUInt32LE(40)/4).toBe(221);
 await page.locator('.add').click();await page.locator('#clip-start').fill('4');await page.locator('#clip-start').dispatchEvent('change');
 // [0,1] and [4,5]: the exported interval lies wholly inside an interior gap.
 await page.locator('#section-in').fill('1.25');await page.locator('#section-out').fill('1.75');
 pending=page.waitForEvent('download');await page.locator('#export-section').click();
 bytes=await readFile(await (await pending).path());expect(bytes.readUInt32LE(40)/4).toBe(22050);
 expect(bytes.subarray(44).every(value=>value===0)).toBe(true);
});
