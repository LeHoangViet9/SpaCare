import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {invoiceAdjustmentInput} from '../src/lib/invoice-adjustment-rules.ts';
test('mistaken receipts require explicit VOID intent, unique payment IDs and a consistent confirmation',()=>{
 const data={id:'a'.repeat(24),expectedUpdatedAt:'2026-11-08T00:00:00Z',mode:'VOID',total:0,reason:'Nhập nhầm'},paymentId='b'.repeat(24);
 assert.ok(invoiceAdjustmentInput.safeParse({...data,mistakenPaymentIds:[paymentId]}).success);
 assert.ok(invoiceAdjustmentInput.safeParse({...data,mistakenPaymentIds:[paymentId],mistakenReceiptsConfirmed:true}).success);
 for(const extra of [{mistakenPaymentIds:[]},{mistakenPaymentIds:[paymentId,paymentId]},{mistakenPaymentIds:['bad']},{mistakenReceiptsConfirmed:true},{mode:'CORRECT',mistakenPaymentIds:[paymentId]},{mode:'CORRECT',mistakenReceiptsConfirmed:false}])assert.equal(invoiceAdjustmentInput.safeParse({...data,...extra}).success,false);
});
test('void and late cleanup reverse only explicitly mistaken receipts once, preserve originals, money and snapshots, and roll back atomically',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-void-receipts-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:30000});
});
