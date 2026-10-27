import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { previewConfig, assertPreviewOwner, plan, runPlan, reconcile, resolve } from '../src/lib/preview-seed.ts';
const host='synthetic-staging.mongodb.net';
const env={NODE_ENV:'test',SPACARE_ENV:'test',SPACARE_TARGET_DATABASE:'spacare_test',MONGODB_URI:`mongodb+srv://synthetic:synthetic@${host}/spacare_test?authSource=admin`,PREVIEW_OWNER_ID:'a'.repeat(24),PREVIEW_STAFF_PASSWORD:'synthetic-test-only-password'};
test('preview gate permits exact staging/test and explicit write confirmation',()=>{
  assert.equal(previewConfig(env,host).ownerId,env.PREVIEW_OWNER_ID);
  assert.doesNotThrow(()=>previewConfig(env,host,true,'WRITE-SYNTHETIC-spacare_test'));
  assert.throws(()=>previewConfig(env,host,true));
  assert.throws(()=>previewConfig(env,host,true,'yes'));
});
test('preview gate blocks production URI, alternate database, host spoof and Vercel',()=>{
  for(const db of ['spacare_live','spacare_prod','admin','spacare_dev','']) assert.throws(()=>previewConfig({...env,MONGODB_URI:`mongodb+srv://${host}/${db}`},host));
  for(const uri of [`mongodb+srv://production.mongodb.net/spacare_test`,`mongodb+srv://${host}.evil.invalid/spacare_test`,`mongodb+srv://${host}/spacare_test?dbName=spacare_live`,`mongodb://${host}/spacare_test`,`mongodb+srv://${host}/spacare_test?authSource=spacare_live`]) assert.throws(()=>previewConfig({...env,MONGODB_URI:uri},host));
  for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV','VERCEL_URL','VERCEL_REGION']) assert.throws(()=>previewConfig({...env,[key]:'preview'},host));
  for(const key of ['NODE_ENV','SPACARE_ENV','SPACARE_TARGET_DATABASE']) assert.throws(()=>previewConfig({...env,[key]:'production'},host));
});
test('existing OWNER is validated without modification; wrong tenant identity and role blocked',()=>{
  const owner={_id:env.PREVIEW_OWNER_ID,spaId:'b'.repeat(24),role:'OWNER',active:true,passwordHash:'synthetic'};
  const before=structuredClone(owner); assertPreviewOwner(owner,env.PREVIEW_OWNER_ID); assert.deepEqual(owner,before);
  for(const value of [null,{...owner,role:'STAFF'},{...owner,active:false},{...owner,_id:'c'.repeat(24)}]) assert.throws(()=>assertPreviewOwner(value,env.PREVIEW_OWNER_ID));
});
test('plan is deterministic, dependencies resolve, replay uses identical idempotency keys and never mutates OWNER',async()=>{
  const steps=plan('2026-10-27'); assert.deepEqual(steps,plan('2026-10-27'));
  const store=new Map(); let created=0;
  const execute=async(action,data,key)=>{
    assert.ok(!['updateUser','userStatus','deleteInvoice','reverseCash'].includes(action));
    if(action==='user') assert.ok(data.phone.startsWith('000'));
    if(!store.has(key)) {const id=(++created).toString(16).padStart(24,'0');store.set(key,{id,invoiceId:id});}
    return store.get(key);
  };
  const a=await runPlan(steps,env.PREVIEW_STAFF_PASSWORD,execute,()=>{});const n=created;
  const b=await runPlan(steps,env.PREVIEW_STAFF_PASSWORD,execute,()=>{});
  assert.equal(created,n);assert.deepEqual(a,b); assert.equal(store.size,steps.length);
  assert.throws(()=>resolve({ref:'missing'},a));
  assert.equal(steps.filter(s=>s.action==='customer').length,20);
  assert.equal(steps.filter(s=>s.action==='appointment').length,25);
});
const snapshot=()=>({Customer:[{_id:'c'}],Invoice:[{_id:'i',customerId:'c',total:100,paid:60,status:'PARTIALLY_PAID',kind:'SERVICE'}],Payment:[{invoiceId:'i',amount:60,receiptId:'r'}],CashEntry:[{_id:'r',amount:60,kind:'PAYMENT',direction:'IN'}],Product:[{_id:'p',stock:2}],StockMovement:[{productId:'p',direction:'IN',quantity:2,before:0,after:2}]});
test('reconciliation accepts balanced ledger and rejects unbalanced payment, stock and broken relations',()=>{
  reconcile(snapshot());
  for(const mutate of [r=>r.Invoice[0].paid++,r=>r.Invoice[0].customerId='foreign',r=>r.Payment[0].amount++,r=>r.CashEntry[0].amount++,r=>r.Product[0].stock=-1,r=>r.StockMovement[0].after=9,r=>r.Treatment=[{invoiceId:'foreign',customerId:'c',totalSessions:5,remaining:5}]]) {const r=snapshot();mutate(r);assert.throws(()=>reconcile(r));}
});
test('reconciliation checks card and deposit balances, financial origin and payroll totals',()=>{
  for(const rows of [
    {CashCard:[{customerId:'c',amount:100,balance:101}]},
    {CashCard:[{customerId:'c',amount:100,balance:0}]},
    {Deposit:[{customerId:'c',amount:100,balance:99}]},
    {CashCard:[{customerId:'c',amount:100,balance:100,origin:'GIFT',sourceInvoiceId:'missing'}]},
    {Payroll:[{earnedBase:100,commissionTotal:5,bonus:2,deductions:1,advance:0,total:999}]},
    {CashCardUse:[{cardId:'missing',invoiceId:'i',amount:1}]}
  ]) assert.throws(()=>reconcile({...snapshot(),...rows}));
});
test('all generated inputs use the real domain schemas offline with database driver blocked',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./preview-seed-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:20000});
});

test('actual CLI check is offline and missing confirmation rejects before connection',()=>{
  const dir=mkdtempSync(join(tmpdir(),'spacare-preview-offline-'));
  const file=join(dir,'preview.env');
  writeFileSync(file,Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n'));
  const childEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('VERCEL')));
  try {
    const stdout=execFileSync(process.execPath,['--import','tsx','scripts/seed-preview.ts','--check','--env-file',file,'--allow-host',host],{env:childEnv,encoding:'utf8',stdio:'pipe',timeout:20000});
    assert.match(stdout,/No database connection/);
    assert.throws(()=>execFileSync(process.execPath,['--import','tsx','scripts/seed-preview.ts','--write','--env-file',file,'--allow-host',host],{env:childEnv,stdio:'pipe',timeout:20000}),e=>e.status===1&&!String(e.stderr).includes('synthetic-test-only-password'));
  } finally {unlinkSync(file);rmdirSync(dir);}
});

test('balanced package allocation, purchased/gift cards, quota and payroll snapshots reconcile',()=>{
  const rows={
    Customer:[{_id:'c'}],
    Invoice:[{_id:'package',customerId:'c',kind:'PACKAGE',total:100,paid:60,status:'PARTIALLY_PAID',saleCommissionAccrued:3,giftCashCardAmount:50},{_id:'service',customerId:'c',kind:'SERVICE',total:100,paid:60,status:'PARTIALLY_PAID'},{_id:'paid',customerId:'c',total:100,paid:100,status:'PAID'}],
    Deposit:[{_id:'deposit',customerId:'c',amount:100,balance:40,receiptId:'deposit-receipt'}],
    Allocation:[{depositId:'deposit',invoiceId:'package',amount:60}],
    CashCard:[{_id:'card',customerId:'c',origin:'PURCHASE',amount:100,balance:40,receiptId:'card-receipt'},{_id:'gift',customerId:'c',origin:'GIFT',amount:50,balance:50,sourceInvoiceId:'package'}],
    CashCardUse:[{cardId:'card',invoiceId:'service',amount:60}],
    Payment:[{invoiceId:'paid',amount:100,receiptId:'payment-receipt'}],
    CashEntry:[{_id:'deposit-receipt',kind:'DEPOSIT',direction:'IN',amount:100},{_id:'card-receipt',kind:'CARD_SALE',direction:'IN',amount:100},{_id:'payment-receipt',kind:'PAYMENT',direction:'IN',amount:100}],
    SharedSaleCommission:[{invoiceId:'package',amount:3}],
    Treatment:[{_id:'t',invoiceId:'package',customerId:'c',packageType:'SESSIONS',totalSessions:5,remaining:4}],
    TreatmentUse:[{treatmentId:'t',customerId:'c'}],
    Payroll:[{earnedBase:100,commissionTotal:3,bonus:2,deductions:1,advance:0,total:104}]
  };
  assert.doesNotThrow(()=>reconcile(rows));
  for(const mutate of [r=>r.Allocation[0].amount++,r=>r.CashCardUse[0].amount++,r=>r.SharedSaleCommission[0].amount++,r=>r.Treatment[0].remaining++,r=>r.Invoice[1].customerId='foreign']) {
    const bad=structuredClone(rows);mutate(bad);assert.throws(()=>reconcile(bad));
  }
});

test('full synthetic plan uses real domain services with mocked persistence, rollback and replay',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./preview-seed-domain-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:30000});
});
