import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync,readdirSync,statSync}from'node:fs';
import{resolve}from'node:path';

const root=resolve('.'),bytes=p=>statSync(resolve(root,p)).size,read=p=>readFileSync(resolve(root,p),'utf8');
function directScripts(){return[...read('index.html').matchAll(/<script\s+type="module"\s+src="\.\/([^"?]+)(?:\?[^\"]*)?"/g)].map(m=>m[1])}

test('critical Phase module entrypoints stay inside startup budget',()=>{const scripts=directScripts(),total=scripts.reduce((n,p)=>n+bytes(p),0);assert.ok(scripts.length>=10);assert.ok(total<=256*1024,`critical module entrypoints are ${(total/1024).toFixed(1)} KB; budget is 256 KB`)});
test('entire Phase JavaScript source stays inside alpha bundle budget',()=>{const files=readdirSync(resolve(root,'js')).filter(n=>n.endsWith('.js')),total=files.reduce((n,f)=>n+bytes(`js/${f}`),0);assert.ok(total<=512*1024,`all JavaScript is ${(total/1024).toFixed(1)} KB; budget is 512 KB`)});
test('Phase core styles stay inside rendering budget',()=>{const total=bytes('styles.css')+bytes('ui-polish.css');assert.ok(total<=128*1024,`styles are ${(total/1024).toFixed(1)} KB; budget is 128 KB`)});
test('standalone recovery route remains lightweight',()=>{const total=bytes('recovery.html');assert.ok(total<=64*1024,`recovery.html is ${(total/1024).toFixed(1)} KB; budget is 64 KB`)});
