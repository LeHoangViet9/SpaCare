import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {invoiceContentContext} from '../src/lib/invoice-content';
import {operate} from '../src/lib/operations';
import {allModels, PackageTemplate, TreatmentUse, Appointment, Invoice, InvoiceAdjustment, User, Control, Customer, CashEntry, Payment, Deposit, Allocation, CashCard, CashCardUse, Treatment, Commission, InvoiceLineCommission, SaleCommission, SharedSaleCommission, Payroll, Service, Product, StockMovement, Day, Audit, Idempotency} from '../src/lib/models';
import {spaDay} from '../src/lib/rules';
import {cashFlowNet} from '../src/lib/cash-flow';
const id=()=>String(new mongoose.Types.ObjectId()),spaId=id(),owner=id(),customer=id(),service=id(),tech=id(),tech2=id();
const actor={id:owner,spaId,name:'Owner',role:'OWNER' as const,cashier:false};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));let state:Record<string,any[]>={};let tick=Date.now(),fail='';
function match(row:any,f:any):boolean{return Object.entries(f).every(([key,value]:any)=>{
  if(key==='$or')return value.some((p:any)=>match(row,p));if(key==='$and')return value.every((p:any)=>match(row,p));
  const actual=row[key];if(value&&typeof value==='object'&&!(value instanceof mongoose.Types.ObjectId)&&!(value instanceof Date))return Object.entries(value).every(([op,v]:any)=>{
    if(op==='$exists')return (actual!==undefined)===v;if(op==='$in')return v.some((n:any)=>(Array.isArray(actual)?actual:[actual]).some((a:any)=>String(n)===String(a)));if(op==='$ne')return String(actual)!==String(v);
    if(op==='$gte')return new Date(actual)>=new Date(v);if(op==='$lt')return new Date(actual)<new Date(v);throw Error('Unhandled filter '+op);
  });return String(actual)===String(value);
});}
function doc(name:string,row:any):any{
  if(!row)return null;const result={...clone(row)};
  for(const field of ['createdAt','updatedAt','earnedAt','performedAt'])if(result[field])result[field]=new Date(result[field]);
  return Object.assign(result,{toObject(this:any){const {save,toObject,...value}=this;return clone(value);},async save(this:any,options:any){assert.ok(options.session);const model=allModels.find(m=>m.modelName===name)!;await new model(this.toObject()).validate();this.updatedAt=new Date(++tick);state[name][state[name].findIndex(r=>String(r._id)===String(this._id))]=this.toObject();}});
}
function query(value:any):any{return {skip(){return this;},limit(){return this;},select(){return this;},sort(){return this;},session(){return this;},lean:async()=>JSON.parse(JSON.stringify(value),(key,value)=>['createdAt','updatedAt','earnedAt','performedAt'].includes(key)&&value?new Date(value):value),then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};}
for(const model of allModels){
 const name=model.modelName;state[name]=[];
 (model as any).find=(f:any)=>query(state[name].filter(r=>match(r,f)).map(r=>doc(name,r)));
 (model as any).findOne=(f:any)=>query(doc(name,state[name].find(r=>match(r,f))));
 (model as any).exists=(f:any)=>query(state[name].find(r=>match(r,f))||null);
 (model as any).countDocuments=(f:any)=>query(state[name].filter(r=>match(r,f)).length);
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
add(User,{_id:tech2,name:'Technician 2',role:'STAFF',active:true,cashier:true});
add(Customer,{_id:customer,name:'Customer'});add(Service,{_id:service,name:'Service',active:true,commission:10000});add(Day,{day:spaDay(),status:'OPEN'});
const current=(bill:any)=>state.Invoice.find(r=>r._id===bill._id);
const call=(action:string,data:any,key:string=randomUUID())=>operate(actor,action,data,key);
function sale(){const bill=add(Invoice,{customerId:customer,serviceId:service,kind:'SERVICE',description:'Original',total:1000000,paid:1000000,status:'PAID',refunded:0});const entry=add(CashEntry,{customerId:customer,amount:1000000,day:spaDay(),method:'CASH',direction:'IN',kind:'PAYMENT',reversed:false});const payment=add(Payment,{invoiceId:bill._id,amount:1000000,receiptId:entry._id,reversed:false});return {bill,entry,payment};}
const payload=(bill:any,mode='CORRECT',total=600000)=>({id:bill._id,expectedUpdatedAt:current(bill).updatedAt,mode,total,reason:'Owner reason',stockHandling:'KEEP_OUT',entitlementHandling:'KEEP',giftHandling:'KEEP'});
const commit=async(data:any,key=randomUUID())=>{const preview=await call('previewInvoiceAdjustment',data);return {preview,data:{...data,confirmed:true,expectedPreview:preview.previewToken},key};};


export {actor,spaId,owner,tech,tech2,customer,service,add,clone,call};
export const localState=()=>state;
export const resetLocalState=(value:Record<string,any[]>)=>{state=clone(value);};
