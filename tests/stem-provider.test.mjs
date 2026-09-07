import test from'node:test';
import assert from'node:assert/strict';
import{normalizeProviderEndpoint,resolveProviderUrl,validateStemResult,createHttpStemProvider}from'../js/stem-provider.js';

const response=(body,{status=200,blob=null}={})=>({ok:status>=200&&status<300,status,json:async()=>body,blob:async()=>blob||new Blob(['wav'],{type:'audio/wav'})});

test('provider endpoint normalization and URL resolution are stable',()=>{
  assert.equal(normalizeProviderEndpoint(' https://nx.example.test/api/// '),'https://nx.example.test/api');
  assert.equal(resolveProviderUrl('https://nx.example.test/api','/v1/stem-jobs/abc'),'https://nx.example.test/v1/stem-jobs/abc');
  assert.equal(resolveProviderUrl('https://nx.example.test/api','files/vocals.wav'),'https://nx.example.test/api/files/vocals.wav');
});

test('provider recognizes only canonical Phase stem slots',()=>{
  assert.deepEqual(validateStemResult({vocals:'/v.wav',drums:'/d.wav',noise:'/x.wav'}),['vocals','drums']);
  assert.throws(()=>validateStemResult({noise:'/x.wav'}),/recognized stem slots/);
});

test('HTTP provider creates, polls and downloads a four-stem job',async()=>{
  const calls=[],progress=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url:String(url),method:options.method||'GET'});
    if(String(url).endsWith('/v1/stem-jobs')&&options.method==='POST')return response({id:'job-1',progress:.05});
    if(String(url).endsWith('/v1/stem-jobs/job-1'))return response({id:'job-1',status:'complete',progress:1,stems:{vocals:{url:'/files/v.wav',fileName:'vocals.wav'},drums:'/files/d.wav',bass:'/files/b.wav',other:'/files/o.wav'}});
    if(String(url).includes('/files/'))return response(null,{blob:new Blob([String(url)],{type:'audio/wav'})});
    return response({}, {status:404});
  };
  const provider=createHttpStemProvider({endpoint:'https://nx.example.test',fetchImpl,pollMs:0});
  const file=new File([new Uint8Array([1,2,3])],'song.wav',{type:'audio/wav'});
  const out=await provider.separate({file,trackLabel:'TRACK A',onProgress:x=>progress.push(x)});
  assert.equal(out.jobId,'job-1');
  assert.deepEqual(Object.keys(out.stems),['vocals','drums','bass','other']);
  assert.equal(out.stems.vocals.fileName,'vocals.wav');
  assert.equal(out.stems.drums.fileName,'drums.wav');
  assert.equal(calls[0].method,'POST');
  assert.ok(progress.some(x=>x.stage==='complete'&&x.progress===1));
});

test('HTTP provider surfaces failed separation jobs',async()=>{
  const fetchImpl=async(url,options={})=>options.method==='POST'?response({id:'bad'}):response({id:'bad',status:'failed',message:'model unavailable'});
  const provider=createHttpStemProvider({endpoint:'https://nx.example.test',fetchImpl,pollMs:0});
  await assert.rejects(()=>provider.separate({file:new File(['x'],'song.wav',{type:'audio/wav'})}),/model unavailable/);
});

test('HTTP provider supports cancellation before upload',async()=>{
  const controller=new AbortController();controller.abort();
  const provider=createHttpStemProvider({endpoint:'https://nx.example.test',fetchImpl:async()=>response({})});
  await assert.rejects(()=>provider.separate({file:new File(['x'],'song.wav'),signal:controller.signal}),e=>e?.name==='AbortError');
});
