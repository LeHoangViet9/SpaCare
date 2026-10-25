import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { workspaceQuery } from '../src/lib/workspace-query.ts';
const { readWorkspace } = await tsImport('../src/lib/workspace-read.ts', import.meta.url);
const { readStaffProfile } = await tsImport('../src/lib/staff-read.ts', import.meta.url);

test('restricted workspace sections reject unauthorized actors before database access', async () => {
  const employee = { id: 'a'.repeat(24), spaId: 'b'.repeat(24), name: 'Test', role: 'STAFF', cashier: false };
  for (const section of ['cash_cards', 'services', 'staff', 'audit', 'days', 'reports', 'cashier', 'package_catalog']) {
    await assert.rejects(readWorkspace(employee, workspaceQuery(new URLSearchParams({ section }))), error => error.status === 403);
  }
  for (const section of ['services', 'staff', 'audit', 'package_catalog']) {
    await assert.rejects(readWorkspace({ ...employee, cashier: true }, workspaceQuery(new URLSearchParams({ section }))), error => error.status === 403);
  }
});
test('staff profile denies staff and cashier before database reads', async () => {
  for (const cashier of [false, true]) await assert.rejects(readStaffProfile({ id: 'a'.repeat(24), spaId: 'b'.repeat(24), name: 'Test', role: 'STAFF', cashier }, 'c'.repeat(24)), error => error.status === 403);
});


test('customer shell reads scoped staff only, without financial or history queries', async t => {
  const { User, Day, Invoice, Deposit, Treatment, Customer } = await tsImport('../src/lib/models.ts', import.meta.url);
  const employee = { id: 'a'.repeat(24), spaId: 'b'.repeat(24), name: 'Test', role: 'STAFF', cashier: false };
  const staff = [{ _id: employee.id, name: 'Test' }];
  t.mock.method(User, 'find', filter => {
    assert.equal(filter.spaId, employee.spaId);
    return { select: fields => {
      assert.equal(fields.includes('email'), false);
      return { lean: async () => staff };
    } };
  });
  for (const model of [Day, Invoice, Deposit, Treatment, Customer]) {
    for (const method of ['find', 'findOne', 'aggregate', 'countDocuments']) {
      t.mock.method(model, method, () => { throw new Error('Unnecessary query: ' + model.modelName + '.' + method); });
    }
  }
  const result = await readWorkspace(employee, workspaceQuery(new URLSearchParams({ section: 'customers', search: 'test' })));
  assert.deepEqual(result.staff, staff);
  assert.deepEqual(result.customers, []);
  assert.deepEqual(result.invoices, []);
  assert.equal(result.user, employee);
});


test('appointment schema permits no performer but rejects malformed performer ids', async () => {
  const { Appointment } = await tsImport('../src/lib/models.ts', import.meta.url);
  const visit = new Appointment({ spaId: 'a'.repeat(24), customerId: 'b'.repeat(24), serviceId: 'c'.repeat(24), startAt: new Date() });
  assert.equal(visit.validateSync(), undefined);
  visit.staffId = 'invalid';
  assert.ok(visit.validateSync()?.errors.staffId);
});


test('panels with their own API do not load operational balances or history', async t => {
  const { User, Day, Invoice, Deposit, Treatment, Customer, Service, PackageTemplate, Appointment, CashEntry, TreatmentUse } = await tsImport('../src/lib/models.ts', import.meta.url);
  const owner = { id: 'a'.repeat(24), spaId: 'b'.repeat(24), name: 'Test', role: 'OWNER', cashier: true };
  t.mock.method(User, 'find', filter => {
    assert.equal(filter.spaId, owner.spaId);
    return { select: () => ({ lean: async () => [] }) };
  });
  for (const model of [Day, Invoice, Deposit, Treatment, Customer, Service, PackageTemplate, Appointment, CashEntry, TreatmentUse]) {
    for (const method of ['find', 'findOne', 'aggregate', 'countDocuments']) {
      t.mock.method(model, method, () => { throw new Error('Unnecessary read: ' + model.modelName); });
    }
  }
  for (const section of ['customers', 'salary', 'commission', 'products', 'product_groups', 'inventory', 'cash_cards']) {
    const result = await readWorkspace(owner, workspaceQuery(new URLSearchParams({ section })));
    assert.equal(result.user, owner);
    assert.deepEqual(result.invoices, []);
    assert.deepEqual(result.treatments, []);
  }
});


test('parallel customer reads preserve last-page fallback and authenticated scope', async t => {
  const { Customer } = await tsImport('../src/lib/models.ts', import.meta.url);
  const { findCustomerPage } = await tsImport('../src/lib/customer-search.ts', import.meta.url);
  const spaId = 'b'.repeat(24);
  const offsets = [];
  t.mock.method(Customer, 'countDocuments', filter => { assert.equal(filter.spaId, spaId); return Promise.resolve(12); });
  t.mock.method(Customer, 'find', filter => {
    assert.equal(filter.spaId, spaId);
    let offset;
    const cursor = { select: () => cursor, sort: () => cursor, skip: n => { offset = n; offsets.push(n); return cursor; }, limit: () => cursor,
      lean: async () => offset === 10 ? [{ _id: 'c'.repeat(24), name: 'Last page' }] : [] };
    return cursor;
  });
  const result = await findCustomerPage(spaId, { page: 99, pageSize: 10, search: '' });
  assert.equal(result.page, 2);
  assert.equal(result.total, 12);
  assert.equal(result.customers.length, 1);
  assert.deepEqual(offsets, [980, 10]);
  offsets.length = 0;
  const valid = await findCustomerPage(spaId, { page: 2, pageSize: 10, search: '' });
  assert.equal(valid.customers.length, 1);
  assert.deepEqual(offsets, [10]);
});
