import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('push encrypts/decrypts Unicode, signs verifiable VAPID, blocks arbitrary endpoints and retries transient failures', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./push-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  });
});
