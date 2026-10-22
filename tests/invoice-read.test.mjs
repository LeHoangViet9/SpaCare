import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('package invoice reads existing session signatures, paginates and preserves staff signature scope', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./invoice-read-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  });
});
