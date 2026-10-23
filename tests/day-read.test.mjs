import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('day page keeps current-day state independent of list filters and ignores hidden search', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./day-read-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  });
});
