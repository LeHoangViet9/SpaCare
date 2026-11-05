import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { operate } from '../src/lib/operations';
import { Deposit, Allocation, SaleCommission, SharedSaleCommission, InvoiceLineCommission, Product, StockMovement, TreatmentUse, ActivityNotification, Appointment, Commission, ServiceGroup, User, Control, Customer, Invoice, CashEntry, CashCard, CashCardUse, Payment, Day, Audit, Idempotency, Treatment, PackageTemplate, Service } from '../src/lib/models';
import { spaDay } from '../src/lib/rules';
const spaId='a'.repeat(24),ownerId='b'.repeat(24),customerId='c'.repeat(24),serviceId='d'.repeat(24);
const actor={id:ownerId,spaId,name:'Owner',role:'OWNER' as const,cashier:false};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
let state:Record<string,any[]>={};
function match(row:any,filter:any):boolean{return Object.entries(filter).every(([k,v]:any)=>v&&typeof v==='object'&&'$in' in v?v.$in.some((x:any)=>String(x)===String(row[k])):String(row[k])===String(v));}
function doc(name:string,row:any):any{if(!row)return null;return {...clone(row),...(name==='Appointment'?{startAt:new Date(row.startAt)}:{}),toObject(){const {toObject,save,...v}=this;return clone(v);},async save(){const i=state[name].findIndex(v=>String(v._id)===String(this._id));state[name][i]=this.toObject();}};}
function query(value:any):any{return {distinct:(key:string)=>query([...new Set((value||[]).map((row:any)=>row[key]).filter(Boolean))]),session:async()=>value,then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};}
let failModel='', failAt=1, matchingWrites=0;
for(const model of [Deposit,Allocation,SaleCommission,SharedSaleCommission,InvoiceLineCommission,Product,StockMovement,TreatmentUse,ActivityNotification,Appointment,Commission,ServiceGroup,User,Control,Customer,Invoice,CashEntry,CashCard,CashCardUse,Payment,Day,Audit,Idempotency,Treatment,PackageTemplate,Service]){
  const name=model.modelName;state[name]=[];
  (model as any).find=(filter:any)=>query(state[name].filter(row=>match(row,filter)));
  (model as any).findOne=(filter:any)=>query(doc(name,state[name].find(row=>match(row,filter))));
  (model as any).exists=(filter:any)=>query(state[name].find(row=>match(row,filter))||null);
  (model as any).findOneAndUpdate=(filter:any,update:any)=>{
    const row=state[name].find(row=>match(row,filter));
    if(name==='Control'&&row)for(const [field,value] of Object.entries(update?.$inc || {}))row[field]=(row[field]||0)+Number(value);
    return query(doc(name,row));
  };
  (model as any).create=async(rows:any[],options:any)=>{
    assert.ok(options.session,'every financial write needs the transaction');
    if(failModel===name && ++matchingWrites===failAt)throw new Error('INJECTED_LEDGER_FAILURE');
    const result=[];for(const row of rows){const item=new model(row);await item.validate();const v=clone(item.toObject());state[name].push(v);result.push(doc(name,v));}return result;
  };
}
let legacyPackageIndex=false;
(Treatment.collection as any).indexes=async()=>legacyPackageIndex ? [{name:'spaId_1_invoiceId_1',key:{spaId:1,invoiceId:1},unique:true}] : [{name:'treatment_invoice_lookup',key:{spaId:1,invoiceId:1}}];
state.User=[{_id:ownerId,spaId,name:'Owner',role:'OWNER',active:true,cashier:false}];
state.Control=[{_id:'e'.repeat(24),spaId,revision:0}];
state.Customer=[{_id:customerId,spaId,name:'Customer'}];
state.Service=[{_id:serviceId,spaId,name:'Service',price:400000,active:true,commission:0}];
state.Day=[{_id:'f'.repeat(24),spaId,day:spaDay(),status:'OPEN'}];
(mongoose as any).connect=()=>assert.fail('Model doubles must never connect to a database');
(mongoose.connection as any).readyState=1;
let queue=Promise.resolve(), transactionCalls=0;
(mongoose.connection as any).transaction=(fn:any)=>{transactionCalls++;const result=queue.then(async()=>{const before=clone(state);try{return await fn({fixture:true});}catch(e){state=before;throw e;}});queue=result.catch(()=>{});return result;};
const call=(action:string,data:any,key=randomUUID())=>operate(actor,action,data,key);
function invoice(total=400000,kind='SERVICE',customer=customerId){const row={_id:String(new mongoose.Types.ObjectId()),spaId,customerId:customer,serviceId,kind,total,paid:0};state.Invoice.push(row);return row;}
const payment=(method:string,amount:number,extra:any={})=>({method,amount,receivedConfirmation:true,...extra});
const split=(bill:any,payments:any[],key=randomUUID())=>call('splitPayment',{invoiceId:bill._id,payments},key);
const current=(bill:any)=>state.Invoice.find(row=>row._id===bill._id);
const mixed=invoice(1500000), mixedKey=randomUUID();
const values=[payment('BANK_TRANSFER',500000),payment('CASH',1000000)];
const result=await split(mixed,values,mixedKey);
assert.equal(transactionCalls,1,'both methods must share a single transaction');assert.equal(state.Idempotency.length,1);
assert.equal(current(mixed).paid,1500000);assert.equal(current(mixed).total-current(mixed).paid,0);assert.equal(current(mixed).status,'PAID');
assert.equal(state.Payment.length,2);assert.equal(state.CashEntry.length,2);
assert.deepEqual(state.Payment.map(row=>row.amount),[500000,1000000]);
assert.deepEqual(state.CashEntry.map(row=>[row.method,row.amount,row.kind,row.direction]),[['BANK_TRANSFER',500000,'PAYMENT','IN'],['CASH',1000000,'PAYMENT','IN']]);
assert.ok(state.Payment.every(row=>row.invoiceId===mixed._id));
assert.deepEqual(state.Payment.map(row=>row.receiptId),state.CashEntry.map(row=>row._id));
assert.equal(state.Audit.filter(row=>row.action==='payment').length,2);
assert.deepEqual(await split(mixed,values,mixedKey),result);assert.equal(state.Payment.length,2);
await assert.rejects(split(mixed,[payment('CASH',1)],mixedKey),(e:any)=>e.status===409);
for(const method of ['CASH','BANK_TRANSFER']){const bill=invoice(1500000);await split(bill,[payment(method,1500000)]);assert.equal(current(bill).paid,1500000);assert.equal(state.Payment.filter(row=>row.invoiceId===bill._id).length,1);}
for(const payments of [[],[payment('CASH',0),payment('BANK_TRANSFER',0)],[payment('CASH',1000000),payment('BANK_TRANSFER',500001)],[payment('CASH',1),payment('CASH',1)],[payment('CARD',1)],[payment('CASH',1,{receivedConfirmation:false})],[payment('CASH',-1)],[payment('CASH',0.5)]]){
 const bill=invoice(1500000);const before=clone(state);await assert.rejects(split(bill,payments));assert.deepEqual(state,before);
}
const partial=invoice(1500000);await split(partial,[payment('CASH',300000)]);assert.equal(current(partial).total-current(partial).paid,1200000);
await assert.rejects(split(partial,[payment('CASH',1000000),payment('BANK_TRANSFER',200001)]));
await split(partial,[payment('CASH',1000000),payment('BANK_TRANSFER',200000)]);assert.equal(current(partial).paid,1500000);
// The second write can fail after the first receipt, invoice update and child audit.
for(const model of ['Payment','CashEntry','Audit']){
 const bill=invoice(1500000), key=randomUUID(), before=clone(state);failModel=model;failAt=2;matchingWrites=0;
 await assert.rejects(split(bill,values,key),/INJECTED_LEDGER_FAILURE/);assert.deepEqual(state,before,'all receipts, balances, audits and idempotency must roll back');
 failModel='';await split(bill,values,key);assert.equal(current(bill).paid,1500000);
}
const lineA='1'.repeat(24),lineB='2'.repeat(24);
const lines=()=>[{lineId:lineA,name:'Massage',total:1000000,paid:0},{lineId:lineB,name:'Gội đầu',total:500000,paid:0}];
const lineBill=invoice(2300000);(lineBill as any).serviceItems=[{lineId:lineA,name:'Service A',total:1000000,paid:0},{lineId:lineB,name:'Service B',total:1300000,paid:0}];
const originalLines=clone((lineBill as any).serviceItems), partialKey=randomUUID();
const oneMethodBill=invoice(2300000);(oneMethodBill as any).serviceItems=clone((lineBill as any).serviceItems);
const oneMethodKey=randomUUID();await split(oneMethodBill,[payment('CASH',2000000)],oneMethodKey);await split(oneMethodBill,[payment('CASH',2000000)],oneMethodKey);
assert.equal(current(oneMethodBill).paid,2000000);assert.equal(current(oneMethodBill).total-current(oneMethodBill).paid,300000);
assert.equal(state.Payment.filter(row=>row.invoiceId===oneMethodBill._id).length,1);assert.deepEqual(current(oneMethodBill).serviceItems,originalLines);
await assert.rejects(split(oneMethodBill,[payment('BANK_TRANSFER',300001)]));
const partialMixed=[payment('CASH',1500000),payment('BANK_TRANSFER',500000)];
const partialResult=await split(lineBill,partialMixed,partialKey);assert.deepEqual(await split(lineBill,partialMixed,partialKey),partialResult);
assert.equal(current(lineBill).paid,2000000);assert.equal(current(lineBill).total-current(lineBill).paid,300000);
assert.deepEqual(current(lineBill).serviceItems,originalLines);
assert.ok(state.Payment.filter(row=>row.invoiceId===lineBill._id).every(row=>row.lineAllocations===undefined));
await split(lineBill,[payment('BANK_TRANSFER',300000)]);assert.equal(current(lineBill).paid,2300000);
assert.deepEqual(current(lineBill).serviceItems,originalLines);
// Deprecated optional client fields are accepted but never applied or persisted.
const stale=invoice(1500000);(stale as any).serviceItems=lines();
await split(stale,[payment('CASH',100000,{lineAllocations:[{lineId:lineA,amount:99999}]})]);
assert.equal(current(stale).paid,100000);assert.deepEqual(current(stale).serviceItems,lines());
assert.equal(state.Payment.find(row=>row.invoiceId===stale._id).lineAllocations,undefined);
assert.ok(state.Audit.filter(row=>row.action==='payment').every(row=>row.details.lineAllocations===undefined));
for(const lineAllocations of [[], 'obsolete', [{lineId:'invalid',amount:0}]]){
 const bill=invoice(1500000);(bill as any).serviceItems=lines();await split(bill,[payment('CASH',100000,{lineAllocations})]);
 assert.equal(current(bill).paid,100000);assert.equal(state.Payment.find(row=>row.invoiceId===bill._id).lineAllocations,undefined);
}
// A new receipt ignores stale/missing line identities and historical line paid totals.
for(const serviceItems of [[{total:1500000,paid:0}], [{lineId:lineA,total:1500000,paid:17}]]){
 const bill=invoice(1500000);(bill as any).serviceItems=serviceItems;await split(bill,[payment('CASH',200000)]);assert.equal(current(bill).paid,200000);assert.deepEqual(current(bill).serviceItems,serviceItems);
}
// Existing allocation ledgers remain readable; reversing old money after aggregate receipts works.
const historical=invoice(1500000);(historical as any).serviceItems=lines();(historical as any).serviceItems[0].paid=100000;historical.paid=100000;
const oldPaymentId=String(new mongoose.Types.ObjectId()),oldReceiptId=String(new mongoose.Types.ObjectId());
const historicalAllocations=[{lineId:lineA,amount:100000}];
state.Payment.push({_id:oldPaymentId,spaId,invoiceId:historical._id,receiptId:oldReceiptId,amount:100000,reversed:false,lineAllocations:clone(historicalAllocations)});
state.CashEntry.push({_id:oldReceiptId,spaId,customerId,kind:'PAYMENT',direction:'IN',method:'CASH',amount:100000,day:spaDay(),actorId:ownerId,reversed:false});
await split(historical,[payment('BANK_TRANSFER',200000)]);assert.equal(current(historical).paid,300000);assert.equal(current(historical).serviceItems[0].paid,100000);
const reversalKey=randomUUID();await call('reverseCash',{id:oldReceiptId,reason:'Correct historical receipt'},reversalKey);await call('reverseCash',{id:oldReceiptId,reason:'Correct historical receipt'},reversalKey);
assert.equal(current(historical).paid,200000);assert.equal(current(historical).serviceItems[0].paid,0);
assert.deepEqual(state.Payment.find(row=>row._id===oldPaymentId).lineAllocations,historicalAllocations);
// Pre-change idempotency fingerprints stay readable, including normalized legacy field order.
const previousKey=randomUUID(),previousResult={id:historical._id,invoiceId:historical._id,paymentIds:[oldPaymentId],message:'Historical success'};
const previousData={invoiceId:historical._id,payments:[{amount:100000,method:'CASH',note:'',receivedConfirmation:true,lineAllocations:historicalAllocations}]};
state.Idempotency.push({_id:String(new mongoose.Types.ObjectId()),spaId,userId:ownerId,key:previousKey,fingerprint:createHash('sha256').update(JSON.stringify({action:'splitPayment',data:previousData})).digest('hex'),result:previousResult});
const beforeReplay=state.Payment.length;
assert.deepEqual(await split(historical,[payment('CASH',100000,{lineAllocations:[{amount:100000,lineId:lineA}]})],previousKey),previousResult);
assert.equal(state.Payment.length,beforeReplay);assert.equal(current(historical).paid,200000);
const deposited=invoice(1500000);(deposited as any).serviceItems=lines();(deposited as any).serviceItems[0].paid=100000;deposited.paid=100000;
const depositId=String(new mongoose.Types.ObjectId()),allocationId=String(new mongoose.Types.ObjectId());
state.Deposit=[{_id:depositId,spaId,customerId,amount:500000,balance:400000}];
state.Allocation=[{_id:allocationId,spaId,depositId,invoiceId:deposited._id,amount:100000,reversed:false,lineAllocations:clone(historicalAllocations)}];
await split(deposited,[payment('CASH',200000)]);await call('reverseAllocation',{id:allocationId,reason:'Correct old deposit assignment'});
assert.equal(current(deposited).paid,200000);assert.equal(current(deposited).serviceItems[0].paid,0);assert.equal(state.Deposit[0].balance,500000);
assert.deepEqual(state.Allocation.find(row=>row._id===allocationId).lineAllocations,historicalAllocations);
const newCreditBill=invoice(1500000);(newCreditBill as any).serviceItems=lines();
const creditResult=await call('allocate',{depositId,invoiceId:newCreditBill._id,amount:100000,reason:'Invoice credit'});
assert.equal(current(newCreditBill).paid,100000);assert.equal(state.Allocation.find(row=>row._id===creditResult.id).lineAllocations,undefined);
assert.deepEqual(current(newCreditBill).serviceItems,lines());
const cardId=String(new mongoose.Types.ObjectId());state.CashCard=[{_id:cardId,spaId,customerId,origin:'OPENING',amount:800000,balance:800000,actorId:ownerId}];
const cardBill=invoice(1500000);(cardBill as any).serviceItems=lines();
const cardResult=await call('redeemCashCard',{cardId,invoiceId:cardBill._id,amount:200000,additionalAmount:100000,method:'CASH',receivedConfirmation:true});
assert.equal(current(cardBill).paid,300000);assert.equal(current(cardBill).cardPaid,200000);assert.equal(state.CashCard[0].balance,600000);
assert.equal(state.CashCardUse.find(row=>row._id===cardResult.id).lineAllocations,undefined);
assert.equal(state.Payment.find(row=>row.invoiceId===cardBill._id).lineAllocations,undefined);assert.deepEqual(current(cardBill).serviceItems,lines());
// Concurrent submissions cannot collect more than the remaining debt, even with different keys.
const race=invoice(1500000);const settled=await Promise.allSettled([split(race,values),split(race,values)]);assert.equal(settled.filter(row=>row.status==='fulfilled').length,1);assert.equal(current(race).paid,1500000);
const saleBill=invoice(1500000,'PACKAGE');Object.assign(saleBill,{sellerId:ownerId,sellerName:'Owner',saleCommissionVersion:1,saleCommissionAccrued:0,description:'Package'});
await split(saleBill,values);
const commissions=state.SaleCommission.filter(row=>row.invoiceId===saleBill._id);
assert.deepEqual(commissions.map(row=>row.amount),[25000,50000]);assert.equal(current(saleBill).saleCommissionAccrued,75000);
assert.deepEqual(commissions.map(row=>row.sourceId),state.Payment.filter(row=>row.invoiceId===saleBill._id).map(row=>row._id));
const rollbackSale=invoice(1500000,'PACKAGE');Object.assign(rollbackSale,{sellerId:ownerId,sellerName:'Owner',saleCommissionVersion:1,saleCommissionAccrued:0,description:'Package'});
const beforeSale=clone(state);failModel='SaleCommission';failAt=2;matchingWrites=0;
await assert.rejects(split(rollbackSale,values),/INJECTED_LEDGER_FAILURE/);assert.deepEqual(state,beforeSale);failModel='';
const guarded=invoice(1500000);const user=state.User[0];user.role='STAFF';user.cashier=false;
await assert.rejects(split(guarded,values),(e:any)=>e.status===403);
user.role='OWNER';state.User[0].role='OWNER';state.User[0].active=false;
await assert.rejects(split(guarded,values),(e:any)=>e.status===401);state.User[0].active=true;
state.Day[0].status='CLOSED';await assert.rejects(split(guarded,values));state.Day[0].status='OPEN';
const foreign=invoice(1500000);(foreign as any).spaId='9'.repeat(24);await assert.rejects(split(foreign,values),(e:any)=>e.status===404);
const cancelled=invoice(1500000);(cancelled as any).status='CANCELLED';await assert.rejects(split(cancelled,values),(e:any)=>e.status===409);
const replaced=invoice(1500000);(replaced as any).activeDocumentId='8'.repeat(24);await assert.rejects(split(replaced,values),(e:any)=>e.status===409);
