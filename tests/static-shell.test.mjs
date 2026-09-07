import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync,existsSync,readdirSync}from'node:fs';
import{resolve,dirname,relative}from'node:path';

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
  const assets=serviceWorkerAssets(read('sw.js'));assert.ok(assets.includes('recovery.html'));assert.ok(assets.includes('ui-polish.css'));assert.ok(assets.includes('js/runtime-guard.js'));assert.ok(assets.includes('js/session-safety.js'));assert.ok(assets.includes('js/optional-ui.js'));
  for(const asset of assets){if(asset==='')continue;assert.ok(existsSync(resolve(root,asset)),`missing service-worker asset: ${asset}`)}
});

test('every Phase JavaScript module is available offline',()=>{
  const cached=new Set(serviceWorkerAssets(read('sw.js'))),files=readdirSync(resolve(root,'js')).filter(name=>name.endsWith('.js'));
  assert.ok(files.length>20);
  for(const name of files)assert.ok(cached.has(`js/${name}`),`js/${name} is not included in the service-worker shell`);
});

test('all literal relative JavaScript imports resolve to repository files',()=>{
  const files=readdirSync(resolve(root,'js')).filter(name=>name.endsWith('.js'));
  for(const name of files){const path=resolve(root,'js',name),source=readFileSync(path,'utf8'),specs=[];for(const m of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g))specs.push(m[1]);for(const spec of specs){const target=resolve(dirname(path),spec);assert.ok(existsSync(target),`${relative(root,path)} imports missing ${spec}`)}}
});

test('Pages artifact copies all root runtime assets and emits build metadata',()=>{
  const workflow=read('.github/workflows/pages.yml');
  for(const asset of['index.html','recovery.html','styles.css','ui-polish.css','manifest.webmanifest','sw.js'])assert.match(workflow,new RegExp(`\\b${asset.replace('.','\\.')}\\b`),`Pages workflow must copy ${asset}`);
  assert.match(workflow,/cp -R icons js _site\//);assert.match(workflow,/_site\/build\.json/);assert.match(workflow,/GITHUB_SHA/);
});

test('deployed build metadata stays network-first through the service worker',()=>{
  const sw=read('sw.js');assert.match(sw,/build\.json/);assert.match(sw,/networkFirst\(event\.request\)/);
});

test('visible Phase version and cache-bust generation stay consistent',()=>{
  const html=read('index.html'),tag=html.match(/ALPHA\s+([0-9.]+)/)?.[1],footer=html.match(/PHASE\s+([0-9.]+)<\/span>/)?.[1];
  assert.ok(tag);assert.equal(footer,tag);
  const generations=[...html.matchAll(/[?&]v=(\d+)/g)].map(m=>m[1]);assert.ok(generations.length>10);assert.equal(new Set(generations).size,1);
});

test('runtime and lifecycle guards load before workstation modules',()=>{
  const html=read('index.html'),runtime=html.indexOf('./js/runtime-guard.js'),safety=html.indexOf('./js/session-safety.js'),app=html.indexOf('./js/app.js');assert.ok(runtime>=0&&safety>=0&&app>=0);assert.ok(runtime<safety);assert.ok(safety<app);
});

test('standalone recovery route exposes runtime history and recovery report',()=>{
  const html=read('recovery.html');assert.match(html,/echoverse\.phase\.runtimeLog\.v1/);assert.match(html,/DOWNLOAD RECOVERY REPORT/);assert.match(html,/build\.json/);assert.match(html,/RESET APP CACHE \+ WORKER/);
});
