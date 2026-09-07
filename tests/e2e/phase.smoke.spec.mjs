import{test,expect}from'@playwright/test';

const base='http://127.0.0.1:4173';

async function boot(page,{width=1440,height=900}={}){
  await page.setViewportSize({width,height});
  const errors=[];page.on('pageerror',err=>errors.push(String(err?.stack||err)));
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await expect(page.locator('.brand .tag')).toContainText('0.12.8');
  await expect(page.locator('#engineState')).toBeVisible();
  await expect(page.locator('#demoProject')).toBeVisible({timeout:5000});
  return errors;
}

async function expectContained(page){
  const result=await page.evaluate(()=>{
    const box=el=>el?.getBoundingClientRect();
    const top=document.querySelector('.topbar'),mode=document.querySelector('.modebar');
    const rows=[...document.querySelectorAll('.track-head')].map(head=>{const h=box(head),kids=[...head.children].map(box).filter(Boolean);return{right:Math.max(...kids.map(k=>k.right),h.left)-h.right,bottom:Math.max(...kids.map(k=>k.bottom),h.top)-h.bottom}});
    return{topOverflow:top?top.scrollWidth-top.clientWidth:0,modeOverflow:mode?mode.scrollWidth-mode.clientWidth:0,rows};
  });
  expect(result.topOverflow).toBeLessThanOrEqual(2);expect(result.modeOverflow).toBeLessThanOrEqual(2);
  for(const row of result.rows){expect(row.right).toBeLessThanOrEqual(2);expect(row.bottom).toBeLessThanOrEqual(2)}
}

async function waitForServiceWorkerControl(page){
  return page.evaluate(async()=>{
    if(!('serviceWorker'in navigator))return false;
    await navigator.serviceWorker.ready;
    if(navigator.serviceWorker.controller)return true;
    await Promise.race([new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,5000))]);
    return!!navigator.serviceWorker.controller;
  });
}

test('Phase boots and completes the core demo mashup workflow',async({page})=>{
  test.setTimeout(45000);const errors=await boot(page);await expectContained(page);
  await page.locator('#demoProject').click();
  await expect(page.locator('#engineState')).toContainText('DEMO READY',{timeout:15000});
  await expect(page.locator('#sub-0')).not.toContainText('No audio loaded');
  await expect(page.locator('#sub-1')).not.toContainText('No audio loaded');
  await page.locator('#analyze').click();
  await expect(page.locator('#engineState')).toContainText('ANALYSIS READY',{timeout:15000});
  await page.locator('#alignB').click();
  await expect(page.locator('#engineState')).toContainText('ALIGNED',{timeout:7000});
  await expect(page.locator('#renderState')).toContainText('VISUAL CHANGES PENDING');
  await page.locator('#render').click();
  await expect(page.locator('#renderState')).toContainText('AUDIO CURRENT',{timeout:20000});
  await page.locator('#play').click();await page.waitForTimeout(250);await page.locator('#stop').click();
  await page.locator('#helpPanel').click();await expect(page.locator('#helpDrawer')).toHaveClass(/open/);await expect(page.locator('#helpDrawer')).toBeVisible();await page.locator('#helpClose').click();
  await page.locator('#diagPanel').click();await expect(page.locator('#diagDrawer')).toHaveClass(/open/);await expect(page.locator('#diagBody')).toContainText('PWA / STORAGE');await page.locator('#diagClose').click();
  await page.locator('#stemsPanel').click();await expect(page.locator('#stemDrawer')).toHaveClass(/open/);await expect(page.locator('#stemSeparate')).toBeVisible();await page.locator('#stemClose').click();
  expect(errors,errors.join('\n')).toEqual([]);
});

test('Phase lifecycle saves the session and the PWA relaunches offline',async({page,context})=>{
  test.setTimeout(40000);const errors=await boot(page);expect(await waitForServiceWorkerControl(page)).toBe(true);
  await page.locator('#demoProject').click();await expect(page.locator('#engineState')).toContainText('DEMO READY',{timeout:15000});
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  const saved=await page.evaluate(()=>{const raw=localStorage.getItem('echoverse.phase.session.v5');return raw?JSON.parse(raw):null});
  expect(saved?.version).toBe(12);expect(saved?.tracks?.[0]?.fileName).toBe('phase-demo-a.wav');expect(saved?.tracks?.[1]?.fileName).toBe('phase-demo-b.wav');expect(saved?.savedAt).toBeTruthy();
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await expect(page.locator('.brand .tag')).toContainText('0.12.8');await expect(page.locator('#demoProject')).toBeVisible({timeout:7000});
  await page.goto(base+'/recovery.html',{waitUntil:'domcontentloaded',timeout:15000});
  await expect(page.locator('h1')).toHaveText('PHASE RECOVERY');await expect(page.locator('#saved')).toHaveText('YES');await expect(page.locator('#mapVersion')).toHaveText('12');
  await context.setOffline(false);expect(errors,errors.join('\n')).toEqual([]);
});

test('Phase controls remain contained in a compact workstation viewport',async({page})=>{const errors=await boot(page,{width:1024,height:650});await expectContained(page);expect(errors,errors.join('\n')).toEqual([])});

test('standalone recovery route loads without workstation modules',async({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(String(err?.stack||err)));
  await page.goto(base+'/recovery.html',{waitUntil:'networkidle'});
  await expect(page.locator('h1')).toHaveText('PHASE RECOVERY');
  await expect(page.locator('#liveVersion')).toHaveText('0.12.8');
  await expect(page.locator('#liveValidated')).toHaveText('YES');
  await expect(page.locator('#report')).toBeVisible();
  expect(errors,errors.join('\n')).toEqual([]);
});
