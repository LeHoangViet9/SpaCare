import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('attendance uses three shared tables instead of employee cards and excludes owner',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./attendance-table-fixture.tsx',import.meta.url))],{stdio:'pipe',timeout:15000});
});
