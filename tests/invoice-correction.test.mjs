import test from 'node:test';
import assert from 'node:assert/strict';
import { repriceInvoiceItems } from '../src/lib/invoice-correction.ts';
test('invoice repricing preserves fixed commissions and reconciles rounding exactly',()=>{
 const original=[{total:100000,commission:10000},{total:200000,commission:20000}];
 const rows=repriceInvoiceItems(original,400001);
 assert.equal(rows.reduce((n,r)=>n+r.total,0),400001);
 assert.deepEqual(rows.map(r=>r.commission),[10000,20000]);
 assert.deepEqual(original.map(r=>r.total),[100000,200000]);
 assert.equal(repriceInvoiceItems([{total:999999999999},{total:1}],1000000000000).reduce((n,r)=>n+r.total,0),1000000000000);
 assert.throws(()=>repriceInvoiceItems(original,0));
});

import { invoiceDeletionBlock } from '../src/lib/invoice-correction.ts';
test('permanent invoice deletion only accepts canceled and untouched records',()=>{
 assert.equal(invoiceDeletionBlock({status:'CANCELLED',paid:0}), '');
 assert.ok(invoiceDeletionBlock({status:'OPEN',paid:0}));
 for(const patch of [{paid:1},{cardPaid:1},{refunded:1},{openingBalance:true},{performedAt:new Date()},{performedBy:'actor'},{appointmentId:'visit'},{treatmentId:'plan'},{treatmentUseId:'use'},{giftOfInvoiceId:'gift'},{productId:'product'},{kind:'PRODUCT'},{kind:'SESSION'},{kind:'GIFT'},{saleCommissionAccrued:1}]) assert.ok(invoiceDeletionBlock({status:'CANCELLED',...patch}),JSON.stringify(patch));
});
