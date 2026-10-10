import{test,expect}from'@playwright/test';
import{readFile,stat}from'node:fs/promises';

function wave(freq,seconds=2,sr=44100){
 const n=Math.floor(sr*seconds),b=Buffer.alloc(44+n*2);
 b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++)b.writeInt16LE(Math.round(12000*Math.sin(2*Math.PI*freq*i/sr)),44+i*2);
 return b;
}
test('Master Assembly: import, sample inspect, ripple splice, solo and WAV',async({page})=>{
 test.setTimeout(55000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 await expect(page.getByRole('heading',{name:'Final arrangement'})).toBeVisible();
 await page.locator('#source-files').setInputFiles([
  {name:'tone-a.wav',mimeType:'audio/wav',buffer:wave(80)},
  {name:'tone-b.wav',mimeType:'audio/wav',buffer:wave(190)}
 ]);
 await expect(page.locator('.source-card')).toHaveCount(2);
 await expect(page.locator('.source-card .add').first()).toBeEnabled({timeout:20000});
 await expect(page.locator('.source-card .add').last()).toBeEnabled();
 await page.locator('.source-card .add').first().click();
 await page.locator('.source-card .add').last().click();
 await expect(page.locator('.master-clip')).toHaveCount(2);
 await page.locator('#playhead').fill('0.8');
 await page.locator('.source-card .insert').first().click();
 await expect(page.locator('.master-clip')).toHaveCount(4);
 await page.locator('.master-clip').first().click();
 await page.locator('#sample-view').click();
 await expect(page.locator('#join-message')).toContainText('Native samples loaded',{timeout:10000});
 await page.locator('#copy-clip').click();
 await page.locator('#playhead').fill('0.4');
 await page.locator('#paste-clip').click();
 await expect(page.locator('.master-clip')).toHaveCount(6);
 await page.locator('.source-card .audition').first().click();
 await expect(page.locator('#notice')).toContainText('Solo audition',{timeout:12000});
 await page.locator('#stop-master').click();
 await page.locator('#play-master').click();
 await expect(page.locator('#notice')).toContainText('Playing original-quality master',{timeout:15000});
 await page.locator('#stop-master').click();
 const pending=page.waitForEvent('download');
 await page.locator('#export-master').click();
 const download=await pending;
 expect(download.suggestedFilename()).toBe('phase-master-assembly.wav');
 const bytes=await readFile(await download.path());
 expect(bytes.toString('ascii',0,4)).toBe('RIFF');
 expect(bytes.readUInt32LE(24)).toBe(44100);
 expect(bytes.length).toBeGreaterThan(400000);
 expect(errors).toEqual([]);
});
test('Master Assembly layout remains reachable on phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:4173/');
 await expect(page.locator('a[href="./assembly.html"]')).toBeVisible();
 await page.locator('a[href="./assembly.html"]').click();
 await expect(page.getByRole('heading',{name:'Final arrangement'})).toBeVisible();
 await expect(page.locator('#sources')).toBeVisible();
});
