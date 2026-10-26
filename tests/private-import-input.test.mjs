import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { tsImport } from 'tsx/esm/api';
const {readSupplementInput}=await tsImport('../src/lib/supplement-input.ts',import.meta.url);
const {readConfirmedAliases,confirmedHairRemovalName}=await tsImport('../src/lib/hair-removal-import.ts',import.meta.url);
const input={batch:'synthetic-batch-001',source:{name:'Synthetic Customer',phone:'0900000099',startsOn:'2022-01-15',expiresOn:'2025-01-15',services:['Service A','Service B','Service C']}};
function withFile(fn) {
  const root=resolve('imports');mkdirSync(root,{recursive:true});
  const dir=mkdtempSync(join(root,'synthetic-input-test-'));
  const file=join(dir,'input.json');
  try{return fn(file);}finally{
    assert.ok(resolve(dir).startsWith(root+sep));rmSync(dir,{recursive:true,force:true});
  }
}
test('private supplement preserves source and batch for existing fingerprints and retries',()=>withFile(file=>{
  writeFileSync(file,JSON.stringify(input));
  assert.deepEqual(readSupplementInput(file),input);
  assert.equal(JSON.stringify(readSupplementInput(file).source),JSON.stringify(input.source));
}));
test('private supplement rejects invalid input without exposing personal fields or parsing errors',()=>withFile(file=>{
  for(const bad of [null,{...input,extra:true},{...input,batch:'../unsafe'},
    {...input,source:{...input.source,phone:'invalid'}},
    {...input,source:{...input.source,startsOn:'2022-02-30'}},
    {...input,source:{...input.source,expiresOn:'2026-01-15'}},
    {...input,source:{...input.source,services:['Service A','service a','Service C']}},
    {...input,source:{...input.source,services:['Service A']}}]) {
    writeFileSync(file,JSON.stringify(bad));
    assert.throws(()=>readSupplementInput(file),error=>error.status===400 && !error.message.includes(input.source.name) && !error.message.includes(input.source.phone));
  }
  writeFileSync(file,'{broken');assert.throws(()=>readSupplementInput(file),/File bổ sung không hợp lệ/);
  writeFileSync(file,' '.repeat(65537));assert.throws(()=>readSupplementInput(file),/File bổ sung không hợp lệ/);
  assert.throws(()=>readSupplementInput('package.json'),/File bổ sung không hợp lệ/);
  assert.throws(()=>readSupplementInput('imports/../package.json'),/File bổ sung không hợp lệ/);
}));
test('confirmed aliases are supplied privately and never relax exact name/phone matching',()=>withFile(file=>{
  const rows=[{phone:'0900000099',source:'Synthetic source',existing:'Synthetic existing'}];
  writeFileSync(file,JSON.stringify(rows));const aliases=readConfirmedAliases(file);
  assert.equal(confirmedHairRemovalName(rows[0].source,rows[0].phone,aliases),rows[0].existing);
  assert.equal(confirmedHairRemovalName(rows[0].source,'0900000088',aliases),rows[0].source);
  assert.equal(confirmedHairRemovalName('Other source',rows[0].phone,aliases),'Other source');
  assert.equal(confirmedHairRemovalName(rows[0].source,rows[0].phone),rows[0].source);
  writeFileSync(file,JSON.stringify([...rows,...rows]));assert.throws(()=>readConfirmedAliases(file),/File ánh xạ không hợp lệ/);
}));
test('operational scripts contain no built-in customer records and do not print input identity',()=>{
  const supplement=readFileSync('scripts/supplement-huong-lan.ts','utf8');
  assert.match(supplement,/readSupplementInput/);
  assert.doesNotMatch(supplement,/const source=\{/);
  assert.doesNotMatch(supplement,/console\.log.*(?:source\.name|source\.phone)/);
  assert.doesNotMatch(readFileSync('src/lib/hair-removal-import.ts','utf8'),/const confirmedAliases/);
});
