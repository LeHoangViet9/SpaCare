import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('package receipt reads saved uses per package and preserves session history and 80mm layout',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-package-progress-fixture.ts',import.meta.url))],{stdio:'inherit',timeout:20000});
});
