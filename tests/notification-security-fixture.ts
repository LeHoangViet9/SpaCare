import assert from 'node:assert/strict';
import { mock } from 'node:test';
import mongoose from 'mongoose';
import {createECDH,randomBytes} from 'node:crypto';
mock.module('next/headers',{namedExports:{cookies:async()=>({get:()=>({value:'fixture-session'})})}});
mock.module('next/server',{namedExports:{after:()=>{}}});
const closingChecks:any[]=[];const appointmentChecks:any[]=[];const dispatches:any[]=[];
mock.module('../src/lib/notification-events',{namedExports:{
 queueClosingReminders:async(now:Date,spaId?:string)=>{closingChecks.push({now,spaId});return 0;},
 queueAppointmentReminders:async(...args:any[])=>{appointmentChecks.push(args);return 0;}
}});
mock.module('../src/lib/notifications',{namedExports:{
 pushConfig:()=>process.env.VAPID_PUBLIC_KEY?{publicKey:process.env.VAPID_PUBLIC_KEY}:null,
 dispatchNotifications:async(...args:any[])=>{dispatches.push(args);}
}});
const {ActivityNotification,Notification,PushDevice,Session,User}=await import('../src/lib/models');
(mongoose.connection as any).readyState=1;
(mongoose.connection as any).name='spacare_test';
(mongoose as any).connect=()=>assert.fail('No database connection allowed');
let role='STAFF',active=true;const spaId='a'.repeat(24),userId='b'.repeat(24),noticeId='c'.repeat(24);
(Session as any).findOne=async()=>({userId,spaId});
(User as any).findOne=async()=>active?{_id:userId,spaId,role,active,name:'Fixture'}:null;
let reads:any[]=[];let writes:any[]=[];
for(const model of [Notification,ActivityNotification]){
 const source=model.modelName;
 (model as any).find=(filter:any)=>{reads.push({source,filter});const query:any={sort:()=>query,limit:()=>query,select:()=>query,lean:async()=>[{_id:noticeId,title:filter.kind || source,createdAt:new Date(),url:'/workspace',body:'Detail'}]};return query;};
 (model as any).countDocuments=async(filter:any)=>{reads.push({source,filter});return 1;};
 (model as any).updateOne=async(filter:any)=>{writes.push({source,filter});};
 (model as any).updateMany=async(filter:any)=>{writes.push({source,filter});};
}
(PushDevice as any).findOneAndUpdate=async(filter:any,update:any)=>{writes.push({source:'PushDevice',filter,update});};
(PushDevice as any).deleteOne=async(filter:any)=>{writes.push({source:'PushDevice',filter});};
const {GET,POST}=await import('../src/app/api/notifications/route');
const request=(body:any)=>new Request('http://localhost:3100/api/notifications',{method:'POST',headers:{origin:'http://localhost:3100','content-type':'application/json'},body:JSON.stringify(body)});
const staffResponse=await GET();assert.equal(staffResponse.status,200);const staff=await staffResponse.json();assert.equal(staff.items.length,2);assert.equal(staff.unread,2);assert.ok(staff.items.some((item:any)=>item.title==='APPOINTMENT_REMINDER'));
assert.equal(closingChecks.length,0,'staff polling must not enqueue owner reminders');
assert.ok(reads.every(item=>(item.source==='Notification'||item.filter.kind==='APPOINTMENT_REMINDER')&&item.filter.spaId===spaId&&item.filter.userId===userId));
await POST(request({action:'read',id:noticeId}));assert.ok(writes.every(item=>(item.source==='Notification'||item.filter.kind==='APPOINTMENT_REMINDER')&&item.filter.userId===userId&&item.filter.spaId===spaId));
reads=[];writes=[];role='OWNER';const owner=await (await GET()).json();assert.equal(owner.items.length,2);assert.equal(owner.unread,2);assert.equal(closingChecks.length,1);assert.equal(closingChecks[0].spaId,spaId);
assert.ok(reads.some(item=>item.source==='ActivityNotification'));await POST(request({action:'readAll'}));assert.equal(writes.length,2);
role='STAFF';writes=[];
const dh=createECDH('prime256v1');dh.generateKeys();process.env.VAPID_PUBLIC_KEY='public';process.env.VAPID_PRIVATE_KEY='private';process.env.VAPID_SUBJECT='https://example.test';
// Test/Preview cannot register devices even when VAPID is present.
assert.equal((await POST(request({action:'subscribe',subscription:{}}))).status,403);
assert.equal(writes.length,0);
const environmentBefore={...process.env};
for(const key of Object.keys(process.env)) if(key.startsWith('VERCEL')) delete process.env[key];
delete process.env.NODE_TEST_CONTEXT;delete process.env.SPACARE_ENV;delete process.env.SPACARE_TARGET_DATABASE;
Object.assign(process.env,{NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'production',MONGODB_URI:'mongodb://127.0.0.1:1/spacare_live'});
(mongoose.connection as any).name='spacare_live';
assert.equal((await POST(request({action:'subscribe',subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{p256dh:dh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}}))).status,200);
assert.equal(writes[0].update.$set.spaId,spaId);assert.equal(writes[0].update.$set.userId,userId);
for(const key of Object.keys(process.env)) if(!(key in environmentBefore))delete process.env[key];
Object.assign(process.env,environmentBefore);
(mongoose.connection as any).name='spacare_test';
role='CUSTOMER';reads=[];assert.equal((await GET()).status,403);assert.equal(reads.length,0);assert.equal((await POST(request({action:'readAll'}))).status,403);
role='STAFF';active=false;assert.equal((await GET()).status,401);
const {GET:daily}=await import('../src/app/api/notifications/daily-close/route');
assert.equal((await daily(new Request('http://localhost:3100/api/notifications/daily-close'))).status,401);
console.log('Notification API: staff booking access, owner financial access, account state, scoped reads/writes/subscriptions and cron authorization verified.');

const {GET:dispatch}=await import('../src/app/api/notifications/dispatch/route');
const closingBefore=closingChecks.length;
assert.equal((await dispatch(new Request('http://localhost:3100/api/notifications/dispatch'))).status,401);
assert.equal(closingChecks.length,closingBefore,'unauthorized cron cannot enqueue reminders');
process.env.CRON_SECRET='fixture-cron';
const authorized=()=>new Request('http://localhost:3100/api/notifications/dispatch',{headers:{authorization:'Bearer fixture-cron'}});
const dispatched=await dispatch(authorized());assert.equal(dispatched.status,200);assert.equal(dispatched.headers.get('cache-control'),'no-store');
assert.equal(closingChecks.length,closingBefore+1);assert.equal(closingChecks.at(-1).spaId,undefined);
assert.equal(appointmentChecks.length,1);assert.equal(dispatches.length,1);
