import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {operate} from '../src/lib/operations';
import {allModels, Invoice, User, Control, Customer, CashEntry, Payment, Treatment, TreatmentUse, PackageTemplate, Service, Day, Audit} from '../src/lib/models';
import {spaDay} from '../src/lib/rules';
const id=()=>String(new mongoose.Types.ObjectId()),spaId=id(),owner=id(),customer=id(),service=id(),tech=id();
const actor={id:owner,spaId,name:'Owner',role:'OWNER' as const,cashier:false};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));let state:Record<string,any[]>={};let tick=Date.now(),fail='';
function match(row:any,f:any):boolean{return Object.entries(f).every(([key,value]:any)=>{
  if(key==='$or')return value.some((p:any)=>match(row,p));if(key==='$and')return value.every((p:any)=>match(row,p));
  const actual=row[key];if(value&&typeof value==='object'&&!(value instanceof mongoose.Types.ObjectId)&&!(value instanceof Date))return Object.entries(value).every(([op,v]:any)=>{
    if(op==='$exists')return (actual!==undefined)===v;if(op==='$in')return v.some((n:any)=>String(n)===String(actual));if(op==='$ne')return String(actual)!==String(v);
    if(op==='$gte')return new Date(actual)>=new Date(v);if(op==='$lt')return new Date(actual)<new Date(v);throw Error('Unhandled filter '+op);
  });return String(actual)===String(value);
});}
function doc(name:string,row:any):any{
  if(!row)return null;const result={...clone(row)};
  for(const field of ['createdAt','updatedAt','earnedAt','performedAt'])if(result[field])result[field]=new Date(result[field]);
  return Object.assign(result,{toObject(this:any){const {save,toObject,...value}=this;return clone(value);},async save(this:any,options:any){assert.ok(options.session);this.updatedAt=new Date(++tick);state[name][state[name].findIndex(r=>String(r._id)===String(this._id))]=this.toObject();}});
}
function query(value:any):any{return {select(){return this;},sort(){return this;},session(){return this;},lean:async()=>clone(value),then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};}
for(const model of allModels){
 const name=model.modelName;state[name]=[];
 (model as any).find=(f:any)=>query(state[name].filter(r=>match(r,f)).map(r=>doc(name,r)));
 (model as any).findOne=(f:any)=>query(doc(name,state[name].find(r=>match(r,f))));
 (model as any).countDocuments=(f:any)=>query(state[name].filter(r=>match(r,f)).length);
 (model as any).exists=(f:any)=>query(state[name].find(r=>match(r,f))||null);
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
add(Customer,{_id:customer,name:'Customer'});add(Service,{_id:service,name:'Service',active:true});add(Day,{day:spaDay(),status:'OPEN'});
const call=(data:any,key=randomUUID())=>operate(actor,'updateCustomerTreatment',data,key);
const bill=add(Invoice,{customerId:customer,serviceId:service,kind:'PACKAGE',description:'Original purchase',total:300000,paid:300000,status:'PAID'});
const entry=add(CashEntry,{customerId:customer,actorId:owner,day:spaDay(),amount:300000,direction:'IN',kind:'PAYMENT',method:'CASH',reversed:false});
add(Payment,{invoiceId:bill._id,receiptId:entry._id,amount:300000,reversed:false});
const plan=add(Treatment,{customerId:customer,invoiceId:bill._id,serviceId:service,name:'Legacy original',totalSessions:5,remaining:2,status:'ACTIVE'});
const signature={version:1,strokes:[[[0.1,0.2],[0.3,0.4]]]};
for(let n=1;n<=3;n++)add(TreatmentUse,{treatmentId:plan._id,customerId:customer,staffId:tech,actorId:tech,sessionNumber:n,performedAt:new Date().toISOString(),signature,snapshot:'Original immutable visit'});
const template=add(PackageTemplate,{name:'Selected catalog package',serviceId:service,totalSessions:10,price:500000,active:true});
const current=()=>state.Treatment.find(row=>row._id===plan._id);
const data=()=>({id:plan._id,expectedUpdatedAt:current().updatedAt,expectedUseCount:3,name:template.name,serviceId:service,templateId:template._id,totalSessions:10,notes:'',reason:'Correct remaining rights'});
const history=()=>clone({invoices:state.Invoice,payments:state.Payment,entries:state.CashEntry,uses:state.TreatmentUse});
const original=history();
const key=randomUUID(),request=data();await call(request,key);await call(request,key);
assert.equal(current().name,template.name);assert.equal(current().templateId,template._id);assert.equal(current().remaining,7);
assert.deepEqual(history(),original);assert.equal(state.Audit.length,1);
assert.equal(state.Audit[0].details.before.name,'Legacy original');assert.equal(state.Audit[0].details.after.name,template.name);
assert.equal(state.Audit[0].details.rightsImpact.historicalUsesPreserved,true);
const otherService=add(Service,{name:'Different service',active:true}),other=add(PackageTemplate,{name:'Different package',serviceId:otherService._id,totalSessions:10,active:true});
const tooSmall=add(PackageTemplate,{name:'Not enough rights',serviceId:service,totalSessions:2,active:true});
const stopped=add(PackageTemplate,{name:'Stopped',serviceId:service,totalSessions:10,active:false});
const timed=add(PackageTemplate,{name:'Timed',serviceId:service,packageType:'TIME',durationMonths:12,active:true});
for(const invalid of [
 {...data(),name:'Free-form mismatch'},
 {...data(),serviceId:otherService._id},
 {...data(),name:other.name,serviceId:otherService._id,templateId:other._id},
 {...data(),name:tooSmall.name,templateId:tooSmall._id,totalSessions:2,confirmUsedFloor:true},
 {...data(),name:stopped.name,templateId:stopped._id},
 {...data(),name:timed.name,templateId:timed._id},
 {...data(),templateId:entry._id},
 {...data(),expectedUseCount:2},
 {...data(),templateId:undefined,name:'Legacy API rename'},
]){const before=clone(state);await assert.rejects(call(invalid));assert.deepEqual(state,before);}
// Existing quota correction safeguards are unchanged for the same package.
await assert.rejects(call({...data(),totalSessions:2}),/Đã dùng 3 buổi/);
await call({...data(),totalSessions:2,confirmUsedFloor:true});assert.equal(current().totalSessions,3);assert.equal(current().remaining,0);
assert.deepEqual(history(),original);
const snapshot=clone(state);fail='Audit';await assert.rejects(call({...data(),totalSessions:12}),/INJECTED_Audit/);fail='';assert.deepEqual(state,snapshot);
// Legacy clients may edit rights while retaining the original identity; no name inference.
await call({...data(),templateId:undefined,totalSessions:12});assert.equal(current().remaining,9);assert.deepEqual(history(),original);
const beforeForeign=clone(state);state.PackageTemplate.find(row=>row._id===template._id).spaId=id();
await assert.rejects(call(data()),(e:any)=>e.status===404);state=beforeForeign;
