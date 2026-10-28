import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const { Appointment, TreatmentUse, Treatment, Payment, Customer, Invoice } = await tsImport('../src/lib/models.ts', import.meta.url);
const { staffReadScope } = await tsImport('../src/lib/staff-read-scope.ts', import.meta.url);
const { invoiceScope } = await tsImport('../src/lib/invoice-read.ts', import.meta.url);
const { findCustomerPage } = await tsImport('../src/lib/customer-search.ts', import.meta.url);
const { readCustomerHistory } = await tsImport('../src/lib/customer-history.ts', import.meta.url);
const staff = { id: 'a'.repeat(24), spaId: 'b'.repeat(24), role: 'STAFF', cashier: false, name: 'Synthetic' };
const cursor = rows => ({ select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => rows });
function assignments(t) {
  t.mock.method(Appointment, 'find', filter => { assert.equal(filter.spaId, staff.spaId); assert.equal(filter.staffId, staff.id); return cursor([{ customerId: 'customer-own', treatmentIds: ['package-own'] }]); });
  t.mock.method(TreatmentUse, 'find', filter => { assert.deepEqual(filter, { spaId: staff.spaId, $or: [{ actorId: staff.id }, { staffId: staff.id }] }); return cursor([{ customerId: 'customer-performed', treatmentId: 'package-performed' }]); });
}
test('ordinary STAFF customer/package/use scopes derive exclusively from assignments', async t => {
  assignments(t);
  const scope = await staffReadScope(staff);
  assert.deepEqual(scope.customers, { spaId: staff.spaId, _id: { $in: ['customer-own', 'customer-performed'] } });
  assert.deepEqual(scope.treatments, { spaId: staff.spaId, _id: { $in: ['package-own', 'package-performed'] } });
  assert.deepEqual(scope.uses.$or, [{ actorId: staff.id }, { staffId: staff.id }]);
});
test('no assignments grants no customers or packages; owner/cashier lookup remains available', async t => {
  t.mock.method(Appointment, 'find', () => cursor([]));
  t.mock.method(TreatmentUse, 'find', () => cursor([]));
  const access = await staffReadScope(staff);
  assert.deepEqual(access.customers._id.$in, []);
  assert.deepEqual(access.treatments._id.$in, []);
  for (const user of [{ ...staff, role: 'OWNER' }, { ...staff, cashier: true }]) {
    assert.deepEqual((await staffReadScope(user)).customers, { spaId: staff.spaId });
  }
});
test('customer lookup intersects direct client ID with STAFF scope before count and pagination', async t => {
  assignments(t);
  const target = 'c'.repeat(24);
  const verify = filter => { assert.equal(filter.$and[0]._id, target); assert.deepEqual(filter.$and[1]._id.$in, ['customer-own', 'customer-performed']); };
  t.mock.method(Customer, 'countDocuments', filter => { verify(filter); return Promise.resolve(0); });
  t.mock.method(Customer, 'find', filter => { verify(filter); return cursor([]); });
  t.mock.method(Appointment, 'aggregate', async () => []);
  const result = await findCustomerPage(staff.spaId, { id: target, search: '', page: 1, pageSize: 10 }, staff);
  assert.equal(result.total, 0); assert.deepEqual(result.customers, []);
  await assert.rejects(findCustomerPage('foreign', { search: '', page: 1, pageSize: 10 }, staff), e => e.status === 403);
});
test('unassigned customer history denies before reading invoices, packages or credit', async t => {
  assignments(t);
  t.mock.method(Customer, 'findOne', filter => { assert.ok(filter.$and[0]._id.$in.includes('customer-own')); return cursor(null); });
  t.mock.method(Invoice, 'find', () => { throw Error('Forbidden history query'); });
  t.mock.method(Treatment, 'countDocuments', () => { throw Error('Forbidden package query'); });
  await assert.rejects(readCustomerHistory(staff, 'c'.repeat(24), 'treatments', 1), e => e.status === 404);
});
test('cashier reads old outstanding debt and same-day collections without granting all historical invoices', async t => {
  assignments(t);
  t.mock.method(Treatment, 'find', () => cursor([]));
  t.mock.method(Payment, 'find', filter => { assert.equal(filter.spaId, staff.spaId); assert.equal(filter.reversed, false); assert.equal(filter.createdAt.$lt - filter.createdAt.$gte, 86400000); return cursor([{ invoiceId: 'collected-old-invoice' }]); });
  const scope = await invoiceScope({ ...staff, cashier: true });
  assert.equal(scope.spaId, staff.spaId);
  assert.deepEqual(scope.$or[0], { status: { $ne: 'CANCELLED' }, $expr: { $gt: ['$total', '$paid'] } });
  assert.ok(scope.$or.some(c => c._id?.$in.includes('collected-old-invoice')));
  assert.equal(scope.$or.some(c => c.customerId), false);
  assert.deepEqual(await invoiceScope({ ...staff, role: 'OWNER' }), { spaId: staff.spaId });
});
