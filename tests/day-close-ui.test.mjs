import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('closing preview shows expected cash and exactly one counted input before confirmation',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./day-close-ui-fixture.tsx',import.meta.url))],{stdio:'pipe',timeout:15000});
});
