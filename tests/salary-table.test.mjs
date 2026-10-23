import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('salary table shows both commission components and protects approved/paid actions', () => {
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./salary-table-fixture.tsx',import.meta.url))],{stdio:'pipe',timeout:15000});
});
