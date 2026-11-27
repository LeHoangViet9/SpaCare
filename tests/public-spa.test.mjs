import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('public spa pages and bookings isolate two spas and fail closed for invalid or unpublished slugs (model doubles)', () => {
  execFileSync(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', fileURLToPath(new URL('./public-spa-fixture.tsx', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '', SPACARE_WRITE_FREEZE: 'OFF' }, stdio: 'pipe', timeout: 20000,
  });
});
