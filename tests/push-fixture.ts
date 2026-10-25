import assert from 'node:assert/strict';
import { createECDH, createDecipheriv, createHmac, createPublicKey, randomBytes, verify } from 'node:crypto';
import { encryptPush, vapidAuthorization, sendPush } from '../src/lib/web-push';
import { allowedPushEndpoint, pushInput } from '../src/lib/push-validation';
import { ActivityNotification, Notification, PushDevice, User } from '../src/lib/models';
import { dispatchNotifications } from '../src/lib/notifications';

const ua = createECDH('prime256v1'); ua.generateKeys();
const vapid = createECDH('prime256v1'); vapid.generateKeys();
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/example',
  keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
const config = { subject: 'https://example.test', publicKey: vapid.getPublicKey().toString('base64url'), privateKey: vapid.getPrivateKey().toString('base64url') };
assert.ok(pushInput.safeParse(subscription).success);
for (const endpoint of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x',
  'https://fcm.googleapis.com.evil.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:444/x']) {
  assert.equal(allowedPushEndpoint(endpoint), false);
}
assert.ok(allowedPushEndpoint('https://web.push.apple.com/test'));
assert.ok(allowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/test'));
const payload = JSON.stringify({ title: 'Lịch hẹn mới', body: 'Mở SpaCare', tag: 'booking-test' });
const encrypted = encryptPush(subscription, payload);
assert.notDeepEqual(encryptPush(subscription, payload), encrypted, 'Each delivery uses fresh salt and ephemeral keys');
assert.equal(encrypted.readUInt32BE(16), 4096);
const serverKey = encrypted.subarray(21, 21 + encrypted[20]);
// Independent receiver-side derivation decrypts the exact RFC aes128gcm record.
const hkdf = (salt: Buffer, input: Buffer, info: Buffer, length: number) => {
  const prk = createHmac('sha256', salt).update(input).digest();
  return createHmac('sha256', prk).update(info).update(Buffer.from([1])).digest().subarray(0, length);
};
const ikm = hkdf(Buffer.from(subscription.keys.auth, 'base64url'), ua.computeSecret(serverKey),
  Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), serverKey]), 32);
const salt = encrypted.subarray(0, 16);
const key = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
const decipher = createDecipheriv('aes-128-gcm', key, nonce);
decipher.setAuthTag(encrypted.subarray(-16));
const decrypted = Buffer.concat([decipher.update(encrypted.subarray(21 + encrypted[20], -16)), decipher.final()]);
assert.equal(decrypted.at(-1), 2);
assert.equal(decrypted.subarray(0, -1).toString(), payload);
const authorization = vapidAuthorization(subscription.endpoint, config);
const token = authorization.match(/^vapid t=(.*), k=/)![1];
const [header, claims, signature] = token.split('.');
const pub = vapid.getPublicKey();
const publicKey = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256',
  x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') } });
assert.ok(verify('sha256', Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
assert.equal(JSON.parse(Buffer.from(claims, 'base64url').toString()).aud, 'https://fcm.googleapis.com');
let calls = 0;
globalThis.fetch = async (_url, options) => {
  calls++;
  assert.equal(options?.redirect, 'error');
  assert.equal((options?.headers as any)['Content-Encoding'], 'aes128gcm');
  return new Response(null, { status: 410 });
};
await assert.rejects(sendPush(subscription, payload, config), (error: any) => error.statusCode === 410);
await assert.rejects(sendPush({ ...subscription, endpoint: 'https://localhost/x' }, payload, config));
assert.equal(calls, 1, 'Never contact a supplied private/arbitrary endpoint');

process.env.VAPID_PUBLIC_KEY = config.publicKey; process.env.VAPID_PRIVATE_KEY = config.privateKey; process.env.VAPID_SUBJECT = config.subject;
let row: any = { _id: 'notice', spaId: 'spa', userId: 'owner', appointmentId: 'booking', url: '/workspace/appointments?search=booking' };
let claimed = 0, sent = 0, deleted = 0;
(ActivityNotification as any).findOneAndUpdate = async () => null;
(Notification as any).findOneAndUpdate = async (filter: any, update: any) => {
  assert.equal(filter.spaId, 'spa'); assert.equal(filter.userId, 'owner');
  assert.equal(filter.pushState, 'PENDING'); assert.equal(update.$inc.attempts, 1);
  if (claimed++) return null;
  return row;
};
(Notification as any).updateOne = async () => { sent++; };
(User as any).exists = async (filter: any) => { assert.equal(filter.active, true); assert.deepEqual(filter.role, { $in: ['OWNER', 'STAFF'] }); return true; };
(PushDevice as any).find = (filter: any) => { assert.equal(filter.userId, 'owner'); return { limit: async () => [{ _id: 'device', ...subscription }] }; };
(PushDevice as any).deleteOne = async () => { deleted++; };
await dispatchNotifications({ spaId: 'spa', userId: 'owner' });
assert.equal(deleted, 1, 'Expired subscriptions are removed'); assert.equal(sent, 1);
claimed = 0; sent = 0;
globalThis.fetch = async () => new Response(null, { status: 503 });
await dispatchNotifications({ spaId: 'spa', userId: 'owner' });
assert.equal(sent, 0, 'Transient failures remain queued');


// Deliver actual booking/invoice content, permit staff bookings, and suppress closed-day reminders.
const decoded:any[]=[];const saved:any[]=[];
const bookings:any[]=[{_id:'book-staff',spaId:'spa',userId:'staff',title:'Booking',body:'Guest - 0912345678 - Service - 14:17',url:'/workspace/appointments?search=book'}];
const activities:any[]=[{_id:'invoice-owner',spaId:'spa',userId:'owner',kind:'INVOICE_CREATED',title:'Invoice',body:'Guest - Total 350.000',url:'/workspace/invoices?search=invoice'},
 {_id:'invoice-staff',spaId:'spa',userId:'staff',kind:'INVOICE_CREATED',title:'Private invoice',body:'Do not deliver'},
 {_id:'closed-day',spaId:'spa',userId:'owner',kind:'DAY_CLOSE',day:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}),title:'Close day',body:'Already closed'}];
(Notification as any).findOneAndUpdate=async()=>bookings.shift()||null;
(ActivityNotification as any).findOneAndUpdate=async()=>activities.shift()||null;
(Notification as any).updateOne=(filter:any,update:any)=>{saved.push({filter,update});return Promise.resolve({});};
(ActivityNotification as any).updateOne=(filter:any,update:any)=>{saved.push({filter,update});return Promise.resolve({});};
(User as any).exists=async(filter:any)=>{assert.equal(filter.active,true);return filter._id==='owner'||(filter._id==='staff'&&Array.isArray(filter.role?.$in)&&filter.role.$in.includes('STAFF'));};
const {Day}=await import('../src/lib/models');
(Day as any).exists=async()=>true;
(PushDevice as any).find=()=>({limit:async()=>[{_id:'device',...subscription}]});
globalThis.fetch=async(_url,options)=>{
 const bytes=Buffer.from(options!.body as Uint8Array);const peer=bytes.subarray(21,21+bytes[20]);
 const material=hkdf(Buffer.from(subscription.keys.auth,'base64url'),ua.computeSecret(peer),Buffer.concat([Buffer.from('WebPush: info\0'),ua.getPublicKey(),peer]),32);
 const aesKey=hkdf(bytes.subarray(0,16),material,Buffer.from('Content-Encoding: aes128gcm\0'),16);
 const aesNonce=hkdf(bytes.subarray(0,16),material,Buffer.from('Content-Encoding: nonce\0'),12);
 const cipher=createDecipheriv('aes-128-gcm',aesKey,aesNonce);cipher.setAuthTag(bytes.subarray(-16));
 const text=Buffer.concat([cipher.update(bytes.subarray(21+bytes[20],-16)),cipher.final()]);decoded.push(JSON.parse(text.subarray(0,-1).toString()));
 return new Response(null,{status:201});
};
await dispatchNotifications({spaId:'spa'});
assert.equal(decoded.length,2);assert.equal(decoded[0].body,'Guest - 0912345678 - Service - 14:17');assert.equal(decoded[1].body,'Guest - Total 350.000');
assert.notEqual(decoded[0].tag,decoded[1].tag);assert.ok(saved.find(item=>item.filter._id==='closed-day')?.update.readAt);


// Reminders expire at arrival and cannot survive cancellation, rescheduling or reassignment.
const {Appointment}=await import('../src/lib/models');
const arrival=new Date(Date.now()+600000),changed=new Date(Date.now()+500000),pastArrival=new Date(Date.now()-60000);
const reminder=(id:string,userId='staff',start=arrival)=>({_id:id,spaId:'spa',userId,kind:'APPOINTMENT_REMINDER',appointmentId:id,appointmentStartAt:start,title:'Upcoming',body:'Guest at 14:17',url:'/workspace/appointments'});
activities.push(reminder('valid'),reminder('cancelled'),reminder('rescheduled'),reminder('expired','staff',pastArrival),reminder('reassigned'),reminder('owner-private','owner'));
(Appointment as any).findOne=(filter:any)=>({select:()=>({lean:async()=>filter._id==='cancelled'?null:{startAt:filter._id==='rescheduled'?changed:filter._id==='expired'?pastArrival:arrival,bookingSource:['reassigned','owner-private'].includes(filter._id)?undefined:'PUBLIC_WEB',staffId:'different-staff'}})});
decoded.length=0;saved.length=0;const ttls:number[]=[];const decryptingFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{ttls.push(Number((options!.headers as any).TTL));return decryptingFetch(url,options);};
await dispatchNotifications({spaId:'spa'});
assert.equal(decoded.length,2);assert.ok(ttls.every(ttl=>ttl>0&&ttl<=600));
for(const id of ['cancelled','rescheduled','expired','reassigned'])assert.ok(saved.find(item=>item.filter._id===id)?.update.readAt);
