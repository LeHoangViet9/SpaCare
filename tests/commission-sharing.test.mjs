import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedCommissionDeltas, packageCommissionDelta } from '../src/lib/sale-commission.ts';
import { packageSaleInput } from '../src/lib/package-input.ts';
const a='a'.repeat(24), b='b'.repeat(24), c='c'.repeat(24);
test('sale participants reject duplicates, empty arrays, mixed-case duplicates and inconsistent seller', () => {
 const sale={customerId:a,templateId:b,dueDate:'2026-10-23'};
 assert.deepEqual(packageSaleInput.parse({...sale,participantIds:[a,b]}).participantIds,[a,b]);
 for(const participantIds of [[],[a,a],[a,a.toUpperCase()],['bad'],Array(21).fill(a)]) assert.equal(packageSaleInput.safeParse({...sale,participantIds}).success,false);
 assert.equal(packageSaleInput.safeParse({...sale,participantIds:[a,b],sellerId:b}).success,false);
 assert.equal(packageSaleInput.safeParse({...sale,sellerId:a}).success,true);
});
test('5 percent is a single pool split equally, integer remainder is deterministic', () => {
 const target=packageCommissionDelta(2000000,0,2000000,0).target;
 assert.deepEqual(sharedCommissionDeltas(target,0,[b,a]).map(r=>r.amount),[50000,50000]);
 assert.deepEqual(sharedCommissionDeltas(target,0,[c,a,b]).map(r=>r.amount),[33334,33333,33333]);
 assert.deepEqual(sharedCommissionDeltas(target,0,[c,a,b]),sharedCommissionDeltas(target,0,[b,c,a]));
 for(const [oldPool,newPool] of [[0,1],[1,2],[2,1],[100000,75000],[75000,0],[0,0]]) {
  const rows=sharedCommissionDeltas(newPool,oldPool,[a,b,c]);
  assert.equal(rows.reduce((n,r)=>n+r.amount,0),newPool-oldPool);
  assert.equal(rows.reduce((n,r)=>n+r.total,0),newPool);
  assert.ok(Math.max(...rows.map(r=>r.total))-Math.min(...rows.map(r=>r.total))<=1);
 }
 assert.throws(()=>sharedCommissionDeltas(100,0,[])); assert.throws(()=>sharedCommissionDeltas(100,0,[a,a]));
});
test('installments and refunds yield exactly the same per-person cumulative entitlement', () => {
 const ids=[a,b,c]; const earned=new Map(ids.map(id=>[id,0])); let accrued=0;
 for(const [paid,refunded] of [[1,0],[19,0],[20,0],[41,0],[1000001,0],[2000000,0],[2000000,500000],[1000001,500000],[1000001,1000001]]) {
  const {target}=packageCommissionDelta(paid,refunded,2000000,accrued);
  for(const row of sharedCommissionDeltas(target,accrued,ids)) earned.set(row.staffId,earned.get(row.staffId)+row.amount);
  assert.deepEqual([...earned.values()],sharedCommissionDeltas(target,0,ids).map(r=>r.total)); accrued=target;
 }
 assert.deepEqual([...earned.values()],[0,0,0]);
});

test('shared commission picker shows additive controls and each person gets a part of the same pool',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./sale-participants-fixture.tsx',import.meta.url))],{stdio:'pipe',timeout:15000});
});

test('participant subdocuments do not track an undeclared version key during transaction rollback', async () => {
 const {tsImport}=await import('tsx/esm/api');
 const {createRequire}=await import('node:module');
 const {Invoice}=await tsImport('../src/lib/models.ts',import.meta.url);
 const require=createRequire(import.meta.url);
 const {sessionNewDocuments}=require('mongoose/lib/helpers/symbols');
 const session={transaction:{},[sessionNewDocuments]:new Map()};
 const invoice=new Invoice({spaId:a,customerId:b,description:'Rollback fixture',total:100,paid:0,saleParticipants:[{staffId:c,staffName:'Participant'}]});
 const person=invoice.saleParticipants[0];
 assert.equal(person.schema.options.versionKey,false);
 assert.equal(person.schema.options.strict,'throw');
 person.$session(session);
 // Saving a subdocument runs Mongoose middleware without writing to the database.
 await person.save({suppressWarning:true});
 const state=session[sessionNewDocuments].get(person);
 assert.ok(state); assert.equal(Object.hasOwn(state,'versionKey'),false);
});
