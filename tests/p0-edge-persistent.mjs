// Hosted synthetic persistent Microsoft Edge profile test. No access to user Edge data.
// Browser profile exists only on the ephemeral CI runner, with fake fixture content.
import{chromium}from'@playwright/test';
import{promises as fs}from'node:fs';
const origin='https://phase.aerovista.us';
const dir='test-results/p0-edge-persistent';
const profile=dir+'/synthetic-edge-profile';
await fs.mkdir(dir,{recursive:true});
const evidence={generatedAt:new Date().toISOString(),origin,profile:'isolated test-runner persistent profile',checks:[],errors:[],realUserProfileAccess:false};
const fixture=JSON.stringify({version:12,savedAt:new Date().toISOString(),tracks:[],fixture:'synthetic-only-p0-edge'});
async function run(stage,fn){
 try{const result=await fn();evidence.checks.push({stage,ok:true,...(result||{})})}
 catch(e){evidence.checks.push({stage,ok:false,error:String(e?.message||e)});evidence.errors.push(String(e?.message||e))}
}
let ctx;
try{
 await run('first persistent Edge launch',async()=>{
  ctx=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:{width:1366,height:768}});
  const page=ctx.pages()[0]||await ctx.newPage();
  page.on('pageerror',e=>evidence.errors.push('stage1 JS '+e.message));
  const response=await page.goto(origin+'/recovery.html',{waitUntil:'domcontentloaded',timeout:35000});
  if(response?.status()!==200)throw Error('Recovery HTTP '+response?.status());
  await page.evaluate(value=>localStorage.setItem('echoverse.phase.session.v5',value),fixture);
  await page.locator('#refresh').click();
  if(await page.locator('#saved').innerText()!=='YES')throw Error('Synthetic recovery map invisible');
  const view=await page.evaluate(async()=>({registrations:'serviceWorker'in navigator?(await navigator.serviceWorker.getRegistrations()).length:0,keys:'caches'in window?await caches.keys():[]}));
  await page.screenshot({path:dir+'/edge-first.png',fullPage:true});
  return view;
 });
 if(ctx){await ctx.close();ctx=null}
 await run('same persistent Edge profile after normal browser restart',async()=>{
  ctx=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:{width:1366,height:768}});
  const page=ctx.pages()[0]||await ctx.newPage();
  page.on('pageerror',e=>evidence.errors.push('stage2 JS '+e.message));
  const response=await page.goto(origin+'/recovery.html',{waitUntil:'domcontentloaded',timeout:35000});
  if(response?.status()!==200)throw Error('Recovery HTTP '+response?.status());
  await page.locator('#refresh').click();
  const unchanged=await page.evaluate(()=>localStorage.getItem('echoverse.phase.session.v5'));
  if(unchanged!==fixture)throw Error('LocalStorage map changed across Edge restart');
  if(await page.locator('#saved').innerText()!=='YES')throw Error('Saved map not recognized after Edge restart');
  const build=await page.locator('#liveVersion').innerText();
  if(build!=='0.14.6')throw Error('Unexpected recovery build '+build);
  await page.screenshot({path:dir+'/edge-reopened.png',fullPage:true});
  const routes=[];
  for(const url of ['/', '/assembly.html']){
   const response=await page.goto(origin+url,{waitUntil:'domcontentloaded',timeout:35000});
   if(response?.status()!==200)throw Error('Editor '+url+' status '+response?.status());
   routes.push({path:url,title:await page.title(),status:response.status()});
  }
  return{preserved:true,build,routes};
 });
}finally{
 if(ctx)await ctx.close();
 await fs.writeFile(dir+'/report.json',JSON.stringify(evidence,null,2));
 console.log('PHASE_P0_EDGE_PERSISTENT '+JSON.stringify(evidence));
}
if(evidence.errors.length)process.exitCode=1;
