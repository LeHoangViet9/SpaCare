import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('invoice discount boundaries, stored receipt content and PDF rendering',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-discount-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:20000});
});
