import test from 'node:test';
import assert from 'node:assert/strict';
import { cashierCatalog } from '../src/lib/cashier-catalog.ts';
const data = {
  services: [{ _id: 'face', name: 'Chăm sóc da', active: true }, { _id: 'old', name: 'Ngừng bán', active: false }],
  packageTemplates: [{ _id: 'template', serviceId: 'face', name: 'Gói mùa thu', active: true }, { _id: 'inactive', serviceId: 'face', name: 'Gói ngừng', active: false }, { _id: 'old-template', serviceId: 'old', name: 'Gói dịch vụ cũ', active: true }],
  treatments: [{ _id: 'own', customerId: 'customer', serviceId: 'face', name: 'Gói da', status: 'ACTIVE', remaining: 2 }, { _id: 'other', customerId: 'other', serviceId: 'face', name: 'Gói da', status: 'ACTIVE', remaining: 2 }, { _id: 'paused', customerId: 'customer', serviceId: 'face', name: 'Gói da', status: 'PAUSED', remaining: 2 }, { _id: 'empty', customerId: 'customer', serviceId: 'face', name: 'Gói da', status: 'ACTIVE', remaining: 0 }],
};
test('cashier searches without accents and excludes stopped services/templates', () => {
  assert.deepEqual(cashierCatalog(data, 'service', '', 'CHAM SOC').map(r => r._id), ['face']);
  assert.deepEqual(cashierCatalog(data, 'package', '', 'cham soc da').map(r => r._id), ['template']);
  assert.equal(cashierCatalog(data, 'package', '', 'khong ton tai').length, 0);
});
test('cashier suggests only selected customer active packages with sessions remaining', () => {
  assert.equal(cashierCatalog(data, 'session', '', '').length, 0);
  assert.deepEqual(cashierCatalog(data, 'session', 'customer', '').map(r => r._id), ['own']);
});
