import assert from 'node:assert/strict';
import { mock } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let payload: Record<string, any> | null = null;
let historyKind = 'invoices';
mock.module('react', { namedExports: {
  ...React,
  useState: (initial: unknown) => [initial === null ? payload : initial === 'invoices' ? historyKind : initial, () => {}],
} });
const { default: InvoiceDetail } = await import('../src/components/invoice-detail');
const render = () => renderToStaticMarkup(React.createElement(InvoiceDetail, {
  record: { kind: 'customer', id: 'a'.repeat(24) }, onClose() {}, onInvoice() {},
}));

assert.match(render(), /Đang tải/);
for (const kind of ['invoices', 'appointments', 'treatments']) {
  historyKind = kind;
  payload = {
    customer: { name: 'Nguyễn An', phone: '0901234567' },
    summary: { appointments: 0, activePackages: 0, debt: 0, credit: null },
    kind, rows: [], total: 0, page: 1,
  };
  assert.match(render(), /Nguyễn An/);
  assert.match(render(), /Khách chưa có/);
}
historyKind = 'invoices';
payload!.kind = 'invoices';
payload!.rows = [{ _id: 'b'.repeat(24), description: 'Chăm sóc da', total: 100000, createdAt: '2026-11-05T03:00:00Z' }];
payload!.total = 1;
assert.match(render(), /Chăm sóc da/);
