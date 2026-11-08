import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {receiptDayInput} from '../src/lib/receipt-day.ts';

test('actual receipt days validate real calendar dates',()=>{
  assert.equal(receiptDayInput.safeParse('2026-11-07').success,true);
  for(const day of ['2026-02-30','2026-13-01','','2026-11-07T00:00:00Z'])assert.equal(receiptDayInput.safeParse(day).success,false);
});
test('creation receipts use actual days immediately across reporting, installments, checkout and card extra receipts (model doubles)',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./receipt-creation-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:20000});
});
