import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('notification events preserve daily timing, scope, deduplication, transaction rollback and detailed push content',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./notification-events-fixture.ts',import.meta.url))],{env:{...process.env,MONGODB_URI:'mongodb://127.0.0.1:1/spacare_test'},stdio:'pipe',timeout:15000});
});

test('notification API scopes inbox and device ownership, rejects customer/inactive accounts and protects cron',()=>{
 execFileSync(process.execPath,['--import','tsx','--experimental-test-module-mocks',fileURLToPath(new URL('./notification-security-fixture.ts',import.meta.url))],{env:{...process.env,MONGODB_URI:'mongodb://127.0.0.1:1/spacare_test',APP_ORIGIN:'http://localhost:3100'},stdio:'pipe',timeout:15000});
});

test('appointment reminders enforce time windows, state, recipient scope, reschedule deduplication and rollback',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./appointment-reminders-fixture.ts',import.meta.url))],{env:{...process.env,MONGODB_URI:'mongodb://127.0.0.1:1/spacare_test'},stdio:'pipe',timeout:15000});
});
