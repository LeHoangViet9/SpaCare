import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('invoice-level receipts preserve sources, historical allocations, retries, permissions and rollback (model doubles)', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./split-payment-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: 'mongodb://fixture.invalid/spacare_test' }, stdio: 'pipe', timeout: 15000,
  });
});
