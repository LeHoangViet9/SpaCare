import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {operate} from '../src/lib/operations';
import {allModels, PackageTemplate, TreatmentUse, Appointment, Invoice, InvoiceAdjustment, User, Control, Customer, CashEntry, Payment, Deposit, Allocation, CashCard, CashCardUse, Treatment, Commission, InvoiceLineCommission, SaleCommission, SharedSaleCommission, Payroll, Service, Product, StockMovement, Day, Audit, Idempotency} from '../src/lib/models';
import {spaDay} from '../src/lib/rules';
import {cashFlowNet} from '../src/lib/cash-flow';
const id=()=>String(new mongoose.Types.ObjectId()),spaId=id(),owner=id(),customer=id(),service=id(),tech=id();
const actor={id:owner,spaId,name:'Owner',role:'OWNER' as const,cashier:false};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));let state:Record<string,any[]>={};let tick=Date.now(),fail='';
function match(row:any,f:any):boolean{return Object.entries(f).every(([key,value]:any)=>{
  if(key==='$or')return value.some((p:any)=>match(row,p));if(key==='$and')return value.every((p:any)=>match(row,p));
  const actual=row[key];if(value&&typeof value==='object'&&!(value instanceof mongoose.Types.ObjectId)&&!(value instanceof Date))return Object.entries(value).every(([op,v]:any)=>{
    if(op==='$exists')return (actual!==undefined)===v;if(op==='$in')return v.some((n:any)=>(Array.isArray(actual)?actual:[actual]).some((a:any)=>String(n)===String(a)));if(op==='$ne')return String(actual)!==String(v);
    if(op==='$gte')return new Date(actual)>=new Date(v);if(op==='$lt')return new Date(actual)<new Date(v);throw Error('Unhandled filter '+op);
  });return String(actual)===String(value);
});}
function doc(name:string,row:any):any{
  if(!row)return null;const result={...clone(row)};
  for(const field of ['createdAt','updatedAt','earnedAt','performedAt'])if(result[field])result[field]=new Date(result[field]);
  return Object.assign(result,{toObject(this:any){const {save,toObject,...value}=this;return clone(value);},async save(this:any,options:any){assert.ok(options.session);const model=allModels.find(m=>m.modelName===name)!;await new model(this.toObject()).validate();this.updatedAt=new Date(++tick);state[name][state[name].findIndex(r=>String(r._id)===String(this._id))]=this.toObject();}});
}
function query(value:any):any{return {select(){return this;},sort(){return this;},session(){return this;},lean:async()=>clone(value),then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};}
for(const model of allModels){
 const name=model.modelName;state[name]=[];
 (model as any).find=(f:any)=>query(state[name].filter(r=>match(r,f)).map(r=>doc(name,r)));
 (model as any).findOne=(f:any)=>query(doc(name,state[name].find(r=>match(r,f))));
 (model as any).exists=(f:any)=>query(state[name].find(r=>match(r,f))||null);
 (model as any).countDocuments=(f:any)=>query(state[name].filter(r=>match(r,f)).length);
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

const unpaid=()=>add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Mistaken invoice',total:300000,paid:0,status:'OPEN',refunded:0});
function collect(bill:any,amount=300000,day=spaDay(),method='CASH'){
 const entry=add(CashEntry,{actorId:owner,customerId:customer,amount,day,method,direction:'IN',kind:'PAYMENT',reversed:false});
 const payment=add(Payment,{invoiceId:bill._id,amount,receiptId:entry._id,reversed:false});current(bill).paid+=amount;current(bill).status=current(bill).paid===current(bill).total?'PAID':'PARTIALLY_PAID';return {entry,payment};
}
const input=(bill:any,ids?:string[])=>({id:bill._id,expectedUpdatedAt:current(bill).updatedAt,mode:'VOID',total:0,reason:'Invoice/payment entered by mistake',...(ids?{mistakenPaymentIds:ids}:{})});
const confirmed=async(bill:any,ids?:string[])=>{const req=await commit(input(bill,ids));if(ids)req.data.mistakenReceiptsConfirmed=true;return req;};
const cashFor=(bill:any)=>{const ids=state.Payment.filter(p=>p.invoiceId===bill._id).map(p=>p.receiptId);return state.CashEntry.filter(r=>ids.includes(r._id)||ids.includes(r.originalId));};
const bill=unpaid(),source=collect(bill),original=clone(source),before=clone(current(bill));
let req=await confirmed(bill,[source.payment._id]);
assert.equal(req.preview.after.total,0);assert.equal(req.preview.after.paid,0);assert.equal(req.preview.after.adjustmentCredit,0);assert.equal(req.preview.reconciliation.mistakenReceipts.total,300000);assert.equal(req.preview.reconciliation.cashImpact.directReceived,0);
assert.deepEqual(current(bill),before);assert.equal(cashFlowNet(cashFor(bill) as any,'CASH'),300000,'preview is read-only');
await assert.rejects(call('applyInvoiceAdjustment',{...req.data,mistakenReceiptsConfirmed:false},req.key),(e:any)=>e.status===409);
const response=await call('applyInvoiceAdjustment',req.data,req.key);assert.deepEqual(await call('applyInvoiceAdjustment',req.data,req.key),response);
assert.equal(current(bill).status,'CANCELLED');assert.equal(current(bill).total-current(bill).paid,0);assert.equal(current(bill).adjustmentCredit||0,0);assert.equal(current(bill).cancelledTotal,300000);
assert.equal(cashFlowNet(cashFor(bill) as any,'CASH'),0);assert.equal(cashFor(bill).length,2);assert.equal(cashFor(bill).filter(r=>r.kind==='REVERSAL').length,1);
const savedSource=state.CashEntry.find(r=>r._id===source.entry._id);assert.equal(savedSource.reversed,true);assert.equal(savedSource.amount,original.entry.amount);assert.equal(savedSource.day,original.entry.day);assert.equal(savedSource.createdAt,original.entry.createdAt);
const savedPayment=state.Payment.find(p=>p._id===source.payment._id);assert.equal(savedPayment.reversed,true);assert.equal(savedPayment.receiptId,original.entry._id);
const adjustment=state.InvoiceAdjustment.find(r=>r.invoiceId===bill._id);assert.equal(adjustment.before.paid,300000);assert.equal(adjustment.reconciliation.createdReceiptReversals[0].receiptId,source.entry._id);assert.ok(adjustment.reconciliation.createdReceiptReversals[0].reversalId);
await assert.rejects(call('applyInvoiceAdjustment',req.data),(e:any)=>e.status===409);assert.equal(cashFor(bill).length,2);
await assert.rejects(call('previewInvoiceAdjustment',input(bill,[source.payment._id])),(e:any)=>e.status===409);
// No receipt and real-money cancellation both remain available; nothing is selected by default.
const empty=unpaid();req=await confirmed(empty);await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(current(empty).status,'CANCELLED');assert.deepEqual(cashFor(empty),[]);
const real=unpaid(),realSource=collect(real),realSources=clone(realSource);req=await confirmed(real);assert.equal(req.preview.after.adjustmentCredit,300000);await call('applyInvoiceAdjustment',req.data,req.key);assert.deepEqual({entry:state.CashEntry.find(r=>r._id===realSource.entry._id),payment:state.Payment.find(r=>r._id===realSource.payment._id)},realSources);assert.equal(cashFlowNet(cashFor(real) as any,'CASH'),300000);
// Mixed real/mistaken sources: reverse only the selected receipt; real money remains visible.
const mixed=unpaid(),wrong=collect(mixed,100000),actual=collect(mixed,200000,spaDay(),'BANK_TRANSFER');req=await confirmed(mixed,[wrong.payment._id]);assert.equal(req.preview.after.adjustmentCredit,200000);await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(cashFlowNet(cashFor(mixed) as any,'CASH'),0);assert.equal(cashFlowNet(cashFor(mixed) as any,'BANK_TRANSFER'),200000);assert.equal(state.CashEntry.find(r=>r._id===actual.entry._id).reversed,false);
// Finish an earlier VOID without reapplying stock, plans or gifts. Only the remaining source is reversed.
const cancellation=clone({total:current(mixed).total,paid:current(mixed).paid,cancelledAt:current(mixed).cancelledAt,cancelledTotal:current(mixed).cancelledTotal,cancelReason:current(mixed).cancelReason});
req=await confirmed(mixed,[actual.payment._id]);await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(current(mixed).adjustmentCredit,0);assert.equal(cashFlowNet(cashFor(mixed) as any,'BANK_TRANSFER'),0);assert.deepEqual({total:current(mixed).total,paid:current(mixed).paid,cancelledAt:current(mixed).cancelledAt,cancelledTotal:current(mixed).cancelledTotal,cancelReason:current(mixed).cancelReason},cancellation);
// Legacy cancelled invoices with paid cleared use only verified linked sources, never cancelledTotal.
const legacy=unpaid(),legacyWrong=collect(legacy,100000),legacyReal=collect(legacy,200000);Object.assign(current(legacy),{total:0,paid:0,status:'CANCELLED',cancelledTotal:987654321,cancelReason:'Old cancellation',cancelledAt:new Date().toISOString()});req=await confirmed(legacy,[legacyWrong.payment._id]);assert.equal(req.preview.after.adjustmentCredit,200000);await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(current(legacy).status,'CANCELLED');assert.equal(current(legacy).adjustmentCredit,200000);assert.equal(state.CashEntry.find(r=>r._id===legacyReal.entry._id).reversed,false);
// Failure while writing reversals or at the final audit restores all sources and cancellation.
for(const failure of ['CashEntry','InvoiceAdjustment','Audit']){
 const candidate=unpaid(),one=collect(candidate,100000),two=collect(candidate,200000);req=await confirmed(candidate,[one.payment._id,two.payment._id]);const snapshot=clone(state);fail=failure;
 await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),new RegExp('INJECTED_'+failure));fail='';assert.deepEqual(state,snapshot);await call('applyInvoiceAdjustment',req.data,req.key);await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(cashFor(candidate).filter(r=>r.kind==='REVERSAL').length,2);assert.equal(cashFlowNet(cashFor(candidate) as any,'CASH'),0);
}
// Original and reversal day must remain OPEN; never silently repair a CLOSED snapshot.
const yesterday=spaDay(new Date(Date.now()-86400000)),book=add(Day,{day:yesterday,status:'OPEN',revision:1,opening:0});
const dated=unpaid(),oldReceipt=collect(dated,300000,yesterday);req=await confirmed(dated,[oldReceipt.payment._id]);state.Day.find(r=>r._id===book._id).status='CLOSED';const closed=clone(state);
await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),(e:any)=>e.status===409);assert.deepEqual(state,closed);state.Day.find(r=>r._id===book._id).status='OPEN';
req=await confirmed(dated,[oldReceipt.payment._id]);await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(cashFor(dated).find(r=>r.kind==='PAYMENT').day,yesterday);assert.equal(cashFor(dated).find(r=>r.kind==='REVERSAL').day,spaDay());assert.equal(cashFlowNet(cashFor(dated).filter(r=>r.day===yesterday) as any,'CASH'),0);assert.equal(cashFlowNet(cashFor(dated).filter(r=>r.day===spaDay()) as any,'CASH'),0);
// Scope, permissions, refunds and replaced chains cannot be bypassed with selected IDs.
const foreign=unpaid(),foreignSource=collect(foreign);await assert.rejects(call('previewInvoiceAdjustment',input(foreign,[realSource.payment._id])),(e:any)=>e.status===409);
const request=input(foreign,[foreignSource.payment._id]);await assert.rejects(operate({...actor,id:tech,role:'STAFF',cashier:true},'previewInvoiceAdjustment',request,randomUUID()),(e:any)=>e.status===403);
current(foreign).activeDocumentId=id();await assert.rejects(call('previewInvoiceAdjustment',input(foreign,[foreignSource.payment._id])),(e:any)=>e.status===409);delete current(foreign).activeDocumentId;
current(foreign).refunded=1;await assert.rejects(call('previewInvoiceAdjustment',input(foreign,[foreignSource.payment._id])),(e:any)=>e.status===409);
assert.equal(state.CashEntry.filter(r=>r.kind==='REFUND').length,0);

// Receipt reversals, stock return, rights cancellation and closed-payroll compensation share one rollback.
const stocked=unpaid(),stockWrong=collect(stocked,100000),stockPending=collect(stocked,200000,spaDay(),'BANK_TRANSFER');
const product=add(Product,{name:'Returned product',sku:'VOID-TEST',unit:'chai',stock:8,active:true,price:150000});
current(stocked).productItems=[{lineId:id(),productId:product._id,name:product.name,unit:product.unit,quantity:2,unitPrice:150000,total:300000}];
add(StockMovement,{checkoutInvoiceId:stocked._id,productId:product._id,direction:'OUT',quantity:2});
const plan=add(Treatment,{invoiceId:stocked._id,customerId:customer,serviceId:service,name:'Untouched history',totalSessions:5,remaining:5,status:'ACTIVE'});
const commission=add(Commission,{invoiceId:stocked._id,customerId:customer,serviceId:service,staffId:tech,staffName:'Technician',amount:50000,earnedAt:new Date().toISOString(),sourceType:'INVOICE',sourceId:stocked._id});
const payroll=add(Payroll,{staffId:tech,month:spaDay().slice(0,7),status:'PAID',commissionIds:[commission._id],commissionTotal:50000,total:50000}),payrollBefore=clone(payroll);
req=await commit({...input(stocked,[stockWrong.payment._id]),stockHandling:'RETURN',entitlementHandling:'CANCEL_REMAINING'});req.data.mistakenReceiptsConfirmed=true;
const allBefore=clone(state);fail='Audit';await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),/INJECTED_Audit/);fail='';assert.deepEqual(state,allBefore);
await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(state.Product.find(p=>p._id===product._id).stock,10);assert.equal(state.Treatment.find(p=>p._id===plan._id).status,'CANCELLED');assert.equal(state.Commission.find(p=>p._id===commission._id).amount,50000);assert.deepEqual(state.Payroll.find(p=>p._id===payroll._id),payrollBefore);assert.equal(state.InvoiceLineCommission.filter(p=>p.invoiceId===stocked._id).reduce((n,p)=>n+p.amount,0),-50000);
const stockHistory=clone(state.StockMovement.filter(m=>m.checkoutInvoiceId===stocked._id||m.reversalOf)),planHistory=clone(state.Treatment.find(p=>p._id===plan._id)),compensations=clone(state.InvoiceLineCommission.filter(p=>p.invoiceId===stocked._id));
req=await confirmed(stocked,[stockPending.payment._id]);await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(state.Product.find(p=>p._id===product._id).stock,10);assert.deepEqual(state.StockMovement.filter(m=>m.checkoutInvoiceId===stocked._id||m.reversalOf),stockHistory);assert.deepEqual(state.Treatment.find(p=>p._id===plan._id),planHistory);assert.deepEqual(state.InvoiceLineCommission.filter(p=>p.invoiceId===stocked._id),compensations);assert.deepEqual(state.Payroll.find(p=>p._id===payroll._id),payrollBefore);


console.log('Void receipt fixture passed.');
