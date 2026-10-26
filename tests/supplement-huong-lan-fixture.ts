import assert from 'node:assert/strict';
import {mock} from 'node:test';
import mongoose from 'mongoose';
import * as opening from '../src/lib/opening-balances';
import {Customer,Service,Treatment,Invoice,Control,Audit,Idempotency,CashEntry,Payment,Commission,SaleCommission} from '../src/lib/models';
const scenario=process.argv[2];process.argv=[process.execPath,'supplement',scenario==='check-conflict'?'--check':'--write'];
process.env.MONGODB_URI='mongodb://127.0.0.1:1/spacare_live';process.env.SEED_OWNER_PHONE='0912345678';process.env.SEED_OWNER_PASSWORD='fixture-password-123';delete process.env.SEED_OWNER_EMAIL;delete process.env.VERCEL;
const spaId='a'.repeat(24),customerId='b'.repeat(24),owner={_id:'c'.repeat(24),spaId,name:'Owner'};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
let state:Record<string,any[]>={Customer:[{_id:customerId,spaId,name:'Hương Lan KL',phone:'0366575893'}],Service:['Triệt lông Nách','Triệt lông 1/2 chân','Triệt lông Bikini'].map(name=>({_id:String(new mongoose.Types.ObjectId()),spaId,name,active:true})),Treatment:[{_id:'d'.repeat(24),spaId,customerId,serviceId:'e'.repeat(24),name:'Triệt lông Mép',openingBalance:true,startsOn:'2025-06-17',expiresOn:'2028-06-17',packageType:'TIME',status:'ACTIVE'}],Invoice:[],Control:[{spaId}],Audit:[],Idempotency:[]};
const matches=(row:any,filter:any)=>Object.entries(filter).every(([k,v])=>String(row[k])===String(v));
const query=(value:any)=>({session:async()=>value});
function doc(name:string,row:any):any{return row?{...clone(row),async save(){const {save,...value}=this;const index=state[name].findIndex(r=>String(r._id)===String(value._id));state[name][index]=clone(value);}}:null;}
for(const model of [Customer,Service,Treatment,Invoice,Control,Audit,Idempotency]){
 const name=model.modelName;
 (model as any).find=(filter:any)=>query(state[name].filter(row=>matches(row,filter)));
 (model as any).findOne=(filter:any)=>query(state[name].find(row=>matches(row,filter)));
 (model as any).findOneAndUpdate=()=>query(state.Control[0]);
 (model as any).create=async(rows:any[],options:any)=>{assert.ok(options.session);if(scenario==='rollback' && name==='Audit')throw Error('INJECTED_FAILURE');const result=[];for(const row of rows){const record=new model(row);await record.validate();const value=clone(record.toObject());state[name].push(value);result.push(doc(name,value));}return result;};
}
for(const model of [CashEntry,Payment,Commission,SaleCommission])(model as any).create=()=>assert.fail('Historical supplement must never create receipts or commissions');
(Treatment.collection as any).indexes=async()=>[{key:{spaId:1,invoiceId:1}}];
(mongoose.connection as any).transaction=async(fn:any)=>{const before=clone(state);try{return await fn({fixture:true});}catch(error){state=before;throw error;}};
(mongoose as any).disconnect=async()=>{};
mock.module('../src/lib/db.ts',{namedExports:{connect:async()=>{},DatabaseUnavailableError:class extends Error{}}});
mock.module('../src/lib/opening-balances.ts',{namedExports:{...opening,openingOwner:async()=>owner}});
if(['conflict','check-conflict'].includes(scenario))state.Treatment.push({...state.Treatment[0],_id:'f'.repeat(24),serviceId:state.Service[0]._id,startsOn:'2024-01-01'});
if(scenario==='cancelled')state.Treatment.push({...state.Treatment[0],_id:'f'.repeat(24),serviceId:state.Service[0]._id,status:'CANCELLED',startsOn:'2026-10-26',expiresOn:'2029-10-26'});
const before=clone(state);const output:string[]=[];console.log=(...values)=>output.push(values.join(' '));const errors:any[]=[];console.error=(...values)=>errors.push(values);
await import('../scripts/supplement-huong-lan');
if(['success','cancelled'].includes(scenario)){
 assert.equal(process.exitCode,undefined);assert.equal(state.Invoice.length,1);assert.equal(state.Treatment.length,before.Treatment.length+3);
 assert.equal(state.Invoice[0].total,0);assert.equal(state.Invoice[0].paid,0);assert.equal(state.Invoice[0].openingBalance,true);assert.equal(state.Invoice[0].packageItems.length,3);
 assert.deepEqual(state.Treatment[0],before.Treatment[0],'existing upper-lip entitlement is preserved');
 assert.deepEqual(state.Treatment.slice(0,before.Treatment.length),before.Treatment);
 for(const plan of state.Treatment.slice(before.Treatment.length)){assert.equal(plan.invoiceId,state.Invoice[0]._id);assert.equal(plan.startsOn,'2025-06-17');assert.equal(plan.expiresOn,'2028-06-17');}
 assert.equal(state.Audit.length,1);assert.equal(state.Idempotency.length,1);
 const once=clone(state);await import('../scripts/supplement-huong-lan.ts'+'?retry');assert.deepEqual(state,once,'same batch cannot duplicate entitlements');
}else{assert.equal(process.exitCode,1);assert.deepEqual(state,before,'conflict or audit failure must leave every document untouched');assert.ok(errors.length);if(scenario==='check-conflict'){const report=JSON.parse(output[0]);assert.equal(report.existing.find((t:any)=>t.name==='Triệt lông Mép' && t.startsOn==='2024-01-01').status,'ACTIVE');assert.equal(report.conflicts.length,1);assert.equal(report.missing.length,2);assert.equal(report.newReceipts,0);}process.exitCode=0;}
