// Read-only Phase P0 public-domain and recovery acceptance probe.
// Runs in a disposable GitHub-hosted Chromium profile. No production writes,
// private project bytes, audio uploads, cache resets, or service-worker removal.
import {chromium} from '@playwright/test';
import {promises as fs} from 'node:fs';
import dns from 'node:dns/promises';
import {execFileSync} from 'node:child_process';
const base=process.env.PHASE_PUBLIC_URL||'https://phase.aerovista.us';
const origin=new URL(base).origin;
const host=new URL(base).hostname;
const dest='test-results/p0-public-acceptance';
await fs.mkdir(dest,{recursive:true});
const record={
 generatedAt:new Date().toISOString(),origin,hostname:host,
 checks:{},dns:{},routeResponses:{},pageResults:{},errors:[],
 scope:'Fresh isolated Chromium; no access to user normal Edge profile or NXCore'
};
let browser=null,failed=false;
async function probe(label,fn){
 try{const result=await fn();record.checks[label]={ok:true};return result}
 catch(e){record.checks[label]={ok:false,error:String(e?.message||e)};
  record.errors.push({test:label,error:String(e?.message||e)});failed=true;return null}
}
async function get(url){
 const response=await fetch(url,{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(20000)});
 record.routeResponses[new URL(url).pathname]={status:response.status,redirected:response.redirected,
  finalURL:response.url,contentType:response.headers.get('content-type')};
 if(!response.ok)throw Error('HTTP '+response.status+' at '+url);
 return response;
}
function assert(cond,message){if(!cond)throw Error(message)}
try{
 await probe('system-dns',async()=>{
  const addresses=await dns.lookup(host,{all:true});
  assert(addresses.length>0,'Empty DNS address response');
  record.dns.system=addresses;return addresses;
 });
 for(const provider of [
  {label:'cloudflare',address:'1.1.1.1'},
  {label:'google',address:'8.8.8.8'}
 ]){
  // Resolver timeouts are informational: systems may block direct UDP DNS.
  try{const resolver=new dns.Resolver();resolver.setServers([provider.address]);
   record.dns[provider.label]={addresses:await resolver.resolve4(host)};
  }catch(e){record.dns[provider.label]={error:String(e?.code||e?.message||e)}}
 }
 const pages={
  index:{path:'/',required:'PHASE'},
  assembly:{path:'/assembly.html',required:'MASTER ASSEMBLY'},
  recovery:{path:'/recovery.html',required:'PHASE RECOVERY'},
  serviceWorker:{path:'/sw.js',required:'echoverse-phase-shell-'},
  build:{path:'/build.json',required:'validated'}
 };
 for(const [name,{path,required}]of Object.entries(pages)){
  await probe('http-'+name,async()=>{
   const response=await get(new URL(path,origin));const contents=await response.text();
   assert(contents.includes(required),'Missing expected '+required+' marker');
   if(name==='build'){
    const b=JSON.parse(contents);record.build={version:b.version,commit:b.commit,validated:b.validated,
      channel:b.channel,workflowRun:b.workflowRun,builtAt:b.builtAt};
    assert(b.validated===true,'Production build is not marked validated');
    assert(typeof b.commit==='string'&&/^[a-f0-9]{40}$/.test(b.commit),'Invalid build commit');
    assert(/^0\\.14\\.6$/.test(b.version),'Expected Phase 0.14.6, received '+b.version);
    try{
     const out=execFileSync('git',['ls-remote','https://github.com/aerovista-us/phase.git',
      'refs/heads/main'],{encoding:'utf8',timeout:15000});
     record.expectedMainCommit=out.trim().split(/\\s/)[0];
     record.buildMatchesMain=record.expectedMainCommit===b.commit;
     assert(record.buildMatchesMain,'Deployed Pages commit differs from current main head');
    }catch(e){if(e?.message?.includes('Deployed Pages'))throw e;
     record.dns.gitHeadWarning=String(e?.message||e);
    }
   }
   if(name==='serviceWorker'){
    const m=contents.match(/echoverse-phase-shell-v\\d+/);
    record.workerCache=m?.[0]||null;
    assert(record.workerCache==='echoverse-phase-shell-v50','Unexpected worker cache generation');
   }
   return{name,bytes:contents.length};
  });
 }
 await probe('browser-recovery-and-editors',async()=>{
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:1360,height:850},serviceWorkers:'block'});
  const page=await ctx.newPage();
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  for(const [name,path,expected]of [
   ['recovery','/recovery.html','PHASE RECOVERY'],
   ['assembly','/assembly.html','MASTER ASSEMBLY'],
   ['mix','/','PHASE']
  ]){
   const response=await page.goto(new URL(path,origin).href,
    {waitUntil:'domcontentloaded',timeout:25000});
   assert(response?.status()===200, name+' browser navigation not 200');
   assert((await page.locator('body').innerText()).includes(expected),name+' missing title');
   record.pageResults[name]={http:response.status(),title:await page.title(),
    url:page.url()};
   await page.screenshot({path:dest+'/'+name+'.png',fullPage:true});
  }
  // Synthetic disposable map, only in this isolated runner context.
  await page.goto(new URL('/recovery.html',origin).href,{waitUntil:'domcontentloaded'});
  const fake='p0-fixture-not-user-data-'+Date.now();
  const map={version:12,savedAt:new Date().toISOString(),tracks:[],probe:fake};
  await page.evaluate(payload=>localStorage.setItem('echoverse.phase.session.v5',payload),
   JSON.stringify(map));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#refresh').click();
  const after=await page.evaluate(()=>localStorage.getItem('echoverse.phase.session.v5'));
  assert(after===JSON.stringify(map),'Read-only recovery removed or altered synthetic saved map');
  assert((await page.locator('#saved').innerText())==='YES','Recovery did not see synthetic map');
  record.pageResults.syntheticRecovery={preserved:true,fixture:'non-user synthesized',resetInvoked:false};
  record.pageResults.pageErrors=pageErrors;
  assert(pageErrors.length===0,'Browser JavaScript errors: '+pageErrors.join(' | '));
  await ctx.close();return true;
 });
}finally{
 if(browser)await browser.close();
 await fs.writeFile(dest+'/report.json',JSON.stringify(record,null,2));
 console.log('PHASE_P0_PUBLIC_REPORT '+JSON.stringify({
  origin,checks:record.checks,dns:record.dns,build:record.build,workerCache:record.workerCache,
  buildMatchesMain:record.buildMatchesMain,pageResults:record.pageResults,errors:record.errors
 }));
}
if(failed)process.exitCode=1;
