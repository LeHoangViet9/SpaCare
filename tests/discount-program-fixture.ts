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
    const actual=key.split('.').reduce((v:any,part:string)=>v?.[part],row);
    if (!value || typeof value !== 'object' || value instanceof mongoose.Types.ObjectId || value instanceof Date) return equal(actual, value);
    return Object.entries(value).every(([op, expected]: any) => {
      switch (op) {
        case '$ne': return !equal(actual, expected);
        case '$exists': return (actual !== undefined) === expected;
        case '$in': return expected.some((v: any) => equal(actual, v));
        case '$gte': return expected instanceof Date ? new Date(actual) >= expected : actual >= expected;
        case '$lte': return actual <= expected;
        case '$lt': return expected instanceof Date ? new Date(actual) < expected : actual < expected;
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

const refs=reset();
const program=add(DiscountProgram,{code:'GG_OLD',name:'Chương trình cũ',startsOn:oldDay,endsOn:today,percent:25,enabled:true});
add(DiscountProgram,{...program,_id:objectId(),code:'GG_OVERLAP'});
const programs=clone(state.DiscountProgram);
for(const method of ['find','findOne','exists']) (DiscountProgram as any)[method]=()=>assert.fail('New operations must not read retired programs');
// Persisted historical snapshots remain readable without configuration lookups.
const historical=add(Invoice,{customerId:refs.customerId,serviceId:refs.serviceId,kind:'SERVICE',description:'Historical sale',subtotal:30000,discount:{type:'PERCENT',value:25,amount:7500,programId:program._id,programCode:program.code,programName:program.name},total:22500,paid:10000,status:'PARTIAL',documentHistory:[{snapshot:{total:22500,discount:{programName:program.name}}}]});
const receipt=add(CashEntry,{customerId:refs.customerId,actorId:ownerId,amount:10000,method:'CASH',direction:'IN',kind:'PAYMENT',day:today,reversed:false});
add(Payment,{invoiceId:historical._id,receiptId:receipt._id,amount:10000,reversed:false});
const saved=clone(historical),sources=clone([state.Payment,state.CashEntry]);
const pdf=()=>invoiceExportDocument({invoice:state.Invoice[0],customer:{name:'Synthetic'},gifts:[],adjustments:[]} as any);
const oldPdf=pdf();
assert.ok(oldPdf.tables[0].rows.some(row=>row[0]==='Chương trình giảm giá'&&row[1].includes(program.name)));
for(const action of ['saveDiscountProgram','setDiscountProgramStatus','deleteDiscountProgram']){
 const before=clone(state);await assert.rejects(call(action,{id:program._id}),/Thao tác không hợp lệ/);assert.deepEqual(state,before);
}
const fresh=await call('invoice',refs);
assert.equal(state.Invoice.find(row=>row._id===fresh.id).total,30000);
assert.equal(state.Invoice.find(row=>row._id===fresh.id).discount,undefined);
for(const discount of [{type:'AMOUNT',value:1500},{type:'PERCENT',value:10}]){
 const key=randomUUID(),result=await call('invoice',{...refs,discount},key);
 assert.equal(state.Invoice.find(row=>row._id===result.id).total,discount.type==='AMOUNT'?28500:27000);
 assert.equal(state.Invoice.find(row=>row._id===result.id).discount.programId,undefined);
 assert.deepEqual(await call('invoice',{...refs,discount},key),result);
}
const plain=await call('checkout',{customerId:refs.customerId,actions:[{action:'serviceInvoice',data:{items:[{serviceId:refs.serviceId,performerId:ownerId}]}}]});
assert.equal(state.Invoice.find(row=>row._id===plain.invoiceId).total,30000);
assert.equal(state.Invoice.find(row=>row._id===plain.invoiceId).discount,undefined);
const sold=await call('checkout',{customerId:refs.customerId,discount:{type:'PERCENT',value:10},actions:[{action:'serviceInvoice',data:{items:[{serviceId:refs.serviceId,performerId:ownerId}]}}],payments:[{amount:10000,method:'CASH',receivedOn:today,receivedConfirmation:true}]});
const bill=state.Invoice.find(row=>row._id===sold.invoiceId);
assert.equal(bill.total,27000);assert.equal(bill.paid,10000);assert.equal(bill.serviceItems[0].total,30000);
assert.equal(state.InvoiceLineCommission.at(-1).amount,1000);
const appointment=add((await import('../src/lib/models')).Appointment,{customerId:refs.customerId,serviceId:refs.serviceId,staffId:ownerId,startAt:new Date(),status:'CONFIRMED'});
const completed=await call('completeAppointment',{id:appointment._id});
assert.equal(state.Invoice.find(row=>row._id===completed.invoiceId).total,30000);
assert.equal(state.Invoice.find(row=>row._id===completed.invoiceId).discount,undefined);
assert.deepEqual(state.Invoice[0],saved);assert.deepEqual([state.Payment.slice(0,1),state.CashEntry.slice(0,1)],sources);
assert.deepEqual(state.DiscountProgram,programs);assert.deepEqual(pdf(),oldPdf);
const report=await readReport(actor,workspaceQuery(new URLSearchParams({section:'reports',from:today,to:today})));
assert.equal((report.invoices.find((row:any)=>String(row._id)===historical._id) as any).discount.programName,program.name);
