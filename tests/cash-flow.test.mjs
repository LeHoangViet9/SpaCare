import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tsImport } from 'tsx/esm/api';

const { cashFlowEntries, cashFlowMatch, cashFlowNet, cashFlowTotals } = await tsImport('../src/lib/cash-flow.ts', import.meta.url);
const day = '2026-11-02';

test('method totals count receipts and real expenses, excluding reversed receipts and expenses with linked reversals', () => {
 const entries = [];
 for (const method of ['CASH','BANK_TRANSFER']) {
  entries.push({method,direction:'IN',amount:500,kind:'PAYMENT'}, {method,direction:'OUT',amount:80,kind:'REFUND'});
  for (const direction of ['IN','OUT']) {
   entries.push({method,direction,amount:900,reversed:true},
    {method,direction:direction==='IN'?'OUT':'IN',amount:900,kind:'REVERSAL',originalId:'synthetic-source'});
  }
 }
 assert.deepEqual(cashFlowTotals(entries),{cashIn:500,cashOut:80,bankIn:500,bankOut:80});
 assert.deepEqual(cashFlowTotals([]),{cashIn:0,cashOut:0,bankIn:0,bankOut:0});
});

function summarize(entries) {
 const actual = cashFlowEntries(entries);
 const days = new Map();
 const methods = new Map();
 for (const entry of actual) {
  const total = days.get(entry.day) || { incoming: 0, outgoing: 0 };
  total[entry.direction === 'IN' ? 'incoming' : 'outgoing'] += entry.amount;
  days.set(entry.day, total);
  const methodTotal = methods.get(entry.method) || { incoming: 0, outgoing: 0 };
  methodTotal[entry.direction === 'IN' ? 'incoming' : 'outgoing'] += entry.amount;
  methods.set(entry.method, methodTotal);
 }
 return {
  incoming: actual.filter(entry => entry.direction === 'IN').reduce((sum, entry) => sum + entry.amount, 0),
  outgoing: actual.filter(entry => entry.direction === 'OUT').reduce((sum, entry) => sum + entry.amount, 0),
  days,
  methods,
 };
}

// Synthetic identifiers only; this fixture does not reference operational invoices.
function correctedPaymentFixture() {
 return [
  { _id: 'original', day, direction: 'IN', method: 'BANK_TRANSFER', amount: 1_750_000, kind: 'PAYMENT', reversed: true },
  { _id: 'reversal', day, direction: 'OUT', method: 'BANK_TRANSFER', amount: 1_750_000, kind: 'REVERSAL', originalId: 'original' },
  { _id: 'test-cash-a-cash', invoiceCode: 'TEST-CASH-A', day, direction: 'IN', method: 'CASH', amount: 90_000, kind: 'PAYMENT' },
  { _id: 'test-cash-b-cash', invoiceCode: 'TEST-CASH-B', day, direction: 'IN', method: 'CASH', amount: 40_000, kind: 'PAYMENT' },
  { _id: 'test-cash-c-cash', invoiceCode: 'TEST-CASH-C', day, direction: 'IN', method: 'CASH', amount: 60_000, kind: 'PAYMENT' },
  { _id: 'test-cash-d-cash', invoiceCode: 'TEST-CASH-D', day, direction: 'IN', method: 'CASH', amount: 130_000, kind: 'PAYMENT' },
  { _id: 'test-bank-a-bank', invoiceCode: 'TEST-BANK-A', day, direction: 'IN', method: 'BANK_TRANSFER', amount: 60_000, kind: 'PAYMENT' },
  { _id: 'test-bank-b-bank', invoiceCode: 'TEST-BANK-B', day, direction: 'IN', method: 'BANK_TRANSFER', amount: 1_750_000, kind: 'PAYMENT' },
  { _id: 'test-replacement-replacement', invoiceCode: 'TEST-REPLACEMENT', day, direction: 'IN', method: 'BANK_TRANSFER', amount: 1_750_000, kind: 'PAYMENT', invoiceCreatedAt: '2026-11-01' },
 ];
}

test('ordinary receipts remain in actual cash totals', () => {
 const entries = [{ day, direction: 'IN', method: 'CASH', amount: 125_000, kind: 'INCOME' }];
 assert.deepEqual(cashFlowEntries(entries), entries);
 assert.equal(summarize(entries).incoming, 125_000);
 assert.equal(summarize(entries).outgoing, 0);
});

test('a linked correction pair is excluded while the replacement receipt is counted once', () => {
 const entries = correctedPaymentFixture();
 const actual = cashFlowEntries(entries);
 const result = summarize(entries);

 assert.deepEqual(actual.map(entry => entry._id), [
  'test-cash-a-cash', 'test-cash-b-cash', 'test-cash-c-cash', 'test-cash-d-cash',
  'test-bank-a-bank', 'test-bank-b-bank', 'test-replacement-replacement',
 ]);
 assert.equal(result.incoming, 3_880_000);
 assert.equal(result.outgoing, 0);
 assert.deepEqual(result.methods.get('CASH'), { incoming: 320_000, outgoing: 0 });
 assert.deepEqual(result.methods.get('BANK_TRANSFER'), { incoming: 3_560_000, outgoing: 0 });
 assert.equal(cashFlowNet(entries, 'CASH'), 320_000);
 assert.equal(cashFlowNet(entries, 'BANK_TRANSFER'), 3_560_000);
 assert.deepEqual(cashFlowMatch({ day }), {
  $and: [
   { day },
   { reversed: { $ne: true } },
   { $nor: [{ kind: 'REVERSAL', originalId: { $exists: true, $ne: null } }] },
  ],
 });
});

test('a real refund remains an outgoing cash flow', () => {
 const entries = [
  { day, direction: 'IN', method: 'BANK_TRANSFER', amount: 600_000, kind: 'PAYMENT' },
  { day, direction: 'OUT', method: 'BANK_TRANSFER', amount: 250_000, kind: 'REFUND' },
 ];
 assert.equal(summarize(entries).incoming, 600_000);
 assert.equal(summarize(entries).outgoing, 250_000);
 assert.ok(cashFlowEntries(entries).some(entry => entry.kind === 'REFUND'));
});

test('cash totals use receipt day, independently of invoice creation day', () => {
 const entries = correctedPaymentFixture();
 const result = summarize(entries);
 assert.equal(result.days.get(day).incoming, 3_880_000);
 assert.equal(result.days.has('2026-11-01'), false);
 assert.equal(entries.find(entry => entry._id === 'test-replacement-replacement').invoiceCreatedAt, '2026-11-01');
 const reportRead = readFile(new URL('../src/lib/report-read.ts', import.meta.url), 'utf8');
 return reportRead.then(source => {
  assert.ok(source.includes('cashFlowMatch({ ...scope'));
  assert.ok(source.includes("dated('createdAt')"));
 });
});

test('overview, report, CSV, and day close share the same correction rule', async () => {
 const entries = correctedPaymentFixture();
 const result = summarize(entries);
 const overview = {
  incoming: result.days.get(day).incoming,
  outgoing: result.days.get(day).outgoing,
  cashIn: result.methods.get('CASH').incoming,
  bankIn: result.methods.get('BANK_TRANSFER').incoming,
 };
 const report = { incoming: result.incoming, outgoing: result.outgoing, days: result.days };
 const csvRows = [...report.days].map(([key, flow]) => [key, flow.incoming, flow.outgoing, flow.incoming - flow.outgoing]);
 const methodCsvRows = [...result.methods].map(([method, flow]) => [
  method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản',
  flow.incoming,
  flow.outgoing,
  flow.incoming - flow.outgoing,
 ]);
 const closingCashExpected = cashFlowNet(entries, 'CASH');
 const closingBankNet = cashFlowNet(entries, 'BANK_TRANSFER');

 assert.deepEqual(overview, { incoming: 3_880_000, outgoing: 0, cashIn: 320_000, bankIn: 3_560_000 });
 assert.equal(report.incoming - report.outgoing, 3_880_000);
 assert.deepEqual(csvRows, [[day, 3_880_000, 0, 3_880_000]]);
 assert.deepEqual(methodCsvRows, [
  ['Tiền mặt', 320_000, 0, 320_000],
  ['Chuyển khoản', 3_560_000, 0, 3_560_000],
 ]);
 assert.equal(closingCashExpected, 320_000);
 assert.equal(closingBankNet, 3_560_000);
 assert.equal(closingCashExpected + closingBankNet, 3_880_000);

 const workspaceRead = await readFile(new URL('../src/lib/workspace-read.ts', import.meta.url), 'utf8');
 const reportRead = await readFile(new URL('../src/lib/report-read.ts', import.meta.url), 'utf8');
 const operations = await readFile(new URL('../src/lib/operations.ts', import.meta.url), 'utf8');
 const reportsUi = await readFile(new URL('../src/components/reports.tsx', import.meta.url), 'utf8');
 const workspaceUi = await readFile(new URL('../src/components/workspace.tsx', import.meta.url), 'utf8');
 assert.ok(workspaceRead.includes("cashFlowMatch({ ...aggregateScope, day: today })"));
 assert.ok(workspaceRead.includes('cashFlowMatch(match)'));
 assert.ok((workspaceRead.match(/cashFlowMatch\(/g) || []).length >= 3);
 assert.ok((reportRead.match(/cashFlowMatch\(/g) || []).length >= 2);
 assert.ok(operations.includes('CashEntry.find(cashFlowMatch({ ...scope, day: d.day }))'));
 assert.ok(operations.includes('cashFlowNet(entries, method)'));
 assert.ok(reportsUi.includes('(r.days || []).map((d: Row) => [d._id, d.incoming, d.outgoing, d.incoming - d.outgoing])'));
 assert.ok(reportsUi.includes("(r.methods || []).map((m: Row) => [m._id === 'CASH' ? 'Tiền mặt'"));
 assert.ok(reportsUi.includes("['Theo phương thức']"));
 assert.ok(workspaceUi.includes('data.totals.cashInflow'));
 assert.ok(workspaceUi.includes('data.totals.bankInflow'));
 assert.ok(workspaceUi.includes('bankNet:r.liveBankNet'));
 assert.ok(workspaceUi.includes('Chuyển khoản ròng: {vnd(r.liveBankNet)}'));
});

test('correction rows remain in the ledger source data for lookup and audit', async () => {
 const entries = correctedPaymentFixture();
 assert.deepEqual(entries.map(entry => entry._id), [
  'original', 'reversal', 'test-cash-a-cash', 'test-cash-b-cash', 'test-cash-c-cash',
  'test-cash-d-cash', 'test-bank-a-bank', 'test-bank-b-bank', 'test-replacement-replacement',
 ]);

 const workspaceRead = await readFile(new URL('../src/lib/workspace-read.ts', import.meta.url), 'utf8');
 assert.ok(workspaceRead.includes("models[collection].find(filter).select(fields[collection] || '')"));
});
