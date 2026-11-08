import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {TestContext} from 'node:test';
import type mongoose from 'mongoose';
import {Spa,Control,User,Customer,Service,Day,Invoice,Payment,CashEntry} from '../src/lib/models';
import {operate} from '../src/lib/operations';
import {spaDay} from '../src/lib/rules';
import {hashPassword} from '../src/lib/password';
import {readReport} from '../src/lib/report-read';
import {readWorkspace} from '../src/lib/workspace-read';
import {workspaceQuery} from '../src/lib/workspace-query';

export async function receiptCreationIntegration(extraSpaIds:mongoose.Types.ObjectId[],t:TestContext){
 for(const mode of ['yesterday','today','unpaid','split','installments','closed'])await t.test('invoice creation receipt day: '+mode,async()=>{
  const spa=await Spa.create({name:'Receipt day synthetic test'});extraSpaIds.push(spa._id);const scope={spaId:spa._id};
  const owner=await User.create({...scope,name:'Receipt owner',role:'OWNER',active:true,passwordHash:hashPassword(randomUUID())});
  const actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER' as const,cashier:false};
  const call=(action:string,data:unknown,key=randomUUID())=>operate(actor,action,data,key);
  const today=spaDay(),yesterday=spaDay(new Date(Date.now()-86400000));
  await Control.create(scope);
  const old=await Day.create({...scope,day:yesterday,status:'OPEN',opening:0});
  const current=await Day.create({...scope,day:today,status:mode==='closed'?'CLOSED':'OPEN',opening:0,...(mode==='closed'?{expected:0,bankNet:0,counted:0,difference:0}:{})});
  const customer=await Customer.create({...scope,name:'Receipt customer',phone:'0900000085'});
  const service=await Service.create({...scope,name:'Receipt service',price:300000,commission:0,active:true});
  const payment=(amount:number,receivedOn:string,method='CASH')=>({amount,receivedOn,method,receivedConfirmation:true});
  const input={customerId:String(customer._id),serviceId:String(service._id),total:300000,issuedOn:yesterday,
   ...(['unpaid','installments'].includes(mode)?{}:{payments:mode==='split'||mode==='closed'?[payment(100000,yesterday),payment(200000,today,'BANK_TRANSFER')]:[payment(300000,mode==='today'?today:yesterday)]})};
  if(mode==='closed'){
   // Read persisted objects on both sides: BSON may reorder keys after insertion.
   const booksBefore=await Day.find(scope).sort({_id:1}).lean();
   const controlBefore=await Control.findOne(scope).lean();
   await assert.rejects(call('invoice',input),(error:any)=>error.status===409&&/Hãy mở sổ hôm nay/.test(error.message));
   assert.equal(await Invoice.countDocuments(scope),0);assert.equal(await CashEntry.countDocuments(scope),0);assert.equal(await Payment.countDocuments(scope),0);
   assert.deepEqual(await Day.find(scope).sort({_id:1}).lean(),booksBefore);
   assert.deepEqual(await Control.findOne(scope).lean(),controlBefore);
   return;
  }
  const key=randomUUID(),result=await call('invoice',input,key);assert.deepEqual(await call('invoice',input,key),result);
  assert.equal(spaDay((await Invoice.findById(result.id))!.createdAt),yesterday);
  if(mode==='installments'){
   await call('payment',{invoiceId:result.id,...payment(100000,yesterday)});
   const key=randomUUID(),data={invoiceId:result.id,...payment(200000,today)};await call('payment',data,key);await call('payment',data,key);
  }
  const query=(section:string,day:string)=>workspaceQuery(new URLSearchParams({section,from:day,to:day}));
  const oldIn=mode==='yesterday'?300000:['split','installments'].includes(mode)?100000:0;
  const todayIn=mode==='today'?300000:['split','installments'].includes(mode)?200000:0;
  assert.equal((await readReport(actor,query('reports',yesterday))).inflow,oldIn);
  assert.equal((await readReport(actor,query('reports',today))).inflow,todayIn);
  const overview=await readWorkspace(actor,query('overview',today));assert.equal(overview.totals.inflow,todayIn);assert.equal(overview.totals.debt,mode==='unpaid'?300000:0);
  assert.equal(await CashEntry.countDocuments(scope),mode==='unpaid'?0:['split','installments'].includes(mode)?2:1);
  assert.equal((await Invoice.findById(result.id))!.paid,mode==='unpaid'?0:300000);
 });
}
