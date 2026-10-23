import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('public booking rejects full slots without writes, uses free staff, validates inputs and reuses retries (model doubles)', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./public-booking-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  });
});
