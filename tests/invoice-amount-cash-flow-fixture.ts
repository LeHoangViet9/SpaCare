import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { allModels, Invoice, Customer, Service, CashEntry, Payment, Day, SaleCommission } from '../src/lib/models';
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
  m.updateMany = async (_filter: any, _update: any, options: any) => { assert.ok(options.session); return { matchedCount: 0 }; };
  m.create = async (rows: any[], options: any) => {
    assert.ok(options.session);
    if(failCreate===name)throw Error('INJECTED_'+name);
    const result=[];
    for(const row of rows){const instance=new model({...row,createdAt:new Date(),updatedAt:new Date()});await instance.validate();const data=JSON.parse(JSON.stringify(instance.toObject()));state[name].push(data);result.push(document(name,data));}
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
function setup(received:number,closed=false){
  for(const key of Object.keys(state))state[key]=[];
  state.User.push({_id:ownerId,spaId,name:actor.name,role:'OWNER',active:true});
  state.Control.push({_id:objectId(),spaId,revision:0});
  const customer=add(Customer,{name:'Synthetic customer'}),service=add(Service,{name:'Synthetic service',price:30000,active:true});
  const book=add(Day,{day:oldDay,status:closed?'CLOSED':'OPEN',opening:0,expected:received,bankNet:0,counted:received,difference:0,revision:1});
  add(Day,{day:today,status:'OPEN',opening:0});
  // Deliberate historical fixture: receipt evidence already exists independently
  // of the mistyped invoice total. The payment API cannot create this overpayment.
  const invoice=add(Invoice,{customerId:customer._id,serviceId:service._id,kind:'SERVICE',description:'Mistyped invoice',total:30000,paid:received,refunded:0,status:'PAID',createdAt:new Date(oldDay+'T12:00:00+07:00')});
  const receipt=add(CashEntry,{customerId:customer._id,actorId:ownerId,amount:received,method:'CASH',direction:'IN',kind:'PAYMENT',day:oldDay,reversed:false});
  add(Payment,{invoiceId:invoice._id,receiptId:receipt._id,amount:received,reversed:false});
  return {invoice,receipt,book};
}
const call=(action:string,data:any,key=randomUUID())=>operate(actor,action,data,key);
const makeQuery=(section:string,from=oldDay,to=today)=>workspaceQuery(new URLSearchParams({section,from,to}));
async function correct(invoice:any){
  const data={id:invoice._id,expectedUpdatedAt:invoice.updatedAt.toISOString(),mode:'CORRECT',total:300000,reason:'Correct amount without collecting money'};
  const preview=await call('previewInvoiceAdjustment',data);
  assert.deepEqual(preview.reconciliation.cashImpact,{incoming:0,outgoing:0,directReceived:invoice.paid});
  const key=randomUUID(),payload={...data,confirmed:true,expectedPreview:preview.previewToken};
  const result=await call('applyInvoiceAdjustment',payload,key);
  assert.deepEqual(await call('applyInvoiceAdjustment',payload,key),result);
  assert.equal(state.InvoiceAdjustment.length,1);
  const adjustment=state.InvoiceAdjustment[0];
  assert.equal(String(adjustment.invoiceId),invoice._id);
  assert.equal(adjustment.before.total,30000);assert.equal(adjustment.after.total,300000);
  assert.equal(state.Audit.filter(row=>row.action==='correctInvoice').length,1);
}
async function check(incomingYesterday:number,incomingToday:number,debt:number){
  for(const [day,expected]of [[oldDay,incomingYesterday],[today,incomingToday]] as const){
    const report=await readReport(actor,makeQuery('reports',day,day));
    assert.equal(report.inflow,expected,day+' report');
    const ledger=await readWorkspace(actor,makeQuery('cash',day,day));
    assert.deepEqual(ledger.pages.cash.summary,{incoming:expected,outgoing:0},day+' ledger');
  }
  const overview=await readWorkspace(actor,makeQuery('overview'));
  assert.equal(overview.totals.inflow,incomingToday);assert.equal(overview.totals.debt,debt);
  const report=await readReport(actor,makeQuery('reports'));
  assert.equal(report.inflow,incomingYesterday+incomingToday);assert.equal(report.summary.debt,debt);
  const books=await readWorkspace(actor,makeQuery('days'));
  assert.equal(books.days.find((row:any)=>row.day===today)!.liveExpected,incomingToday);
  return books;
}
// 1. Existing real receipt 300k yesterday; correct only 30k -> 300k today.
for(const closed of [false,true]){
  const {invoice,receipt,book}=setup(300000,closed),history=clone([state.CashEntry,state.Payment]),snapshot=clone(book);
  await correct(invoice);assert.equal(state.Invoice[0].paid,300000);assert.equal(state.Invoice[0].status,'PAID');
  assert.deepEqual([state.CashEntry,state.Payment],history);assert.deepEqual(state.Day[0],snapshot);
  await check(300000,0,0);
  // Existing financial-revision guard must fail atomically, never double-return money.
  const before=clone(state);
  await assert.rejects(call('reverseCash',{id:receipt._id,reason:'Cannot reverse reconciled financial history'}),(e:any)=>e.status===409);
  assert.deepEqual(state,before);
  await call('closeDay',{day:today,counted:0,expectedPreview:0});
  assert.equal(state.Day[1].expected,0);assert.deepEqual(state.Day[0],snapshot);
  assert.equal(state.CashEntry.length,1);
  if(closed)assert.equal(state.InvoiceAdjustment[0].reconciliation.receipts[0].day,oldDay);
}
// 2. Only 30k recorded: no evidence of any additional money. Keep 270k debt.
let seeded=setup(30000);await correct(seeded.invoice);await check(30000,0,270000);
assert.equal(state.Payment.length,1);assert.equal(state.CashEntry.length,1);
// 3. Only an explicit, real additional collection creates 270k today; retry once.
const payment={invoiceId:seeded.invoice._id,amount:270000,method:'CASH',receivedConfirmation:true};
const key=randomUUID();await call('payment',payment,key);await call('payment',payment,key);
await check(30000,270000,0);
assert.equal(state.Payment.length,2);assert.deepEqual(state.CashEntry.map(row=>[row.day,row.amount]),[[oldDay,30000],[today,270000]]);
await call('closeDay',{day:today,counted:270000,expectedPreview:270000});assert.equal(state.Day[1].expected,270000);
// Missing or inconsistent historical evidence must fail without writing anything.
for(const kind of ['mismatch','missing-day','invalid-day','missing-payment']){
  seeded=setup(300000);if(kind==='mismatch')state.Invoice[0].paid=30000;
  if(kind==='missing-day')delete state.CashEntry[0].day;
  if(kind==='invalid-day')state.CashEntry[0].day='2026-02-30';
  if(kind==='missing-payment')state.Payment=[];
  const before=clone(state);
  await assert.rejects(call('previewInvoiceAdjustment',{id:seeded.invoice._id,expectedUpdatedAt:seeded.invoice.updatedAt.toISOString(),mode:'CORRECT',total:300000,reason:'Insufficient evidence'}),(e:any)=>e.status===409);
  assert.deepEqual(state,before);
}
// The ordinary creation/payment route cannot record 300k against a 30k invoice.
seeded=setup(0);const before=clone(state);
await assert.rejects(call('payment',{invoiceId:seeded.invoice._id,amount:300000,method:'CASH',receivedConfirmation:true}),/vượt công nợ/);
assert.deepEqual(state,before);

// Explicit correction of an existing receipt, as opposed to changing invoice total.
function correctionData(amount:number,day=oldDay){
  return {id:state.Invoice[0]._id,expectedUpdatedAt:new Date(state.Invoice[0].updatedAt).toISOString(),mode:'CORRECT',total:300000,paid:amount,
    reason:'Verified original receipt entry was wrong',receiptCorrections:[{paymentId:state.Payment[0]._id,amount,day}]};
}
async function applyCorrection(data:any){
  const preview=await call('previewInvoiceAdjustment',data),payload={...data,confirmed:true,expectedPreview:preview.previewToken},key=randomUUID();
  const result=await call('applyInvoiceAdjustment',payload,key);assert.deepEqual(await call('applyInvoiceAdjustment',payload,key),result);
  return preview;
}
seeded=setup(30000);state.Invoice[0].total=300000;state.Invoice[0].status='PARTIALLY_PAID';
const originalReceipt=clone(state.CashEntry[0]),originalPayment=clone(state.Payment[0]);
let data=correctionData(300000),preview=await call('previewInvoiceAdjustment',data);
assert.equal(preview.after.paid,300000);assert.equal(preview.after.status,'PAID');
assert.deepEqual(preview.reconciliation.receiptChanges,[{paymentId:originalPayment._id,receiptId:originalReceipt._id,method:'CASH',before:{amount:30000,day:oldDay},after:{amount:300000,day:oldDay}}]);
const beforeFailure=clone(state);failCreate='Audit';
await assert.rejects(call('applyInvoiceAdjustment',{...data,confirmed:true,expectedPreview:preview.previewToken}),/INJECTED_Audit/);failCreate='';
assert.deepEqual(state,beforeFailure,'receipt, payment, day revisions and invoice roll back if audit fails');
await applyCorrection(data);await check(300000,0,0);
assert.equal(state.Payment.length,1);assert.equal(state.CashEntry.length,1);
assert.equal(state.CashEntry[0]._id,originalReceipt._id);assert.deepEqual(state.CashEntry[0].createdAt,originalReceipt.createdAt);
assert.deepEqual(state.InvoiceAdjustment[0].reconciliation.receipts[0].amount,30000);
assert.equal(state.InvoiceAdjustment[0].actorId,ownerId);assert.ok(state.InvoiceAdjustment[0].createdAt);
assert.equal(state.Audit.find(row=>row.action==='correctInvoice').details.reconciliation.receiptChanges[0].after.amount,300000);
assert.equal(state.Day[0].revision,2);assert.equal(state.Day[1].revision,undefined,'no touching today when correcting yesterday');
for(const amount of [100000,200000,0]){
  await applyCorrection(correctionData(amount));await check(amount,0,300000-amount);
  assert.equal(state.Invoice[0].status,amount===0?'OPEN':'PARTIALLY_PAID');
}
assert.equal(state.InvoiceAdjustment.length,4);assert.equal(state.CashEntry.length,1);
assert.equal(String(state.InvoiceAdjustment[1].previousAdjustmentId),String(state.InvoiceAdjustment[0]._id));
// Reject overpayment rather than inventing deposit/credit or an off-ledger receipt.
for(const bad of [correctionData(300001),{...correctionData(100000),paid:99999},{...correctionData(100000),receiptCorrections:undefined},
  {...correctionData(100000),receiptCorrections:[{paymentId:objectId(),amount:100000,day:oldDay}]}]){
  const before=clone(state);await assert.rejects(call('previewInvoiceAdjustment',bad),(e:any)=>e.status===409);assert.deepEqual(state,before);
}
// Multiple receipts have independent amounts/dates, including moving a mistyped day.
seeded=setup(30000);state.Invoice[0].total=300000;state.Invoice[0].paid=50000;
const secondReceipt=add(CashEntry,{customerId:seeded.invoice.customerId,actorId:ownerId,amount:20000,method:'BANK_TRANSFER',direction:'IN',kind:'PAYMENT',day:today,reversed:false});
const secondPayment=add(Payment,{invoiceId:seeded.invoice._id,receiptId:secondReceipt._id,amount:20000,reversed:false});
data={...correctionData(100000),paid:300000,receiptCorrections:[{paymentId:state.Payment[0]._id,amount:100000,day:oldDay},{paymentId:secondPayment._id,amount:200000,day:oldDay}]};
await applyCorrection(data);await check(300000,0,0);
assert.deepEqual(state.CashEntry.map(row=>[row.day,row.amount]),[[oldDay,100000],[oldDay,200000]]);
assert.equal(state.InvoiceAdjustment.length,1);assert.equal(state.InvoiceAdjustment[0].reconciliation.receiptChanges.length,2);
assert.equal(state.Day[0].revision,2);assert.equal(state.Day[1].revision,1);
const afterCorrection=clone(state);
await assert.rejects(call('reverseCash',{id:secondReceipt._id,reason:'Keep existing financial revision guard'}),(e:any)=>e.status===409);assert.deepEqual(state,afterCorrection);
await call('closeDay',{day:today,counted:0,expectedPreview:0});
await call('closeDay',{day:oldDay,counted:100000,expectedPreview:100000});
assert.equal(state.Day[0].expected,100000);assert.equal(state.Day[0].bankNet,200000);assert.equal(state.Day[1].expected,0);
// CLOSED source or destination, including closure after preview, always fails atomically.
for(const closedTarget of ['old','new','after-preview']){
  seeded=setup(30000);state.Invoice[0].total=300000;data=correctionData(300000,today);
  if(closedTarget==='after-preview')preview=await call('previewInvoiceAdjustment',data);
  const day=state.Day[closedTarget==='new'?1:0];Object.assign(day,{status:'CLOSED',expected:30000,counted:30000,difference:0});
  const before=clone(state);
  await assert.rejects(call(closedTarget==='after-preview'?'applyInvoiceAdjustment':'previewInvoiceAdjustment',closedTarget==='after-preview'?{...data,confirmed:true,expectedPreview:preview.previewToken}:data),(e:any)=>e.status===409);
  assert.deepEqual(state,before);
}
// Ordinary reversal before correction excludes the original payment; correction cannot resurrect it.
seeded=setup(30000);state.Invoice[0].total=300000;
const reversedPaymentId=state.Payment[0]._id;
await call('reverseCash',{id:seeded.receipt._id,reason:'Original receipt entered by mistake'});
await check(0,0,300000);
const beforeReversed=clone(state);
await assert.rejects(call('previewInvoiceAdjustment',{...correctionData(300000),receiptCorrections:[{paymentId:reversedPaymentId,amount:300000,day:oldDay}]}),(e:any)=>e.status===409);
assert.deepEqual(state,beforeReversed);

// Package commissions follow corrected received money using linked compensation,
// rather than mutating the original commission or its source identity.
seeded=setup(30000);
Object.assign(state.Invoice[0],{total:300000,kind:'PACKAGE',saleCommissionVersion:1,saleCommissionAccrued:1500,sellerId:ownerId,sellerName:actor.name,
  packageItems:[{serviceId:seeded.invoice.serviceId,sellerId:ownerId,total:300000}]});
const commission=add(SaleCommission,{invoiceId:seeded.invoice._id,staffId:ownerId,staffName:actor.name,serviceId:seeded.invoice.serviceId,amount:1500,sourceType:'PAYMENT',sourceId:state.Payment[0]._id,earnedAt:new Date()});
for(const [amount,target]of [[300000,15000],[100000,5000]]){
  await applyCorrection(correctionData(amount));
  assert.equal(state.Invoice[0].saleCommissionAccrued,target);
  assert.equal(state.SaleCommission[0].amount,1500);
  assert.equal(state.SaleCommission[0]._id,commission._id);
  assert.equal(state.SaleCommission[0].amount+state.SharedSaleCommission.reduce((sum,row)=>sum+row.amount,0),target);
}
state.Invoice[0].serviceItems=[{serviceId:seeded.invoice.serviceId,total:10000}];
let immutable=clone(state);
await assert.rejects(call('previewInvoiceAdjustment',correctionData(200000)),(e:any)=>e.status===409);assert.deepEqual(state,immutable);

for(const condition of ['staff','inactive','shared','foreign','future','line-allocation','refunded','replaced']){
  seeded=setup(30000);state.Invoice[0].total=300000;
  if(condition==='staff')Object.assign(state.User[0],{role:'STAFF',cashier:true});
  if(condition==='inactive')state.User[0].active=false;
  if(condition==='shared')add(Payment,{invoiceId:objectId(),receiptId:seeded.receipt._id,amount:30000,reversed:false});
  if(condition==='foreign')state.CashEntry[0].spaId=objectId();
  if(condition==='line-allocation')state.Payment[0].lineAllocations=[{lineId:objectId(),amount:30000}];
  if(condition==='refunded'){state.Invoice[0].refunded=10000;}
  if(condition==='replaced')state.Invoice[0].activeDocumentId=objectId();
  const data=correctionData(300000,condition==='future'?spaDay(new Date(Date.now()+86400000)):oldDay),before=clone(state);
  await assert.rejects(call('previewInvoiceAdjustment',data));assert.deepEqual(state,before,condition+' must fail without side effects');
}
