import { assertDatabaseTarget } from '../src/lib/production-safety.mjs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

// Set before Next loads .env.local so the demo cannot open the operational DB.
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spacare_demo?replicaSet=rs0&directConnection=true';
assertDatabaseTarget(uri, process.env, 'demo');
const parsed = new URL(uri);
if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || parsed.pathname !== '/spacare_demo') {
  throw new Error('dev:demo chỉ chấp nhận database spacare_demo.');
}
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--webpack', '--port', '3000'], {
  stdio: 'inherit',
  env: { ...process.env, MONGODB_URI: uri, APP_ORIGIN: process.env.APP_ORIGIN || 'http://localhost:3000' },
});
child.on('error', error => { console.error('Không khởi động được server demo:', error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
