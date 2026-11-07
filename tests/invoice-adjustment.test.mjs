import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {adjustmentBalance,invoiceAdjustmentInput,invoiceAdjustmentRefundInput} from '../src/lib/invoice-adjustment-rules.ts';
test('correction returns stored value first, discloses direct credit and never invents cash refunds',()=>{
  assert.deepEqual(adjustmentBalance(1000000,0,0,false,300000,200000,100000),{paid:300000,credit:400000,depositReturn:200000,cardReturn:100000});
  assert.deepEqual(adjustmentBalance(1000000,0,0,false,1500000,0,0),{paid:1000000,credit:0,depositReturn:0,cardReturn:0});
  assert.deepEqual(adjustmentBalance(500000,500000,0,true,1200000,0,0),{paid:1000000,credit:0,depositReturn:0,cardReturn:0});
  assert.deepEqual(adjustmentBalance(1000000,0,200000,false,0,0,0),{paid:0,credit:800000,depositReturn:0,cardReturn:0});
  assert.deepEqual(adjustmentBalance(0,600000,400000,true,0,0,0),{paid:0,credit:600000,depositReturn:0,cardReturn:0});
  assert.throws(()=>adjustmentBalance(1,0,2,false,0,0,0));
});
test('correction and real-refund inputs reject silent privileges, negative amounts and missing evidence',()=>{
  const base={id:'a'.repeat(24),expectedUpdatedAt:'2026-11-06T00:00:00Z',mode:'CORRECT',description:'Corrected',total:1,reason:'Owner correction'};
  assert.equal(invoiceAdjustmentInput.safeParse(base).success,true);
  assert.equal(invoiceAdjustmentInput.safeParse({...base,issuedOn:'2026-11-06'}).success,true);
  for(const issuedOn of ['2026-02-30','2026-13-01','not-a-day'])assert.equal(invoiceAdjustmentInput.safeParse({...base,issuedOn}).success,false);
  assert.equal(invoiceAdjustmentInput.safeParse({...base,mode:'VOID',issuedOn:'2026-11-06'}).success,false);
  for(const extra of [{reason:' '},{total:-1},{total:1.5},{actorId:'b'.repeat(24)},{spaId:'b'.repeat(24)}])assert.equal(invoiceAdjustmentInput.safeParse({...base,...extra}).success,false);
  const refund={id:base.id,expectedUpdatedAt:base.expectedUpdatedAt,amount:1,method:'CASH',reason:'Actual refund',receivedConfirmation:true};
  assert.equal(invoiceAdjustmentRefundInput.safeParse(refund).success,true);
  assert.equal(invoiceAdjustmentRefundInput.safeParse({...refund,receivedConfirmation:false}).success,false);
});
test('owner financial corrections preserve sources and payroll, recheck preview, rollback and refund only on confirmation (model doubles)',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-adjustment-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:20000});
});
test('invoice list uses accessible correction/void icons and preserves debt payment action',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-adjustment-ui-fixture.tsx',import.meta.url))],{stdio:'pipe',timeout:15000});
});
