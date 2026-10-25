import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('booking lists the customer package before service selection and uses large service choices',()=>{execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./appointment-package-picker-fixture.tsx',import.meta.url))],{stdio:'pipe',timeout:20000});});
