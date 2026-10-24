import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { operate } from '../src/lib/operations';
import { ServiceGroup, User, Control, Customer, Invoice, CashEntry, CashCard, CashCardUse, Payment, Day, Audit, Idempotency, Treatment, PackageTemplate, Service } from '../src/lib/models';
import { spaDay } from '../src/lib/rules';
const spaId='a'.repeat(24),ownerId='b'.repeat(24),customerId='c'.repeat(24),serviceId='d'.repeat(24);
const actor={id:ownerId,spaId,name:'Owner',role:'OWNER' as const,cashier:false};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
let state:Record<string,any[]>={};
function match(row:any,filter:any):boolean{return Object.entries(filter).every(([k,v]:any)=>v&&typeof v==='object'&&'$in' in v?v.$in.some((x:any)=>String(x)===String(row[k])):String(row[k])===String(v));}
function doc(name:string,row:any):any{if(!row)return null;return {...clone(row),toObject(){const {toObject,save,...v}=this;return clone(v);},async save(){const i=state[name].findIndex(v=>String(v._id)===String(this._id));state[name][i]=this.toObject();}};}
function query(value:any):any{return {distinct:(key:string)=>query([...new Set((value||[]).map((row:any)=>row[key]).filter(Boolean))]),session:async()=>value,then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};}
let failModel='';
for(const model of [ServiceGroup,User,Control,Customer,Invoice,CashEntry,CashCard,CashCardUse,Payment,Day,Audit,Idempotency,Treatment,PackageTemplate,Service]){
  const name=model.modelName;state[name]=[];
  (model as any).find=(filter:any)=>query(state[name].filter(row=>match(row,filter)));
  (model as any).findOne=(filter:any)=>query(doc(name,state[name].find(row=>match(row,filter))));
  (model as any).exists=(filter:any)=>query(state[name].find(row=>match(row,filter))||null);
  (model as any).findOneAndUpdate=(filter:any)=>query(doc(name,state[name].find(row=>match(row,filter))));
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
console.log('Model doubles verified: sale, gift, split payment, retry, concurrent debit and rollback. Not a real MongoDB transaction test.');
