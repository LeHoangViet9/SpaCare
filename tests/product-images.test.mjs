import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('product image bytes, upload limits and saved image URL validation', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./product-images-fixture.ts', import.meta.url))], { stdio: 'pipe', timeout: 15000 });
});