import assert from 'node:assert/strict';
import { createECDH, createDecipheriv, createHmac, createPublicKey, randomBytes, verify } from 'node:crypto';
import { encryptPush, vapidAuthorization, sendPush } from '../src/lib/web-push';
import { allowedPushEndpoint, pushInput } from '../src/lib/push-validation';
import { Notification, PushDevice, User } from '../src/lib/models';
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
(Notification as any).findOneAndUpdate = async (filter: any, update: any) => {
  assert.equal(filter.spaId, 'spa'); assert.equal(filter.userId, 'owner');
  assert.equal(filter.pushState, 'PENDING'); assert.equal(update.$inc.attempts, 1);
  if (claimed++) return null;
  return row;
};
(Notification as any).updateOne = async () => { sent++; };
(User as any).exists = async (filter: any) => { assert.equal(filter.active, true); assert.equal(filter.role, 'OWNER'); return true; };
(PushDevice as any).find = (filter: any) => { assert.equal(filter.userId, 'owner'); return { limit: async () => [{ _id: 'device', ...subscription }] }; };
(PushDevice as any).deleteOne = async () => { deleted++; };
await dispatchNotifications({ spaId: 'spa', userId: 'owner' });
assert.equal(deleted, 1, 'Expired subscriptions are removed'); assert.equal(sent, 1);
claimed = 0; sent = 0;
globalThis.fetch = async () => new Response(null, { status: 503 });
await dispatchNotifications({ spaId: 'spa', userId: 'owner' });
assert.equal(sent, 0, 'Transient failures remain queued');
