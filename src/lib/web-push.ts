// RFC 8291 (aes128gcm, single record) and RFC 8292 (VAPID ES256).
// Uses Node's OpenSSL-backed primitives; no dependency on a background browser session.
import { createECDH, createCipheriv, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { allowedPushEndpoint } from './push-validation';
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
type Vapid = { subject: string; publicKey: string; privateKey: string };
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();
const expand = (key: Buffer, info: Buffer, size: number) => hmac(key, Buffer.concat([info, Buffer.from([1])])).subarray(0, size);

export function encryptPush(subscription: Subscription, payload: string) {
  const plain = Buffer.from(payload);
  if (plain.length > 3000) throw new Error('Push payload too large');
  const ua = Buffer.from(subscription.keys.p256dh, 'base64url');
  const auth = Buffer.from(subscription.keys.auth, 'base64url');
  const dh = createECDH('prime256v1');
  const server = dh.generateKeys();
  const shared = dh.computeSecret(ua);
  const ikm = expand(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua, server]), 32);
  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const key = expand(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = expand(prk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = createCipheriv('aes-128-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([plain, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header); header.writeUInt32BE(4096, 16); header[20] = server.length;
  return Buffer.concat([header, server, encrypted]);
}
export function vapidAuthorization(endpoint: string, config: Vapid) {
  const publicKey = Buffer.from(config.publicKey, 'base64url');
  const privateKey = createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256',
    x: publicKey.subarray(1, 33).toString('base64url'), y: publicKey.subarray(33).toString('base64url'), d: config.privateKey } });
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 3600, sub: config.subject })).toString('base64url');
  const unsigned = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `vapid t=${unsigned}.${signature}, k=${config.publicKey}`;
}
export async function sendPush(subscription: Subscription, payload: string, config: Vapid, ttl = 3600) {
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 86400) throw new Error('Invalid push TTL');
  if (!allowedPushEndpoint(subscription.endpoint)) throw new Error('Unsupported push endpoint');
  const encrypted = encryptPush(subscription, payload);
  const response = await fetch(subscription.endpoint, { method: 'POST', redirect: 'error',
    signal: AbortSignal.timeout(8000), headers: { Authorization: vapidAuthorization(subscription.endpoint, config),
      TTL: String(ttl), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(encrypted) });
  if (!response.ok) throw Object.assign(new Error('Push delivery failed'), { statusCode: response.status });
  await response.body?.cancel();
}
