import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const { invoiceHandlingReasons } = await tsImport('../src/lib/invoice-handling.ts',import.meta.url);
const { readInvoiceHandling } = await tsImport('../src/lib/invoice-handling-read.ts',import.meta.url);
const models = await tsImport('../src/lib/models.ts',import.meta.url);
const invoice={_id:'a'.repeat(24),kind:'PACKAGE',status:'OPEN',total:350000,paid:0,createdAt:new Date(),sellerId:'b'.repeat(24),saleCommissionVersion:1};
const context={used:false,appointments:false,pendingAppointments:false,changedPlan:false,history:false,giftCards:false,usedGiftCard:false,settled:false,lineCommission:false,packageCommission:false,oldDayClosed:false,todayClosed:false,receiptDayOpen:true,directPayment:true,hasActivePayment:false};
test('unused, used and booked packages have separate content, date and void explanations',()=>{
  const fresh=invoiceHandlingReasons(invoice,context,true);
  assert.equal(fresh.edit,'');assert.equal(fresh.date,'');assert.equal(fresh.void,'');assert.ok(fresh.replace);
  const used=invoiceHandlingReasons(invoice,{...context,used:true},true);
  assert.match(used.edit,/buổi sử dụng/);assert.match(used.void,/buổi sử dụng/);assert.equal(used.date,'');
  const booked=invoiceHandlingReasons(invoice,{...context,appointments:true,pendingAppointments:true},true);
  assert.match(booked.edit,/lịch hẹn/);assert.match(booked.void,/lịch hẹn/);assert.equal(booked.date,'');
  const pastVisit=invoiceHandlingReasons(invoice,{...context,appointments:true},true);
  assert.ok(pastVisit.edit);assert.equal(pastVisit.void,'','void backend only blocks pending appointments');
});
test('paid used package may replace advisor but cannot reprice or void; date remains distinct',()=>{
  const paid={...invoice,status:'PAID',paid:invoice.total};
  const result=invoiceHandlingReasons(paid,{...context,used:true,history:true,hasActivePayment:true},true);
  assert.ok(result.edit);assert.ok(result.cancel);assert.ok(result.void);assert.equal(result.date,'');assert.equal(result.replace,'');
  assert.ok(invoiceHandlingReasons(paid,{...context,directPayment:false},true).replace);
  assert.ok(invoiceHandlingReasons({...paid,productItems:[{}]},context,true).replace);
});
test('permissions, closed books, payroll and replaced chains keep guards visible',()=>{
  assert.ok(Object.values(invoiceHandlingReasons(invoice,context,false)).every(reason=>reason.includes('chủ spa')));
  assert.ok(Object.values(invoiceHandlingReasons({...invoice,status:'CANCELLED'},context,true)).every(Boolean));
  const locked=invoiceHandlingReasons(invoice,{...context,oldDayClosed:true},true);
  assert.match(locked.edit,/chốt sổ/);assert.match(locked.date,/chốt sổ/);
  const payroll=invoiceHandlingReasons({...invoice,paid:350000},{...context,settled:true},true);
  assert.ok(payroll.edit);assert.ok(payroll.replace);assert.ok(payroll.void);assert.equal(payroll.date,'');
  const chain=invoiceHandlingReasons({...invoice,activeDocumentId:'c'.repeat(24),paid:350000},context,true);
  assert.ok(chain.edit);assert.ok(chain.date);assert.ok(chain.void);assert.equal(chain.replace,'');
  const cards=invoiceHandlingReasons(invoice,{...context,giftCards:true,usedGiftCard:true},true);
  assert.ok(cards.edit);assert.ok(cards.void);
});
test('handling projection is read-only and scopes every reference lookup to current spa',async t=>{
  const spaId='d'.repeat(24);let reads=0;
  for(const name of ['Appointment','Allocation','CashCard','CashCardUse','CashEntry','Commission','Day','InvoiceLineCommission','Payment','Payroll','SaleCommission','SharedSaleCommission','TreatmentUse']){
    const model=models[name];
    for(const method of ['find','findOne','exists'])t.mock.method(model,method,filter=>{
      reads++;assert.equal(filter.spaId,spaId,name+'.'+method);
      return method==='exists'?Promise.resolve(null):{select(){return this;},lean:async()=>method==='find'?[]:null};
    });
    for(const method of ['create','updateOne','deleteMany'])t.mock.method(model,method,()=>assert.fail('Unexpected write'));
  }
  const result=await readInvoiceHandling(spaId,invoice,[],[]);
  assert.ok(reads>=10);assert.equal(result.edit,'');assert.equal(result.date,'');
});
