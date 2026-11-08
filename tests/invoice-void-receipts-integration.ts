import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type mongoose from 'mongoose';
import {Spa,Control,User,Customer,Service,Invoice,Payment,CashEntry,Day,InvoiceAdjustment,Audit} from '../src/lib/models';
import {operate} from '../src/lib/operations';
import {hashPassword} from '../src/lib/password';
import {spaDay} from '../src/lib/rules';
import {readReport} from '../src/lib/report-read';
import {readWorkspace} from '../src/lib/workspace-read';
import {readInvoice} from '../src/lib/invoice-read';
import {workspaceQuery} from '../src/lib/workspace-query';
const snapshot=(v:unknown)=>JSON.parse(JSON.stringify(v));

// Only invoked by integration.test.ts after spacare_test/server/schema verification.
export async function invoiceVoidReceiptsIntegration(extraSpaIds:mongoose.Types.ObjectId[]){
 const spa=await Spa.create({name:'Synthetic invoice cancellation receipts'});extraSpaIds.push(spa._id);const scope={spaId:spa._id};
 const owner=await User.create({...scope,name:'Void owner',role:'OWNER',active:true,passwordHash:hashPassword(randomUUID())});
 const actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER' as const,cashier:false};
 const call=(action:string,data:unknown,key=randomUUID())=>operate(actor,action,data,key);
 const today=spaDay(),yesterday=spaDay(new Date(Date.now()-86400000));await Control.create(scope);
 await call('openDay',{day:today,opening:0});await Day.create({...scope,day:yesterday,opening:0,status:'OPEN'});
 const customer=await Customer.create({...scope,name:'Void customer',phone:'0900000091'}),service=await Service.create({...scope,name:'Void service',price:300000,commission:0,active:true});
 const bill=await Invoice.create({...scope,customerId:customer._id,serviceId:service._id,kind:'SERVICE',description:'Mistaken invoice with mixed receipts',total:300000,paid:300000,status:'PAID'});
 const receipt=async(amount:number,method:string,day:string,invoiceId:unknown)=>{
  const entry=await CashEntry.create({...scope,customerId:customer._id,actorId:owner._id,amount,method,day,direction:'IN',kind:'PAYMENT'});
  const payment=await Payment.create({...scope,invoiceId,receiptId:entry._id,amount});return {entry,payment};
 };
 const wrong=await receipt(100000,'CASH',yesterday,bill._id),real=await receipt(200000,'BANK_TRANSFER',yesterday,bill._id);
 const input={id:String(bill._id),expectedUpdatedAt:bill.updatedAt.toISOString(),mode:'VOID',total:0,reason:'Only cash was entered by mistake',mistakenPaymentIds:[String(wrong.payment._id)]};
 const preview=await call('previewInvoiceAdjustment',input);assert.equal(preview.reconciliation.mistakenReceipts.total,100000);assert.equal(preview.after.adjustmentCredit,200000);
 const request={...input,confirmed:true,mistakenReceiptsConfirmed:true,expectedPreview:preview.previewToken},key=randomUUID();
 const before=snapshot([bill.toObject(),wrong.entry.toObject(),wrong.payment.toObject()]),createAudit=Audit.create;
 try{
  (Audit as any).create=async(...args:any[])=>{if(args[0]?.[0]?.action==='voidInvoice')throw Error('INJECTED_VOID_AUDIT');return (createAudit as any).apply(Audit,args);};
  await assert.rejects(call('applyInvoiceAdjustment',request,key),/INJECTED_VOID_AUDIT/);
 }finally{Audit.create=createAudit;}
 assert.deepEqual(snapshot([(await Invoice.findById(bill._id))!.toObject(),(await CashEntry.findById(wrong.entry._id))!.toObject(),(await Payment.findById(wrong.payment._id))!.toObject()]),before);
 assert.equal(await CashEntry.countDocuments({...scope,kind:'REVERSAL'}),0);assert.equal(await InvoiceAdjustment.countDocuments(scope),0);
 const result=await call('applyInvoiceAdjustment',request,key);assert.deepEqual(await call('applyInvoiceAdjustment',request,key),result);
 const saved=(await Invoice.findById(bill._id))!;assert.equal(saved.status,'CANCELLED');assert.equal(saved.total,0);assert.equal(saved.paid,0);assert.equal(saved.adjustmentCredit,200000);
 assert.equal(await CashEntry.countDocuments({...scope,originalId:wrong.entry._id}),1);assert.equal((await CashEntry.findById(wrong.entry._id))!.reversed,true);assert.equal((await Payment.findById(wrong.payment._id))!.reversed,true);
 assert.deepEqual(snapshot((await CashEntry.findById(real.entry._id))!.toObject()),snapshot(real.entry.toObject()));assert.deepEqual(snapshot((await Payment.findById(real.payment._id))!.toObject()),snapshot(real.payment.toObject()));
 const query=(section:string,day:string)=>workspaceQuery(new URLSearchParams({section,from:day,to:day}));
 assert.equal((await readReport(actor,query('reports',yesterday))).inflow,200000);assert.equal((await readReport(actor,query('reports',today))).inflow,0);
 assert.equal((await readWorkspace(actor,query('overview',yesterday))).totals.debt,0);assert.equal((await readWorkspace(actor,query('cash',yesterday))).pages.cash.summary.incoming,200000);
 const details=await readInvoice(actor,String(bill._id));assert.equal(details.payments.length,1);assert.equal(details.adjustments[0].reconciliation.createdReceiptReversals[0].receiptId,String(wrong.entry._id));
 await call('closeDay',{day:yesterday,counted:0,expectedPreview:0});const closed=(await Day.findOne({...scope,day:yesterday}))!;assert.equal(closed.bankNet,200000);const closedSnapshot=snapshot(closed.toObject());
 await assert.rejects(call('previewInvoiceAdjustment',{...input,expectedUpdatedAt:saved.updatedAt.toISOString(),mistakenPaymentIds:[String(real.payment._id)]}),(e:any)=>e.status===409);assert.deepEqual(snapshot((await Day.findById(closed._id))!.toObject()),closedSnapshot);
 // A previously cancelled invoice can finish a verified mistaken receipt without reopening the invoice.
 const late=await Invoice.create({...scope,customerId:customer._id,serviceId:service._id,kind:'SERVICE',description:'Late receipt cleanup',total:100000,paid:100000,status:'PAID'}),lateSource=await receipt(100000,'CASH',today,late._id);
 const cancel={id:String(late._id),expectedUpdatedAt:late.updatedAt.toISOString(),mode:'VOID',total:0,reason:'Cancel obligation; receipt classification pending'};
 const retained=await call('previewInvoiceAdjustment',cancel);await call('applyInvoiceAdjustment',{...cancel,confirmed:true,expectedPreview:retained.previewToken});
 assert.equal((await CashEntry.findById(lateSource.entry._id))!.reversed,false);
 const cleanup={...cancel,expectedUpdatedAt:(await Invoice.findById(late._id))!.updatedAt.toISOString(),reason:'Verified receipt was entered by mistake',mistakenPaymentIds:[String(lateSource.payment._id)]},review=await call('previewInvoiceAdjustment',cleanup);
 const cleanupKey=randomUUID(),cleanupRequest={...cleanup,confirmed:true,mistakenReceiptsConfirmed:true,expectedPreview:review.previewToken};await call('applyInvoiceAdjustment',cleanupRequest,cleanupKey);await call('applyInvoiceAdjustment',cleanupRequest,cleanupKey);
 assert.equal((await Invoice.findById(late._id))!.status,'CANCELLED');assert.equal((await Invoice.findById(late._id))!.adjustmentCredit,0);assert.equal(await CashEntry.countDocuments({...scope,originalId:lateSource.entry._id}),1);
 assert.equal((await readReport(actor,query('reports',today))).inflow,0);assert.equal(await CashEntry.countDocuments({...scope,kind:'REFUND'}),0);
}
