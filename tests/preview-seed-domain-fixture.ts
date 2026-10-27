// Real domain services + real Mongoose schema validation, in-memory persistence only.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { allModels, User, Control, Idempotency } from '../src/lib/models';
import { operate, schemas } from '../src/lib/operations';
import { plan, runPlan, reconcile } from '../src/lib/preview-seed';
import { spaDay } from '../src/lib/rules';
const copy=(v:any)=>JSON.parse(JSON.stringify(v));
const state:Record<string,any[]>={};
const spaId='a'.repeat(24),ownerId='b'.repeat(24);
const actor={id:ownerId,spaId,name:'SYNTHETIC Owner',role:'OWNER' as const,cashier:false};
const scalar=(v:any)=>v instanceof Date?v.getTime():v;
function match(row:any,filter:any):boolean {
  return Object.entries(filter).every(([key,value]:any)=>{
    if(key==='$or') return value.some((f:any)=>match(row,f));
    if(key==='$and') return value.every((f:any)=>match(row,f));
    const actual=row[key];
    if(value&&typeof value==='object'&&!(value instanceof Date)&&!value.toHexString) return Object.entries(value).every(([op,want]:any)=>{
      const a=want instanceof Date?new Date(actual).getTime():scalar(actual),b=scalar(want);
      if(op==='$exists') return (actual!==undefined)===want;
      if(op==='$ne') return String(actual)!==String(want);
      if(op==='$in') return want.some((v:any)=>String(v)===String(actual));
      if(op==='$lt') return a<b;
      if(op==='$lte') return a<=b;
      if(op==='$gt') return a>b;
      if(op==='$gte') return a>=b;
      throw new Error('UNSUPPORTED_MOCK_FILTER');
    });
    return String(actual)===String(value);
  });
}
function query(load:()=>any):any {
  let order:any, lean=false;
  const evaluate=()=>{
    let result=load();
    if(Array.isArray(result)&&order) {result=[...result];result.sort((a:any,b:any)=>{for(const [key,dir] of Object.entries(order)){if(String(a[key])!==String(b[key]))return (String(a[key])<String(b[key])?-1:1)*Number(dir);}return 0;});}
    return lean?(Array.isArray(result)?result.map(r=>r.toObject()):result?.toObject()):result;
  };
  const q:any={session:()=>q,select:()=>q,sort:(v:any)=>{order=v;return q;},lean:()=>{lean=true;return q;},distinct:(key:string)=>query(()=>[...new Set((load()||[]).map((r:any)=>r[key]).filter(Boolean))]),then:(yes:any,no:any)=>Promise.resolve().then(evaluate).then(yes,no)};
  return q;
}
let failModel='';
for(const model of allModels) {
  const name=model.modelName;state[name]=[];
  const hydrate=(row:any)=>row?model.hydrate(copy(row)):null;
  const persist=async(doc:any,session:any)=>{
    assert.ok(session,'all business writes must be transactional');
    if(name===failModel) throw new Error('SYNTHETIC_INJECTED_FAILURE');
    assert.ok(!(name==='User'&&String(doc._id)===ownerId),'OWNER must never be saved');
    await doc.validate();
    if(!doc.createdAt) doc.createdAt=new Date();doc.updatedAt=new Date();
    const row=copy(doc.toObject()),index=state[name].findIndex(r=>String(r._id)===String(row._id));
    if(index<0) state[name].push(row);else state[name][index]=row;
    return doc;
  };
  model.prototype.save=function(options:any){return persist(this,options?.session);};
  (model as any).find=(filter:any={})=>query(()=>state[name].filter(r=>match(r,filter)).map(hydrate));
  (model as any).findOne=(filter:any)=>query(()=>hydrate(state[name].find(r=>match(r,filter))));
  (model as any).exists=(filter:any)=>query(()=>{const row=state[name].find(r=>match(r,filter));return row?{_id:row._id}:null;});
  (model as any).findOneAndUpdate=(filter:any,update:any,options:any)=>query(()=>{
    assert.ok(options?.session);
    const row=state[name].find(r=>match(r,filter));if(!row)return null;
    assert.notEqual(name==='User'?String(row._id):'',ownerId);
    for(const [k,v] of Object.entries(update.$inc||{})) row[k]=(row[k]||0)+Number(v);
    Object.assign(row,update.$set||{});return hydrate(row);
  });
  (model as any).create=async(rows:any[],options:any)=>{const results=[];for(const row of rows) results.push(await persist(new model(row),options?.session));return results;};
}
state.User.push({_id:ownerId,spaId,name:actor.name,role:'OWNER',active:true,cashier:false,passwordHash:'SYNTHETIC_OWNER_HASH_UNCHANGED'});
state.Control.push({_id:'c'.repeat(24),spaId,revision:0,invoiceSequence:0});
const ownerBefore=copy(state.User[0]);
let connections=0,transactions=0;
(mongoose as any).connect=async()=>{connections++;throw new Error('NO_NETWORK_ALLOWED');};
(mongoose.connection as any).readyState=1;
(mongoose.connection as any).name='spacare_test';
(mongoose.connection as any).transaction=async(fn:any)=>{
  transactions++;const before=copy(state);
  try{return await fn({syntheticTransaction:true});}catch(error){for(const key of Object.keys(state))state[key]=before[key];throw error;}
};
Object.assign(process.env,{NODE_ENV:'test',SPACARE_ENV:'test',SPACARE_TARGET_DATABASE:'spacare_test'});
process.env.MONGODB_URI='mongodb://127.0.0.1:1/spacare_test';
for(const key of Object.keys(process.env))if(key.startsWith('VERCEL'))delete process.env[key];
const steps=plan(spaDay());
const validate=(action:string,data:any)=>schemas[action as keyof typeof schemas].parse(data);
const execute=(action:string,data:any,key:string)=>operate(actor,action,data,key);
const prefix=steps.slice(0,steps.findIndex(s=>s.key==='package0'));
await runPlan(prefix,'synthetic-staff-test-only',execute,validate);
// A failure after invoice/treatment creation must roll back that operation.
const results=await runPlan(prefix,'synthetic-staff-test-only',execute,validate);
const {resolve}=await import('../src/lib/preview-seed');
const step=steps.find(s=>s.key==='package0')!;
const before=copy(state);failModel='CashCard';
await assert.rejects(execute(step.action,resolve(step.data,results),'synthetic-rollback-package-test'),/SYNTHETIC_INJECTED_FAILURE/);
failModel='';assert.deepEqual(state,before,'package, gift, receipts, audit and counters roll back together');
await runPlan(steps,'synthetic-staff-test-only',execute,validate);
reconcile(state);
assert.ok(state.ActivityNotification.length>0);
assert.ok(state.ActivityNotification.every(row=>row.pushEnvironment==='QUARANTINED'),'synthetic outbox is permanently quarantined');
const counts:Record<string,number>={Customer:20,User:6,ServiceGroup:6,Service:20,PackageTemplate:10,Treatment:13,TreatmentUse:10,Appointment:25,Invoice:30,Product:10,StockMovement:11,CashCard:5,Deposit:5,Workday:15,StaffLeave:5,Payroll:5};
for(const [name,count] of Object.entries(counts))assert.equal(state[name].length,count,name);
assert.deepEqual(state.User.find(u=>u._id===ownerId),ownerBefore);
const sizes=Object.fromEntries(Object.entries(state).map(([name,rows])=>[name,rows.length]));
await runPlan(steps,'synthetic-staff-test-only',execute,validate);
assert.deepEqual(Object.fromEntries(Object.entries(state).map(([name,rows])=>[name,rows.length])),sizes,'replay creates no duplicate records');
assert.deepEqual(state.User.find(u=>u._id===ownerId),ownerBefore);
assert.equal(state.Idempotency.length,steps.length);
assert.equal(connections,0);assert.ok(transactions>=steps.length);
assert.equal(state.CashCard.filter(c=>c.balance===0).length,1);
assert.ok(state.Product.some(p=>p.stock===0)&&state.Product.some(p=>p.stock>0&&p.stock<p.minStock));
console.log('PASS: full seed domain scenario, reconciliation, rollback, OWNER preservation and replay with in-memory persistence; no real MongoDB.');
