import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('retired programs never apply; manual discounts and historical snapshots survive (model doubles)',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./discount-program-fixture.ts',import.meta.url))],{stdio:'inherit',timeout:20000});
});
