import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('optional invoice deadlines validate dates and render only against actual debt',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-deadline-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:20000});
});
