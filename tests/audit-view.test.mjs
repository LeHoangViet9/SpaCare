import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const {auditLines,auditActions}=await tsImport('../src/lib/audit-view.ts',import.meta.url);

test('audit formats money, customer references and payment method', () => {
  const lines = auditLines({ amount: 500000, method: 'BANK_TRANSFER', customerId: 'abc123456', reason: 'Thu lần hai' }, { customers: [{ _id: 'abc123456', name: 'Ngọc Anh' }] });
  assert.ok(lines.some(s => s.includes('500.000')));
  assert.ok(lines.some(s => s.includes('Ngọc Anh')));
  assert.ok(lines.some(s => s.includes('Chuyển khoản')));
  assert.equal(auditActions.payment, 'Thu tiền hóa đơn');
});
test('audit compares only recorded changes and hides internal or sensitive payloads', () => {
  const lines = auditLines({ before: { remaining: 10, status: 'ACTIVE' }, after: { remaining: 9, status: 'ACTIVE' }, signature: { strokes: [] }, password: 'secret', signatureDigest: 'hash', reason: 'Khách xác nhận' }, {});
  assert.ok(lines.includes('Số buổi còn lại: 10 → 9'));
  assert.ok(!lines.some(s => /secret|hash|strokes|Trạng thái/.test(s)));
  assert.ok(lines.includes('Lý do: Khách xác nhận'));
});
test('legacy records do not invent previous values and keep missing references traceable', () => {
  assert.deepEqual(auditLines(null, {}), ['Bản ghi cũ chưa có thông tin chi tiết để hiển thị.']);
  assert.deepEqual(auditLines({ name: 'Tên mới' }, {}), ['Tên: Tên mới']);
  assert.ok(auditLines({ invoiceId: 'abc123456' }, {})[0].includes('Hóa đơn #123456'));
});
