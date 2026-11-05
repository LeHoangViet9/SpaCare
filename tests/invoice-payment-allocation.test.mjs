import test from 'node:test';
import assert from 'node:assert/strict';
import { invoicePaymentAllocation, allocateInvoicePayments } from '../src/lib/invoice-payment-allocation.ts';
import { applyInvoiceLinePayment } from '../src/lib/invoice-line-payments.ts';
const a='a'.repeat(24), b='b'.repeat(24);
const invoice=()=>({total:1500000,paid:300000,serviceItems:[{lineId:a,total:1000000,paid:300000},{lineId:b,total:500000,paid:0}]});
const part=(method,amount,lineAllocations)=>({method,amount,lineAllocations});

test('one outstanding line allocates both partial and full receipts without manual fields',()=>{
 const bill=invoice();bill.serviceItems[0].paid=1000000;bill.paid=1000000;
 assert.equal(invoicePaymentAllocation(bill,200000).mode,'automatic');
 assert.deepEqual(allocateInvoicePayments(bill,[part('CASH',100000),part('BANK_TRANSFER',100000)]).map(row=>row.lineAllocations),[[{lineId:b,amount:100000}],[{lineId:b,amount:100000}]]);
 assert.deepEqual(allocateInvoicePayments(bill,[part('BANK_TRANSFER',500000)])[0].lineAllocations,[{lineId:b,amount:500000}]);
});

test('full settlement uses actual line debt and preserves separate method totals without mutating invoices',()=>{
 const bill=invoice(), before=structuredClone(bill);
 assert.equal(invoicePaymentAllocation(bill,1200000).mode,'automatic');
 const payments=allocateInvoicePayments(bill,[part('CASH',800000),part('BANK_TRANSFER',400000)]);
 assert.deepEqual(payments.map(row=>row.lineAllocations),[[{lineId:a,amount:700000},{lineId:b,amount:100000}],[{lineId:b,amount:400000}]]);
 let lines=bill.serviceItems;
 for(const payment of payments)lines=applyInvoiceLinePayment(lines,payment.lineAllocations,payment.amount);
 assert.deepEqual(lines.map(row=>row.paid),[1000000,500000]);
 assert.deepEqual(bill,before);
 assert.deepEqual(allocateInvoicePayments(bill,[part('BANK_TRANSFER',1200000)])[0].lineAllocations,[{lineId:a,amount:700000},{lineId:b,amount:500000}]);
});

test('partial receipts on multiple outstanding lines still require valid explicit allocations per source',()=>{
 const bill=invoice();
 assert.equal(invoicePaymentAllocation(bill,400000).mode,'manual');
 assert.throws(()=>allocateInvoicePayments(bill,[part('CASH',400000)]));
 assert.throws(()=>allocateInvoicePayments(bill,[part('CASH',400000,[{lineId:a,amount:399999}])]));
 assert.throws(()=>allocateInvoicePayments(bill,[part('CASH',400000,[{lineId:b,amount:400000}]),part('BANK_TRANSFER',200000,[{lineId:b,amount:200000}])]));
 const source=[part('CASH',200000,[{lineId:a,amount:200000}]),part('BANK_TRANSFER',200000,[{lineId:b,amount:200000}])];
 assert.deepEqual(allocateInvoicePayments(bill,source),source);
});

test('legacy invoices retain aggregate payments; inconsistent line balances fail closed',()=>{
 const legacy={total:1500000,paid:0};
 assert.equal(invoicePaymentAllocation(legacy,1500000).mode,'legacy');
 assert.equal(allocateInvoicePayments(legacy,[part('CASH',1000000),part('BANK_TRANSFER',500000)])[0].lineAllocations,undefined);
 for(const change of [{paid:1},{total:1400000},{serviceItems:[{lineId:a,total:1000000,paid:300000},{total:500000,paid:0}]}]){
  const bill={...invoice(),...change};assert.equal(invoicePaymentAllocation(bill,100000).mode,'reconcile');assert.throws(()=>allocateInvoicePayments(bill,[part('CASH',100000)]));
 }
});

test('mirrored treatment sessions count once while other session and product/package debts remain included',()=>{
 const bill={total:1500000,paid:0,serviceItems:[{lineId:a,total:0,paid:0}],treatmentSessions:[{lineId:a,total:0,paid:0}],productItems:[{lineId:b,total:500000,paid:0}],packageItems:[{lineId:'c'.repeat(24),total:1000000,paid:0}]};
 assert.equal(invoicePaymentAllocation(bill,1500000).lines.length,3);
 assert.equal(allocateInvoicePayments(bill,[part('CASH',1500000)])[0].lineAllocations.reduce((sum,row)=>sum+row.amount,0),1500000);
});
