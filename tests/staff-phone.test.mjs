import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('staff phones normalize for login, legacy emails remain valid, and index migration preserves uniqueness on failure', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./staff-phone-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  });
});
test('login authenticates canonical phone and legacy email, throttles phone variants, and denies wrong passwords/inactive accounts', () => {
  execFileSync(process.execPath, ['--import', 'tsx', '--experimental-test-module-mocks', fileURLToPath(new URL('./staff-login-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '', APP_ORIGIN: 'http://localhost:3100' }, stdio: 'pipe', timeout: 15000,
  });
});
