import test from 'node:test';
import assert from 'node:assert/strict';
import { safeError, checkPrivileges, checkConcerns, indexSnapshot, preserveLegacy } from '../scripts/index-readiness-policy.mjs';

test('readiness errors never expose driver messages, URI, namespace or duplicate values', () => {
  for (const code of [11000, 13, 18, undefined]) {
    const result = safeError(Object.assign(new Error('mongodb://user:secret@host/customer_db customer-name dup key'), {code}));
    assert.match(result, /^BLOCKED_[A-Z_]+$/);
    assert.doesNotMatch(result, /secret|customer|mongodb|host/);
  }
});
const grants = [
  {resource:{db:'spacare_test',collection:''},actions:['listCollections']},
  {resource:{db:'spacare_test',collection:'commissions'},actions:['listIndexes']},
  {resource:{db:'spacare_test',collection:'invoicelinecommissions'},actions:['find','listIndexes','createIndex','createCollection']},
  {resource:{cluster:true},actions:['getDefaultRWConcern']},
];
test('privileges require each action on the correct resource and fail closed', () => {
  assert.doesNotThrow(() => checkPrivileges(grants,'spacare_test',true));
  for (const bad of [undefined, [], grants.map(p=>({...p,resource:{db:'other',collection:''}})), grants.map(p=>({...p,resource:{db:'spacare_test',collection:'other'}}))]) {
    assert.throws(()=>checkPrivileges(bad,'spacare_test',true),/BLOCKED_PRIVILEGES/);
  }
  const readOnly = grants.map(p=>({...p,actions:p.actions.filter(a=>!a.startsWith('create'))}));
  assert.doesNotThrow(()=>checkPrivileges(readOnly,'spacare_test',false));
  assert.throws(()=>checkPrivileges(readOnly,'spacare_test',true),/BLOCKED_PRIVILEGES/);
});
test('RW concern rejects missing, weak and failed command results', () => {
  const strong={ok:1,defaultReadConcern:{level:'majority'},defaultWriteConcern:{w:'majority',j:true}};
  assert.doesNotThrow(()=>checkConcerns(strong));
  for (const bad of [null,{}, {...strong,ok:0}, {...strong,defaultReadConcern:{level:'local'}}, {...strong,defaultWriteConcern:{w:1,j:true}}, {...strong,defaultWriteConcern:{w:'majority'}}]) {
    assert.throws(()=>checkConcerns(bad),/BLOCKED_RW_CONCERN/);
  }
});
test('legacy canonical snapshot preserves key order and every option', () => {
  const indexes=[{name:'x',key:{spaId:1,invoiceId:1},unique:true,v:2}];
  assert.equal(indexSnapshot(indexes),indexSnapshot([{v:2,unique:true,key:{spaId:1,invoiceId:1},name:'x'}]));
  assert.notEqual(indexSnapshot(indexes),indexSnapshot([{...indexes[0],key:{invoiceId:1,spaId:1}}]));
  assert.notEqual(indexSnapshot(indexes),indexSnapshot([{...indexes[0],hidden:true}]));
});
test('legacy drift blocks success and failed apply; no repair attempted', async () => {
  for (const throws of [false,true]) {
    let reads=0;
    await assert.rejects(preserveLegacy(async()=>[{key:{x:1},unique:++reads===1}],async()=>{if(throws) throw new Error('private');}),/BLOCKED_LEGACY_INDEX_DRIFT/);
    assert.equal(reads,2);
  }
});
test('apply failure preserves legacy verification and retry succeeds without extra mutation', async () => {
  const indexes=[{name:'legacy',key:{spaId:1,invoiceId:1},unique:true}];
  let reads=0, created=false, writes=0;
  const read=async()=>{reads++;return indexes;};
  const apply=async()=>{if(!created){created=true;writes++;throw new Error('interrupted');}};
  await assert.rejects(preserveLegacy(read,apply),/interrupted/);
  await preserveLegacy(read,apply);
  await preserveLegacy(read,apply);
  assert.equal(writes,1); assert.equal(reads,6);
  await assert.rejects(preserveLegacy(async()=>{throw new Error('cannot read');},apply),/cannot read/);
});
