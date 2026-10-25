import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { operate } from '../src/lib/operations';
import { ActivityNotification, Appointment, Commission, ServiceGroup, User, Control, Customer, Invoice, CashEntry, CashCard, CashCardUse, Payment, Day, Audit, Idempotency, Treatment, PackageTemplate, Service } from '../src/lib/models';
import { spaDay } from '../src/lib/rules';
const spaId='a'.repeat(24),ownerId='b'.repeat(24),customerId='c'.repeat(24),serviceId='d'.repeat(24);
const actor={id:ownerId,spaId,name:'Owner',role:'OWNER' as const,cashier:false};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
let state:Record<string,any[]>={};
function match(row:any,filter:any):boolean{return Object.entries(filter).every(([k,v]:any)=>v&&typeof v==='object'&&'$in' in v?v.$in.some((x:any)=>String(x)===String(row[k])):String(row[k])===String(v));}
function doc(name:string,row:any):any{if(!row)return null;return {...clone(row),...(name==='Appointment'?{startAt:new Date(row.startAt)}:{}),toObject(){const {toObject,save,...v}=this;return clone(v);},async save(){const i=state[name].findIndex(v=>String(v._id)===String(this._id));state[name][i]=this.toObject();}};}
function query(value:any):any{return {distinct:(key:string)=>query([...new Set((value||[]).map((row:any)=>row[key]).filter(Boolean))]),session:async()=>value,then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};}
let failModel='';
for(const model of [ActivityNotification,Appointment,Commission,ServiceGroup,User,Control,Customer,Invoice,CashEntry,CashCard,CashCardUse,Payment,Day,Audit,Idempotency,Treatment,PackageTemplate,Service]){
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
    if(failModel===name)throw new Error('INJECTED_LEDGER_FAILURE');
    const result=[];for(const row of rows){const item=new model(row);await item.validate();const v=clone(item.toObject());state[name].push(v);result.push(doc(name,v));}return result;
  };
}
state.User=[{_id:ownerId,spaId,name:'Owner',role:'OWNER',active:true,cashier:false}];
state.Control=[{_id:'e'.repeat(24),spaId,revision:0}];
state.Customer=[{_id:customerId,spaId,name:'Customer'}];
state.Service=[{_id:serviceId,spaId,name:'Service',price:400000,active:true,commission:0}];
state.Day=[{_id:'f'.repeat(24),spaId,day:spaDay(),status:'OPEN'}];
(mongoose as any).connect=()=>assert.fail('Model doubles must never connect to a database');
(mongoose.connection as any).readyState=1;
let queue=Promise.resolve();
(mongoose.connection as any).transaction=(fn:any)=>{const result=queue.then(async()=>{const before=clone(state);try{return await fn({fixture:true});}catch(e){state=before;throw e;}});queue=result.catch(()=>{});return result;};
const call=(action:string,data:any,key=randomUUID())=>operate(actor,action,data,key);
function invoice(total=400000,kind='SERVICE',customer=customerId){const row={_id:String(new mongoose.Types.ObjectId()),spaId,customerId:customer,serviceId,kind,total,paid:0};state.Invoice.push(row);return row;}
const sale={customerId,amount:800000,method:'CASH',receivedConfirmation:true};
const key=randomUUID(),purchase=await call('sellCashCard',sale,key);await call('sellCashCard',sale,key);
assert.equal(state.CashCard.length,1);assert.equal(state.CashEntry.length,1);assert.equal(state.CashEntry[0].amount,800000);assert.equal(state.CashEntry[0].kind,'CARD_SALE');
const b=invoice(),use={cardId:purchase.id,invoiceId:b._id,amount:400000};const useKey=randomUUID();
await call('redeemCashCard',use,useKey);await call('redeemCashCard',use,useKey);
assert.equal(state.CashCard[0].balance,400000);assert.equal(state.Invoice[0].paid,400000);assert.equal(state.Invoice[0].cardPaid,400000);assert.equal(state.CashEntry.length,1);assert.equal(state.CashCardUse.length,1);
for(const kind of ['PACKAGE','PRODUCT','SESSION','GIFT'])await assert.rejects(call('redeemCashCard',{...use,invoiceId:invoice(400000,kind)._id}),e=>(e as any).status===409);
await assert.rejects(call('redeemCashCard',{...use,invoiceId:invoice(400000,'SERVICE','9'.repeat(24))._id}),e=>(e as any).status===409);
const split=invoice();await call('redeemCashCard',{...use,invoiceId:split._id,amount:200000,additionalAmount:200000,method:'BANK_TRANSFER',receivedConfirmation:true});
assert.equal(state.CashCard[0].balance,200000);assert.equal(state.Payment[0].amount,200000);assert.equal(state.CashEntry.at(-1).amount,200000);assert.equal(state.Invoice.find(v=>v._id===split._id).paid,400000);
const rollback=invoice();const before=clone(state);failModel='Payment';
await assert.rejects(call('redeemCashCard',{...use,invoiceId:rollback._id,amount:100000,additionalAmount:300000,method:'CASH',receivedConfirmation:true}),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,before,'card, invoice, cash, ledger, audit and key all roll back');
const saleBefore=clone(state);failModel='CashCard';await assert.rejects(call('sellCashCard',sale),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,saleBefore,'failed card creation must roll back the receipt');
const race=await Promise.allSettled([invoice(),invoice()].map(b=>call('redeemCashCard',{...use,invoiceId:b._id,amount:200000})));
assert.equal(race.filter(v=>v.status==='fulfilled').length,1);assert.equal(state.CashCard[0].balance,0);
const templateId='1'.repeat(24);state.PackageTemplate=[{_id:templateId,spaId,serviceId,name:'3 million package',price:3000000,active:true,totalSessions:10,packageType:'SESSIONS'}];
const cashCount=state.CashEntry.length;const giftKey=randomUUID();const pack={customerId,templateId,dueDate:spaDay(),promotion:'Gift 800k',giftCashCardAmount:800000};
await call('sellPackage',pack,giftKey);await call('sellPackage',pack,giftKey);
assert.equal(state.CashCard.length,2);assert.equal(state.CashCard[1].origin,'GIFT');assert.equal(state.CashCard[1].amount,800000);assert.equal(state.CashEntry.length,cashCount);
const giftBefore=clone(state);failModel='CashCard';await assert.rejects(call('sellPackage',pack),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,giftBefore,'gift creation failure rolls back the package and invoice');
state.Day[0].status='CLOSED';const closedBefore=clone(state);await assert.rejects(call('redeemCashCard',{cardId:state.CashCard[1]._id,invoiceId:invoice()._id,amount:100000}));assert.equal(state.CashCard[1].balance,closedBefore.CashCard[1].balance);
const groupKey=randomUUID();const group=await call('serviceGroup',{name:'  Da   mặt  '},groupKey);await call('serviceGroup',{name:'  Da   mặt  '},groupKey);
assert.equal(state.ServiceGroup.length,1);assert.equal(state.ServiceGroup[0].name,'Da mặt');
await assert.rejects(call('serviceGroup',{name:'da mặt'}),e=>(e as any).status===409);
state.Service[0].category='Nhóm cũ';await assert.rejects(call('serviceGroup',{name:' NHÓM CŨ '}),e=>(e as any).status===409);
const groupsBefore=clone(state);failModel='ServiceGroup';await assert.rejects(call('serviceGroup',{name:'Rollback group'}),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,groupsBefore);
state.Day[0].status='OPEN';
const createCard=await call('sellCashCard',{...sale,amount:800000});
const inline={customerId,serviceId,total:400000,cashCard:{cardId:createCard.id,amount:300000,additionalAmount:100000,method:'CASH',receivedConfirmation:true}};
const inlineKey=randomUUID(), countBefore=state.Invoice.length, receiptsBefore=state.CashEntry.length;
const created=await call('invoice',inline,inlineKey);await call('invoice',inline,inlineKey);
assert.equal(state.Invoice.length,countBefore+1);assert.equal(state.Invoice.find(v=>v._id===created.id).paid,400000);
assert.equal(state.Invoice.find(v=>v._id===created.id).cardPaid,300000);assert.equal(state.CashCard.find(v=>v._id===createCard.id).balance,500000);
assert.equal(state.CashEntry.length,receiptsBefore+1);assert.equal(state.Payment.at(-1).amount,100000);
for(const model of ['CashCardUse','Payment','Audit']){
  const snapshot=clone(state);failModel=model;await assert.rejects(call('invoice',inline),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,snapshot,'inline creation must roll back '+model);
}
for(const cashCard of [{cardId:createCard.id,amount:600000},{cardId:createCard.id,amount:100000,additionalAmount:400000},{cardId:createCard.id,amount:100000,additionalAmount:100000,method:'CASH',receivedConfirmation:false}]){
  const snapshot=clone(state);await assert.rejects(call('invoice',{...inline,cashCard}));assert.deepEqual(state,snapshot);
}
const foreign=state.CashCard.find(v=>v._id===createCard.id);foreign.customerId='9'.repeat(24);
let snapshot=clone(state);await assert.rejects(call('invoice',inline));assert.deepEqual(state,snapshot);state.CashCard.find(v=>v._id===createCard.id).customerId=customerId;
state.Day[0].status='CLOSED';snapshot=clone(state);await assert.rejects(call('invoice',inline));assert.deepEqual(state,snapshot);state.Day[0].status='OPEN';
await assert.rejects(call('invoice',{...inline,treatmentId:'1'.repeat(24)}),e=>(e as any).status===409);
console.log('Model doubles verified: sale, gift, split payment, retry, concurrent debit and rollback. Not a real MongoDB transaction test.');

// Completed walk-in services credit the selected performer atomically, including card payment.
const performerId='8'.repeat(24);
state.User.push({_id:performerId,spaId,name:'Performer',role:'STAFF',active:true,cashier:false});
state.Service[0].commission=20000;
const completionKey=randomUUID();
const completedInput={customerId,serviceId,total:400000,staffId:performerId};
const completed=await call('invoice',completedInput,completionKey);
await call('invoice',completedInput,completionKey);
const completedInvoice=state.Invoice.find(v=>v._id===completed.id);
assert.equal(String(completedInvoice.performedBy),performerId);
assert.ok(completedInvoice.performedAt);
assert.equal(state.Commission.filter(v=>v.invoiceId===completed.id).length,1);
assert.equal(state.Commission.find(v=>v.invoiceId===completed.id).amount,20000);
await call('completeInvoiceService',{id:completed.id,staffId:performerId});
assert.equal(state.Commission.filter(v=>v.invoiceId===completed.id).length,1);
const beforeCompletionFailure=clone(state);failModel='Commission';
await assert.rejects(call('invoice',completedInput),/INJECTED_LEDGER_FAILURE/);
failModel='';assert.deepEqual(state,beforeCompletionFailure,'commission failure rolls back the new invoice');
state.User.find(v=>v._id===performerId).active=false;
await assert.rejects(call('invoice',completedInput));
state.User.find(v=>v._id===performerId).active=true;
await assert.rejects(call('invoice',{...completedInput,staffId:'7'.repeat(24)}));


// Multi-service checkout is one invoice, one summed performer commission, one card redemption.
const secondServiceId='6'.repeat(24);
state.Service.push({_id:secondServiceId,spaId,name:'Second service',price:150000,active:true,commission:10000});
const bundleInput={customerId,staffId:performerId,items:[{serviceId,total:350000},{serviceId:secondServiceId}]};
const bundleKey=randomUUID(),bundle=await call('serviceInvoice',bundleInput,bundleKey);
await call('serviceInvoice',bundleInput,bundleKey);
const bundleBill=state.Invoice.find(v=>v._id===bundle.id);
assert.equal(bundleBill.total,500000);assert.equal(bundleBill.serviceId,undefined);
assert.equal(bundleBill.serviceItems.length,2);assert.equal(bundleBill.serviceItems[0].total,350000);
assert.equal(bundleBill.serviceItems[1].total,150000);assert.equal(bundleBill.commission,30000);
assert.equal(state.Commission.filter(v=>v.invoiceId===bundle.id).length,1);
assert.equal(state.Commission.find(v=>v.invoiceId===bundle.id).amount,30000);
assert.equal(state.Invoice.filter(v=>v._id===bundle.id).length,1);
state.Service[0].name='Changed catalog';state.Service[0].commission=999;
assert.notEqual(bundleBill.serviceItems[0].name,state.Service[0].name);
assert.equal(bundleBill.serviceItems[0].commission,20000);
for(const items of [[],[{serviceId},{serviceId}], [{serviceId,total:-1}], [{serviceId,total:1_000_000_000_000},{serviceId:secondServiceId,total:1}]]) {
 const before=clone(state);await assert.rejects(call('serviceInvoice',{...bundleInput,items}));assert.deepEqual(state,before);
}
const foreignServiceId='5'.repeat(24);
state.Service.push({_id:foreignServiceId,spaId:'4'.repeat(24),name:'Foreign',price:100,active:true});
await assert.rejects(call('serviceInvoice',{...bundleInput,items:[{serviceId:foreignServiceId}]}));
state.Service.find(v=>v._id===secondServiceId).active=false;
await assert.rejects(call('serviceInvoice',bundleInput));state.Service.find(v=>v._id===secondServiceId).active=true;
await assert.rejects(operate({...actor,id:performerId,role:'STAFF'},'serviceInvoice',bundleInput,randomUUID()),e=>(e as any).status===403);
let bundleBefore=clone(state);failModel='Commission';await assert.rejects(call('serviceInvoice',bundleInput),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,bundleBefore);
const bundleCard=await call('sellCashCard',{...sale,amount:800000});
const bundlePay={...bundleInput,cashCard:{cardId:bundleCard.id,amount:400000,additionalAmount:100000,method:'CASH',receivedConfirmation:true}};
const cardBundleKey=randomUUID(),paidBundle=await call('serviceInvoice',bundlePay,cardBundleKey);await call('serviceInvoice',bundlePay,cardBundleKey);
assert.equal(state.Invoice.find(v=>v._id===paidBundle.id).paid,500000);
assert.equal(state.CashCard.find(v=>v._id===bundleCard.id).balance,400000);
assert.equal(state.CashCardUse.filter(v=>v.invoiceId===paidBundle.id).length,1);
assert.equal(state.Payment.filter(v=>v.invoiceId===paidBundle.id).length,1);
for(const model of ['Payment','Audit']) { bundleBefore=clone(state);failModel=model;await assert.rejects(call('serviceInvoice',bundlePay),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,bundleBefore); }


// Completing a public multi-service visit cannot silently bill only its first service.
const visitId='3'.repeat(24);
state.Appointment=[{_id:visitId,spaId,customerId,serviceId,staffId:performerId,startAt:new Date(Date.now()-60000).toISOString(),status:'CONFIRMED',requestedServices:[{serviceId,name:'First'},{serviceId:secondServiceId,name:'Second'}]}];
let beforeVisit=clone(state);failModel='Commission';
await assert.rejects(call('completeAppointment',{id:visitId}),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,beforeVisit);
await assert.rejects(call('completeAppointment',{id:visitId,total:1}),e=>(e as any).status===409);assert.deepEqual(state,beforeVisit);
const completeVisitKey=randomUUID();const visitResult=await call('completeAppointment',{id:visitId},completeVisitKey);
await call('completeAppointment',{id:visitId},completeVisitKey);
const visitBill=state.Invoice.find(row=>row.appointmentId===visitId);
assert.equal(visitResult.invoiceId,visitBill._id);assert.equal(visitBill.serviceItems.length,2);
assert.equal(visitBill.total,550000);assert.equal(visitBill.commission,10999);
assert.equal(state.Commission.filter(row=>row.invoiceId===visitBill._id).length,1);
assert.equal(state.Commission.find(row=>row.invoiceId===visitBill._id).amount,10999);
assert.equal(state.Appointment[0].status,'COMPLETED');

// Invoice notifications are committed once per created invoice and roll back with its transaction.
const notified = state.ActivityNotification.filter(row=>row.invoiceId===bundle.id);
assert.equal(notified.length,1);assert.equal(notified[0].userId,ownerId);assert.match(notified[0].body,/500/);
const notificationBefore=clone(state);failModel='ActivityNotification';
await assert.rejects(call('serviceInvoice',bundleInput),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,notificationBefore);

assert.ok(/^HD[0-9]{6,}$/.test(bundleBill.code));
assert.equal(new Set(state.Invoice.filter(row=>row.code).map(row=>row.code)).size,state.Invoice.filter(row=>row.code).length);
const sequenceBefore=state.Control[0].invoiceSequence;
await call('serviceInvoice',bundleInput,bundleKey);
assert.equal(state.Control[0].invoiceSequence,sequenceBefore,'idempotent retries never allocate another invoice number');
