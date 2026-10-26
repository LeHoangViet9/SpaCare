import { parseEnv } from 'node:util';
import { assertDatabaseTarget, SafetyGuardError } from '../src/lib/production-safety.mjs';
import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync, appendFileSync } from 'node:fs';

// Only updates ignored local configuration. Never prints keys or database credentials.
const path = '.env.local';
let existing = '';
try { existing = readFileSync(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const fileConfig = parseEnv(existing);
const target = { ...fileConfig, ...process.env };
if (target.VERCEL || target.VERCEL_ENV || target.NODE_ENV === 'production' || target.SPACARE_ENV === 'production') throw new SafetyGuardError();
if (fileConfig.MONGODB_URI) assertDatabaseTarget(fileConfig.MONGODB_URI, target, 'maintenance');
if (target.MONGODB_URI) assertDatabaseTarget(target.MONGODB_URI, target, 'maintenance');
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
  let origin;
  try { origin = new URL(match[1]); } catch { throw new SafetyGuardError(); }
  if (origin.username || origin.password || !['http:', 'https:'].includes(origin.protocol)) throw new SafetyGuardError();
  lines.push(`VAPID_SUBJECT=${origin.origin}`);
}
if (!has('CRON_SECRET')) lines.push(`CRON_SECRET=${randomBytes(32).toString('hex')}`);
if (lines.length) appendFileSync(path, '\n' + lines.join('\n') + '\n', { mode: 0o600 });
console.log('Đã cấu hình khóa push trong .env.local; không thay khóa đã có.');
