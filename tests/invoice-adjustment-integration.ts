import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {Spa,Control,User,Customer,Service,Invoice,Payment,CashEntry,Commission,InvoiceLineCommission,SaleCommission,SharedSaleCommission,Payroll,InvoiceAdjustment,Audit,Idempotency,Treatment,TreatmentUse,Day} from '../src/lib/models';
import {operate} from '../src/lib/operations';
import {hashPassword} from '../src/lib/password';
import {spaDay} from '../src/lib/rules';
import type {Actor} from '../src/lib/auth';
const snapshot=(value:unknown)=>JSON.parse(JSON.stringify(value));

export async function invoiceAdjustmentIntegration(extraSpaIds:mongoose.Types.ObjectId[],t:TestContext){
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
  const bill=await Invoice.create({...scope,customerId:customer._id,serviceId:service._id,kind:sale?'PACKAGE':'SERVICE',description:'Original document',total:1000000,paid:1000000,status:'PAID',...(sale?{saleCommissionVersion:model===SharedSaleCommission?2:1,saleCommissionAccrued:50000,sellerId:staff._id,sellerName:staff.name}:{}),...(model===SharedSaleCommission?{saleParticipants:[{staffId:staff._id,staffName:staff.name},{staffId:other._id,staffName:other.name}]}:{})});
  const receipt=await CashEntry.create({...scope,customerId:customer._id,actorId:owner._id,day:spaDay(),kind:'PAYMENT',direction:'IN',method:'CASH',amount:1000000});
  const payment=await Payment.create({...scope,invoiceId:bill._id,receiptId:receipt._id,amount:1000000});
  const earned={...scope,staffId:staff._id,staffName:staff.name,serviceId:service._id,serviceName:service.name,customerId:customer._id,invoiceId:bill._id,amount:50000,earnedAt:new Date(),sourceId:sale?payment._id:bill._id};
  await model.create({...earned,...(model===InvoiceLineCommission?{lineId:new mongoose.Types.ObjectId(),sourceType:'INVOICE_LINE'}:model===Commission?{sourceType:'INVOICE'}:{sourceType:'PAYMENT'}),...(model===SharedSaleCommission?{amount:25000,shareCount:2}:{})});
  if(model===SharedSaleCommission)await model.create({...earned,staffId:other._id,staffName:other.name,amount:25000,shareCount:2,sourceType:'PAYMENT'});
  const originalRows=JSON.stringify(await model.find({...scope,invoiceId:bill._id}).lean());
  const sources=snapshot([payment.toObject(),receipt.toObject()]);
  const input={id:String(bill._id),expectedUpdatedAt:bill.updatedAt.toISOString(),mode:'CORRECT',description:'Corrected content',total:600000,issuedOn:spaDay(new Date(Date.now()-86400000)),reason:'Owner corrected price and date'};
  const preview=await call('previewInvoiceAdjustment',input);
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
  assert.equal(spaDay(updated.createdAt),input.issuedOn);
  const datedDocument=await InvoiceAdjustment.findById(result.adjustmentId);assert.equal(spaDay(new Date(datedDocument!.before.createdAt)),spaDay(bill.createdAt));assert.equal(spaDay(new Date(datedDocument!.after.createdAt)),input.issuedOn);
  const plan=await Treatment.create({...scope,invoiceId:bill._id,customerId:customer._id,serviceId:service._id,name:'Retained used package',totalSessions:10,remaining:7,status:'ACTIVE'});
  const use=await TreatmentUse.create({...scope,treatmentId:plan._id,actorId:staff._id,staffId:staff._id,performedAt:new Date(),sessionNumber:3,snapshot:'Original historical visit'});
  const useSnapshot=snapshot(use.toObject());
  const voidInput={id:String(bill._id),expectedUpdatedAt:updated.updatedAt.toISOString(),mode:'VOID',description:updated.description,total:0,reason:'Void wrong document',entitlementHandling:'KEEP',giftHandling:'KEEP',stockHandling:'KEEP_OUT'};
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
  const giftEdit={id:String(gift._id),expectedUpdatedAt:gift.updatedAt.toISOString(),mode:'CORRECT',description:gift.description,total:50000,reason:'Attempt to reprice gift'};
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
  const voidInput={id:String(parent._id),expectedUpdatedAt:parent.updatedAt.toISOString(),mode:'VOID',description:parent.description,total:0,reason:'Void parent after collected gift payment',entitlementHandling:'KEEP',giftHandling:'REVOKE_UNUSED'};
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
  const priceChange={id:String(fresh._id),expectedUpdatedAt:fresh.updatedAt.toISOString(),mode:'CORRECT',description:fresh.description,total:fresh.total-1,reason:'Mixed total change'};
  await assert.rejects(call('previewInvoiceAdjustment',priceChange),(error:any)=>error.status===409);
  const contentOnly=await call('previewInvoiceAdjustment',{...priceChange,total:fresh.total,description:'Mixed description correction'});
  assert.equal(contentOnly.delta,0);
 });
}
