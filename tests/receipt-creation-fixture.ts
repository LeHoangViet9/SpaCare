import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { allModels, Invoice, Customer, Service, CashEntry, Payment, Day, CashCard, PackageTemplate, Product } from '../src/lib/models';
import { readReport } from '../src/lib/report-read';
import { readWorkspace } from '../src/lib/workspace-read';
import { workspaceQuery } from '../src/lib/workspace-query';
import { operate } from '../src/lib/operations';
import { spaDay } from '../src/lib/rules';

// In-memory model doubles only. Any attempt to open a database connection fails.
function clone(value:any):any{
  if(value instanceof mongoose.Types.ObjectId)return String(value);
  if(value instanceof Date)return new Date(value);
  if(Array.isArray(value))return value.map(clone);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clone(item)]));
  return value;
}
const spaId = 'a'.repeat(24), ownerId = 'b'.repeat(24);
const actor = { id: ownerId, spaId, name: 'Synthetic owner', role: 'OWNER' as const, cashier: false };
const today = spaDay();
const oldDay = new Date(new Date(today + 'T12:00:00+07:00').getTime() - 86400000).toISOString().slice(0, 10);
const state: Record<string, any[]> = {};
let failCreate='';
let failPaymentAudit=false;
const equal = (a: any, b: any) => a == null || b == null ? a == b : String(a) === String(b);
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: any) => {
    if (key === '$expr') return !!expression(value, row);
    if (key === '$and') return value.every((part: any) => matches(row, part));
    if (key === '$or') return value.some((part: any) => matches(row, part));
    if (key === '$nor') return !value.some((part: any) => matches(row, part));
    if (!value || typeof value !== 'object' || value instanceof mongoose.Types.ObjectId || value instanceof Date) return equal(row[key], value);
    return Object.entries(value).every(([op, expected]: any) => {
      switch (op) {
        case '$ne': return !equal(row[key], expected);
        case '$exists': return (row[key] !== undefined) === expected;
        case '$in': return expected.some((v: any) => equal(row[key], v));
        case '$gte': return expected instanceof Date ? new Date(row[key]) >= expected : row[key] >= expected;
        case '$gt': return row[key]>expected;
        case '$lte': return row[key] <= expected;
        case '$lt': return expected instanceof Date ? new Date(row[key]) < expected : row[key] < expected;
        default: assert.fail('Unsupported fixture predicate: ' + op);
      }
    });
  });
}
function expression(value: any, row: any): any {
  if (typeof value === 'string' && value.startsWith('$')) return row[value.slice(1)];
  if (!value || typeof value !== 'object') return value;
  if ('$subtract' in value) return expression(value.$subtract[0], row)-expression(value.$subtract[1], row);
  if ('$gt' in value) return expression(value.$gt[0], row)>expression(value.$gt[1], row);
  if ('$ifNull' in value) return expression(value.$ifNull[0], row) ?? expression(value.$ifNull[1], row);
  if ('$dateToString' in value) return spaDay(new Date(expression(value.$dateToString.date, row)));
  if ('$eq' in value) return equal(expression(value.$eq[0], row), expression(value.$eq[1], row));
  if ('$cond' in value) return expression(value.$cond[expression(value.$cond[0], row) ? 1 : 2], row);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expression(v, row)]));
}
function aggregate(rows: any[], pipeline: any[]) {
  for (const stage of pipeline) {
    if (stage.$match) rows = rows.filter(row => matches(row, stage.$match));
    else if (stage.$group) {
      const groups = new Map<string, any>();
      for (const row of rows) {
        const id = expression(stage.$group._id, row), key = JSON.stringify(id);
        const group = groups.get(key) || { _id: id };
        for (const [field, accumulator] of Object.entries(stage.$group) as any) {
          if (field === '_id') continue;
          assert.ok('$sum' in accumulator);
          group[field] = (group[field] || 0) + (expression(accumulator.$sum, row) || 0);
        }
        groups.set(key, group);
      }
      rows = [...groups.values()];
    } else if (stage.$unionWith) {
      const model = allModels.find(model => model.collection.name === stage.$unionWith.coll)!;
      assert.ok(model);
      rows = rows.concat(aggregate(clone(state[model.modelName]), stage.$unionWith.pipeline));
    } else if (stage.$sort) rows.sort((a, b) => String(a._id).localeCompare(String(b._id)));
    else assert.fail('Unsupported fixture aggregation stage');
  }
  return rows;
}
function document(name: string, row: any): any {
  if (!row) return null;
  const data=clone(row);
  for(const field of ['createdAt','updatedAt','earnedAt'])if(data[field])data[field]=new Date(data[field]);
  return { ...data, toObject() { const { save, toObject, ...data } = this; return clone(data); },
    async save(options: any) { assert.ok(options.session); this.updatedAt=new Date(Date.now()+1); state[name][state[name].findIndex(v => equal(v._id, row._id))] = this.toObject(); } };
}
function query(value: any, filter: any): any {
  const q: any = { then: (ok: any, fail: any) => Promise.resolve(value).then(ok, fail), cast: () => filter };
  for (const key of ['select', 'sort', 'skip', 'limit', 'lean', 'session']) q[key] = () => q;
  return q;
}
for (const model of allModels) {
  const name = model.modelName, m = model as any;
  state[name] = [];
  m.find = (filter: any) => query(state[name].filter(row => matches(row, filter)).map(row => document(name, row)), filter);
  m.findOne = (filter: any) => query(document(name, state[name].find(row => matches(row, filter))), filter);
  m.exists = (filter:any) => query(state[name].find(row=>matches(row,filter)) || null,filter);
  m.countDocuments = (filter: any) => Promise.resolve(state[name].filter(row => matches(row, filter)).length);
  m.aggregate = async (pipeline: any[]) => aggregate(clone(state[name]), pipeline);
  m.findOneAndUpdate = (filter: any, update: any) => {
    const row = state[name].find(row => matches(row, filter));
    if (row) for (const [key, value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + Number(value);
    return query(document(name, row), filter);
  };
  m.updateOne = async (filter:any,update:any,options:any)=>{assert.ok(options.session);const row=state[name].find(row=>matches(row,filter));assert.ok(row);Object.assign(row,clone(update.$set));return {matchedCount:1};};
  m.updateMany = async (_filter: any, _update: any, options: any) => { assert.ok(options.session); return { matchedCount: 0 }; };
  m.create = async (rows: any[], options: any) => {
    assert.ok(options.session);
    if(failCreate===name)throw Error('INJECTED_'+name);
    if(failPaymentAudit&&name==='Audit'&&rows[0]?.action==='payment')throw Error('INJECTED_PAYMENT_AUDIT');
    const result=[];
    for(const row of rows){const instance=new model({...row,createdAt:row.createdAt||new Date(),updatedAt:new Date()});await instance.validate();const data=JSON.parse(JSON.stringify(instance.toObject()));state[name].push(data);result.push(document(name,data));}
    return result;
  };

}
(mongoose as any).connect = () => assert.fail('This fixture must never connect to MongoDB');
(mongoose.connection as any).readyState = 1;
(mongoose.connection as any).transaction = async (callback: any) => {
  const before = clone(state);
  try { return await callback({ fixture: true }); }
  catch (error) { for (const key of Object.keys(state)) state[key] = before[key]; throw error; }
};
const objectId=()=>String(new mongoose.Types.ObjectId());
process.env.MONGODB_URI='mongodb://127.0.0.1:1/spacare_test';
function add(model:any,values:any){const row={_id:objectId(),spaId,createdAt:new Date(),updatedAt:new Date(),...values};state[model.modelName].push(row);return row;}
function setup(){
  for(const name of Object.keys(state))state[name]=[];
  state.User.push({_id:ownerId,spaId,name:actor.name,role:'OWNER',active:true});
  state.Control.push({_id:objectId(),spaId,revision:0});
  const customer=add(Customer,{name:'Synthetic customer'}),service=add(Service,{name:'Synthetic service',price:300000,commission:0,active:true});
  add(Day,{day:oldDay,status:'OPEN',opening:0,revision:0});add(Day,{day:today,status:'OPEN',opening:0,revision:0});
  return {customer,service};
}
const call=(action:string,data:any,key=randomUUID())=>operate(actor,action,data,key);
const payment=(amount:number,receivedOn=oldDay,method='CASH')=>({amount,method,receivedOn,receivedConfirmation:true});
const q=(section:string,day=today)=>workspaceQuery(new URLSearchParams({section,from:day,to:day}));
async function check(oldIn:number,todayIn:number,debt=0){
  assert.equal((await readReport(actor,q('reports',oldDay))).inflow,oldIn);
  assert.equal((await readReport(actor,q('reports'))).inflow,todayIn);
  const overview=await readWorkspace(actor,q('overview'));assert.equal(overview.totals.inflow,todayIn);assert.equal(overview.totals.debt,debt);
  for(const [day,amount]of [[oldDay,oldIn],[today,todayIn]] as const){
    const ledger=await readWorkspace(actor,q('cash',day));assert.deepEqual(ledger.pages.cash.summary,{incoming:amount,outgoing:0});
  }
}
for(const receivedOn of [oldDay,today]){
  const {customer,service}=setup();
  const input={customerId:customer._id,serviceId:service._id,total:300000,issuedOn:oldDay,payments:[payment(300000,receivedOn)]},key=randomUUID();
  const result=await call('invoice',input,key);assert.deepEqual(await call('invoice',input,key),result);
  assert.equal(state.Invoice.length,1);assert.equal(state.Payment.length,1);assert.equal(state.CashEntry.length,1);
  assert.equal(spaDay(new Date(state.Invoice[0].createdAt)),oldDay);
  assert.equal(state.CashEntry[0].day,receivedOn);assert.equal(spaDay(new Date(state.CashEntry[0].createdAt)),today);
  assert.equal(state.Invoice[0].paid,300000);assert.equal(state.Invoice[0].status,'PAID');
  assert.equal(state.Day.find(row=>row.day===receivedOn).revision,1);
  await check(receivedOn===oldDay?300000:0,receivedOn===today?300000:0);
  assert.ok(state.Audit.some(row=>row.action==='payment'&&row.details.receivedOn===receivedOn));
  // Changing the invoice date later cannot move the original receipt.
  const sources=clone([state.Payment,state.CashEntry]);
  await call('correctInvoiceDate',{id:result.id,expectedUpdatedAt:new Date(state.Invoice[0].updatedAt).toISOString(),issuedOn:today,reason:'Invoice date only'});
  assert.deepEqual([state.Payment,state.CashEntry],sources);
}
let source=setup();state.Day[0].status='CLOSED';const closed=clone(state.Day[0]);
let input={customerId:source.customer._id,serviceId:source.service._id,total:300000,issuedOn:oldDay};
let result=await call('invoice',input);await check(0,0,300000);
assert.equal(state.CashEntry.length,0);assert.equal(state.Payment.length,0);assert.deepEqual(state.Day[0],closed);
// Installments recorded later keep their explicit individual receipt days.
state.Day[0].status='OPEN';
await call('payment',{invoiceId:result.id,...payment(100000)});
const installmentKey=randomUUID(),installment={invoiceId:result.id,...payment(200000,today)};
await call('payment',installment,installmentKey);await call('payment',installment,installmentKey);
await check(100000,200000);assert.equal(state.Payment.length,2);

// Only the actual receipt day needs an open book; today's CLOSED book is untouched.
source=setup();state.Day[1].status='CLOSED';const todaySnapshot=clone(state.Day[1]);
await call('invoice',{customerId:source.customer._id,serviceId:source.service._id,total:300000,issuedOn:oldDay,payments:[payment(300000)]});
await check(300000,0);assert.deepEqual(state.Day[1],todaySnapshot);

source=setup();input={customerId:source.customer._id,serviceId:source.service._id,total:300000,issuedOn:oldDay};
result=await call('invoice',{...input,payments:[payment(100000),payment(200000,today,'BANK_TRANSFER')]});
await check(100000,200000);assert.deepEqual(state.CashEntry.map(row=>[row.day,row.amount,row.method]),[[oldDay,100000,'CASH'],[today,200000,'BANK_TRANSFER']]);
await call('closeDay',{day:oldDay,counted:100000,expectedPreview:100000});
await call('closeDay',{day:today,counted:0,expectedPreview:0});
assert.equal(state.Day[0].expected,100000);assert.equal(state.Day[1].bankNet,200000);

for(const condition of ['old-closed','today-closed','missing-book','foreign-book','future','invalid','missing-date','no-confirmation','overpaid','audit-failure']){
  source=setup();const payments=[payment(100000),payment(200000,today,'BANK_TRANSFER')];
  if(condition==='old-closed')Object.assign(state.Day[0],{status:'CLOSED',expected:0,counted:0,difference:0});
  if(condition==='today-closed')Object.assign(state.Day[1],{status:'CLOSED',expected:0,counted:0,difference:0});
  if(condition==='missing-book')state.Day.splice(0,1);
  if(condition==='foreign-book')state.Day[0].spaId=objectId();
  if(condition==='future')payments[0].receivedOn=spaDay(new Date(Date.now()+86400000));
  if(condition==='invalid')payments[0].receivedOn='2026-02-30';
  if(condition==='missing-date')delete (payments[0] as any).receivedOn;
  if(condition==='no-confirmation')payments[0].receivedConfirmation=false;
  if(condition==='overpaid')payments[0].amount=300000;
  if(condition==='audit-failure')failPaymentAudit=true;
  const before=clone(state);
  await assert.rejects(call('invoice',{customerId:source.customer._id,serviceId:source.service._id,total:300000,issuedOn:oldDay,payments}));
  failCreate='';failPaymentAudit=false;assert.deepEqual(state,before,condition+' rolls back invoice, receipts, audit and day revisions');
}
// Payment without the new field retains the legacy current-day behavior.
source=setup();result=await call('invoice',{customerId:source.customer._id,serviceId:source.service._id,total:300000,issuedOn:oldDay});
await call('payment',{invoiceId:result.id,amount:300000,method:'CASH',receivedConfirmation:true});await check(0,300000);
// Inline card debit is not cash; only its actual extra receipt has a receipt day.
source=setup();const card=add(CashCard,{customerId:source.customer._id,amount:200000,balance:200000,origin:'PURCHASE'});
await call('invoice',{customerId:source.customer._id,serviceId:source.service._id,total:300000,issuedOn:oldDay,cashCard:{cardId:card._id,amount:200000,additionalAmount:100000,method:'CASH',receivedConfirmation:true,receivedOn:oldDay}});
await check(100000,0);assert.equal(state.CashEntry.length,1);assert.equal(state.Invoice[0].paid,300000);
// Checkout passes its own receipt list once to the resulting invoice.
source=setup();await call('checkout',{customerId:source.customer._id,issuedOn:oldDay,actions:[{action:'invoice',data:{serviceId:source.service._id,total:300000}}],payments:[payment(300000)]});
await check(300000,0);assert.equal(state.Payment.length,1);
// Package creation uses the same path without duplicating the purchase invoice.
source=setup();const template=add(PackageTemplate,{serviceId:source.service._id,name:'Synthetic package',totalSessions:5,price:300000,active:true});
await call('sellPackage',{customerId:source.customer._id,templateId:template._id,issuedOn:oldDay,payments:[payment(300000)]});
await check(300000,0);assert.equal(state.Invoice.length,1);assert.equal(state.Payment.length,1);
// Other creation entry points share the same atomic day handling.
source=setup();await call('serviceInvoice',{customerId:source.customer._id,items:[{serviceId:source.service._id,performerId:ownerId,total:300000}],issuedOn:oldDay,payments:[payment(300000)]});await check(300000,0);
for(const isClosed of [false,true]){
  source=setup();const product=add(Product,{name:'Synthetic product',sku:'RECEIPT-TEST',unit:'chai',price:300000,stock:5,active:true});
  if(isClosed)state.Day[0].status='CLOSED';
  const input={customerId:source.customer._id,items:[{productId:product._id,quantity:1,unitPrice:300000}],issuedOn:oldDay,payments:[payment(300000)]};
  if(isClosed){const before=clone(state);await assert.rejects(call('productInvoice',input));assert.deepEqual(state,before);}
  else{await call('productInvoice',input);await check(300000,0);assert.equal(state.Product[0].stock,4);}
}
