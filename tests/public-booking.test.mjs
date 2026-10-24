import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('public arrival booking has no invented duration/capacity, validates opening hours and reuses retries (model doubles)', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./public-booking-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  });
});
