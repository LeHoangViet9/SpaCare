import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {operate} from '../src/lib/operations';
import {allModels, Invoice, InvoiceAdjustment, User, Control, Customer, CashEntry, Payment, Deposit, Allocation, CashCard, CashCardUse, Treatment, Commission, InvoiceLineCommission, SaleCommission, SharedSaleCommission, Payroll, Service, Product, StockMovement, Day, Audit, Idempotency} from '../src/lib/models';
import {spaDay} from '../src/lib/rules';
import {cashFlowNet} from '../src/lib/cash-flow';
const id=()=>String(new mongoose.Types.ObjectId()),spaId=id(),owner=id(),customer=id(),service=id(),tech=id();
const actor={id:owner,spaId,name:'Owner',role:'OWNER' as const,cashier:false};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));let state:Record<string,any[]>={};let tick=Date.now(),fail='';
function match(row:any,f:any):boolean{return Object.entries(f).every(([key,value]:any)=>{
  if(key==='$or')return value.some((p:any)=>match(row,p));if(key==='$and')return value.every((p:any)=>match(row,p));
  const actual=row[key];if(value&&typeof value==='object'&&!(value instanceof mongoose.Types.ObjectId)&&!(value instanceof Date))return Object.entries(value).every(([op,v]:any)=>{
    if(op==='$exists')return (actual!==undefined)===v;if(op==='$in')return v.some((n:any)=>String(n)===String(actual));if(op==='$ne')return String(actual)!==String(v);
    if(op==='$gte')return new Date(actual)>=new Date(v);if(op==='$lt')return new Date(actual)<new Date(v);throw Error('Unhandled filter '+op);
  });return String(actual)===String(value);
});}
function doc(name:string,row:any):any{
  if(!row)return null;const result={...clone(row)};
  for(const field of ['createdAt','updatedAt','earnedAt','performedAt'])if(result[field])result[field]=new Date(result[field]);
  return Object.assign(result,{toObject(this:any){const {save,toObject,...value}=this;return clone(value);},async save(this:any,options:any){assert.ok(options.session);this.updatedAt=new Date(++tick);state[name][state[name].findIndex(r=>String(r._id)===String(this._id))]=this.toObject();}});
}
function query(value:any):any{return {select(){return this;},sort(){return this;},session(){return this;},lean:async()=>clone(value),then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};}
for(const model of allModels){
 const name=model.modelName;state[name]=[];
 (model as any).find=(f:any)=>query(state[name].filter(r=>match(r,f)).map(r=>doc(name,r)));
 (model as any).findOne=(f:any)=>query(doc(name,state[name].find(r=>match(r,f))));
 (model as any).exists=(f:any)=>query(state[name].find(r=>match(r,f))||null);
 (model as any).findOneAndUpdate=(f:any,u:any)=>{const row=state[name].find(r=>match(r,f));if(row)for(const [key,value]of Object.entries(u.$inc||{}))row[key]=(row[key]||0)+Number(value);return query(doc(name,row));};
 (model as any).updateMany=async(f:any,u:any,options:any)=>{assert.ok(options.session);for(const row of state[name].filter(r=>match(r,f)))Object.assign(row,u.$set);};
 (model as any).updateOne=async(f:any,u:any,options:any)=>{assert.ok(options.session);if(name==='Invoice'&&u.$set?.createdAt)assert.ok(options.overwriteImmutable);const row=state[name].find(r=>match(r,f));assert.ok(row);Object.assign(row,clone(u.$set));};
 (model as any).create=async(rows:any[],options:any)=>{assert.ok(options.session);if(fail===name)throw Error('INJECTED_'+name);const result=[];for(const values of rows){const v=new model({...values,createdAt:new Date(++tick),updatedAt:new Date(tick)});await v.validate();const row=clone(v.toObject());state[name].push(row);result.push(doc(name,row));}return result;};
}
(mongoose as any).connect=()=>assert.fail('No database allowed in model doubles');(mongoose.connection as any).readyState=1;
process.env.MONGODB_URI='mongodb://127.0.0.1:1/spacare_test';
let queue=Promise.resolve();(mongoose.connection as any).transaction=(fn:any)=>{const result=queue.then(async()=>{const before=clone(state);try{return await fn({fixture:true});}catch(e){state=before;throw e;}});queue=result.catch(()=>{});return result;};
const add=(model:any,fields:any)=>{const row={_id:id(),spaId,createdAt:new Date(++tick).toISOString(),updatedAt:new Date(tick).toISOString(),...fields};state[model.modelName].push(row);return row;};
add(Control,{revision:0});add(User,{_id:owner,name:'Owner',role:'OWNER',active:true});add(User,{_id:tech,name:'Technician',role:'STAFF',active:true,cashier:true});
add(Customer,{_id:customer,name:'Customer'});add(Service,{_id:service,name:'Service',active:true});add(Day,{day:spaDay(),status:'OPEN'});
const current=(bill:any)=>state.Invoice.find(r=>r._id===bill._id);
const call=(action:string,data:any,key=randomUUID())=>operate(actor,action,data,key);
function sale(){const bill=add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Original',total:1000000,paid:1000000,status:'PAID',refunded:0});const entry=add(CashEntry,{customerId:customer,amount:1000000,day:spaDay(),method:'CASH',direction:'IN',kind:'PAYMENT',reversed:false});const payment=add(Payment,{invoiceId:bill._id,amount:1000000,receiptId:entry._id,reversed:false});return {bill,entry,payment};}
const payload=(bill:any,mode='CORRECT',total=600000)=>({id:bill._id,expectedUpdatedAt:current(bill).updatedAt,mode,total,reason:'Owner reason',stockHandling:'KEEP_OUT',entitlementHandling:'KEEP',giftHandling:'KEEP'});
const commit=async(data:any,key=randomUUID())=>{const preview=await call('previewInvoiceAdjustment',data);return {preview,data:{...data,confirmed:true,expectedPreview:preview.previewToken},key};};
const original=sale();
current(original.bill).serviceItems=[{lineId:id(),serviceId:service,name:'Original service',total:1000000,performerId:tech}];
current(original.bill).performedBy=tech;
const originalLines=clone(current(original.bill).serviceItems),originalPerformer=current(original.bill).performedBy;
const history=clone([original.entry,original.payment]);
const originalCommission=add(Commission,{invoiceId:original.bill._id,staffId:tech,staffName:'Technician',customerId:customer,serviceId:service,amount:50000,earnedAt:new Date().toISOString()});
const closed=add(Payroll,{staffId:tech,month:spaDay().slice(0,7),status:'PAID',commissionIds:[originalCommission._id],commissionTotal:50000,total:50000});
const payrollBefore=clone(closed);
for(const tampering of [{description:'Tampered description'},{serviceItems:[]},{packageItems:[]},{treatmentSessions:[]},{performerId:owner},{quantity:99}]){
  await assert.rejects(call('previewInvoiceAdjustment',{...payload(original.bill),...tampering}));
}
assert.equal(state.InvoiceAdjustment.length,0);
let req=await commit(payload(original.bill));
assert.equal(req.preview.after.description,'Original');
assert.deepEqual(req.preview.after.serviceItems,originalLines);
for(const action of ['previewInvoiceAdjustment','applyInvoiceAdjustment','refundInvoiceAdjustment'])await assert.rejects(operate({...actor,id:tech,role:'STAFF',cashier:true},action,action==='refundInvoiceAdjustment'?{id:original.bill._id,expectedUpdatedAt:original.bill.updatedAt,amount:1,method:'CASH',reason:'Bad',receivedConfirmation:true}:req.data,randomUUID()),(e:any)=>e.status===403);
const result=await call('applyInvoiceAdjustment',req.data,req.key);assert.deepEqual(await call('applyInvoiceAdjustment',req.data,req.key),result);
assert.equal(current(original.bill).paid,600000);assert.equal(current(original.bill).adjustmentCredit,400000);
assert.equal(current(original.bill).description,'Original');assert.deepEqual(current(original.bill).serviceItems,originalLines);assert.equal(current(original.bill).performedBy,originalPerformer);
assert.deepEqual([state.CashEntry.find(r=>r._id===original.entry._id),state.Payment.find(r=>r._id===original.payment._id)],history);
assert.equal(cashFlowNet(state.CashEntry as any,'CASH'),1000000);assert.equal(state.InvoiceAdjustment.length,1);
assert.deepEqual(state.Payroll.find(r=>r._id===closed._id),payrollBefore);
await assert.rejects(call('applyInvoiceAdjustment',req.data),(e:any)=>e.status===409);
await assert.rejects(call('deleteInvoice',{id:original.bill._id,expectedUpdatedAt:current(original.bill).updatedAt,reason:'Legacy unsafe',confirmDelete:true}),(e:any)=>e.status===409);
req=await commit(payload(original.bill,'VOID',0));
const beforeFailure=clone(state);fail='Audit';await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),/INJECTED_Audit/);fail='';assert.deepEqual(state,beforeFailure);
await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(current(original.bill).status,'CANCELLED');assert.equal(current(original.bill).adjustmentCredit,1000000);
assert.equal(state.Commission.find(r=>r._id===originalCommission._id).amount,50000);
const compensation=state.InvoiceLineCommission.find(r=>r.invoiceId===original.bill._id);assert.equal(compensation.amount,-50000);assert.ok(spaDay(new Date(compensation.earnedAt)).slice(0,7)>closed.month);assert.equal(compensation.sourceType,'INVOICE_ADJUSTMENT');
assert.deepEqual(state.Payroll.find(r=>r._id===closed._id),payrollBefore);
const refund={id:original.bill._id,expectedUpdatedAt:current(original.bill).updatedAt,amount:400000,method:'CASH',reason:'Actually returned',receivedConfirmation:true};
await assert.rejects(call('refundInvoiceAdjustment',{...refund,receivedConfirmation:false}));
const refundKey=randomUUID();await call('refundInvoiceAdjustment',refund,refundKey);await call('refundInvoiceAdjustment',refund,refundKey);
assert.equal(current(original.bill).adjustmentCredit,600000);assert.equal(cashFlowNet(state.CashEntry as any,'CASH'),600000);
assert.equal(state.CashEntry.filter(r=>r.kind==='REFUND').length,1);assert.equal(state.CashEntry.filter(r=>r.kind==='REVERSAL').length,0);
// Mixed stored value is restored without cash movement, even with multiple uses of one source.
const mixed=add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Mixed',total:500000,paid:500000,status:'PAID',refunded:0,cardPaid:200000});
const deposit=add(Deposit,{customerId:customer,amount:300000,balance:0});add(Allocation,{invoiceId:mixed._id,depositId:deposit._id,amount:150000,reversed:false});add(Allocation,{invoiceId:mixed._id,depositId:deposit._id,amount:150000,reversed:false});
const card=add(CashCard,{customerId:customer,amount:200000,balance:0,origin:'PURCHASE'});add(CashCardUse,{invoiceId:mixed._id,cardId:card._id,amount:200000});
req=await commit(payload(mixed,'VOID',0));await call('applyInvoiceAdjustment',req.data);
assert.equal(state.Deposit.find(r=>r._id===deposit._id).balance,300000);assert.equal(state.CashCard.find(r=>r._id===card._id).balance,200000);
assert.equal(current(mixed).adjustmentCredit,0);assert.equal(state.CashEntry.filter(r=>r.kind==='REFUND').length,1);
const inventory=sale(),product=add(Product,{name:'Product',sku:'SKU',unit:'chai',stock:3});add(StockMovement,{invoiceId:inventory.bill._id,productId:product._id,direction:'OUT',quantity:2});
const plan=add(Treatment,{invoiceId:inventory.bill._id,customerId:customer,serviceId:service,totalSessions:10,remaining:7,status:'ACTIVE'});
req=await commit({...payload(inventory.bill,'VOID',0),stockHandling:'RETURN',entitlementHandling:'CANCEL_REMAINING'});
const stockBefore=clone(state);fail='StockMovement';await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),/INJECTED_StockMovement/);fail='';assert.deepEqual(state,stockBefore);
await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(state.Product.find(r=>r._id===product._id).stock,5);assert.equal(state.Treatment.find(r=>r._id===plan._id).remaining,7);assert.equal(state.Treatment.find(r=>r._id===plan._id).status,'CANCELLED');
// A changed related balance invalidates a previously reviewed preview without writing anything.
const stale=sale();req=await commit(payload(stale.bill));state.Payroll.push({_id:id(),spaId,staffId:tech,month:'2000-01',status:'DRAFT'});
current(stale.bill).total=999999;await assert.rejects(call('applyInvoiceAdjustment',req.data),(e:any)=>e.status===409);
const foreign=sale();current(foreign.bill).spaId=id();await assert.rejects(call('previewInvoiceAdjustment',payload(foreign.bill)),(e:any)=>e.status===404);
assert.ok(state.Audit.some(r=>r.action==='voidInvoice'&&r.details.before.paid===600000&&r.details.after.adjustmentCredit===1000000));
// Shared-sale rounding follows cumulative equal shares, even when a reduction
// would produce a different answer if old rounded shares were used as weights.
const secondTech=id();add(User,{_id:secondTech,name:'Second seller',role:'STAFF',active:true});
const shared=sale();Object.assign(current(shared.bill),{kind:'PACKAGE',total:60,paid:60,saleCommissionVersion:2,saleCommissionAccrued:3,sellerId:tech,sellerName:'Technician',saleParticipants:[{staffId:tech,staffName:'Technician'},{staffId:secondTech,staffName:'Second seller'}]});
shared.entry.amount=60;shared.payment.amount=60;
const ordered=[tech,secondTech].sort();
for(const [index,staffId]of ordered.entries())add(SharedSaleCommission,{invoiceId:shared.bill._id,staffId,staffName:'Seller',customerId:customer,serviceId:service,amount:index===0?2:1,earnedAt:new Date().toISOString(),sourceType:'PAYMENT',sourceId:shared.payment._id});
for(const [total,expected]of [[40,[1,1]],[60,[2,1]]] as const){
 req=await commit(payload(shared.bill,'CORRECT',total));await call('applyInvoiceAdjustment',req.data);
 assert.deepEqual(ordered.map(staffId=>state.SharedSaleCommission.filter(r=>r.invoiceId===shared.bill._id&&r.staffId===staffId).reduce((n,r)=>n+r.amount,0)),[...expected]);
}
const multi=sale();
for(const staffId of [tech,secondTech])add(InvoiceLineCommission,{invoiceId:multi.bill._id,staffId,staffName:'Performer',customerId:customer,serviceId:service,amount:10000,earnedAt:new Date().toISOString(),sourceType:'INVOICE_LINE',sourceId:id(),lineId:id()});
req=await commit(payload(multi.bill,'VOID',0));await call('applyInvoiceAdjustment',req.data);
const multiRows=state.InvoiceLineCommission.filter(r=>r.invoiceId===multi.bill._id&&r.sourceType==='INVOICE_ADJUSTMENT');assert.equal(multiRows.length,2);assert.equal(new Set(multiRows.map(r=>r.sourceId)).size,2);
// Related data can change independently of the invoice timestamp.
const linked=sale(),gift=add(CashCard,{customerId:customer,sourceInvoiceId:linked.bill._id,amount:100000,balance:50000,origin:'GIFT'});
req=await commit({...payload(linked.bill,'VOID',0),giftHandling:'REVOKE_UNUSED'});
state.CashCard.find(r=>r._id===gift._id).balance=40000;
await assert.rejects(call('applyInvoiceAdjustment',req.data),(e:any)=>e.status===409);
req=await commit({...payload(linked.bill,'VOID',0),giftHandling:'REVOKE_UNUSED'});await call('applyInvoiceAdjustment',req.data);assert.equal(state.CashCard.find(r=>r._id===gift._id).balance,0);
// Issue date is changed through the same adjustment, without moving actual receipts.
const dated=sale(),issuedOn=spaDay(new Date(Date.now()-86400000));
const datedSources=clone([dated.payment,dated.entry]),datedBefore=clone(current(dated.bill));
req=await commit({...payload(dated.bill,'CORRECT',1000000),issuedOn});
const closedDay=add(Day,{day:issuedOn,status:'CLOSED',opening:500000,expected:650000,bankNet:200000,counted:650000,difference:0,revision:7});
const closedSnapshot=clone(closedDay);
await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),(e:any)=>e.status===409);
assert.deepEqual(current(dated.bill),datedBefore);
assert.deepEqual(state.Day.find(r=>r._id===closedDay._id),closedSnapshot);
state.Day.find(r=>r._id===closedDay._id).status='OPEN';
const openSnapshot=clone(state.Day.find(r=>r._id===closedDay._id));
fail='Audit';await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),/INJECTED_Audit/);fail='';assert.deepEqual(current(dated.bill),datedBefore);
await call('applyInvoiceAdjustment',req.data,req.key);await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(spaDay(new Date(current(dated.bill).createdAt)),issuedOn);
assert.deepEqual(state.Day.find(r=>r._id===closedDay._id),openSnapshot);
assert.deepEqual([state.Payment.find(r=>r._id===dated.payment._id),state.CashEntry.find(r=>r._id===dated.entry._id)],datedSources);
assert.equal(current(dated.bill).financialRevision,undefined);
const datedAdjustment=state.InvoiceAdjustment.find(r=>r.invoiceId===dated.bill._id);
assert.equal(datedAdjustment.before.createdAt,datedBefore.createdAt);assert.equal(spaDay(new Date(datedAdjustment.after.createdAt)),issuedOn);assert.equal(datedAdjustment.delta,0);
await assert.rejects(call('previewInvoiceAdjustment',{...payload(dated.bill),issuedOn:spaDay(new Date(Date.now()+86400000))}),(e:any)=>e.status===400);
const noPaymentInvoice=add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Unpaid',total:250000,paid:0,status:'OPEN',refunded:0});
const noPaymentCashBefore=clone(state.CashEntry);
req=await commit({...payload(noPaymentInvoice,'CORRECT',noPaymentInvoice.total),issuedOn});
await call('applyInvoiceAdjustment',req.data);
assert.equal(spaDay(new Date(current(noPaymentInvoice).createdAt)),issuedOn);
assert.equal(current(noPaymentInvoice).financialRevision,undefined);
assert.equal(current(noPaymentInvoice).paid,0);
assert.deepEqual(state.CashEntry,noPaymentCashBefore);
const installments=add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Installments',total:600000,paid:400000,status:'OPEN',refunded:0});
const today=spaDay(),priorDay=spaDay(new Date(Date.now()-86400000)),earlierDay=spaDay(new Date(Date.now()-2*86400000));
const cashInstallment=add(CashEntry,{customerId:customer,amount:100000,day:today,method:'CASH',direction:'IN',kind:'PAYMENT',reversed:false});
const bankInstallment=add(CashEntry,{customerId:customer,amount:300000,day:priorDay,method:'BANK_TRANSFER',direction:'IN',kind:'PAYMENT',reversed:false});
const cashPayment=add(Payment,{invoiceId:installments._id,amount:100000,receiptId:cashInstallment._id,reversed:false});
const bankPayment=add(Payment,{invoiceId:installments._id,amount:300000,receiptId:bankInstallment._id,reversed:false});
const installmentSources=clone([cashInstallment,bankInstallment,cashPayment,bankPayment]);
const installmentCash=()=>state.CashEntry.filter(entry=>[cashInstallment._id,bankInstallment._id].includes(entry._id));
const installmentTotals=()=>[today,priorDay].map(day=>installmentCash().filter(entry=>entry.day===day).reduce((total,entry)=>total+(entry.direction==='IN'&&!entry.reversed?entry.amount:0),0));
const receiptCountBefore=state.CashEntry.length,dayTotalsBefore=installmentTotals();
for(const date of [priorDay,earlierDay]){
  req=await commit({...payload(installments,'CORRECT',installments.total),expectedUpdatedAt:current(installments).updatedAt,issuedOn:date});
  await call('applyInvoiceAdjustment',req.data);
  assert.equal(current(installments).financialRevision,undefined);
  assert.deepEqual(state.CashEntry.filter(entry=>[cashInstallment._id,bankInstallment._id].includes(entry._id)),installmentSources.slice(0,2));
  assert.deepEqual([state.Payment.find(row=>row._id===cashPayment._id),state.Payment.find(row=>row._id===bankPayment._id)],installmentSources.slice(2));
  assert.deepEqual(installmentTotals(),dayTotalsBefore);
}
assert.equal(state.CashEntry.length,receiptCountBefore);
assert.equal(state.InvoiceAdjustment.filter(row=>row.invoiceId===installments._id).length,2);
const installmentAdjustments=state.InvoiceAdjustment.filter(row=>row.invoiceId===installments._id);
assert.equal(String(installmentAdjustments[1].previousAdjustmentId),String(installmentAdjustments[0]._id));
await call('reverseCash',{id:cashInstallment._id,reason:'Test reverse after invoice date edit'});
assert.equal(current(installments).paid,300000,'date-only corrections must not block reversing the original receipt');
const reversedRows=state.CashEntry.filter(entry=>[cashInstallment._id,...state.CashEntry.filter(row=>String(row.originalId)===cashInstallment._id).map(row=>row._id)].includes(entry._id));
assert.equal(cashFlowNet(reversedRows as any,'CASH'),0);
assert.deepEqual(installmentCash().map(entry=>entry.day),[today,priorDay]);
const afterReversal=clone(installmentCash());
req=await commit({...payload(installments,'CORRECT',installments.total),expectedUpdatedAt:current(installments).updatedAt,issuedOn:spaDay(new Date(Date.now()-3*86400000))});
await call('applyInvoiceAdjustment',req.data);
assert.deepEqual(installmentCash(),afterReversal,'invoice date edits must preserve both original and reversed receipt days');
const replaced=sale(),replacementDetails={activeDocumentId:id(),effectiveCode:'HD000123',documentHistory:[{documentId:id(),status:'REPLACED',code:'HD000122'}]};
Object.assign(current(replaced.bill),replacementDetails);
req=await commit({...payload(replaced.bill,'CORRECT',replaced.bill.total),issuedOn:issuedOn});
await call('applyInvoiceAdjustment',req.data);
assert.deepEqual([current(replaced.bill).activeDocumentId,current(replaced.bill).effectiveCode,current(replaced.bill).documentHistory],
  [replacementDetails.activeDocumentId,replacementDetails.effectiveCode,replacementDetails.documentHistory]);
// Gift-only packages do not require a second, unrelated purchased-package choice.
const giftOnly=sale(),giftInvoice=add(Invoice,{customerId:customer,kind:'GIFT',giftOfInvoiceId:giftOnly.bill._id,total:0,paid:0,status:'PAID'});
const giftPlan=add(Treatment,{customerId:customer,invoiceId:giftInvoice._id,serviceId:service,name:'Gift',remaining:1,totalSessions:1,status:'ACTIVE'});
const giftData={id:giftOnly.bill._id,expectedUpdatedAt:current(giftOnly.bill).updatedAt,mode:'VOID',total:0,reason:'Owner',giftHandling:'REVOKE_UNUSED'};
req=await commit(giftData);await call('applyInvoiceAdjustment',req.data);
assert.equal(state.Treatment.find(r=>r._id===giftPlan._id).status,'CANCELLED');
