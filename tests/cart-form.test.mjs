import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('grouped cart render callbacks survive validated form traversal',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./cart-form-fixture.tsx',import.meta.url))],{stdio:'pipe',timeout:15000});
});
