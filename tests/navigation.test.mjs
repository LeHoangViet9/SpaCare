import test from 'node:test';
import assert from 'node:assert/strict';
import { menu, pageKeys, canViewPage } from '../src/lib/navigation.ts';
test('distinct pages; unconfirmed payroll and commission stay unavailable', () => {
 const keys = pageKeys();
 assert.equal(keys.length, 13);
 assert.equal(new Set(keys).size, keys.length);
 for (const role of ['OWNER', 'STAFF']) for (const key of ['salary', 'commission', 'unknown']) assert.equal(canViewPage(key, { role, cashier: true }), false);
 assert.equal(menu.find(n => n.key === 'admin').children[0].children.filter(n => n.pending).length, 2);
});
test('page access preserves owner and cashier boundaries', () => {
 for (const key of ['staff', 'audit', 'services']) {
  assert.equal(canViewPage(key, { role: 'STAFF', cashier: true }), false);
  assert.equal(canViewPage(key, { role: 'OWNER' }), true);
 }
 for (const key of ['days', 'reports']) {
  assert.equal(canViewPage(key, { role: 'STAFF' }), false);
  assert.equal(canViewPage(key, { role: 'STAFF', cashier: true }), true);
 }
 for (const key of ['overview', 'appointments', 'customers', 'packages', 'treatment_uses', 'invoices', 'deposits', 'cash']) assert.equal(canViewPage(key, { role: 'STAFF' }), true);
});

test('quyền quản lý xem lương/hoa hồng còn OPEN: chưa mở trang cho bất kỳ vai trò nào', () => {
  for (const role of ['STAFF', 'OWNER', 'MANAGER']) {
    for (const cashier of [false, true]) {
      for (const page of ['salary', 'commission']) assert.equal(canViewPage(page, { role, cashier }), false);
    }
  }
  for (const page of ['staff', 'audit', 'services']) assert.equal(canViewPage(page, { role: 'MANAGER' }), false);
});
