import test from 'node:test';
import assert from 'node:assert/strict';
import { packageTemplateInput, packageSaleInput, invoiceCharge } from '../src/lib/package-input.ts';
const id = '123456789012345678901234';
test('package catalog requires a service, positive sale price and bounded sessions', () => {
  const input = { name: ' Chăm sóc da ', serviceId: id, totalSessions: 10, price: 900000 };
  assert.equal(packageTemplateInput.parse(input).name, 'Chăm sóc da');
  for (const patch of [{ totalSessions: 0 }, { totalSessions: 1001 }, { totalSessions: 1.5 }, { price: 0 }, { serviceId: 'foreign' }]) assert.equal(packageTemplateInput.safeParse({ ...input, ...patch }).success, false);
});
test('sale requires saved template and promotion for gifts; gift price cannot be submitted', () => {
  const sale = { customerId: id, templateId: id, dueDate: '2026-12-01' };
  assert.deepEqual(packageSaleInput.parse(sale).gifts, []);
  assert.equal(packageSaleInput.safeParse({ ...sale, gifts: [{ templateId: id }] }).success, false);
  assert.equal(packageSaleInput.safeParse({ ...sale, promotion: '   ', gifts: [{ templateId: id }] }).success, false);
  assert.equal(packageSaleInput.parse({ ...sale, promotion: 'Tháng 10', gifts: [{ templateId: id }] }).gifts.length, 1);
  assert.equal(packageSaleInput.safeParse({ ...sale, promotion: 'Tháng 10', gifts: [{ templateId: id, price: 123 }] }).success, false);
  assert.equal(packageSaleInput.safeParse({ customerId: id, serviceId: id, name: 'Unsaved', totalSessions: 10, total: 100 }).success, false);
});
test('standalone invoice permits price override; covered session is always zero', () => {
  assert.equal(invoiceCharge(350000, undefined, false), 350000);
  assert.equal(invoiceCharge(350000, 250000, false), 250000);
  assert.equal(invoiceCharge(350000, 999999, true), 0);
  for (const value of [0, -1, 1.5, NaN, Infinity, 1000000000001]) assert.throws(() => invoiceCharge(350000, value, false));
});
