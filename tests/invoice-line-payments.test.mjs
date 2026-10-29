import test from 'node:test';
import assert from 'node:assert/strict';
import { applyInvoiceLinePayment } from '../src/lib/invoice-line-payments.ts';
const service = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const packageId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const product = 'cccccccccccccccccccccccc';
const session = 'dddddddddddddddddddddddd';
const lines = () => [
  { lineId: service, total: 300000, paid: 0, performerId: 'staff-a' },
  { lineId: packageId, total: 2000000, paid: 0 },
  { lineId: product, total: 100000, paid: 0 },
  { lineId: session, total: 0, paid: 0, performerId: 'staff-b' },
];

test('partial payment funds only explicitly selected lines and preserves performer snapshots', () => {
  const original = lines();
  original.forEach(Object.freeze); Object.freeze(original);
  const result = applyInvoiceLinePayment(original, [{lineId:service,amount:100000},{lineId:packageId,amount:500000}], 600000);
  assert.deepEqual(result.map(line => line.paid), [100000,500000,0,0]);
  assert.deepEqual(original.map(line => line.paid), [0,0,0,0]);
  assert.equal(result[0].performerId, 'staff-a');
  assert.equal(result[3].performerId, 'staff-b');
});

test('reversing the original allocation preserves a later independent payment', () => {
  const allocation = [{lineId:service,amount:100000},{lineId:packageId,amount:500000}];
  const first = applyInvoiceLinePayment(lines(), allocation, 600000);
  const second = applyInvoiceLinePayment(first, [{lineId:product,amount:100000}], 100000);
  const reversed = applyInvoiceLinePayment(second, allocation, 600000, 'REVERSE');
  assert.deepEqual(reversed.map(line => line.paid), [0,0,100000,0]);
  assert.throws(() => applyInvoiceLinePayment(reversed, allocation, 600000, 'REVERSE'));
});

test('rejects missing, foreign, duplicate and case-variant duplicate line allocations', () => {
  assert.throws(() => applyInvoiceLinePayment(lines(), [], 1));
  assert.throws(() => applyInvoiceLinePayment([], [{lineId:service,amount:1}], 1));
  assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId:'eeeeeeeeeeeeeeeeeeeeeeee',amount:1}], 1));
  for (const id of [service,service.toUpperCase()])
    assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId:service,amount:1},{lineId:id,amount:1}], 2));
  assert.throws(() => applyInvoiceLinePayment([...lines(),{lineId:service.toUpperCase(),total:1,paid:0}], [{lineId:service,amount:1}], 1));
});

test('rejects mismatched totals, overpayment and money on a zero-priced treatment use', () => {
  assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId:service,amount:1}], 2));
  assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId:service,amount:300001}], 300001));
  assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId:session,amount:1}], 1));
});

test('invalid final allocation leaves all input balances unchanged', () => {
  const input = lines();
  const before = structuredClone(input);
  assert.throws(() => applyInvoiceLinePayment(input, [{lineId:service,amount:1},{lineId:product,amount:100001}], 100002));
  assert.deepEqual(input,before);
});

test('rejects malformed money, identifiers, state and direction', () => {
  for (const amount of [0,-1,0.1,NaN,Infinity,1000000000001,Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId:service,amount}], amount));
    assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId:service,amount}], 1));
  }
  for (const lineId of ['', 'service', null])
    assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId,amount:1}], 1));
  for (const balance of [{total:-1,paid:0},{total:1,paid:2},{total:1,paid:0,refunded:1},{total:1.1,paid:0}])
    assert.throws(() => applyInvoiceLinePayment([{lineId:service,...balance}], [{lineId:service,amount:1}], 1));
  assert.throws(() => applyInvoiceLinePayment(lines(), [{lineId:service,amount:1}], 1, 'REFUND'));
});

test('reversal cannot reduce paid below already refunded money', () => {
  const input = [{lineId:packageId,total:1000,paid:1000,refunded:800}];
  assert.throws(() => applyInvoiceLinePayment(input,[{lineId:packageId,amount:201}],201,'REVERSE'));
  assert.equal(applyInvoiceLinePayment(input,[{lineId:packageId,amount:200}],200,'REVERSE')[0].paid,800);
});

test('handles the integer VND limit exactly and rejects an invoice exceeding it', () => {
  const input = [{lineId:service,total:999999999999,paid:0},{lineId:packageId,total:1,paid:0}];
  assert.deepEqual(applyInvoiceLinePayment(input,[{lineId:service,amount:999999999999},{lineId:packageId,amount:1}],1000000000000).map(x=>x.paid),[999999999999,1]);
  assert.throws(() => applyInvoiceLinePayment([...input,{lineId:product,total:1,paid:0}],[{lineId:service,amount:1}],1));
});
