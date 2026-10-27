import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { ActivityNotification, Notification, PushDevice, User } from '../src/lib/models';
import { dispatchNotifications, pushConfig } from '../src/lib/notifications';
import { sendPush } from '../src/lib/web-push';
const relevant=['NODE_ENV','NODE_TEST_CONTEXT','SPACARE_ENV','SPACARE_TARGET_DATABASE','CI'];
function environment(mode:string) {
  for(const key of [...relevant,...Object.keys(process.env).filter(k=>k.startsWith('VERCEL'))])delete process.env[key];
  Object.assign(process.env,{NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'production',MONGODB_URI:'mongodb://127.0.0.1:1/spacare_live'});
  (mongoose.connection as any).readyState=1;(mongoose.connection as any).name='spacare_live';
  if(mode==='preview')process.env.VERCEL_ENV='preview';
  if(mode==='test')Object.assign(process.env,{SPACARE_ENV:'test',MONGODB_URI:'mongodb://127.0.0.1:1/spacare_test'});
  if(mode==='staging')process.env.SPACARE_ENV='staging';
  if(mode==='unknown')delete process.env.VERCEL_ENV;
  if(mode==='conflict')process.env.VERCEL_TARGET_ENV='preview';
}
let driver=0,network=0,claims=0,updates=0,deletions=0;
(mongoose as any).connect=async()=>{driver++;throw new Error('DATABASE_FORBIDDEN');};
const ua=createECDH('prime256v1');ua.generateKeys();const vapid=createECDH('prime256v1');vapid.generateKeys();
const config={publicKey:vapid.getPublicKey().toString('base64url'),privateKey:vapid.getPrivateKey().toString('base64url'),subject:'https://synthetic.invalid'};
Object.assign(process.env,{VAPID_PUBLIC_KEY:config.publicKey,VAPID_PRIVATE_KEY:config.privateKey,VAPID_SUBJECT:config.subject});
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:{p256dh:ua.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
globalThis.fetch=async()=>{network++;return new Response(null,{status:201});};
let rows:any[]=[];
(Notification as any).findOneAndUpdate=async(filter:any,update:any)=>{
  claims++;
  assert.deepEqual(filter.$or,[{pushEnvironment:'PRODUCTION'},{pushEnvironment:{$exists:false}}]);
  const row=rows.find(r=>r.pushState==='PENDING'&&(r.pushEnvironment===undefined||r.pushEnvironment==='PRODUCTION'));
  if(row)row.attempts=(row.attempts||0)+update.$inc.attempts;
  return row||null;
};
(ActivityNotification as any).findOneAndUpdate=async()=>{claims++;return null;};
(Notification as any).updateOne=async(filter:any,update:any)=>{updates++;Object.assign(rows.find(r=>r._id===filter._id),update);};
(PushDevice as any).deleteOne=async()=>{deletions++;};
(PushDevice as any).find=()=>({limit:async()=>[{_id:'synthetic-device',...subscription}]});
(User as any).exists=async()=>true;
for(const mode of ['preview','test','staging','unknown','conflict']) {
  environment(mode);
  rows=[{_id:'blocked',pushState:'PENDING',attempts:0}];const before=structuredClone(rows);
  const counters=[claims,updates,deletions,network];
  assert.equal(pushConfig(),null);
  await dispatchNotifications();
  await assert.rejects(sendPush(subscription,'{}',config,3600,{pushEnvironment:'PRODUCTION'}),/PUSH_SAFETY_BLOCKED/);
  assert.deepEqual(rows,before);assert.deepEqual([claims,updates,deletions,network],counters);
}
environment('test');
const quarantined=new Notification({spaId:new mongoose.Types.ObjectId(),userId:new mongoose.Types.ObjectId(),appointmentId:new mongoose.Types.ObjectId()});
const activity=new ActivityNotification({spaId:new mongoose.Types.ObjectId(),userId:new mongoose.Types.ObjectId(),kind:'INVOICE_CREATED',eventKey:'synthetic'});
await quarantined.validate();await activity.validate();
assert.equal(quarantined.pushEnvironment,'QUARANTINED');assert.equal(activity.pushEnvironment,'QUARANTINED');
environment('production');
assert.equal(quarantined.pushEnvironment,'QUARANTINED');
assert.equal(activity.pushEnvironment,'QUARANTINED');
await assert.rejects(sendPush(subscription,'{}',config,3600,{pushEnvironment:quarantined.pushEnvironment}),/PUSH_SAFETY_BLOCKED/);
// Production sends both current and legacy unmarked messages; quarantined backlog stays pending.
rows=[{_id:'legacy',spaId:'spa',userId:'owner',pushState:'PENDING'}, {_id:'current',spaId:'spa',userId:'owner',pushState:'PENDING',pushEnvironment:'PRODUCTION'}, {_id:'sandbox',spaId:'spa',userId:'owner',pushState:'PENDING',pushEnvironment:'QUARANTINED',attempts:0}];
await dispatchNotifications();
assert.equal(network,2);assert.equal(rows[0].pushState,'SENT');assert.equal(rows[1].pushState,'SENT');
assert.equal(rows[2].pushState,'PENDING');assert.equal(rows[2].attempts,0);
// Fail closed if environment changes after claiming; no SENT update or device deletion.
rows=[{_id:'changed',spaId:'spa',userId:'owner',pushState:'PENDING',pushEnvironment:'PRODUCTION'}];
(User as any).exists=async()=>{process.env.SPACARE_ENV='test';return true;};
const beforeNetwork=network,beforeUpdates=updates;
await dispatchNotifications();
assert.equal(network,beforeNetwork);assert.equal(updates,beforeUpdates);assert.equal(deletions,0);assert.equal(rows[0].pushState,'PENDING');
// Missing VAPID configuration retains the outbox without claiming it.
environment('production');
for(const key of ['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT']) {
  const original=process.env[key];delete process.env[key];const counts: number[]=[claims,updates,network];
  assert.equal(pushConfig(),null);await dispatchNotifications();
  assert.deepEqual([claims,updates,network],counts);process.env[key]=original;
}
// A mismatched connected namespace also stops before a claim.
environment('production');(mongoose.connection as any).name='spacare_test';const beforeClaims=claims;
await dispatchNotifications();assert.equal(claims,beforeClaims);
assert.equal(driver,0);
