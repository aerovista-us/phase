import{test,expect}from'@playwright/test';
const base='http://127.0.0.1:4173';
const BOOT='echoverse.phase.boot.v1',LOG='echoverse.phase.runtimeLog.v1';

test('rapid normal navigation during boot is not misreported as a crash',async({page})=>{
  test.setTimeout(35000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(key=>JSON.parse(sessionStorage.getItem(key)||'null')?.state==='starting',BOOT);
  await page.goto(base+'/recovery.html',{waitUntil:'domcontentloaded'});
  const state=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'null'),BOOT);
  expect(state?.state).toBe('navigated_before_ready');
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(key=>JSON.parse(sessionStorage.getItem(key)||'null')?.state==='ready',BOOT,{timeout:8000});
  const history=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'[]'),LOG);
  expect(history.filter(x=>x.type==='previous_boot_incomplete')).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('a previous boot interrupted without pagehide remains diagnostically visible',async({page})=>{
  const old={state:'starting',at:'2026-10-15T00:00:00.000Z',
    version:'0.14.6',path:'/'};
  await page.goto(base+'/recovery.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(({boot,log,old})=>{
    sessionStorage.setItem(boot,JSON.stringify(old));
    localStorage.removeItem(log);
  },{boot:BOOT,log:LOG,old});
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  const report=await page.evaluate(log=>JSON.parse(localStorage.getItem(log)||'[]'),LOG);
  const errors=report.filter(x=>x.type==='previous_boot_incomplete');
  expect(errors).toHaveLength(1);
  expect(errors[0].previous.state).toBe('starting');
  expect(errors[0].previous.version).toBe('0.14.6');
});

test('intentionally leaving after ready still marks boot closed',async({page})=>{
  test.setTimeout(20000);
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(key=>JSON.parse(sessionStorage.getItem(key)||'null')?.state==='ready',BOOT,{timeout:8000});
  await page.goto(base+'/recovery.html',{waitUntil:'domcontentloaded'});
  const state=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'null'),BOOT);
  expect(state?.state).toBe('closed');
});

test('runtime guard side effects run once even when imported with distinct ESM URLs',async({page})=>{
  test.setTimeout(15000);
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  const before=await page.evaluate(log=>JSON.parse(localStorage.getItem(log)||'[]').length,LOG);
  const boot=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'null'),BOOT);
  await page.evaluate(async()=>await import('./js/runtime-guard.js?diagnostic-double-import=1'));
  const after=await page.evaluate(({log,boot})=>({
    entries:JSON.parse(localStorage.getItem(log)||'[]').length,
    state:JSON.parse(sessionStorage.getItem(boot)||'null')
  }),{log:LOG,boot:BOOT});
  expect(after.entries).toBe(before);
  expect(after.state.at).toBe(boot.at);
  expect(after.state.state).toBe(boot.state);
});
