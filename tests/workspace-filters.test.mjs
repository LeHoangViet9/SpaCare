import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceQuery } from '../src/lib/workspace-query.ts';
import { listFilter, datePreset } from '../src/lib/workspace-filters.ts';
const query = (section, extra = {}) => workspaceQuery(new URLSearchParams({ section, ...extra }));
test('list filters reject cross-section states and malformed identities/ranges', () => {
  for (const input of [{ status: 'PAID' }, { employee: 'foreign' }, { customer: 'other' }, { method: 'CARD' }, { direction: 'REFUND' }, { from: '2026-02-30' }]) assert.throws(() => query('appointments', input));
  assert.equal(query('invoices', { status: 'OVERDUE' }).status, 'OVERDUE');
  assert.equal(query('services', { category: ' Da ' }).category, 'Da');
});
test('date filters include complete Vietnam days and ledger uses accounting day', () => {
  const q = query('appointments', { from: '2026-10-22', to: '2026-10-22' });
  const range = listFilter('appointments', q, '2026-10-22').$and[0].startAt;
  assert.equal(range.$gte.toISOString(), '2026-10-21T17:00:00.000Z');
  assert.equal(range.$lt.toISOString(), '2026-10-22T17:00:00.000Z');
  const cash = listFilter('cash', query('cash', { from: '2026-10-22', to: '2026-10-22', direction: 'OUT', method: 'CASH' }), '2026-10-22');
  assert.ok(cash.$and.some(c => c.day?.$gte === '2026-10-22' && c.day?.$lte === '2026-10-22'));
  assert.ok(cash.$and.some(c => c.direction === 'OUT'));
  assert.ok(cash.$and.some(c => c.method === 'CASH'));
});
test('payment filters use amounts so legacy stored status does not hide debt', () => {
  const debt = listFilter('invoices', query('invoices', { status: 'DEBT' }), '2026-10-22');
  assert.deepEqual(debt.$and[0], { $expr: { $gt: ['$total', '$paid'] } });
  const overdue = listFilter('invoices', query('invoices', { status: 'OVERDUE' }), '2026-10-22');
  assert.deepEqual(overdue.$and[1], { dueDate: { $gt: '', $lt: '2026-10-22' } });
  assert.deepEqual(listFilter('invoices', query('invoices', { status: 'PAID' }), '2026-10-22').$and[0], { $expr: { $gte: ['$paid', '$total'] } });
});
test('date presets handle month and year boundaries', () => {
  assert.deepEqual(datePreset('today', '2026-10-22'), { from: '2026-10-22', to: '2026-10-22' });
  assert.deepEqual(datePreset('week', '2026-12-29'), { from: '2026-12-29', to: '2027-01-04' });
  assert.deepEqual(datePreset('month', '2028-02-29'), { from: '2028-02-01', to: '2028-02-29' });
});

 test('cancelled invoices have a separate filter and never appear as paid', () => {
  const cancelled = listFilter('invoices', query('invoices', {status:'CANCELLED'}), '2026-10-25');
  assert.ok(cancelled.$and.some(c => c.status === 'CANCELLED'));
  const paid = listFilter('invoices', query('invoices', {status:'PAID'}), '2026-10-25');
  assert.ok(paid.$and.some(c => c.status?.$ne === 'CANCELLED'));
});


test('cancelled treatments stay out of operational lists even when searching gifts or a customer',()=>{
 for(const extra of [{},{status:'GIFT'},{customer:'a'.repeat(24)},{status:'ACTIVE'}]){
  const filter=listFilter('treatments',query('packages',extra),'2026-10-26');
  assert.ok(filter.$and.some(c=>c.status?.$ne==='CANCELLED'));
 }
});
