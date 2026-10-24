import test from 'node:test';
import assert from 'node:assert/strict';
import { menu, pageKeys, menuPath, canViewPage } from '../src/lib/navigation.ts';

test('mobile groups resolve every desktop page, including nested administration pages', () => {
  for (const key of pageKeys()) {
    const path = menuPath(key);
    assert.ok(menu.includes(path[0]));
    assert.equal(path.at(-1).key, key);
  }
  assert.deepEqual(menuPath('customers').map(n => n.key), ['operations', 'customers']);
  assert.deepEqual(menuPath('cash_cards').map(n=>n.key),['finance','cash_cards']);
  assert.deepEqual(menuPath('deposits').map(n => n.key), ['finance', 'deposits']);
  assert.deepEqual(menuPath('staff').map(n => n.key), ['admin', 'staff_group', 'staff']);
  assert.deepEqual(menuPath('unknown'), []);
});
test('distinct payroll pages are available to owner and staff', () => {
 const keys = pageKeys();
 assert.equal(keys.length, 21);
 assert.equal(new Set(keys).size, keys.length);
 for (const role of ['OWNER', 'STAFF']) for (const key of ['salary', 'commission']) assert.equal(canViewPage(key, { role, cashier: true }), true);
 assert.equal(canViewPage('unknown', { role: 'OWNER' }), false);
 assert.equal(menu.find(n => n.key === 'admin').children[0].children.filter(n => n.pending).length, 0);
});
test('page access preserves owner and cashier boundaries', () => {
 for (const key of ['product_groups', 'inventory', 'staff', 'audit', 'services', 'package_catalog']) {
  assert.equal(canViewPage(key, { role: 'STAFF', cashier: true }), false);
  assert.equal(canViewPage(key, { role: 'OWNER' }), true);
 }
 // STAFF được xem danh sách sản phẩm (read-only); quản lý kho/nhóm vẫn chỉ OWNER
 assert.equal(canViewPage('products', { role: 'STAFF' }), true);
 assert.equal(canViewPage('products', { role: 'OWNER' }), true);
 for (const key of ['days', 'reports', 'cashier', 'cash_cards']) {
  assert.equal(canViewPage(key, { role: 'STAFF' }), false);
  assert.equal(canViewPage(key, { role: 'STAFF', cashier: true }), true);
 }
 for (const key of ['overview', 'appointments', 'customers', 'packages', 'treatment_uses', 'invoices', 'deposits', 'cash']) assert.equal(canViewPage(key, { role: 'STAFF' }), true);
});

test('payroll navigation allows owner/staff but not an unimplemented manager role', () => {
  for (const role of ['STAFF', 'OWNER', 'MANAGER']) {
    for (const cashier of [false, true]) {
      for (const page of ['salary', 'commission']) assert.equal(canViewPage(page, { role, cashier }), role !== 'MANAGER');
    }
  }
  for (const page of ['staff', 'audit', 'services', 'package_catalog']) assert.equal(canViewPage(page, { role: 'MANAGER' }), false);
  for (const key of pageKeys()) assert.equal(canViewPage(key, { role: 'CUSTOMER' }), false);
});
