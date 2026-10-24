import { hashPassword } from '../src/lib/password';
import { parseOpening, inspectOpening, writeOpening, openingSummary, checkOpeningTarget } from '../src/lib/opening-balances';
import { packageLabel, nextSessionNumber } from '../src/lib/treatment-rules';
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
function query(value:any):any{return {sort:()=>query(value),select:()=>query(value),lean:()=>query(value),distinct:(key:string)=>query([...new Set((value||[]).map((row:any)=>row[key]).filter(Boolean))]),session:()=>query(value),then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};}
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

const password='test-only-password-2026';state.User[0].phone='0900000000';state.User[0].passwordHash=hashPassword(password);
const identity={phone:'0900000000',password};
const raw={version:1,targetDatabase:'spacare_test',confirmations:{treatmentsFullyPaid:true,cosmeticsDebtSeparate:true},customers:[{name:'Opening customer',phone:'0900000001',sourceStartDate:'2024-01-07',treatments:[{serviceName:'Service',remaining:8,historicalPaymentStatus:'FULLY_PAID',createNewReceipt:false}],cashCard:{sourceLabel:'Historical mixed card',remainingVnd:2200000},debt:{sourceLabel:'Historical cosmetics debt',outstandingVnd:7000000}}]};
const input=parseOpening(raw);assert.equal(openingSummary(input).remainingSessions,8);
assert.throws(()=>parseOpening({...raw,customers:[raw.customers[0],raw.customers[0]]}));
assert.throws(()=>parseOpening({...raw,customers:[{...raw.customers[0],sourceStartDate:'2026-02-30'}]}));
assert.throws(()=>parseOpening({...raw,confirmations:{treatmentsFullyPaid:false,cosmeticsDebtSeparate:true}}));
assert.throws(()=>checkOpeningTarget('mongodb://127.0.0.1/spacare_live','spacare_test'));checkOpeningTarget('mongodb://127.0.0.1/spacare_test','spacare_test');
assert.throws(()=>checkOpeningTarget('mongodb+srv://example-user:example-pass@CLUSTER.mongodb.net/spacare_live','spacare_live'),/hostname mẫu/);
assert.throws(()=>checkOpeningTarget('https://example.test/spacare_live','spacare_live'));
const batch='fixture-opening-20261024';let report=await inspectOpening(state.User[0],input);assert.deepEqual(report.errors,[]);
assert.ok((await inspectOpening(state.User[0],input,{'Service':'1'.repeat(24)})).errors.length);
await assert.rejects(writeOpening({...identity,password:'wrong'},input,{},report.approval,batch));
await assert.rejects(writeOpening(identity,input,{},'wrong approval',batch));
for(const model of ['Treatment','CashCard','Invoice','Audit','Idempotency']){const before=clone(state);failModel=model;await assert.rejects(writeOpening(identity,input,{},report.approval,batch),/INJECTED_LEDGER_FAILURE/);failModel='';assert.deepEqual(state,before,'opening batch rolls back '+model);}
const result=await writeOpening(identity,input,{},report.approval,batch);await writeOpening(identity,input,{},report.approval,batch);
assert.equal(state.Treatment.length,1);assert.equal(state.Invoice.length,2);assert.equal(state.CashCard.length,1);assert.equal(state.CashCard[0].balance,2200000);assert.equal(state.CashCard[0].origin,'OPENING');
assert.equal(state.Payment.length,0);assert.equal(state.CashEntry.length,0);assert.equal(state.CashCardUse.length,0);
assert.equal(state.Invoice.find(i=>i.kind==='PACKAGE').total,0);assert.equal(state.Invoice.find(i=>i.kind==='PACKAGE').status,'PAID');assert.equal(state.Invoice.find(i=>i.kind==='PRODUCT').total,7000000);
assert.equal(state.Treatment[0].totalSessions,undefined);assert.equal(nextSessionNumber(state.Treatment[0]),1);assert.match(packageLabel(state.Treatment[0]),/8 buổi chuyển/);assert.equal(state.Treatment[0].expiresOn,undefined);
assert.equal(result.created.customers.length,1);
const altered=clone(raw);altered.customers[0].treatments[0].remaining=9;await assert.rejects(writeOpening(identity,altered,{},report.approval,batch),e=>(e as any).status===409);
report=await inspectOpening(state.User[0],input);assert.ok(report.errors.length>=3,'existing entitlement, card and debt require reconciliation');
state.Customer.find(v=>v.phone==='0900000001').name='Other name';assert.ok((await inspectOpening(state.User[0],input)).errors.some(e=>e.includes('khác tên')));

const blankPhones=parseOpening({...raw,customers:[
 {...raw.customers[0],name:'Blank phone one',phone:'',cashCard:undefined,debt:undefined,treatments:[{...raw.customers[0].treatments[0],benefitNote:'Kèm mặt nạ',gift:true}]},
 {...raw.customers[0],name:'Blank phone two',phone:undefined,cashCard:undefined,debt:undefined}
]});
assert.equal(blankPhones.customers[0].phone,undefined);assert.equal(blankPhones.customers[1].phone,undefined);
assert.throws(()=>parseOpening({...raw,customers:[{...raw.customers[0],name:'Same blank',phone:''},{...raw.customers[0],name:' SAME BLANK ',phone:null}]}));
const blankReport=await inspectOpening(state.User[0],blankPhones);assert.deepEqual(blankReport.errors,[]);
await writeOpening(identity,blankPhones,{},blankReport.approval,'fixture-blank-phone-batch');
const blank=state.Customer.find(c=>c.name==='Blank phone one');assert.equal(blank.phone,undefined);
assert.equal(state.Customer.find(c=>c.name==='Blank phone two').phone,undefined);
const blankTreatment=state.Treatment.find(t=>t.customerId===blank._id);assert.match(blankTreatment.name,/Kèm mặt nạ/);assert.match(blankTreatment.name,/Buổi được tặng/);
assert.ok((await inspectOpening(state.User[0],blankPhones)).errors.some(e=>e.includes('thiếu SĐT')));
console.log('Opening balances: validation, same-spa matching, historical settlement, replay, stale approval, conflict and full rollback verified with model doubles.');
