import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {Spa,User,Control,Customer,Service,PackageTemplate,Product,Invoice,Payment,CashEntry,Audit,InvoiceLineCommission,Treatment,Idempotency,CashCard} from '../src/lib/models';
import {operate} from '../src/lib/operations';
import {readInvoice} from '../src/lib/invoice-read';
import {invoiceExport} from '../src/lib/export-read';
import {spaDay} from '../src/lib/rules';

// Called only by the guarded spacare_test integration harness.
export async function invoiceDiscountIntegration(extraSpaIds:mongoose.Types.ObjectId[]) {
  const spa=await Spa.create({name:'Synthetic invoice discount'});extraSpaIds.push(spa._id);
  const spaId=spa._id;
  const owner=await User.create({spaId,name:'Owner discount',role:'OWNER',active:true,passwordHash:'unused synthetic hash'});
  const technician=await User.create({spaId,name:'KTV discount',role:'STAFF',active:true,passwordHash:'unused synthetic hash'});
  await Control.create({spaId});
  const actor={spaId:String(spaId),id:String(owner._id),name:owner.name,role:'OWNER' as const,cashier:true};
  const call=(action:string,data:any,key=randomUUID())=>operate(actor,action,data,key);
  const customer=await Customer.create({spaId,name:'Synthetic discount customer',phone:'0900000000'});
  const service=await Service.create({spaId,name:'Synthetic discount service',price:1000,commission:100,active:true});
  const template=await PackageTemplate.create({spaId,serviceId:service._id,name:'Synthetic discount package',price:2000,totalSessions:3,packageType:'SESSIONS',active:true});
  const product=await Product.create({spaId,name:'Synthetic discount product',sku:'DISCOUNT',unit:'chai',price:500,stock:100,active:true});
  const customerId=String(customer._id),serviceId=String(service._id),performerId=String(technician._id);
  const receivedOn=spaDay();await call('openDay',{day:receivedOn,opening:0});
  const pay=(amount:number,method='CASH')=>({amount,method,receivedOn,receivedConfirmation:true});
  const key=randomUUID(),payload={customerId,items:[{serviceId,performerId},{serviceId,performerId:String(owner._id)}],discount:{type:'PERCENT',value:25},payments:[pay(500),pay(300,'BANK_TRANSFER')]};
  const result=await call('serviceInvoice',payload,key);
  assert.deepEqual(await call('serviceInvoice',payload,key),result);
  const bill=(await Invoice.findById(result.id).lean())!;
  assert.equal(bill.subtotal,2000);assert.equal(bill.discount?.amount,500);assert.equal(bill.total,1500);assert.equal(bill.paid,800);
  assert.equal(bill.total-bill.paid,700);assert.equal(bill.status,'PARTIALLY_PAID');
  assert.deepEqual(bill.serviceItems?.map((line:any)=>line.total),[1000,1000]);
  assert.equal(await InvoiceLineCommission.countDocuments({spaId,invoiceId:bill._id,amount:100}),2);
  assert.equal(await Payment.countDocuments({spaId,invoiceId:bill._id}),2);
  const detail=await readInvoice(actor,result.id);
  assert.deepEqual(detail.invoice.serviceItems?.map((line:any)=>line.performerName),[technician.name,owner.name]);
  assert.deepEqual(detail.invoice.discount,bill.discount);
  const pdf=await invoiceExport(actor,result.id);
  assert.ok(pdf.tables[1].rows[0][0].includes(technician.name));assert.ok(pdf.tables[1].rows[1][0].includes(owner.name));
  const before=await Payment.countDocuments({spaId});
  await assert.rejects(call('payment',{invoiceId:result.id,...pay(701)}),/vượt công nợ/);
  assert.equal(await Payment.countDocuments({spaId}),before);
  await call('payment',{invoiceId:result.id,...pay(700)});
  assert.equal((await Invoice.findById(result.id))!.status,'PAID');
  // Single-service, single-product, product basket, single-package and grouped packages.
  for(const [action,data,subtotal] of [
    ['invoice',{customerId,serviceId},1000],
    ['sellProduct',{customerId,productId:String(product._id),quantity:2},1000],
    ['productInvoice',{customerId,items:[{productId:String(product._id),quantity:2,unitPrice:500}]},1000],
    ['sellPackage',{customerId,templateId:String(template._id)},2000],
    ['checkout',{customerId,actions:[{action:'sellPackage',data:{templateId:String(template._id),cartId:'a'}},{action:'sellPackage',data:{templateId:String(template._id),cartId:'b'}}]},4000],
    ['checkout',{customerId,actions:[{action:'serviceInvoice',data:{items:[{serviceId,performerId}]}},{action:'sellPackage',data:{templateId:String(template._id)}}]},3000],
  ] as const){
    const response=await call(action,{...data,discount:{type:'AMOUNT',value:200},payments:[pay(100)]});
    const stored=(await Invoice.findById(response.invoiceId||response.id).lean())!;
    assert.equal(stored.subtotal,subtotal,action);assert.equal(stored.total,subtotal-200,action);assert.equal(stored.paid,100);
    assert.deepEqual(stored.discount,{type:'AMOUNT',value:200,amount:200});
    if(action==='checkout')assert.equal(response.total,subtotal-200);
  }
  const free=await call('invoice',{customerId,serviceId,discount:{type:'PERCENT',value:100}});
  assert.equal((await Invoice.findById(free.id))!.status,'PAID');assert.equal(await Payment.countDocuments({spaId,invoiceId:free.id}),0);
  const card=await CashCard.create({spaId,customerId,amount:2000,balance:2000,origin:'GIFT',actorId:owner._id});
  const cardBill=await call('invoice',{customerId,serviceId,discount:{type:'AMOUNT',value:200},cashCard:{cardId:String(card._id),amount:800}});
  assert.equal((await Invoice.findById(cardBill.id))!.total,800);assert.equal((await Invoice.findById(cardBill.id))!.paid,800);
  assert.equal((await CashCard.findById(card._id))!.balance,1200);
  // Every failure leaves invoices, stock, entitlements, receipts, audit and idempotency intact.
  async function snapshot(){return JSON.stringify(await Promise.all([Invoice,Product,Treatment,Payment,CashEntry,Audit,Idempotency,CashCard].map(model=>model.find({spaId}).sort({_id:1}).lean())));}
  for(const bad of [
    {customerId,serviceId,discount:{type:'AMOUNT',value:1001}},
    {customerId,serviceId,discount:{type:'PERCENT',value:101}},
    {customerId,serviceId,discount:{type:'AMOUNT',value:-1}},
    {customerId,serviceId,discount:{type:'AMOUNT',value:200},payments:[pay(801)]},
    {customerId,serviceId,discount:{type:'PERCENT',value:100},payments:[pay(1)]},
  ]){const before=await snapshot();await assert.rejects(call('invoice',bad));assert.equal(await snapshot(),before);}
  const plan=(await Treatment.findOne({spaId,invoiceId:{$ne:bill._id}}))!;
  const beforeSession=await snapshot();
  await assert.rejects(call('invoice',{customerId,serviceId,treatmentId:String(plan._id),remainingBefore:plan.remaining,staffId:performerId,discount:{type:'PERCENT',value:0}}),/không hỗ trợ giảm giá/);
  assert.equal(await snapshot(),beforeSession);
  await assert.rejects(call('payment',{invoiceId:free.id,...pay(1),discount:{type:'AMOUNT',value:0}}),/Chỉ nhập giảm giá/);
  await assert.rejects(call('invoice', {...payload,serviceId,discount:{type:'AMOUNT',value:0}},key),/Mã yêu cầu/);
}
