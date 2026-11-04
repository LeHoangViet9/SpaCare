import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('leave management keeps desktop tables, mobile cards, filtered identity and state-based permissions',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./attendance-table-fixture.tsx',import.meta.url))],{stdio:'pipe',timeout:15000});
});
