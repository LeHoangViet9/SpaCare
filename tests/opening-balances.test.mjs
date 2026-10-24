import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('opening balances preserve historic rights without fake cash, retry safely and roll back the entire batch (model doubles)',()=>{execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./opening-balances-fixture.ts',import.meta.url))],{env:{...process.env,MONGODB_URI:'mongodb://127.0.0.1:1/spacare_test'},stdio:'pipe',timeout:20000});});
