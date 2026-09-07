import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync,existsSync}from'node:fs';
import{resolve}from'node:path';

const root=resolve('.');
const read=p=>readFileSync(resolve(root,p),'utf8');
const localPath=url=>String(url).split('?')[0].replace(/^\.\//,'');

function htmlAssets(html){
  const out=[];
  for(const m of html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="(\.\/[^"#]+)"/g))out.push(localPath(m[1]));
  return out;
}

function serviceWorkerAssets(sw){
  const m=sw.match(/const CORE=\[(.*?)\]\.map\(asset\)/s);assert.ok(m,'service worker CORE list should exist');
  return[...m[1].matchAll(/'([^']+)'/g)].map(x=>localPath(x[1])).filter(Boolean);
}

test('every local index asset exists in the repository',()=>{
  const assets=htmlAssets(read('index.html'));assert.ok(assets.length>10);
  for(const asset of assets)assert.ok(existsSync(resolve(root,asset)),`missing index asset: ${asset}`);
});

test('every service-worker shell asset exists',()=>{
  const assets=serviceWorkerAssets(read('sw.js'));assert.ok(assets.includes('recovery.html'));assert.ok(assets.includes('ui-polish.css'));assert.ok(assets.includes('js/runtime-guard.js'));
  for(const asset of assets){if(asset==='')continue;assert.ok(existsSync(resolve(root,asset)),`missing service-worker asset: ${asset}`)}
});

test('Pages artifact copies all root runtime assets',()=>{
  const workflow=read('.github/workflows/pages.yml');
  for(const asset of['index.html','recovery.html','styles.css','ui-polish.css','manifest.webmanifest','sw.js'])assert.match(workflow,new RegExp(`\\b${asset.replace('.','\\.')}\\b`),`Pages workflow must copy ${asset}`);
  assert.match(workflow,/cp -R icons js _site\//);
});

test('visible Phase version and cache-bust generation stay consistent',()=>{
  const html=read('index.html'),tag=html.match(/ALPHA\s+([0-9.]+)/)?.[1],footer=html.match(/PHASE\s+([0-9.]+)<\/span>/)?.[1];
  assert.ok(tag);assert.equal(footer,tag);
  const generations=[...html.matchAll(/[?&]v=(\d+)/g)].map(m=>m[1]);assert.ok(generations.length>10);assert.equal(new Set(generations).size,1);
});

test('runtime guard loads before workstation modules',()=>{
  const html=read('index.html'),guard=html.indexOf('./js/runtime-guard.js'),app=html.indexOf('./js/app.js');assert.ok(guard>=0&&app>=0);assert.ok(guard<app);
});
