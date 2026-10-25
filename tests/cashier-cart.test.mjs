import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('cashier cart keeps multiple products/packages and builds one atomic checkout with optional signature',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./cashier-cart-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:15000});
});
