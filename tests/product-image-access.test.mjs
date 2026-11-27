import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('product image routes enforce public slug/product ownership and authenticated internal previews (model doubles)', () => {
  execFileSync(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', fileURLToPath(new URL('./product-image-access-fixture.ts', import.meta.url))], {
    env: { ...process.env, MONGODB_URI: 'mongodb://127.0.0.1:1/spacare_test' }, stdio: 'pipe', timeout: 15000,
  });
});
