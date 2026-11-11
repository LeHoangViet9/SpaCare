import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { allModels, Invoice, Customer, Service, CashEntry, Payment, Day, SaleCommission } from '../src/lib/models';
import { readReport } from '../src/lib/report-read';
import { readWorkspace } from '../src/lib/workspace-read';
import { workspaceQuery } from '../src/lib/workspace-query';
import { operate } from '../src/lib/operations';
import { spaDay } from '../src/lib/rules';
import {DiscountProgram} from '../src/lib/models';
import {readDiscountPrograms} from '../src/lib/discount-program-read';
import {invoiceExportDocument} from '../src/lib/export-read';

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
  q.skip=(n:number)=>{if(Array.isArray(value))value=value.slice(n);return q;};
  q.limit=(n:number)=>{if(Array.isArray(value))value=value.slice(0,n);return q;};
  return q;
}
for (const model of allModels) {
  const name = model.modelName, m = model as any;
  state[name] = [];
  m.find = (filter: any) => query(state[name].filter(row => matches(row, filter)).map(row => document(name, row)), filter);
  m.findOne = (filter: any) => query(document(name, state[name].find(row => matches(row, filter))), filter);
  m.exists = (filter:any) => query(state[name].find(row=>matches(row,filter)) || null,filter);
  m.countDocuments = (filter: any) => query(state[name].filter(row => matches(row, filter)).length,filter);
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
    for(const row of rows){const instance=new model({createdAt:new Date(),updatedAt:new Date(),...row});await instance.validate();const data=JSON.parse(JSON.stringify(instance.toObject()));state[name].push(data);result.push(document(name,data));}
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
function reset(){setup(0);state.Invoice=[];state.Payment=[];state.CashEntry=[];state.Service[0].commission=1000;return {customerId:state.Customer[0]._id,serviceId:state.Service[0]._id};}
const nextDay=spaDay(new Date(Date.now()+86400000));
const input={name:'Synthetic program',startsOn:oldDay,endsOn:nextDay,percent:25,enabled:true};
const version=(id:string)=>new Date(state.DiscountProgram.find(row=>row._id===id).updatedAt).toISOString();
let refs=reset();const key=randomUUID(),created=await call('saveDiscountProgram',input,key);
assert.deepEqual(await call('saveDiscountProgram',input,key),created);assert.equal(state.DiscountProgram.length,1);
assert.equal(state.Audit.filter(row=>row.action==='saveDiscountProgram').length,1);
for(const data of [{...input,name:'Overlap'},{...input,startsOn:nextDay,endsOn:nextDay}]){
 const before=clone(state);await assert.rejects(call('saveDiscountProgram',data),/chồng lấn/);assert.deepEqual(state,before);
}
await call('saveDiscountProgram',{...input,enabled:false});assert.equal(state.DiscountProgram.length,2);
const beforeConfirm=clone(state);
await assert.rejects(call('setDiscountProgramStatus',{id:created.id,expectedUpdatedAt:version(created.id),enabled:false}),/xác nhận/);
assert.deepEqual(state,beforeConfirm);
const sale={...refs,items:[{serviceId:refs.serviceId,performerId:ownerId},{serviceId:refs.serviceId,performerId:ownerId}],payments:[{amount:20000,method:'CASH',receivedOn:today,receivedConfirmation:true},{amount:10000,method:'BANK_TRANSFER',receivedOn:today,receivedConfirmation:true}]};
const sold=await call('serviceInvoice',sale),invoice=state.Invoice[0];
assert.equal(invoice.subtotal,60000);assert.equal(invoice.total,45000);assert.equal(invoice.paid,30000);
assert.deepEqual(invoice.serviceItems.map((row:any)=>row.total),[30000,30000]);assert.deepEqual(state.InvoiceLineCommission.map(row=>row.amount),[1000,1000]);
assert.deepEqual([invoice.discount.programId,invoice.discount.programName,invoice.discount.value,invoice.discount.amount],[created.id,input.name,25,15000]);
const report=await readReport(actor,workspaceQuery(new URLSearchParams({section:'reports',from:today,to:today})));
assert.equal(report.summary.total,45000);assert.equal(report.summary.debt,15000);assert.equal(report.inflow,30000);
assert.equal((report.invoices[0] as any).discount.programName,input.name);
const saved=clone(invoice),paymentSources=clone([state.Payment,state.CashEntry]);
const pdf=invoiceExportDocument({invoice,customer:{name:'Synthetic'},gifts:[],adjustments:[]} as any);
assert.ok(pdf.tables[0].rows.some(row=>row[0]==='Chương trình giảm giá'&&row[1].includes(input.name)));
const beforeStack=clone(state);
await assert.rejects(call('invoice',{...refs,discount:{type:'AMOUNT',value:1}}),/không cộng dồn/);assert.deepEqual(state,beforeStack);
await assert.rejects(call('invoice',{...refs,discountProgram:null}),/đã thay đổi/);assert.deepEqual(state,beforeStack);
const oldVersion=version(created.id);
await call('saveDiscountProgram',{...input,id:created.id,expectedUpdatedAt:oldVersion,name:'Updated program',percent:50,confirmedRunning:true});
assert.deepEqual(state.Invoice[0],saved);assert.deepEqual([state.Payment,state.CashEntry],paymentSources);
await assert.rejects(call('invoice',{...refs,discountProgram:{id:created.id,updatedAt:oldVersion}}),/đã thay đổi/);
await call('invoice',refs);assert.equal(state.Invoice.at(-1).total,15000);
await call('setDiscountProgramStatus',{id:created.id,expectedUpdatedAt:version(created.id),enabled:false,confirmedRunning:true});
assert.deepEqual(state.Invoice[0],saved);
await call('invoice',{...refs,discount:{type:'PERCENT',value:10}});assert.equal(state.Invoice.at(-1).total,27000);assert.equal(state.Invoice.at(-1).discount.programId,undefined);
assert.equal(state.Audit.filter(row=>row.action==='setDiscountProgramStatus').length,1);
const staff={...actor,role:'STAFF' as const,cashier:true};
state.User[0].role='STAFF';state.User[0].cashier=true;
for(const action of ['saveDiscountProgram','setDiscountProgramStatus'])await assert.rejects(operate(staff,action,action==='saveDiscountProgram'?input:{id:created.id,expectedUpdatedAt:version(created.id),enabled:true},randomUUID()),(e:any)=>e.status===403);
await assert.rejects(readDiscountPrograms(staff,new URLSearchParams('manage=1')),(e:any)=>e.status===403);
for(const percent of [0,100]){
 refs=reset();await call('saveDiscountProgram',{...input,percent});const sale=await call('invoice',refs);
 assert.equal(state.Invoice[0].total,percent===0?30000:0);assert.equal(state.Invoice[0].discount.amount,percent===0?0:30000);assert.equal(state.Payment.length,0);
}
refs=reset();await call('saveDiscountProgram',{...input,startsOn:today});
await call('invoice',{...refs,issuedOn:oldDay});assert.equal(state.Invoice[0].discount,undefined);
await call('invoice',{...refs,total:0});assert.equal(state.Invoice.at(-1).discount,undefined);
// Corrupt historical overlaps fail closed rather than picking a program by DB order.
add(DiscountProgram,{...input,code:'GG_CORRUPT'});const beforeOverlap=clone(state);
await assert.rejects(call('invoice',refs),/chồng lấn/);assert.deepEqual(state,beforeOverlap);
await assert.rejects(readDiscountPrograms(actor,new URLSearchParams('day='+today)),/chồng lấn/);
reset();for(let index=0;index<23;index++)add(DiscountProgram,{...input,code:'GG'+index,enabled:false});
const page=await readDiscountPrograms(actor,new URLSearchParams('manage=1&page=2'));
assert.equal((page as any).total,23);assert.equal((page as any).rows.length,3);assert.equal((page as any).page,2);
