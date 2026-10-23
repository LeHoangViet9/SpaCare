import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const { monthBounds, salaryTotal, payrollInputs } = await tsImport('../src/lib/payroll-rules.ts', import.meta.url);
const { payrollStaffScope, payrollQuery } = await tsImport('../src/lib/payroll-read.ts', import.meta.url);
const id = 'a'.repeat(24), other = 'b'.repeat(24), spaId = 'c'.repeat(24);
test('service commission is a fixed integer amount per service, without client tenant or employee scope', () => {
  for (const commission of [10000, 20000, 0]) {
    assert.deepEqual(payrollInputs.setServiceCommission.parse({ serviceId: id, commission, spaId: other, staffId: other }), { serviceId: id, commission });
  }
  for (const commission of [-1, 0.5, NaN, 1000000000001]) assert.equal(payrollInputs.setServiceCommission.safeParse({ serviceId: id, commission }).success, false);
  assert.equal(payrollInputs.setServiceCommission.safeParse({ serviceId: 'bad', commission: 10000 }).success, false);
});
test('monthly salary sums base, earned commission, bonus and deductions in integer VND', () => {
  assert.equal(salaryTotal(6000000, 300000, 200000, 100000), 6400000);
  assert.equal(salaryTotal(0, 30000, 0, 0), 30000);
  for (const values of [[1, 0, 0, 2], [0.5, 0, 0, 0], [1000000000000, 1, 0, 0], [1, NaN, 0, 0]]) assert.throws(() => salaryTotal(...values));
});
test('monthly commission boundaries use Vietnam timezone and cross December safely', () => {
  const range = monthBounds('2026-12');
  assert.equal(range.start.toISOString(), '2026-11-30T17:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-12-31T17:00:00.000Z');
  for (const month of ['2026-13', '2026-00', '2026-1', 'bad', '1999-12']) assert.throws(() => monthBounds(month));
});
test('staff including cashiers cannot read another employee salary or commissions', () => {
  for (const cashier of [true, false]) {
    const user = { id, spaId, name: 'Staff', role: 'STAFF', cashier };
    assert.deepEqual(payrollStaffScope(user), { spaId, staffId: id });
    assert.deepEqual(payrollStaffScope(user, id), { spaId, staffId: id });
    assert.throws(() => payrollStaffScope(user, other), e => e.status === 403);
  }
  assert.deepEqual(payrollStaffScope({ id, spaId, name: 'Owner', role: 'OWNER', cashier: false }), { spaId });
  assert.throws(() => payrollStaffScope({ id, spaId, name: 'Unknown', role: 'MANAGER', cashier: true }), e => e.status === 403);
});
test('payroll approval needs expected amount and payout requires actual-payment confirmation', () => {
  assert.equal(payrollInputs.approvePayroll.safeParse({ id }).success, false);
  assert.equal(payrollInputs.approvePayroll.parse({ id, expectedTotal: 6000000 }).expectedTotal, 6000000);
  assert.equal(payrollInputs.payPayroll.safeParse({ id, method: 'CASH', receivedConfirmation: false }).success, false);
  const payout = payrollInputs.payPayroll.parse({ id, method: 'CASH', receivedConfirmation: true, amount: 1, staffId: other });
  assert.equal(payout.amount, undefined); assert.equal(payout.staffId, undefined);
  assert.equal(payrollInputs.setStaffSalary.safeParse({ staffId: id, baseSalary: -1 }).success, false);
  assert.throws(() => payrollQuery(new URLSearchParams({ month: '2026-12', employee: 'bad' })));
});

 test('leave records validate calendar days and never accept salary deductions', () => {
 const value = {staffId: id, day:'2026-02-28', type:'PERMITTED', deductions: 500000};
 assert.equal(payrollInputs.recordStaffLeave.parse(value).deductions, undefined);
 for (const day of ['2026-02-30','2026-13-01','bad']) assert.equal(payrollInputs.recordStaffLeave.safeParse({...value,day}).success,false);
 for (const type of ['PERMITTED','UNPERMITTED']) assert.equal(payrollInputs.recordStaffLeave.parse({...value,type}).type,type);
 assert.equal(payrollInputs.recordStaffLeave.safeParse({...value,type:'PAID'}).success,false);
});
