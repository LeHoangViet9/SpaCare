import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('customer containment blocks profile claims, legacy disclosure, new sessions and unauthenticated access without DB work', () => {
  execFileSync(process.execPath, ['--import','tsx','--experimental-test-module-mocks',fileURLToPath(new URL('./customer-security-fixture.tsx',import.meta.url))], { env: {...process.env,MONGODB_URI:'',APP_ORIGIN:'http://localhost:3100'},stdio:'pipe',timeout:15000 });
});
