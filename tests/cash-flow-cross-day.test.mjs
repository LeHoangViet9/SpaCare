import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('cross-day correction preserves CLOSED snapshot while report, CSV and reopened close use current ledger (model doubles)', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./cash-flow-cross-day-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: 'mongodb://127.0.0.1:1/spacare_test' },
    stdio: 'pipe', timeout: 15000,
  });
});
