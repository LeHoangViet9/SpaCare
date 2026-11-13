import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('package-owner use, optional confirmation, legacy recipient history, invoice dueDate visibility, multi-package sales and push validation', () => {
  execFileSync(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(new URL('./multi-use-invoice-push-fixture.ts', import.meta.url))],
    {
      env: { ...process.env, MONGODB_URI: 'mongodb://127.0.0.1:1/spacare_test' },
      stdio: 'pipe',
      timeout: 20000,
    }
  );
});
