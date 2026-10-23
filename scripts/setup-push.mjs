import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync, appendFileSync } from 'node:fs';

// Only updates ignored local configuration. Never prints keys or database credentials.
const path = '.env.local';
let existing = '';
try { existing = readFileSync(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const has = key => new RegExp(`^${key}=.+`, 'm').test(existing);
const lines = [];
if (has('VAPID_PUBLIC_KEY') !== has('VAPID_PRIVATE_KEY')) throw new Error('Cần giữ nguyên cặp khóa VAPID; kiểm tra cấu hình thiếu khóa.');
if (!has('VAPID_PUBLIC_KEY')) {
  const dh = createECDH('prime256v1'); dh.generateKeys();
  lines.push(`VAPID_PUBLIC_KEY=${dh.getPublicKey().toString('base64url')}`, `VAPID_PRIVATE_KEY=${dh.getPrivateKey().toString('base64url')}`);
}
if (!has('VAPID_SUBJECT')) {
  const match = existing.match(/^APP_ORIGIN=["']?([^\r\n"']+)/m);
  if (!match) throw new Error('Cần APP_ORIGIN trước khi cấu hình push.');
  lines.push(`VAPID_SUBJECT=${new URL(match[1]).origin}`);
}
if (!has('CRON_SECRET')) lines.push(`CRON_SECRET=${randomBytes(32).toString('hex')}`);
if (lines.length) appendFileSync(path, '\n' + lines.join('\n') + '\n', { mode: 0o600 });
console.log('Đã cấu hình khóa push trong .env.local; không thay khóa đã có.');
