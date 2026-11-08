import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('invoice amount corrections preserve real receipt days across reports, debt, overview and closing (model doubles)',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-amount-cash-flow-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:20000});
});
