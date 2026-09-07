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

test('Phase boots, demo loads, transport and secondary drawers work',async({page})=>{
  const errors=await boot(page);await expectContained(page);
  await page.locator('#demoProject').click();
  await expect(page.locator('#engineState')).toContainText('DEMO READY',{timeout:15000});
  await expect(page.locator('#sub-0')).not.toContainText('No audio loaded');
  await expect(page.locator('#sub-1')).not.toContainText('No audio loaded');
  await page.locator('#play').click();await page.waitForTimeout(250);await page.locator('#stop').click();
  await page.locator('#helpPanel').click();await expect(page.locator('#helpDrawer')).toHaveClass(/open/);await expect(page.locator('#helpDrawer')).toBeVisible();await page.locator('#helpClose').click();
  await page.locator('#diagPanel').click();await expect(page.locator('#diagDrawer')).toHaveClass(/open/);await expect(page.locator('#diagBody')).toContainText('PWA / STORAGE');await page.locator('#diagClose').click();
  await page.locator('#stemsPanel').click();await expect(page.locator('#stemDrawer')).toHaveClass(/open/);await expect(page.locator('#stemSeparate')).toBeVisible();await page.locator('#stemClose').click();
  expect(errors,errors.join('\n')).toEqual([]);
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
