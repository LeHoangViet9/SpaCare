import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
for(const scenario of ['success','cancelled','conflict','check-conflict','rollback'])test('historical Hương Lan supplement: '+scenario,()=>{
 execFileSync(process.execPath,['--import','tsx','--experimental-test-module-mocks',fileURLToPath(new URL('./supplement-huong-lan-fixture.ts',import.meta.url)),scenario],{stdio:'pipe',timeout:15000});
});
