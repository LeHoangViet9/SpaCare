import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {Spa,Control,User,Customer,Service,Invoice,Payment,CashEntry,Commission,InvoiceLineCommission,SaleCommission,SharedSaleCommission,Payroll,InvoiceAdjustment,Audit,Idempotency,Treatment,TreatmentUse,Day} from '../src/lib/models';
import {operate} from '../src/lib/operations';
import {hashPassword} from '../src/lib/password';
import {readReport} from '../src/lib/report-read';
import {readWorkspace} from '../src/lib/workspace-read';
import {workspaceQuery} from '../src/lib/workspace-query';
import {spaDay} from '../src/lib/rules';
import type {Actor} from '../src/lib/auth';
const snapshot=(value:unknown)=>JSON.parse(JSON.stringify(value));

export async function invoiceAdjustmentIntegration(extraSpaIds:mongoose.Types.ObjectId[],t:TestContext){
 await receiptCorrectionIntegration(extraSpaIds,t);
 const spa=await Spa.create({name:'Financial correction integration'});extraSpaIds.push(spa._id);const scope={spaId:spa._id};
 const owner=await User.create({...scope,name:'Correction owner',role:'OWNER',active:true,passwordHash:hashPassword(randomUUID())});
 const staff=await User.create({...scope,name:'Correction technician',role:'STAFF',active:true,cashier:true,passwordHash:hashPassword(randomUUID())});
 const other=await User.create({...scope,name:'Correction technician 2',role:'STAFF',active:true,passwordHash:hashPassword(randomUUID())});
 const who:Actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER',cashier:false};
 await Control.create(scope);await Day.create({...scope,day:spaDay(),opening:0,status:'OPEN'});
 const customer=await Customer.create({...scope,name:'Correction customer',phone:'0900000082'});
 const service=await Service.create({...scope,name:'Correction service',price:1000000,commission:0,active:true});
 const call=(action:string,data:unknown,key=randomUUID())=>operate(who,action,data,key);
 const cashier:Actor={id:String(staff._id),spaId:String(spa._id),name:staff.name,role:'STAFF',cashier:true};
 const cashierCall=(action:string,data:unknown,key=randomUUID())=>operate(cashier,action,data,key);
 const currentMonth=spaDay().slice(0,7);
 const payroll=await Payroll.create({...scope,staffId:staff._id,staffName:staff.name,month:currentMonth,status:'PAID',baseSalary:0,commissionTotal:50000,total:50000});
 const otherPayroll=await Payroll.create({...scope,staffId:other._id,staffName:other.name,month:currentMonth,status:'APPROVED',baseSalary:0,commissionTotal:25000,total:25000});
 const payrollSnapshot=snapshot([payroll.toObject(),otherPayroll.toObject()]);
 let first=true;
 for(const model of [Commission,InvoiceLineCommission,SaleCommission,SharedSaleCommission]){
  const sale=model===SaleCommission||model===SharedSaleCommission;
  const bill=await Invoice.create({...scope,customerId:customer._id,serviceId:service._id,kind:sale?'PACKAGE':'SERVICE',description:'Original document',total:1000000,paid:1000000,status:'PAID',...(!sale?{serviceItems:[{lineId:new mongoose.Types.ObjectId(),serviceId:service._id,name:'Original line',total:1000000,commission:0,performerId:staff._id}],performedBy:staff._id}:{}),...(sale?{saleCommissionVersion:model===SharedSaleCommission?2:1,saleCommissionAccrued:50000,sellerId:staff._id,sellerName:staff.name}:{}),...(model===SharedSaleCommission?{saleParticipants:[{staffId:staff._id,staffName:staff.name},{staffId:other._id,staffName:other.name}]}:{})});
  const receipt=await CashEntry.create({...scope,customerId:customer._id,actorId:owner._id,day:spaDay(),kind:'PAYMENT',direction:'IN',method:'CASH',amount:1000000});
  const payment=await Payment.create({...scope,invoiceId:bill._id,receiptId:receipt._id,amount:1000000});
  const earned={...scope,staffId:staff._id,staffName:staff.name,serviceId:service._id,serviceName:service.name,customerId:customer._id,invoiceId:bill._id,amount:50000,earnedAt:new Date(),sourceId:sale?payment._id:bill._id};
  await model.create({...earned,...(model===InvoiceLineCommission?{lineId:new mongoose.Types.ObjectId(),sourceType:'INVOICE_LINE'}:model===Commission?{sourceType:'INVOICE'}:{sourceType:'PAYMENT'}),...(model===SharedSaleCommission?{amount:25000,shareCount:2}:{})});
  if(model===SharedSaleCommission)await model.create({...earned,staffId:other._id,staffName:other.name,amount:25000,shareCount:2,sourceType:'PAYMENT'});
  const originalRows=JSON.stringify(await model.find({...scope,invoiceId:bill._id}).lean());
  const sources=snapshot([payment.toObject(),receipt.toObject()]);
  const protectedBefore=snapshot({description:bill.description,serviceItems:bill.serviceItems,packageItems:bill.packageItems,treatmentSessions:bill.treatmentSessions,performedBy:bill.performedBy,saleParticipants:bill.saleParticipants,sellerId:bill.sellerId});
  const input={id:String(bill._id),expectedUpdatedAt:bill.updatedAt.toISOString(),mode:'CORRECT',total:600000,issuedOn:spaDay(new Date(Date.now()-86400000)),reason:'Owner corrected price and date'};
  for(const tampering of [{description:'Tampered content'},{serviceItems:[]},{packageItems:[]},{treatmentSessions:[]},{performerId:String(other._id)},{quantity:99}]){
   await assert.rejects(call('previewInvoiceAdjustment',{...input,...tampering}));
  }
  assert.equal(await InvoiceAdjustment.countDocuments({...scope,invoiceId:bill._id}),0);
  const preview=await call('previewInvoiceAdjustment',input);
  assert.equal(preview.after.description,bill.description);
  assert.deepEqual(snapshot({description:preview.after.description,serviceItems:preview.after.serviceItems,packageItems:preview.after.packageItems,treatmentSessions:preview.after.treatmentSessions,performedBy:preview.after.performedBy,saleParticipants:preview.after.saleParticipants,sellerId:preview.after.sellerId}),protectedBefore);
  assert.equal(preview.after.adjustmentCredit,400000);
  const payload={...input,confirmed:true,expectedPreview:preview.previewToken};
  await assert.rejects(operate({...who,id:String(staff._id),role:'STAFF',cashier:true},'applyInvoiceAdjustment',payload,randomUUID()),(e:any)=>e.status===403);
  const key=randomUUID();
  if(first){
   const original=Audit.create,failedKey=randomUUID(),before=JSON.stringify((await Invoice.findById(bill._id))!.toObject());
   const injected=t.mock.method(Audit,'create',(async(...args:any[])=>{if(args[0]?.[0]?.action==='correctInvoice')throw Error('INVOICE_ADJUSTMENT_AUDIT_FAILURE');return (original as any).apply(Audit,args);}) as any);
   try{await assert.rejects(call('applyInvoiceAdjustment',payload,failedKey),/INVOICE_ADJUSTMENT_AUDIT_FAILURE/);}finally{injected.mock.restore();}
   assert.equal(JSON.stringify((await Invoice.findById(bill._id))!.toObject()),before);assert.equal(await InvoiceAdjustment.countDocuments({...scope,invoiceId:bill._id}),0);assert.equal(await Idempotency.countDocuments({...scope,key:failedKey}),0);first=false;
  }
  const result=await call('applyInvoiceAdjustment',payload,key);assert.deepEqual(await call('applyInvoiceAdjustment',payload,key),result);
  assert.equal(JSON.stringify(await model.find({...scope,invoiceId:bill._id,sourceType:{$ne:'INVOICE_ADJUSTMENT'}}).lean()),originalRows);
  assert.deepEqual(snapshot([(await Payment.findById(payment._id))!.toObject(),(await CashEntry.findById(receipt._id))!.toObject()]),sources);
  const updated=(await Invoice.findById(bill._id))!;
  assert.deepEqual(snapshot({description:updated.description,serviceItems:updated.serviceItems,packageItems:updated.packageItems,treatmentSessions:updated.treatmentSessions,performedBy:updated.performedBy,saleParticipants:updated.saleParticipants,sellerId:updated.sellerId}),protectedBefore);
  assert.equal(spaDay(updated.createdAt),input.issuedOn);
  const datedDocument=await InvoiceAdjustment.findById(result.adjustmentId);assert.equal(spaDay(new Date(datedDocument!.before.createdAt)),spaDay(bill.createdAt));assert.equal(spaDay(new Date(datedDocument!.after.createdAt)),input.issuedOn);
  const plan=await Treatment.create({...scope,invoiceId:bill._id,customerId:customer._id,serviceId:service._id,name:'Retained used package',totalSessions:10,remaining:7,status:'ACTIVE'});
  const use=await TreatmentUse.create({...scope,treatmentId:plan._id,actorId:staff._id,staffId:staff._id,performedAt:new Date(),sessionNumber:3,snapshot:'Original historical visit'});
  const useSnapshot=snapshot(use.toObject());
  const voidInput={id:String(bill._id),expectedUpdatedAt:updated.updatedAt.toISOString(),mode:'VOID',total:0,reason:'Void wrong document',entitlementHandling:'KEEP',giftHandling:'KEEP',stockHandling:'KEEP_OUT'};
  const voidPreview=await call('previewInvoiceAdjustment',voidInput),voidPayload={...voidInput,confirmed:true,expectedPreview:voidPreview.previewToken};
  const race=await Promise.allSettled([call('applyInvoiceAdjustment',voidPayload),call('applyInvoiceAdjustment',voidPayload)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await Invoice.findById(bill._id))!.adjustmentCredit,1000000);
  assert.equal((await Payment.findById(payment._id))!.reversed,false);assert.equal(await CashEntry.countDocuments({...scope,kind:'REVERSAL',originalId:receipt._id}),0);
  assert.deepEqual(snapshot((await TreatmentUse.findById(use._id))!.toObject()),useSnapshot);
  assert.equal((await Treatment.findById(plan._id))!.remaining,7);
  await call('use',{treatmentId:String(plan._id),staffId:String(staff._id),remainingBefore:7});
  assert.equal((await Treatment.findById(plan._id))!.remaining,6);
  const voided=(await Invoice.findById(bill._id))!;
  const refund={id:String(bill._id),expectedUpdatedAt:voided.updatedAt.toISOString(),amount:200000,method:'CASH',reason:'Actually paid customer',receivedConfirmation:true};
  const refundKey=randomUUID();await call('refundInvoiceAdjustment',refund,refundKey);await call('refundInvoiceAdjustment',refund,refundKey);
  assert.equal((await Invoice.findById(bill._id))!.adjustmentCredit,800000);
  assert.equal(await InvoiceAdjustment.countDocuments({...scope,invoiceId:bill._id,mode:'REFUND'}),1);
 }
 assert.deepEqual(snapshot([(await Payroll.findById(payroll._id))!.toObject(),(await Payroll.findById(otherPayroll._id))!.toObject()]),payrollSnapshot);
 assert.ok((await InvoiceLineCommission.find({...scope,sourceType:'INVOICE_ADJUSTMENT'})).every(row=>row.amount<0&&spaDay(row.earnedAt).slice(0,7)>currentMonth));
 await t.test('gift price stays zero and paid child sources cannot be erased by parent void',async()=>{
  const template=await call('packageTemplate',{name:'Gift safety '+randomUUID(),serviceId:String(service._id),totalSessions:5,price:200000});
  const sold=await call('sellPackage',{customerId:String(customer._id),templateId:template.id,dueDate:spaDay(),promotion:'Gift safety',gifts:[{serviceId:String(service._id)}]});
  let parent=(await Invoice.findById(sold.invoiceId))!;
  await call('payment',{invoiceId:String(parent._id),amount:parent.total,method:'CASH',receivedConfirmation:true});
  const gift=(await Invoice.findOne({...scope,giftOfInvoiceId:parent._id}))!;
  const giftEdit={id:String(gift._id),expectedUpdatedAt:gift.updatedAt.toISOString(),mode:'CORRECT',total:50000,reason:'Attempt to reprice gift'};
  await assert.rejects(call('previewInvoiceAdjustment',giftEdit),(error:any)=>error.status===409);
  const giftPaymentsBefore=await Payment.countDocuments({...scope,invoiceId:gift._id});
  const receiptsBefore=await CashEntry.countDocuments(scope);
  await assert.rejects(call('payment',{invoiceId:String(gift._id),amount:1,method:'CASH',receivedConfirmation:true}),(error:any)=>error.status===400);
  assert.equal(await Payment.countDocuments({...scope,invoiceId:gift._id}),giftPaymentsBefore);
  assert.equal(await CashEntry.countDocuments(scope),receiptsBefore);

  // Represent data created by the previously allowed gift-repricing path.
  await Invoice.updateOne({...scope,_id:gift._id},{$set:{total:50000,paid:0,status:'OPEN'}});
  await call('payment',{invoiceId:String(gift._id),amount:50000,method:'CASH',receivedConfirmation:true});
  parent=(await Invoice.findById(parent._id))!;
  const before=JSON.stringify(parent.toObject());
  const voidInput={id:String(parent._id),expectedUpdatedAt:parent.updatedAt.toISOString(),mode:'VOID',total:0,reason:'Void parent after collected gift payment',entitlementHandling:'KEEP',giftHandling:'REVOKE_UNUSED'};
  await assert.rejects(call('previewInvoiceAdjustment',voidInput),(error:any)=>error.status===409);
  assert.equal(JSON.stringify((await Invoice.findById(parent._id))!.toObject()),before);
  const stillPaid=(await Invoice.findById(gift._id))!;
  assert.equal(stillPaid.total,50000);assert.equal(stillPaid.paid,50000);assert.equal(stillPaid.status,'PAID');
  assert.equal(await Payment.countDocuments({...scope,invoiceId:gift._id,reversed:false}),1);

  const keepInput={...voidInput,giftHandling:'KEEP'};
  const preview=await call('previewInvoiceAdjustment',keepInput);
  await call('applyInvoiceAdjustment',{...keepInput,confirmed:true,expectedPreview:preview.previewToken});
  const kept=(await Invoice.findById(gift._id))!;
  assert.equal(kept.total,50000);assert.equal(kept.paid,50000);assert.equal(kept.status,'PAID');
  assert.equal((await Invoice.findById(parent._id))!.status,'CANCELLED');

  const retainedPlan=(await Treatment.findOne({...scope,invoiceId:parent._id,giftOfInvoiceId:{$exists:false}}))!;
  assert.equal(retainedPlan.retainedAfterVoid,true);
  const tomorrow=spaDay(new Date(Date.now()+86_400_000));
  const booked=await call('appointment',{customerId:String(customer._id),serviceId:String(service._id),staffId:String(staff._id),startAt:new Date(`${tomorrow}T10:00:00+07:00`).toISOString(),treatmentId:String(retainedPlan._id)});
  assert.ok(booked.id);
  await cashierCall('invoice',{customerId:String(customer._id),serviceId:String(service._id),treatments:[{treatmentId:String(retainedPlan._id),remainingBefore:5,performerId:String(staff._id)}]});
  assert.equal((await Treatment.findById(retainedPlan._id))!.remaining,4);

  const exhausted=await Treatment.create({...scope,customerId:customer._id,invoiceId:parent._id,serviceId:service._id,name:'Historical uses exceed stale balance',totalSessions:2,remaining:2,status:'ACTIVE',retainedAfterVoid:true});
  for(let sessionNumber=1;sessionNumber<=2;sessionNumber++)await TreatmentUse.create({...scope,treatmentId:exhausted._id,actorId:staff._id,staffId:staff._id,performedAt:new Date(),sessionNumber,snapshot:`Existing use ${sessionNumber}`,digest:`existing-${sessionNumber}`});
  const exhaustedCount=await TreatmentUse.countDocuments({...scope,treatmentId:exhausted._id});
  await assert.rejects(call('appointment',{customerId:String(customer._id),serviceId:String(service._id),staffId:String(staff._id),startAt:new Date(`${tomorrow}T11:00:00+07:00`).toISOString(),treatmentId:String(exhausted._id)}),(error:any)=>error.status===409);
  await assert.rejects(cashierCall('invoice',{customerId:String(customer._id),serviceId:String(service._id),treatments:[{treatmentId:String(exhausted._id),remainingBefore:2,performerId:String(staff._id)}]}),(error:any)=>error.status===409);
  assert.equal(await TreatmentUse.countDocuments({...scope,treatmentId:exhausted._id}),exhaustedCount);
 });
 await t.test('invoice-date-only corrections preserve actual receipt days, adjustment history and reversal access',async()=>{
  // Raw MongoDB finds have no ordering contract. Compare complete records by ID,
  // independently of create() input order and the detail API's createdAt/_id sort.
  const ledgerSnapshot=(rows:unknown[])=>snapshot(rows).sort((a:{_id:string},b:{_id:string})=>a._id.localeCompare(b._id));
  const bill=await Invoice.create({...scope,customerId:customer._id,serviceId:service._id,kind:'SERVICE',description:'Date-only receipt test',total:500000,paid:500000,status:'PAID'});
  const today=spaDay(),priorDay=spaDay(new Date(Date.now()-86400000)),earlierDay=spaDay(new Date(Date.now()-2*86400000));
  const receipts=await CashEntry.create([
   {...scope,customerId:customer._id,actorId:owner._id,day:today,kind:'PAYMENT',direction:'IN',method:'CASH',amount:200000},
   {...scope,customerId:customer._id,actorId:owner._id,day:priorDay,kind:'PAYMENT',direction:'IN',method:'BANK_TRANSFER',amount:300000},
  ]);
  const payments=await Payment.create([
   {...scope,invoiceId:bill._id,receiptId:receipts[0]._id,amount:200000},
   {...scope,invoiceId:bill._id,receiptId:receipts[1]._id,amount:300000},
  ]);
  const cashSnapshot=ledgerSnapshot(await CashEntry.find({...scope,_id:{$in:receipts.map((receipt:{_id:mongoose.Types.ObjectId})=>receipt._id)}}).lean());
  const paymentSnapshot=ledgerSnapshot(payments.map((payment:{toObject:()=>unknown})=>payment.toObject()));
  const updateDate=async(issuedOn:string)=>{
   const current=(await Invoice.findById(bill._id))!;
   const input={id:String(bill._id),expectedUpdatedAt:current.updatedAt.toISOString(),mode:'CORRECT',total:current.total,issuedOn,reason:'Date-only correction'};
   const preview=await call('previewInvoiceAdjustment',input);
   assert.equal(preview.delta,0);
   const result=await call('applyInvoiceAdjustment',{...input,confirmed:true,expectedPreview:preview.previewToken});
   return result;
  };
  await updateDate(priorDay);
  assert.equal((await Invoice.findById(bill._id))!.financialRevision,undefined);
  await updateDate(earlierDay);
  assert.equal((await Invoice.findById(bill._id))!.financialRevision,undefined);
  assert.deepEqual(ledgerSnapshot(await CashEntry.find({...scope,_id:{$in:receipts.map((receipt:{_id:mongoose.Types.ObjectId})=>receipt._id)}}).lean()),cashSnapshot);
  assert.deepEqual(ledgerSnapshot(await Payment.find({...scope,invoiceId:bill._id}).lean()),paymentSnapshot);
  assert.equal(await InvoiceAdjustment.countDocuments({...scope,invoiceId:bill._id}),2);
  await call('reverseCash',{id:String(receipts[0]._id),reason:'Verify reversal remains available'});
  const reversed=(await CashEntry.findOne({...scope,kind:'REVERSAL',originalId:receipts[0]._id}).lean());
  assert.ok(reversed);
  const afterReversal=ledgerSnapshot(await CashEntry.find({...scope,_id:{$in:[receipts[0]._id,receipts[1]._id,reversed._id]}}).lean());
  const paymentsAfterReversal=ledgerSnapshot(await Payment.find({...scope,invoiceId:bill._id}).lean());
  assert.equal(paymentsAfterReversal.find((payment:{receiptId:string})=>payment.receiptId===String(receipts[0]._id)).reversed,true);
  assert.equal(paymentsAfterReversal.find((payment:{receiptId:string})=>payment.receiptId===String(receipts[1]._id)).reversed,false);
  await updateDate(spaDay(new Date(Date.now()-3*86400000)));
  assert.deepEqual(ledgerSnapshot(await CashEntry.find({...scope,_id:{$in:[receipts[0]._id,receipts[1]._id,reversed._id]}}).lean()),afterReversal);
  assert.deepEqual(ledgerSnapshot(await Payment.find({...scope,invoiceId:bill._id}).lean()),paymentsAfterReversal);
  assert.equal(await InvoiceAdjustment.countDocuments({...scope,invoiceId:bill._id}),3);
 });
 await t.test('mixed checkout package invoice is classified by lines and blocks total changes',async()=>{
  const template=await call('packageTemplate',{name:'Mixed sale '+randomUUID(),serviceId:String(service._id),totalSessions:3,price:250000});
  const checkout=await call('checkout',{customerId:String(customer._id),actions:[
   {action:'serviceInvoice',data:{items:[{serviceId:String(service._id),performerId:String(staff._id)}]}},
   {action:'sellPackage',data:{templateId:template.id,dueDate:spaDay(),sellerId:String(staff._id)}},
  ]});
  const mixed=(await Invoice.findById(checkout.invoiceId))!;
  assert.equal(mixed.kind,'PACKAGE');assert.equal(mixed.serviceItems.length,1);assert.equal(mixed.packageItems.length,1);
  await call('payment',{invoiceId:String(mixed._id),amount:mixed.total,method:'CASH',receivedConfirmation:true});
  const fresh=(await Invoice.findById(mixed._id))!;
  assert.ok(await SaleCommission.exists({...scope,invoiceId:fresh._id,cancelledAt:{$exists:false}}));
  const priceChange={id:String(fresh._id),expectedUpdatedAt:fresh.updatedAt.toISOString(),mode:'CORRECT',total:fresh.total-1,reason:'Mixed total change'};
  await assert.rejects(call('previewInvoiceAdjustment',priceChange),(error:any)=>error.status===409);
  const unchanged=await call('previewInvoiceAdjustment',{...priceChange,total:fresh.total});
  assert.equal(unchanged.delta,0);assert.equal(unchanged.after.description,fresh.description);
 });
 await t.test('amount correction uses existing receipts, never books the delta as money today',async()=>{
  for(const recorded of [300000,30000]){
   const isolated=await Spa.create({name:'Amount correction synthetic test'});extraSpaIds.push(isolated._id);
   const s={spaId:isolated._id},today=spaDay(),yesterday=spaDay(new Date(Date.now()-86400000));
   const person=await User.create({...s,name:'Amount owner',role:'OWNER',active:true,passwordHash:hashPassword(randomUUID())});
   const actor:Actor={id:String(person._id),spaId:String(isolated._id),name:person.name,role:'OWNER',cashier:false};
   const action=(op:string,data:unknown,key=randomUUID())=>operate(actor,op,data,key);
   await Control.create(s);await Day.create({...s,day:today,status:'OPEN',opening:0});
   const closed=await Day.create({...s,day:yesterday,status:'CLOSED',opening:0,expected:recorded,bankNet:0,counted:recorded,difference:0});
   const client=await Customer.create({...s,name:'Synthetic customer',phone:'0900000083'});
   const svc=await Service.create({...s,name:'Synthetic service',price:30000,commission:0});
   // Historical evidence fixture; ordinary payment rejects 300k on a 30k bill.
   const bill=await Invoice.create({...s,customerId:client._id,serviceId:svc._id,kind:'SERVICE',description:'Wrong amount',total:30000,paid:recorded,status:'PAID',createdAt:new Date(yesterday+'T12:00:00+07:00')});
   const receipt=await CashEntry.create({...s,customerId:client._id,actorId:person._id,day:yesterday,kind:'PAYMENT',direction:'IN',method:'CASH',amount:recorded});
   const payment=await Payment.create({...s,invoiceId:bill._id,receiptId:receipt._id,amount:recorded});
   const history=snapshot([receipt,payment]),book=snapshot(closed);
   const input={id:String(bill._id),expectedUpdatedAt:bill.updatedAt.toISOString(),mode:'CORRECT',total:300000,reason:'Correct price only'};
   const preview=await action('previewInvoiceAdjustment',input),key=randomUUID();
   assert.deepEqual(preview.reconciliation.cashImpact,{incoming:0,outgoing:0,directReceived:recorded});
   const payload={...input,confirmed:true,expectedPreview:preview.previewToken};
   await action('applyInvoiceAdjustment',payload,key);await action('applyInvoiceAdjustment',payload,key);
   assert.equal(await InvoiceAdjustment.countDocuments({...s,invoiceId:bill._id}),1);
   assert.equal((await Invoice.findById(bill._id))!.paid,recorded);
   assert.deepEqual(snapshot([await CashEntry.findById(receipt._id),await Payment.findById(payment._id)]),history);
   const q=(section:string,day=today)=>workspaceQuery(new URLSearchParams({section,from:day,to:day}));
   async function check(todayIn:number,debt:number){
    assert.equal((await readReport(actor,q('reports',yesterday))).inflow,recorded);
    assert.equal((await readReport(actor,q('reports'))).inflow,todayIn);
    const overview=await readWorkspace(actor,q('overview'));assert.equal(overview.totals.inflow,todayIn);assert.equal(overview.totals.debt,debt);
    assert.deepEqual((await readWorkspace(actor,q('cash'))).pages.cash.summary,{incoming:todayIn,outgoing:0});
    assert.deepEqual(snapshot(await Day.findById(closed._id)),book);
   }
   await check(0,300000-recorded);
   await assert.rejects(action('reverseCash',{id:String(receipt._id),reason:'Do not double reverse reconciled money'}),(e:any)=>e.status===409);
   if(recorded===30000){
    const key=randomUUID(),data={invoiceId:String(bill._id),amount:270000,method:'CASH',receivedConfirmation:true};
    await action('payment',data,key);await action('payment',data,key);await check(270000,0);
   }
   await action('closeDay',{day:today,counted:300000-recorded,expectedPreview:300000-recorded});
   assert.equal((await Day.findOne({...s,day:today}))!.expected,300000-recorded);
   assert.deepEqual(snapshot(await Day.findById(closed._id)),book);
   assert.equal(await CashEntry.countDocuments(s),recorded===300000?1:2);
  }
 });

}

async function receiptCorrectionIntegration(extraSpaIds:mongoose.Types.ObjectId[],t:TestContext){
 await t.test('correct mistaken receipt amounts and dates atomically without collecting money today',async()=>{
  const spa=await Spa.create({name:'Receipt correction synthetic test'});extraSpaIds.push(spa._id);
  const scope={spaId:spa._id},today=spaDay(),yesterday=spaDay(new Date(Date.now()-86400000));
  const owner=await User.create({...scope,name:'Receipt correction owner',role:'OWNER',active:true,passwordHash:hashPassword(randomUUID())});
  const actor:Actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER',cashier:false};
  const action=(op:string,data:unknown,key=randomUUID())=>operate(actor,op,data,key);
  await Control.create(scope);await Day.create({...scope,day:today,status:'OPEN',opening:0});
  const oldBook=await Day.create({...scope,day:yesterday,status:'OPEN',opening:0});
  const customer=await Customer.create({...scope,name:'Synthetic customer',phone:'0900000084'});
  const service=await Service.create({...scope,name:'Synthetic service',price:300000,commission:0});
  const bill=await Invoice.create({...scope,customerId:customer._id,serviceId:service._id,kind:'SERVICE',description:'Existing wrong receipt',total:300000,paid:30000,status:'PARTIALLY_PAID'});
  const receipt=await CashEntry.create({...scope,customerId:customer._id,actorId:owner._id,day:yesterday,kind:'PAYMENT',direction:'IN',method:'CASH',amount:30000});
  const payment=await Payment.create({...scope,invoiceId:bill._id,receiptId:receipt._id,amount:30000});
  const input=async(amount:number,day=yesterday)=>({id:String(bill._id),expectedUpdatedAt:(await Invoice.findById(bill._id))!.updatedAt.toISOString(),mode:'CORRECT',total:300000,paid:amount,reason:'Verified actual receipt',receiptCorrections:[{paymentId:String(payment._id),amount,day}]});
  async function check(amount:number){
   const q=(section:string,day=today)=>workspaceQuery(new URLSearchParams({section,from:day,to:day}));
   assert.equal((await readReport(actor,q('reports',yesterday))).inflow,amount);
   assert.equal((await readReport(actor,q('reports'))).inflow,0);
   const overview=await readWorkspace(actor,q('overview'));assert.equal(overview.totals.inflow,0);assert.equal(overview.totals.debt,300000-amount);
   assert.deepEqual((await readWorkspace(actor,q('cash',yesterday))).pages.cash.summary,{incoming:amount,outgoing:0});
   assert.equal(await CashEntry.countDocuments(scope),1);assert.equal(await Payment.countDocuments(scope),1);
  }
  let data=await input(300000),preview=await action('previewInvoiceAdjustment',data);
  const before=snapshot([await Invoice.findById(bill._id),await Payment.findById(payment._id),await CashEntry.findById(receipt._id),await Day.findById(oldBook._id)]);
  const original=Audit.create;
  const injected=t.mock.method(Audit,'create',(async(...args:any[])=>{if(args[0]?.[0]?.action==='correctInvoice')throw Error('RECEIPT_AUDIT_FAILURE');return (original as any).apply(Audit,args);}) as any);
  try{await assert.rejects(action('applyInvoiceAdjustment',{...data,confirmed:true,expectedPreview:preview.previewToken}),/RECEIPT_AUDIT_FAILURE/);}finally{injected.mock.restore();}
  assert.deepEqual(snapshot([await Invoice.findById(bill._id),await Payment.findById(payment._id),await CashEntry.findById(receipt._id),await Day.findById(oldBook._id)]),before);
  for(const amount of [300000,100000,200000]){
   data=await input(amount);preview=await action('previewInvoiceAdjustment',data);
   const key=randomUUID(),payload={...data,confirmed:true,expectedPreview:preview.previewToken};
   await action('applyInvoiceAdjustment',payload,key);await action('applyInvoiceAdjustment',payload,key);await check(amount);
   assert.equal((await Invoice.findById(bill._id))!.status,amount===300000?'PAID':'PARTIALLY_PAID');
  }
  const history=await InvoiceAdjustment.find({...scope,invoiceId:bill._id}).sort({createdAt:1,_id:1});
  assert.equal(history.length,3);assert.equal(history[0].reconciliation.receiptChanges[0].before.amount,30000);assert.equal(history[0].reconciliation.receiptChanges[0].after.amount,300000);
  assert.equal(String(history[0].actorId),actor.id);assert.equal(history[0].reconciliation.receiptChanges[0].receiptId,String(receipt._id));
  await assert.rejects(action('previewInvoiceAdjustment',await input(300001)),(e:any)=>e.status===409);
  await assert.rejects(action('reverseCash',{id:String(receipt._id),reason:'Do not reverse revised financial history'}),(e:any)=>e.status===409);
  data=await input(300000);preview=await action('previewInvoiceAdjustment',data);
  await action('closeDay',{day:yesterday,counted:200000,expectedPreview:200000});
  const closed=snapshot(await Day.findById(oldBook._id));
  await assert.rejects(action('applyInvoiceAdjustment',{...data,confirmed:true,expectedPreview:preview.previewToken}),(e:any)=>e.status===409);
  assert.deepEqual(snapshot(await Day.findById(oldBook._id)),closed);await check(200000);
 });
}
