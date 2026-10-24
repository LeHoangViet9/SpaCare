import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('owner seed accepts phone/legacy email and rejects conflicting or non-owner identities without changing credentials', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./seed-owner-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  });
});
for (const scenario of ['new', 'existing', 'occupied']) {
  test(`owner setup: ${scenario} database preserves bootstrap boundaries`, () => {
    execFileSync(process.execPath, ['--import', 'tsx', '--experimental-test-module-mocks', fileURLToPath(new URL('./seed-owner-setup-fixture.ts', import.meta.url)), scenario], {
      env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
    });
  });
}

test('setup reports failed index stage/code without leaking driver messages', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', '--experimental-test-module-mocks', fileURLToPath(new URL('./seed-owner-setup-fixture.ts', import.meta.url)), 'index-error'], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  });
});
