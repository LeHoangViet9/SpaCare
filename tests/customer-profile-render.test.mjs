import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('customer profile renders loaded history without requiring an invoice object', () => {
  execFileSync(process.execPath, ['--import', 'tsx', '--experimental-test-module-mocks',
    fileURLToPath(new URL('./customer-profile-render-fixture.tsx', import.meta.url))],
  { stdio: 'pipe', timeout: 15000 });
});
