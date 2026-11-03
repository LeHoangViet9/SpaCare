import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';

const { cashReversalReferences } = await tsImport('../src/lib/cash-reversal-reference.ts', import.meta.url);
const { default: CashEntryNote } = await tsImport('../src/components/cash-entry-note.tsx', import.meta.url);
const { CashEntry, Payment, Invoice, allModels } = await tsImport('../src/lib/models.ts', import.meta.url);
const { readWorkspace } = await tsImport('../src/lib/workspace-read.ts', import.meta.url);
const { workspaceQuery } = await tsImport('../src/lib/workspace-query.ts', import.meta.url);
const { cashFlowEntries } = await tsImport('../src/lib/cash-flow.ts', import.meta.url);
const spaId = 'a'.repeat(24), foreignSpa = 'f'.repeat(24);
const id = n => n.toString(16).padStart(24, '0');
const originals = [
  { _id: id(1), spaId, kind: 'PAYMENT', reversed: true },
  { _id: id(2), spaId, kind: 'INCOME', reversed: true },
  { _id: id(3), spaId: foreignSpa, kind: 'PAYMENT' },
  ...[4, 5, 6, 7].map(n => ({ _id: id(n), spaId, kind: 'PAYMENT' })),
];
const payments = [
  { spaId, receiptId: id(1), invoiceId: id(21), reversed: true },
  { spaId, receiptId: id(2), invoiceId: id(21) }, // A non-PAYMENT original must never be followed.
  { spaId: foreignSpa, receiptId: id(3), invoiceId: id(21) },
  { spaId: foreignSpa, receiptId: id(4), invoiceId: id(21) },
  { spaId, receiptId: id(5), invoiceId: id(25) },
  { spaId, receiptId: id(6), invoiceId: id(26) },
  { spaId, receiptId: id(7), invoiceId: id(27) },
];
const invoices = [
  { _id: id(21), spaId, code: 'HD000067', effectiveCode: 'HD000099', status: 'CANCELLED' },
  { _id: id(25), spaId: foreignSpa, code: 'HD000025' },
  { _id: id(26), spaId },
  { _id: id(27), spaId, code: 'invalid' },
];
const rows = originals.map((original, index) => ({
  _id: id(index + 101), spaId, kind: 'REVERSAL', originalId: original._id,
  note: 'Đảo sai sót', direction: 'OUT', amount: 100, day: '2026-11-03',
}));
rows.push({ _id: id(110), spaId, kind: 'PAYMENT', originalId: id(1), direction: 'IN', amount: 100, reversed: true });

function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return value.every(clause => matches(row, clause));
    if (key === '$or') return value.some(clause => matches(row, clause));
    if (value && typeof value === 'object' && '$in' in value) return value.$in.some(id => String(id) === String(row[key]));
    return String(row[key]) === String(value);
  });
}
function cursor(data, filter) {
  const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query,
    lean: async () => structuredClone(data), cast: () => filter };
  return query;
}
function mockReferences(t) {
  const calls = [];
  for (const [model, data] of [[CashEntry, originals], [Payment, payments], [Invoice, invoices]]) {
    t.mock.method(model, 'find', filter => {
      assert.equal(filter.spaId, spaId, `${model.modelName} must be scoped to the current spa`);
      assert.equal('reversed' in filter, false);
      assert.equal('status' in filter, false);
      calls.push(model.modelName);
      return cursor(data.filter(row => matches(row, filter)), filter);
    });
  }
  return calls;
}

test('reversal follows only same-spa PAYMENT history, including reversed payments and cancelled invoices', async t => {
  const calls = mockReferences(t);
  const before = structuredClone(rows);
  const enriched = await cashReversalReferences(spaId, rows);
  assert.deepEqual(calls, ['CashEntry', 'Payment', 'Invoice']);
  assert.equal(enriched[0].reversalInvoiceCode, 'HD000067');
  assert.ok(enriched.slice(1).every(row => row.reversalInvoiceCode === undefined));
  assert.deepEqual(rows, before, 'read enrichment cannot mutate ledger history');
  assert.deepEqual(enriched.map(({ reversalInvoiceCode, ...row }) => row), before);
  const markup = renderToStaticMarkup(React.createElement(CashEntryNote, { entry: enriched[0], fallback: 'Đảo giao dịch' }));
  assert.match(markup, /Hóa đơn: HD000067/);
  assert.ok(markup.includes('#' + rows[0]._id.slice(-6)), 'keep reversal transaction code');
  assert.ok(markup.includes('Giao dịch gốc: #' + rows[0].originalId.slice(-6)), 'keep original transaction code');
  assert.ok(!markup.includes('HD000099'), 'show original invoice code, not replacement code');
  for (const entry of enriched.slice(1)) {
    const html = renderToStaticMarkup(React.createElement(CashEntryNote, { entry, fallback: 'Giao dịch' }));
    assert.ok(!html.includes('Hóa đơn:'));
    assert.ok(!html.includes('Giao dịch gốc:'), 'unlinked transactions retain their existing presentation');
  }
});

test('PAYMENT rows show only their issued same-spa invoice code and keep receipt identity', async t => {
  mockReferences(t);
  const before = structuredClone(originals);
  const enriched = await cashReversalReferences(spaId, originals);
  assert.equal(enriched[0].paymentInvoiceCode, 'HD000067');
  assert.ok(enriched.slice(1).every(row => row.paymentInvoiceCode === undefined));
  assert.ok(enriched.every(row => row.reversalInvoiceCode === undefined));
  assert.deepEqual(enriched.map(({ paymentInvoiceCode, ...row }) => row), before);
  assert.deepEqual(originals, before);
  for (const [index, entry] of enriched.entries()) {
    const markup = renderToStaticMarkup(React.createElement(CashEntryNote, { entry, fallback: 'Thu hóa đơn' }));
    assert.equal(markup.includes('Hóa đơn: HD000067'), index === 0);
    assert.ok(markup.includes('#' + String(entry._id).slice(-6)));
    assert.ok(!markup.includes('Giao dịch gốc:'));
    assert.ok(!markup.includes('HD000099'));
  }
});

test('pages without payments or reversals do not query invoice references', async t => {
  for (const model of [CashEntry, Payment, Invoice]) t.mock.method(model, 'find', () => assert.fail('Unexpected reference read'));
  const entries = [{ _id: id(1), kind: 'INCOME' }];
  assert.equal(await cashReversalReferences(spaId, entries), entries);
});

test('workspace enriches its cash page without changing summary aggregation, amounts or reversal flags', async t => {
  const ledger = [
    { ...originals[0], direction: 'IN', amount: 100 },
    rows[0],
    { _id: id(120), spaId, kind: 'INCOME', direction: 'IN', amount: 50 },
  ];
  for (const model of allModels) {
    t.mock.method(model, 'find', filter => cursor([], filter));
    t.mock.method(model, 'findOne', () => ({ lean: async () => null }));
    t.mock.method(model, 'countDocuments', async () => 0);
  }
  t.mock.method(CashEntry, 'countDocuments', async () => ledger.length);
  t.mock.method(CashEntry, 'find', filter => {
    if (filter.$and) return cursor(ledger, filter);
    assert.equal(filter.spaId, spaId);
    return cursor(originals.filter(row => matches(row, filter)), filter);
  });
  t.mock.method(Payment, 'find', filter => {
    assert.equal(filter.spaId, spaId);
    return cursor(payments.filter(row => matches(row, filter)), filter);
  });
  t.mock.method(Invoice, 'find', filter => {
    if (filter.$and) return cursor([], filter);
    assert.equal(filter.spaId, spaId);
    return cursor(invoices.filter(row => matches(row, filter)), filter);
  });
  let aggregations = 0;
  t.mock.method(CashEntry, 'aggregate', async pipeline => {
    aggregations++;
    assert.deepEqual(pipeline[0].$match.$and[0].$and[0], { spaId });
    assert.deepEqual(pipeline[0].$match.$and.slice(1), [
      { reversed: { $ne: true } },
      { $nor: [{ kind: 'REVERSAL', originalId: { $exists: true, $ne: null } }] },
    ]);
    assert.deepEqual(pipeline[1], { $group: { _id: null,
      incoming: { $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$amount', 0] } },
      outgoing: { $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$amount', 0] } },
    } });
    return [cashFlowEntries(ledger).reduce((total, entry) => {
      total[entry.direction === 'IN' ? 'incoming' : 'outgoing'] += entry.amount;
      return total;
    }, { incoming: 0, outgoing: 0 })];
  });
  const result = await readWorkspace({ id: id(200), spaId, role: 'OWNER', name: 'Test' }, workspaceQuery(new URLSearchParams({ section: 'cash' })));
  assert.equal(aggregations, 1);
  assert.deepEqual(result.pages.cash.summary, { incoming: 50, outgoing: 0 });
  assert.equal(result.pages.cash.total, ledger.length);
  assert.equal(result.pages.cash.rows[1].reversalInvoiceCode, 'HD000067');
  assert.equal(result.pages.cash.rows[0].paymentInvoiceCode, 'HD000067');
  const stripReference = ({ reversalInvoiceCode, paymentInvoiceCode, ...row }) => row;
  assert.deepEqual(result.cash.map(stripReference), ledger);
  assert.deepEqual(cashFlowEntries(result.cash).map(stripReference), cashFlowEntries(ledger), 'production exclusion of reversal pairs remains identical');
});
