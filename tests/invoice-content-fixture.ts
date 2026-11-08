import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {invoiceContentContext} from '../src/lib/invoice-content';
import {operate} from '../src/lib/operations';
import {allModels, PackageTemplate, TreatmentUse, Appointment, Invoice, InvoiceAdjustment, User, Control, Customer, CashEntry, Payment, Deposit, Allocation, CashCard, CashCardUse, Treatment, Commission, InvoiceLineCommission, SaleCommission, SharedSaleCommission, Payroll, Service, Product, StockMovement, Day, Audit, Idempotency} from '../src/lib/models';
import {spaDay} from '../src/lib/rules';
import {cashFlowNet} from '../src/lib/cash-flow';
const id=()=>String(new mongoose.Types.ObjectId()),spaId=id(),owner=id(),customer=id(),service=id(),tech=id(),tech2=id();
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
add(User,{_id:tech2,name:'Technician 2',role:'STAFF',active:true,cashier:true});
add(Customer,{_id:customer,name:'Customer'});add(Service,{_id:service,name:'Service',active:true,commission:10000});add(Day,{day:spaDay(),status:'OPEN'});
const current=(bill:any)=>state.Invoice.find(r=>r._id===bill._id);
const call=(action:string,data:any,key=randomUUID())=>operate(actor,action,data,key);
function sale(){const bill=add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Original',total:1000000,paid:1000000,status:'PAID',refunded:0});const entry=add(CashEntry,{customerId:customer,amount:1000000,day:spaDay(),method:'CASH',direction:'IN',kind:'PAYMENT',reversed:false});const payment=add(Payment,{invoiceId:bill._id,amount:1000000,receiptId:entry._id,reversed:false});return {bill,entry,payment};}
const payload=(bill:any,mode='CORRECT',total=600000)=>({id:bill._id,expectedUpdatedAt:current(bill).updatedAt,mode,total,reason:'Owner reason',stockHandling:'KEEP_OUT',entitlementHandling:'KEEP',giftHandling:'KEEP'});
const commit=async(data:any,key=randomUUID())=>{const preview=await call('previewInvoiceAdjustment',data);return {preview,data:{...data,confirmed:true,expectedPreview:preview.previewToken},key};};

const unpaid=()=>add(Invoice,{customerId:customer,description:'Original invoice',kind:'SERVICE',total:300000,paid:0,status:'OPEN',serviceItems:[{lineId:id(),serviceId:service,name:'Original service',total:300000,commission:10000,performerId:tech}]});
const context=async(bill:any)=>invoiceContentContext(spaId,doc('Invoice',current(bill)),{fixture:true} as any);
const revise=async(bill:any,content:any,total=current(bill).total)=>commit({...payload(bill,'CORRECT',total),content});
const first=unpaid(),prefill=await context(first);
assert.equal(prefill.client.customerId,customer);assert.equal(prefill.client.serviceItems[0].performerId,tech);assert.equal(prefill.client.serviceItems[0].total,300000);
// No-op keeps business data and ledgers byte-for-byte, even under a different key.
const unchanged=clone(current(first)),businessBefore=clone([state.Audit,state.InvoiceAdjustment,state.CashEntry,state.StockMovement]);
let req=await revise(first,prefill.client);assert.equal(req.preview.noChanges,true);
assert.equal((await call('applyInvoiceAdjustment',req.data,req.key)).noChanges,true);
assert.deepEqual(current(first),unchanged);assert.deepEqual([state.Audit,state.InvoiceAdjustment,state.CashEntry,state.StockMovement],businessBefore);
const otherCustomer=add(Customer,{name:'Correct customer'});
await assert.rejects(revise(first,{customerId:otherCustomer._id}),(e:any)=>e.status===409);
req=await revise(first,{description:'Corrected description',dueDate:'2026-11-09'});
assert.equal(req.preview.reconciliation.content.displayAfter.customerName,'Customer');
await call('applyInvoiceAdjustment',req.data,req.key);await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(current(first).description,'Corrected description');assert.equal(current(first).customerId,customer);
assert.equal(current(first).financialRevision,undefined);assert.equal(state.InvoiceAdjustment.filter(r=>r.invoiceId===first._id).length,1);
assert.deepEqual(state.InvoiceAdjustment[0].reconciliation.changedFields.sort(),['description','dueDate']);
const replacementService=add(Service,{name:'Replacement service',active:true,commission:20000});
const beforeCrossType=clone(state);
for(const content of [{productItems:[{key:'cross-product',productId:id(),quantity:1,unitPrice:1000}]},{packageItems:[{key:'cross-package',templateId:id(),total:1000,totalSessions:1}]},{participantIds:[tech]}])await assert.rejects(revise(first,content),(e:any)=>e.status===409);
assert.deepEqual(state,beforeCrossType);
const lineInvoice=unpaid();req=await revise(lineInvoice,{serviceItems:[{key:'new-row',serviceId:replacementService._id,total:500000,performerId:owner}]},500000);
assert.equal(req.preview.after.serviceItems[0].name,'Replacement service');assert.equal(req.preview.before.serviceItems[0].name,'Original service');
await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(current(lineInvoice).total-current(lineInvoice).paid,500000);assert.equal(state.Commission.length+state.InvoiceLineCommission.length,0);
assert.equal(state.InvoiceAdjustment.find(r=>r.invoiceId===lineInvoice._id).before.serviceItems[0].name,'Original service');
// Part-paid and fully-paid sources and dates remain untouched. Reduced total uses existing credit/refund flow.
for(const received of [100000,300000]){
 const bill=unpaid();current(bill).paid=received;current(bill).status=received===300000?'PAID':'PARTIALLY_PAID';
 const entry=add(CashEntry,{customerId:customer,amount:received,day:'2026-11-07',method:'CASH',direction:'IN',kind:'PAYMENT',reversed:false});
 const payment=add(Payment,{invoiceId:bill._id,receiptId:entry._id,amount:received,reversed:false});const sources=clone([entry,payment]);
 const fields=(await context(bill)).client.serviceItems;fields[0].total=200000;
 req=await revise(bill,{serviceItems:fields},200000);await call('applyInvoiceAdjustment',req.data,req.key);
 assert.equal(current(bill).paid,Math.min(received,200000));assert.equal(current(bill).adjustmentCredit||0,Math.max(0,received-200000));
 assert.deepEqual([state.CashEntry.find(r=>r._id===entry._id),state.Payment.find(r=>r._id===payment._id)],sources);
 await assert.rejects(call('previewInvoiceAdjustment',{...payload(bill,'CORRECT',200000),content:{customerId:otherCustomer._id}}),(e:any)=>e.status===409);
}
// Completed service rows allow only identity corrections, never removal or price changes.
const performed=unpaid();current(performed).performedAt=new Date().toISOString();const performedFields=(await context(performed)).client.serviceItems;
assert.equal((await context(performed)).locks.services[0].correctionOnly,true);
await assert.rejects(revise(performed,{serviceItems:[]}),(e:any)=>e.status===409);
await assert.rejects(revise(performed,{serviceItems:[{...performedFields[0],total:200000}]}),(e:any)=>e.status===409);
const corrected=unpaid(),correctedLine=current(corrected).serviceItems[0];
Object.assign(current(corrected),{performedAt:new Date().toISOString(),performedBy:tech,paid:300000,status:'PAID'});
const performedAtBefore=String(current(corrected).performedAt);
const serviceEarnedAt=new Date(Date.now()-40*24*60*60*1000),serviceMonth=spaDay(serviceEarnedAt).slice(0,7);
const originalLedger=add(InvoiceLineCommission,{invoiceId:corrected._id,lineId:correctedLine.lineId,staffId:tech,staffName:'Technician',serviceId:service,serviceName:'Original service',amount:10000,customerId:customer,earnedAt:serviceEarnedAt.toISOString(),sourceType:'INVOICE_LINE',sourceId:correctedLine.lineId});
const draft=add(Payroll,{staffId:tech,status:'DRAFT',month:serviceMonth,invoiceLineCommissionIds:[originalLedger._id],needsRecalculation:false,total:700000});
const draftTarget=add(Payroll,{staffId:tech2,status:'DRAFT',month:serviceMonth,invoiceLineCommissionIds:[],needsRecalculation:false,total:500000});
originalLedger.payrollId=draft._id;
const received=add(CashEntry,{customerId:customer,amount:300000,day:spaDay(),method:'CASH',direction:'IN',kind:'PAYMENT',reversed:false});
const payment=add(Payment,{invoiceId:corrected._id,amount:300000,receiptId:received._id,reversed:false});
const cashBeforeCorrection=clone([state.CashEntry,state.Payment]),correctionContext=await context(corrected);
assert.equal(correctionContext.locks.correctionOnly,true);
const performerRows=correctionContext.client.serviceItems;performerRows[0].performerId=tech2;
req=await revise(corrected,{serviceItems:performerRows},current(corrected).total);
assert.equal(req.preview.after.serviceItems[0].total,300000);
assert.deepEqual(req.preview.reconciliation.commissionChanges.map((row:any)=>[String(row.staffId),row.delta]).sort(),[[tech2,10000],[tech,-10000]].sort());
await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(String(current(corrected).performedAt),performedAtBefore);assert.equal(current(corrected).performedBy,tech2);
assert.equal(current(corrected).serviceItems[0].performerId,tech2);assert.equal(current(corrected).paid,300000);assert.equal(current(corrected).total,300000);
assert.equal(state.InvoiceLineCommission.filter(r=>r.invoiceId===corrected._id).length,3);
assert.ok(state.InvoiceLineCommission.filter(r=>r.adjustmentId).every(r=>r.originalLedgerIds.some((id:any)=>String(id)===String(originalLedger._id))));
assert.equal(state.InvoiceLineCommission.filter(r=>r.adjustmentId).reduce((sum,r)=>sum+r.amount,0),0);
assert.equal(state.Payroll.find(r=>r._id===draft._id).status,'DRAFT');assert.equal(state.Payroll.find(r=>r._id===draft._id).needsRecalculation,true);
assert.equal(state.Payroll.find(r=>r._id===draftTarget._id).needsRecalculation,true);
assert.ok(state.InvoiceLineCommission.filter(r=>r.adjustmentId).every(r=>spaDay(new Date(r.earnedAt)).slice(0,7)===serviceMonth));
assert.deepEqual([state.CashEntry,state.Payment],cashBeforeCorrection);
assert.deepEqual(state.InvoiceAdjustment.find(r=>r.invoiceId===corrected._id).before.serviceItems[0].performerId,tech);
assert.deepEqual(state.InvoiceAdjustment.find(r=>r.invoiceId===corrected._id).after.serviceItems[0].performerId,tech2);
// Correcting the service on the same line appends the commission difference to the new service.
const serviceRows=(await context(corrected)).client.serviceItems;serviceRows[0].serviceId=replacementService._id;
req=await revise(corrected,{serviceItems:serviceRows},current(corrected).total);
assert.deepEqual(req.preview.reconciliation.commissionChanges.map((row:any)=>[String(row.staffId),row.delta]),[[tech2,10000]]);
await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(current(corrected).serviceItems[0].serviceId,replacementService._id);
assert.equal(current(corrected).serviceItems[0].commission,20000);
assert.equal(state.InvoiceLineCommission.filter(r=>r.invoiceId===corrected._id).reduce((sum,r)=>sum+r.amount,0),20000);
assert.deepEqual([state.CashEntry,state.Payment],cashBeforeCorrection);
const sessionBill=add(Invoice,{customerId:customer,description:'Package session',kind:'SESSION',total:0,paid:0,status:'PAID',treatmentId:id(),performedAt:new Date().toISOString(),performedBy:tech});
const sessionPlan=add(Treatment,{_id:current(sessionBill).treatmentId,invoiceId:id(),customerId:customer,serviceId:service,name:'Package',status:'ACTIVE',remaining:4});
const sessionLineId=id(),sessionPerformedAt=new Date(Date.now()-24*60*60*1000).toISOString();
const sessionUse=add(TreatmentUse,{treatmentId:sessionPlan._id,checkoutInvoiceId:sessionBill._id,actorId:owner,staffId:tech,sessionNumber:1,performedAt:sessionPerformedAt,signature:{version:1,strokes:[[[0.1,0.2],[0.8,0.9]]]},signatureDigest:'signature-digest',snapshot:'immutable session snapshot',digest:'immutable digest'});
Object.assign(current(sessionBill),{treatmentUseId:sessionUse._id,performedAt:sessionPerformedAt,serviceItems:[{lineId:sessionLineId,serviceId:service,name:'Package',total:0,commission:10000,performerId:tech}],treatmentSessions:[{lineId:sessionLineId,treatmentId:sessionPlan._id,treatmentUseId:sessionUse._id,name:'Package',performerId:tech,total:0,paid:0}]});
const sessionLedger=add(InvoiceLineCommission,{invoiceId:sessionBill._id,lineId:sessionLineId,staffId:tech,staffName:'Technician',serviceId:service,serviceName:'Package',amount:10000,customerId:customer,earnedAt:sessionPerformedAt,sourceType:'TREATMENT_USE_LINE',sourceId:sessionUse._id});
const sessionContext=await context(sessionBill);
assert.equal(sessionContext.locks.services[0].technicianOnly,true);
assert.equal(sessionContext.locks.services[0].correctionOnly,true);
const sessionRows=sessionContext.client.serviceItems;sessionRows[0].performerId=tech2;
const sessionReceiptsBefore=clone([state.CashEntry,state.Payment]);
req=await revise(sessionBill,{serviceItems:sessionRows},0);
assert.equal(String(req.preview.reconciliation.content.displayAfter.treatmentSessions[0].performerId),tech2);
const sessionBeforeFailure=clone(state);fail='Audit';await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),/INJECTED_Audit/);fail='';
assert.deepEqual(state,sessionBeforeFailure);
await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(String(current(sessionBill).serviceItems[0].performerId),tech2);
assert.equal(String(current(sessionBill).treatmentSessions[0].performerId),tech2);
assert.equal(String(state.TreatmentUse.find(r=>r._id===sessionUse._id).staffId),tech2);
assert.equal(state.TreatmentUse.find(r=>r._id===sessionUse._id).performedAt,sessionPerformedAt);
assert.deepEqual(state.TreatmentUse.find(r=>r._id===sessionUse._id).signature,sessionUse.signature);
assert.equal(state.TreatmentUse.find(r=>r._id===sessionUse._id).signatureDigest,sessionUse.signatureDigest);
assert.equal(state.TreatmentUse.find(r=>r._id===sessionUse._id).snapshot,sessionUse.snapshot);
assert.equal(state.TreatmentUse.find(r=>r._id===sessionUse._id).digest,sessionUse.digest);
assert.equal(state.InvoiceLineCommission.find(r=>r._id===sessionLedger._id).amount,10000);
assert.deepEqual(state.InvoiceLineCommission.filter(r=>r.adjustmentId&&r.invoiceId===sessionBill._id).map(r=>[String(r.staffId),r.amount]).sort(),[[tech,-10000],[tech2,10000]].sort());
assert.deepEqual(state.InvoiceAdjustment.find(r=>r.invoiceId===sessionBill._id).before.treatmentSessions[0].performerId,tech);
assert.deepEqual(state.InvoiceAdjustment.find(r=>r.invoiceId===sessionBill._id).reconciliation.content.useChanges[0].before.staffId,tech);
assert.deepEqual(state.InvoiceAdjustment.find(r=>r.invoiceId===sessionBill._id).reconciliation.content.useChanges[0].after.staffId,tech2);
assert.deepEqual([state.CashEntry,state.Payment],sessionReceiptsBefore);
await assert.rejects(revise(sessionBill,{serviceItems:[{...sessionRows[0],serviceId:replacementService._id}]}),(e:any)=>e.status===409);
await call('savePayroll',{id:draft._id,staffId:tech,month:serviceMonth,baseSalary:0});
await call('savePayroll',{id:draftTarget._id,staffId:tech2,month:serviceMonth,baseSalary:0});
assert.equal(state.Payroll.find(r=>r._id===draft._id).serviceCommissionTotal,0);
assert.equal(state.Payroll.find(r=>r._id===draftTarget._id).serviceCommissionTotal,20000);
assert.equal(state.Payroll.find(r=>r._id===draft._id).needsRecalculation,false);
assert.equal(state.Payroll.find(r=>r._id===draftTarget._id).needsRecalculation,false);
const locked=unpaid(),lockedLine=current(locked).serviceItems[0];current(locked).performedAt=new Date().toISOString();
const ledger=add(InvoiceLineCommission,{invoiceId:locked._id,lineId:lockedLine.lineId,staffId:tech,staffName:'Tech',serviceId:service,amount:10000,customerId:customer,earnedAt:new Date().toISOString(),sourceType:'INVOICE_LINE',sourceId:lockedLine.lineId});
const payroll=add(Payroll,{staffId:tech,status:'PAID',month:spaDay().slice(0,7),invoiceLineCommissionIds:[ledger._id]});ledger.payrollId=payroll._id;
const payrollSnapshot=clone(payroll),lockedFields=(await context(locked)).client.serviceItems;
assert.equal((await context(locked)).locks.services[0].correctionOnly,false);
await assert.rejects(revise(locked,{serviceItems:[{...lockedFields[0],performerId:owner}]}),(e:any)=>e.status===409);assert.deepEqual(state.Payroll.find(r=>r._id===payroll._id),payrollSnapshot);
const allocated=unpaid();add(Payment,{invoiceId:allocated._id,lineAllocations:[{lineId:current(allocated).serviceItems[0].lineId,amount:1}],reversed:true});
await assert.rejects(revise(allocated,{serviceItems:[]}),(e:any)=>e.status===409);
// Stock corrections append compensations; audit failure rolls invoice, stock, movement and rights back.
const product=add(Product,{name:'Product',sku:'SKU',unit:'chai',stock:8,active:true,price:50000});
const stockInvoice=add(Invoice,{customerId:customer,description:'Products',kind:'PRODUCT',total:100000,paid:0,status:'OPEN',productItems:[{lineId:id(),productId:product._id,name:'Product',unit:'chai',quantity:2,unitPrice:50000,total:100000}]});
add(StockMovement,{checkoutInvoiceId:stockInvoice._id,productId:product._id,direction:'OUT',quantity:2});
await assert.rejects(revise(stockInvoice,{serviceItems:[{key:'cross-service',serviceId:service,total:1}]}),(e:any)=>e.status===409);
const stockRows=(await context(stockInvoice)).client.productItems;stockRows[0].quantity=1;
req=await revise(stockInvoice,{productItems:stockRows},50000);const beforeFailure=clone(state);fail='Audit';await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),/INJECTED_Audit/);fail='';assert.deepEqual(state,beforeFailure);
await call('applyInvoiceAdjustment',req.data,req.key);await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(state.Product.find(r=>r._id===product._id).stock,9);assert.equal(state.StockMovement.filter(r=>r.checkoutInvoiceId===stockInvoice._id).length,2);
const staleRows=(await context(stockInvoice)).client.productItems;staleRows[0].quantity=2;req=await revise(stockInvoice,{productItems:staleRows},100000);state.Product.find(r=>r._id===product._id).stock=10;
await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),(e:any)=>e.status===409);state.Product.find(r=>r._id===product._id).stock=9;
req=await commit({...payload(stockInvoice,'VOID',0),stockHandling:'RETURN'});await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(state.Product.find(r=>r._id===product._id).stock,10,'void restores remaining one, not original two');
// New product and package are committed together. No commission before payment.
const template=add(PackageTemplate,{name:'Package',serviceId:service,packageType:'SESSIONS',totalSessions:5,active:true,price:200000});
const packageInvoice=unpaid();
const originalPlan=add(Treatment,{invoiceId:packageInvoice._id,customerId:customer,serviceId:service,templateId:template._id,name:'Package',packageType:'SESSIONS',totalSessions:5,remaining:5,status:'ACTIVE'});
Object.assign(current(packageInvoice),{kind:'PACKAGE',total:550000,sellerId:tech,sellerName:'Technician',saleParticipants:[{staffId:tech,staffName:'Technician'}],saleCommissionVersion:1,saleCommissionAccrued:0,packageItems:[{lineId:id(),treatmentId:originalPlan._id,templateId:template._id,serviceId:service,name:'Package',total:200000,totalSessions:5,packageType:'SESSIONS'}],productItems:[{lineId:id(),productId:product._id,name:product.name,unit:product.unit,quantity:1,unitPrice:50000,total:50000}]});
state.Product.find(p=>p._id===product._id).stock=9;add(StockMovement,{checkoutInvoiceId:packageInvoice._id,productId:product._id,direction:'OUT',quantity:1});
const mixedClient=(await context(packageInvoice)).client;
req=await revise(packageInvoice,{packageItems:[...mixedClient.packageItems,{key:'package-new',templateId:template._id,total:200000,totalSessions:5,promotion:''}],productItems:[{...mixedClient.productItems[0],quantity:2}]},800000);
const beforePackage=clone(state);fail='Treatment';await assert.rejects(call('applyInvoiceAdjustment',req.data,req.key),/INJECTED_Treatment/);fail='';assert.deepEqual(state,beforePackage);
await call('applyInvoiceAdjustment',req.data,req.key);await call('applyInvoiceAdjustment',req.data,req.key);
const plan=state.Treatment.find(r=>r.invoiceId===packageInvoice._id&&r._id!==originalPlan._id);assert.equal(plan.remaining,5);assert.equal(current(packageInvoice).packageItems[1].name,'Package');assert.equal(state.Treatment.filter(r=>r.invoiceId===packageInvoice._id).length,2);
assert.equal(plan.customerId,customer);
const packageRows=(await context(packageInvoice)).client.packageItems;packageRows[1].totalSessions=7;
req=await revise(packageInvoice,{packageItems:packageRows});await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(state.Treatment.find(r=>r._id===plan._id).remaining,7);
const newTemplate=add(PackageTemplate,{name:'Replacement package',serviceId:service,packageType:'SESSIONS',totalSessions:10,active:true,price:200000});
const replacedPackage=(await context(packageInvoice)).client.packageItems;replacedPackage[1].templateId=newTemplate._id;replacedPackage[1].totalSessions=10;
req=await revise(packageInvoice,{packageItems:replacedPackage});await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(state.Treatment.find(r=>r._id===plan._id).name,'Replacement package');assert.equal(state.Treatment.find(r=>r._id===plan._id).remaining,10);assert.equal(current(packageInvoice).packageItems[1].name,'Replacement package');
state.Treatment.find(r=>r._id===plan._id).remaining=6;add(TreatmentUse,{treatmentId:plan._id,checkoutInvoiceId:packageInvoice._id});
const usedState=clone(state);await assert.rejects(revise(packageInvoice,{packageItems:[]}),(e:any)=>e.status===409);assert.deepEqual(state,usedState);
assert.equal(state.CashEntry.filter(r=>r.kind==='PAYMENT').length,3);
await assert.rejects(operate({...actor,id:tech,role:'STAFF'},'previewInvoiceAdjustment',{...payload(first,'CORRECT',300000),content:{description:'Forbidden'}},randomUUID()),(e:any)=>e.status===403);
await assert.rejects(revise(first,{customerId:id()}),(e:any)=>e.status===409);
const sameTotal=unpaid(),sameEntry=add(CashEntry,{customerId:customer,actorId:owner,amount:100000,day:spaDay(),method:'CASH',direction:'IN',kind:'PAYMENT',reversed:false});
add(Payment,{invoiceId:sameTotal._id,receiptId:sameEntry._id,amount:100000,reversed:false});current(sameTotal).paid=100000;current(sameTotal).status='PARTIALLY_PAID';
req=await revise(sameTotal,{description:'Same total corrected'});await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(current(sameTotal).financialRevision,undefined);
await call('reverseCash',{id:sameEntry._id,reason:'Real mistake reversal still available'});assert.equal(current(sameTotal).paid,0);assert.equal(current(sameTotal).status,'OPEN');
const ambiguous=unpaid();current(ambiguous).kind='PACKAGE';add(Treatment,{customerId:customer,invoiceId:ambiguous._id,serviceId:service,name:'Unpriced legacy package',totalSessions:5,remaining:5,status:'ACTIVE'});
const ambiguousContext=await context(ambiguous);assert.equal(ambiguousContext.client.packageItems.length,0);assert.equal(ambiguousContext.unpricedPackages.length,1);assert.ok(ambiguousContext.locks.addService);
await assert.rejects(revise(ambiguous,{serviceItems:[]}),(e:any)=>e.status===409);
const timeTemplate=add(PackageTemplate,{name:'Timed package',serviceId:service,packageType:'TIME',durationMonths:3,active:true,price:200000});
const timed=add(Invoice,{customerId:customer,description:'Timed package',kind:'PACKAGE',total:200000,paid:0,status:'OPEN',sellerId:tech,sellerName:'Technician',saleCommissionVersion:1,saleCommissionAccrued:0});
add(Treatment,{invoiceId:timed._id,customerId:customer,serviceId:service,templateId:timeTemplate._id,name:'Timed package',packageType:'TIME',durationMonths:3,startsOn:'2026-11-01',expiresOn:'2027-02-01',usedSessions:0,status:'ACTIVE'});
req=await revise(timed,{packageItems:[{...(await context(timed)).client.packageItems[0],total:210000}]},210000);
assert.equal(req.preview.reconciliation.content.displayAfter.packageItems[0].expiresOn,'2027-02-01');await call('applyInvoiceAdjustment',req.data,req.key);
const timedRows=(await context(timed)).client.packageItems;timedRows[0].durationMonths=4;timedRows[0].expiresOn='2027-03-01';
req=await revise(timed,{packageItems:timedRows});assert.equal(req.preview.reconciliation.content.displayBefore.packageItems[0].expiresOn,'2027-02-01');assert.equal(req.preview.reconciliation.content.displayAfter.packageItems[0].expiresOn,'2027-03-01');
await call('applyInvoiceAdjustment',req.data,req.key);assert.equal(state.Treatment.find(r=>r.invoiceId===timed._id).expiresOn,'2027-03-01');assert.equal(current(timed).packageItems[0].expiresOn,undefined,'expiry is stored on rights, not an unsupported invoice field');
const legacyPackage=add(Invoice,{customerId:customer,serviceId:service,description:'Legacy package',kind:'PACKAGE',total:300000,paid:0,status:'OPEN',sellerId:tech,sellerName:'Technician',saleCommissionVersion:1,saleCommissionAccrued:0});
const legacyPlan=add(Treatment,{customerId:customer,invoiceId:legacyPackage._id,serviceId:service,name:'Legacy plan name',totalSessions:5,remaining:5,status:'ACTIVE'});
const legacyContext=await context(legacyPackage);assert.equal(legacyContext.client.packageItems[0].templateId,null);assert.equal(legacyContext.client.packageItems[0].total,300000);
const legacyRows=legacyContext.client.packageItems;legacyRows[0].totalSessions=7;req=await revise(legacyPackage,{packageItems:legacyRows});await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(state.Treatment.find(r=>r._id===legacyPlan._id).remaining,7);assert.equal(current(legacyPackage).packageItems[0].name,'Legacy plan name');
// Additional service lines stay pending until explicit completion, which must never drop lines.
const pending=unpaid(),pendingRows=(await context(pending)).client.serviceItems;
pendingRows.push({key:'extra-service',serviceId:replacementService._id,total:100000,performerId:owner});
req=await revise(pending,{serviceItems:pendingRows},400000);await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(current(pending).performedAt,undefined);const ledgerBefore=state.InvoiceLineCommission.length,cashBeforeCompletion=clone(state.CashEntry),pendingBefore=clone(state);
const completeKey=randomUUID(),completeData={id:pending._id,staffId:tech};fail='InvoiceLineCommission';await assert.rejects(call('completeInvoiceService',completeData,completeKey),/INJECTED_InvoiceLineCommission/);fail='';assert.deepEqual(state,pendingBefore);
await call('completeInvoiceService',completeData,completeKey);await call('completeInvoiceService',completeData,completeKey);
assert.equal(current(pending).serviceItems.length,2);assert.deepEqual(current(pending).serviceItems.map((r:any)=>r.performerId),[tech,owner]);assert.equal(state.InvoiceLineCommission.length,ledgerBefore+2);assert.equal(state.InvoiceLineCommission.filter(r=>r.invoiceId===pending._id).reduce((n,r)=>n+r.amount,0),30000);assert.deepEqual(state.CashEntry,cashBeforeCompletion);
// Conversion to a category absent from the original invoice is rejected, including legacy packages.
const legacyBefore=clone(state);
await assert.rejects(revise(legacyPackage,{packageItems:[],serviceItems:[{key:'replace-package-with-service',serviceId:replacementService._id,total:300000,performerId:owner}]}),(e:any)=>e.status===409);assert.deepEqual(state,legacyBefore);
// Removing a package from an originally mixed invoice keeps existing services and cancelled rights history.
const reduced=unpaid(),reducedPlan=add(Treatment,{invoiceId:reduced._id,customerId:customer,serviceId:service,name:'Unused rights',totalSessions:5,remaining:5,status:'ACTIVE'});
Object.assign(current(reduced),{kind:'PACKAGE',total:400000,sellerId:tech,sellerName:'Technician',packageItems:[{lineId:id(),treatmentId:reducedPlan._id,serviceId:service,name:'Unused rights',total:100000,totalSessions:5}]});
req=await revise(reduced,{packageItems:[]},300000);
assert.equal(req.preview.reconciliation.content.displayBefore.packageItems.length,1);
assert.deepEqual(req.preview.reconciliation.content.displayAfter.packageItems,[]);
await call('applyInvoiceAdjustment',req.data,req.key);
assert.equal(state.Treatment.find(r=>r._id===reducedPlan._id).status,'CANCELLED');assert.equal(current(reduced).kind,'SERVICE');await call('completeInvoiceService',{id:reduced._id,staffId:tech});assert.equal(current(reduced).serviceItems.length,1);
// Legacy arrays may be absent or present but empty (including Mongoose defaults).
// Both preview columns must use the same canonical rows as the edit form.
for(const emptyArrays of [false,true]){
 const legacy=add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Legacy service preview',total:300000,paid:0,status:'OPEN',commission:0,performedBy:tech,
   ...(emptyArrays?{serviceItems:[],productItems:[],packageItems:[],treatmentSessions:[]}: {})});
 const canonical=(await context(legacy)).source.serviceItems[0],fields=(await context(legacy)).client.serviceItems;
 assert.equal(fields.length,1);
 const original=clone(current(legacy));
 req=await revise(legacy,{});
 assert.equal(req.preview.noChanges,true);
 assert.equal(req.preview.reconciliation.content.displayBefore.serviceItems.length,1);
 assert.equal(req.preview.reconciliation.content.displayBefore.serviceItems[0].name,canonical.name);
 assert.equal(req.preview.reconciliation.content.displayAfter.serviceItems[0].name,canonical.name);
 req=await revise(legacy,{serviceItems:[{...fields[0],serviceId:replacementService._id,performerId:tech2}]});
 const review=req.preview.reconciliation.content;
 assert.equal(review.displayBefore.serviceItems.length,1);
 assert.equal(review.displayBefore.serviceItems[0].name,canonical.name);
 assert.equal(review.displayBefore.serviceItems[0].performerId,tech);
 assert.equal(review.displayAfter.serviceItems.length,1);
 assert.equal(review.displayAfter.serviceItems[0].name,replacementService.name);
 assert.equal(review.displayAfter.serviceItems[0].performerId,tech2);
 assert.deepEqual(current(legacy),original,'preview never normalizes the stored invoice');
}
// The display fix must not loosen existing deletion guards on mixed service invoices.
const removedLegacy=add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Legacy mixed preview',total:350000,paid:0,status:'OPEN',commission:0,serviceItems:[],
 productItems:[{lineId:id(),productId:product._id,name:product.name,unit:product.unit,quantity:1,unitPrice:50000,total:50000}],packageItems:[],treatmentSessions:[]});
const legacySources=clone(state);
await assert.rejects(revise(removedLegacy,{serviceItems:[]},50000),(e:any)=>e.status===409);
assert.deepEqual(state,legacySources);
// Legacy products and packages also use canonical display rows when arrays are empty.
const legacyProduct=add(Invoice,{customerId:customer,kind:'PRODUCT',description:'Legacy product preview',productId:product._id,productName:product.name,productUnit:product.unit,quantity:2,unitPrice:50000,total:100000,paid:0,status:'OPEN',productItems:[],serviceItems:[],packageItems:[]});
req=await revise(legacyProduct,{description:'Corrected legacy product preview'});
assert.equal(req.preview.reconciliation.content.displayBefore.productItems[0].quantity,2);
assert.deepEqual(req.preview.reconciliation.content.displayAfter.productItems,req.preview.reconciliation.content.displayBefore.productItems);
const canonicalPackage=add(Invoice,{customerId:customer,serviceId:service,kind:'PACKAGE',description:'Legacy package preview',total:300000,paid:0,status:'OPEN',sellerId:tech,sellerName:'Technician',serviceItems:[],productItems:[],packageItems:[]});
add(Treatment,{customerId:customer,invoiceId:canonicalPackage._id,serviceId:service,name:'Legacy rights preview',totalSessions:5,remaining:5,status:'ACTIVE'});
req=await revise(canonicalPackage,{description:'Corrected legacy package preview'});
assert.equal(req.preview.reconciliation.content.displayBefore.packageItems[0].name,'Legacy rights preview');
assert.deepEqual(req.preview.reconciliation.content.displayAfter.packageItems,req.preview.reconciliation.content.displayBefore.packageItems);
console.log('Invoice content fixture passed: no-op, fields, sources, used/settled locks, stock, rights, rollback, retry, legacy preview.');
