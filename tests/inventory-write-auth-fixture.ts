import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {operate} from '../src/lib/operations';
import {User,Control,Product,StockMovement,Idempotency,Audit} from '../src/lib/models';
const initial={id:'a'.repeat(24),spaId:'b'.repeat(24),name:'Synthetic',role:'OWNER' as const,cashier:true};
let cashier=false,active=true,revision=0;
const session={synthetic:true};
(mongoose as any).connect=()=>assert.fail('Offline authorization test must not connect');
(mongoose.connection as any).readyState=1;
(mongoose.connection as any).name='spacare_test';
(mongoose.connection as any).transaction=async(fn:any)=>{
 const before=revision;
 try{return await fn(session);}catch(error){revision=before;throw error;}
};
(Control as any).findOneAndUpdate=(scope:any,_update:any,options:any)=>{
 assert.equal(scope.spaId,initial.spaId);assert.equal(options.session,session);revision++;
 return Promise.resolve({revision});
};
(User as any).findOne=(filter:any)=>{
 assert.deepEqual(filter,{_id:initial.id,spaId:initial.spaId,active:true});
 return {session:async(s:any)=>{assert.equal(s,session);return active?{role:'STAFF',cashier,active:true}:null;}};
};
for(const model of [Product,StockMovement,Idempotency,Audit])for(const method of ['findOne','create','updateOne']) (model as any)[method]=()=>assert.fail('Unauthorized stock/ledger access');
for(cashier of [false,true])for(const direction of ['IN','OUT']){
 await assert.rejects(operate(initial,'stockMovement',{productId:'c'.repeat(24),direction,quantity:1},'synthetic-owner-only-key'),(error:any)=>error.status===403);
 assert.equal(revision,0);
}
active=false;
await assert.rejects(operate(initial,'stockMovement',{productId:'c'.repeat(24),direction:'IN',quantity:1},'synthetic-inactive-key'),(error:any)=>error.status===401);
assert.equal(revision,0);
