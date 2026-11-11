import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {Spa,Control,User,Customer,Service,Invoice,DiscountProgram,Audit,Payment,CashEntry,InvoiceLineCommission,PackageTemplate,Treatment,Idempotency,Appointment} from '../src/lib/models';
import {operate} from '../src/lib/operations';
import {readInvoice} from '../src/lib/invoice-read';
import {invoiceExport} from '../src/lib/export-read';
import {readReport} from '../src/lib/report-read';
import {workspaceQuery} from '../src/lib/workspace-query';
import {spaDay} from '../src/lib/rules';
export async function discountProgramIntegration(extraSpaIds:mongoose.Types.ObjectId[]){
 const spa=await Spa.create({name:'Synthetic program integration'});extraSpaIds.push(spa._id);const scope={spaId:spa._id};
 const owner=await User.create({...scope,name:'Program owner',role:'OWNER',active:true,passwordHash:'synthetic unused'});
 const staff=await User.create({...scope,name:'Program cashier',role:'STAFF',cashier:true,active:true,passwordHash:'synthetic unused'});
 await Control.create(scope);
 const actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER' as const,cashier:true};
 const cashier={...actor,id:String(staff._id),role:'STAFF' as const};
 const call=(action:string,data:any,key=randomUUID())=>operate(actor,action,data,key);
 const today=spaDay(),yesterday=spaDay(new Date(Date.now()-86400000)),tomorrow=spaDay(new Date(Date.now()+86400000));
 await call('openDay',{day:today,opening:0});
 const customer=await Customer.create({...scope,name:'Program customer',phone:'0900000000'});
 const service=await Service.create({...scope,name:'Program service',price:1001,commission:137,active:true});
 const customerId=String(customer._id),serviceId=String(service._id),performerId=String(staff._id);
 const input={name:'Synthetic date promotion',startsOn:today,endsOn:tomorrow,percent:50,enabled:true};

 // Seed retired configuration directly in the isolated test spa, never via removed actions.
 const program=await DiscountProgram.create({...scope,code:'GG_OLD',...input});
 await DiscountProgram.create({...scope,code:'GG_OVERLAP',...input});
 const configuration=JSON.stringify(await DiscountProgram.find(scope).sort({_id:1}).lean());
 const historical=await Invoice.create({...scope,customerId,serviceId,kind:'SERVICE',description:'Historical program sale',subtotal:1001,total:500,paid:200,status:'PARTIALLY_PAID',discount:{type:'PERCENT',value:50,amount:501,programId:program._id,programCode:program.code,programName:program.name}});
 const receipt=await CashEntry.create({...scope,customerId,actorId:owner._id,amount:200,method:'CASH',direction:'IN',kind:'PAYMENT',day:today});
 await Payment.create({...scope,invoiceId:historical._id,receiptId:receipt._id,amount:200});
 const snapshot=JSON.stringify(await Invoice.findById(historical._id).lean());
 const sources=JSON.stringify([await Payment.find(scope).lean(),await CashEntry.find(scope).lean()]);
 const pdf=await invoiceExport(actor,String(historical._id));
 for(const action of ['saveDiscountProgram','setDiscountProgramStatus','deleteDiscountProgram'])await assert.rejects(call(action,{id:String(program._id)}),/Thao tác không hợp lệ/);
 const fresh=await call('invoice',{customerId,serviceId});
 assert.equal((await Invoice.findById(fresh.id))!.total,1001);assert.equal((await Invoice.findById(fresh.id))!.discount,undefined);
 for(const discount of [{type:'AMOUNT',value:1},{type:'PERCENT',value:10}]){
  const bill=await call('invoice',{customerId,serviceId,discount});
  assert.equal((await Invoice.findById(bill.id))!.total,discount.type==='AMOUNT'?1000:901);
  assert.equal((await Invoice.findById(bill.id))!.discount.programId,undefined);
 }
 const grouped=await call('checkout',{customerId,actions:[{action:'serviceInvoice',data:{items:[{serviceId,performerId}]}}]});
 assert.equal((await Invoice.findById(grouped.invoiceId))!.total,1001);
 const appointment=await Appointment.create({...scope,customerId,serviceId,staffId:staff._id,startAt:new Date(Date.now()-3600000),status:'CONFIRMED'});
 const completed=await call('completeAppointment',{id:String(appointment._id)});
 assert.equal((await Invoice.findById(completed.invoiceId))!.total,1001);assert.equal((await Invoice.findById(completed.invoiceId))!.discount,undefined);
 assert.equal(JSON.stringify(await Invoice.findById(historical._id).lean()),snapshot);
 assert.equal(JSON.stringify([await Payment.find(scope).lean(),await CashEntry.find(scope).lean()]),sources);
 assert.equal(JSON.stringify(await DiscountProgram.find(scope).sort({_id:1}).lean()),configuration);
 assert.deepEqual(await invoiceExport(actor,String(historical._id)),pdf);
 assert.equal((await readInvoice(actor,String(historical._id))).invoice.discount.programName,input.name);
}
