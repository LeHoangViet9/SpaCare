import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('auth handlers preserve 401/400/403 before DB access and return a safe 503 for missing DB', () => {
  execFileSync(process.execPath, ['--import', 'tsx', '--experimental-test-module-mocks', fileURLToPath(new URL('./auth-db-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '', APP_ORIGIN: 'http://localhost:3100' },
    stdio: 'pipe', timeout: 15000,
  });
});
