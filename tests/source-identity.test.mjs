import test from'node:test';import assert from'node:assert/strict';
import{fileIdentity,identityWarnings,identityScore,chooseIdentityMatch}from'../js/source-identity.js';
const f=(name,size,lastModified=1000,type='audio/wav')=>({name,size,lastModified,type});
test('file identity captures lightweight source metadata',()=>assert.deepEqual(fileIdentity(f('a.wav',123)),{name:'a.wav',size:123,lastModified:1000,type:'audio/wav'}));
test('identity warnings distinguish size from modified-time drift',()=>{const expected=fileIdentity(f('a.wav',123,1000)),actual=f('a.wav',124,2000);assert.deepEqual(identityWarnings(expected,actual),['SIZE_MISMATCH','MODIFIED_TIME_DIFFERS'])});
test('identity score strongly prefers same name and size',()=>{const expected=fileIdentity(f('a.wav',123,1000));assert.ok(identityScore(expected,f('a.wav',123,2000))>identityScore(expected,f('a.wav',999,1000)))});
test('identity matcher resolves duplicate filenames using metadata',()=>{const expected=fileIdentity(f('a.wav',123,1000)),files=[f('a.wav',999,1000),f('a.wav',123,1000)];const best=chooseIdentityMatch(expected,files,{nameFallback:false});assert.equal(best.file.size,123);assert.equal(best.score,1);assert.deepEqual(best.warnings,[])});
