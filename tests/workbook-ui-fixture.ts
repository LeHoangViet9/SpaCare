import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { allModels, Spa, User, Control, Customer, Service, Appointment, Invoice, Treatment, Audit, LoginAttempt } from '../src/lib/models';
import { hashPassword, hash } from '../src/lib/password';
import { operate } from '../src/lib/operations';
import { spaDay } from '../src/lib/rules';
const uri=process.env.MONGODB_URI||'';assert.equal(new URL(uri).pathname,'/spacare_test');
const out='outputs/test-review-20261021/ui-fixture.json';
await mongoose.connect(uri,{autoIndex:false});
try {
 if(process.argv.includes('--cleanup')) {
  const f=JSON.parse(await fs.readFile(out,'utf8'));
  assert.match(f.name,/^WORKBOOK-UI-/);
  const spa=await Spa.findOne({_id:f.spaId,name:f.name});assert.ok(spa);
  for(const model of allModels)if(model.schema.path('spaId'))await model.deleteMany({spaId:spa._id});
  for(const email of f.emails)await LoginAttempt.deleteMany({key:{$in:[-1,0,1].map(offset=>hash(email+':'+(Math.floor(Date.now()/900000)+offset)))}});
  await Spa.deleteOne({_id:spa._id});
  console.log('Only the recorded UI test fixture removed from spacare_test');
 } else {
  const spa=await Spa.create({name:'WORKBOOK-UI-'+randomUUID()});
  await Control.create({spaId:spa._id});
  // Disposable local test credential, never used for an operational account.
  const passwordHash=hashPassword('UiFixtureOnly-20261021!');
  const owner=await User.create({spaId:spa._id,name:'Chủ spa kiểm thử',email:'owner-'+randomUUID()+'@example.test',passwordHash,role:'OWNER',cashier:true});
  const staff=await User.create({spaId:spa._id,name:'Nhân viên kiểm thử',email:'staff-'+randomUUID()+'@example.test',passwordHash,role:'STAFF',cashier:false});
  const actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER' as const,cashier:true};
  const op=(action:string,data:unknown)=>operate(actor,action,data,randomUUID());
  await op('openDay',{day:spaDay(),opening:1000000});
  const service=await Service.create({spaId:spa._id,name:'Chăm sóc da chuyên sâu • tiếng Việt có dấu',price:350000,duration:60});
  const stopped=await Service.create({spaId:spa._id,name:'Dịch vụ đã ngừng kiểm thử',price:100000,duration:30,active:false});
  const customers=[];
  for(let n=1;n<=13;n++)customers.push(await Customer.create({spaId:spa._id,name:n===1?'Khách một gói':n===2?'Khách nhiều gói':n===3?'Khách lẻ kiểm thử':n===4?'Khách lịch gói':n===5?'Tên khách rất dài có đầy đủ tiếng Việt để kiểm tra bố cục trên màn hình điện thoại':'Khách kiểm thử '+String(n).padStart(2,'0'),phone:'09100000'+String(n).padStart(2,'0'),notes:'Ghi chú kiểm thử'}));
  const plans=[];
  for(const index of [0,1,1,3])plans.push(await op('sellPackage',{customerId:String(customers[index]._id),serviceId:String(service._id),name:'Gói chăm sóc '+(plans.length+1),totalSessions:7,total:2000000,dueDate:spaDay(new Date(Date.now()+7*86400000))}));
  for(let n=0;n<13;n++)await Appointment.create({spaId:spa._id,customerId:customers[n]._id,serviceId:service._id,staffId:staff._id,startAt:new Date(Date.now()-(n+2)*3600000),endAt:new Date(Date.now()-(n+1)*3600000),...(n===3?{treatmentId:plans[3].id}:{}),notes:'Ghi chú lịch hẹn rất dài để kiểm tra xuống dòng, nội dung không bị mất khi chuyển màn hình.',changeReason:'Lý do kiểm thử hiển thị'});
  const invoice=await Invoice.create({spaId:spa._id,customerId:customers[2]._id,serviceId:service._id,description:service.name,total:350000,paid:100000,status:'PARTIALLY_PAID'});
  await Invoice.create({spaId:spa._id,customerId:customers[2]._id,serviceId:stopped._id,description:stopped.name,total:100000,paid:0});
  await Audit.create({spaId:spa._id,actorId:owner._id,action:'uiFixture',details:{notes:'Nội dung audit kiểm thử '+('dài '.repeat(100))}});
  const fixture={spaId:String(spa._id),name:spa.name,ownerEmail:owner.email,staffEmail:staff.email,emails:[owner.email,staff.email],serviceId:String(service._id),stoppedId:String(stopped._id),customerIds:customers.map(c=>String(c._id)),invoiceId:String(invoice._id),plans};
  await fs.writeFile(out,JSON.stringify(fixture,null,2));
  console.log(JSON.stringify({ownerEmail:owner.email,staffEmail:staff.email,spaId:String(spa._id)}));
 }
}finally{await mongoose.disconnect();}
