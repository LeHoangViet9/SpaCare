import test from 'node:test';
import assert from 'node:assert/strict';
import { money, invoiceState, amountDue, allocationResult, overlaps, spaDay, dayBounds, confirmation, withinSpaHours } from '../src/lib/rules.ts';
test('cọc 500k áp 350k còn 150k và hóa đơn hết nợ', () => {
  const result = allocationResult(500000, 350000, 350000);
  assert.deepEqual(result, { balance: 150000, due: 0 });
});
test('hóa đơn 2tr áp cọc 500k và thu 1tr còn nợ 500k', () => {
  assert.equal(amountDue(2000000, 500000 + 1000000), 500000);
});
test('không phân bổ vượt cọc hoặc vượt công nợ', () => {
  assert.throws(() => allocationResult(100000, 500000, 200000));
  assert.throws(() => allocationResult(500000, 100000, 200000));
});
test('tiền phải nguyên VNĐ, không âm, NaN hoặc vượt giới hạn', () => {
  for (const value of [-1, 0, 1.5, NaN, Infinity, '100', 1000000000001]) assert.throws(() => money(value));
  assert.equal(money(0, true), 0);
  assert.equal(money(100000), 100000);
});
test('lịch nối tiếp được phép, giao nhau bị phát hiện', () => {
  const date = t => new Date(`2026-10-19T${t}:00+07:00`);
  assert.equal(overlaps(date('09:00'), date('10:00'), date('10:00'), date('11:00')), false);
  assert.equal(overlaps(date('09:00'), date('10:00'), date('09:30'), date('10:30')), true);
});
test('lịch phải bắt đầu từ 09:00 và kết thúc không muộn hơn 22:00 giờ Việt Nam', () => {
  const at = time => new Date(`2026-10-23T${time}:00+07:00`);
  assert.equal(withinSpaHours(at('09:00'), at('10:00')), true);
  assert.equal(withinSpaHours(at('21:00'), at('22:00')), true);
  assert.equal(withinSpaHours(at('08:59'), at('09:30')), false);
  assert.equal(withinSpaHours(at('21:30'), at('22:01')), false);
  assert.equal(withinSpaHours(at('21:30'), new Date('2026-10-23T17:00:00Z')), false);
  assert.equal(withinSpaHours(at('21:30'), at('21:00')), false);
});
test('ngày spa chuyển đúng tại 00h Việt Nam', () => {
  assert.equal(spaDay(new Date('2026-10-19T16:59:59Z')), '2026-10-19');
  assert.equal(spaDay(new Date('2026-10-19T17:00:00Z')), '2026-10-20');
  assert.equal(dayBounds('2026-10-19').start.toISOString(), '2026-10-18T17:00:00.000Z');
  assert.throws(() => dayBounds('2026-02-30'));
});
test('xác nhận thay thế cần lý do và tham chiếu bằng chứng', () => {
  assert.throws(() => confirmation('ALTERNATIVE', '', 'MSG-001'));
  assert.throws(() => confirmation('SIGNATURE_REFERENCE', '', ''));
  assert.doesNotThrow(() => confirmation('ALTERNATIVE', 'Khách không ký được, đã xác nhận theo quy trình', 'MSG-001'));
});


test('trạng thái hóa đơn đi theo số tiền đã trả và trở lại khi đảo giao dịch', () => {
  assert.equal(invoiceState(350000, 0), 'OPEN');
  assert.equal(invoiceState(350000, 1), 'PARTIALLY_PAID');
  assert.equal(invoiceState(350000, 349999), 'PARTIALLY_PAID');
  assert.equal(invoiceState(350000, 350000), 'PAID');
  assert.equal(invoiceState(350000, 200000), 'PARTIALLY_PAID');
  assert.equal(invoiceState(350000, 0), 'OPEN');
  assert.throws(() => invoiceState(350000, 350001));
  assert.throws(() => invoiceState(350000, -1));
});

import { packagePaymentDeadline, paymentEvidence } from '../src/lib/rules.ts';
test('selected package payment date accepts today and rejects past/invalid dates', () => {
 assert.equal(packagePaymentDeadline('2026-10-21', '2026-10-21'), '2026-10-21');
 assert.equal(packagePaymentDeadline('2026-11-02', '2026-10-21'), '2026-11-02');
 assert.throws(() => packagePaymentDeadline('2026-10-20', '2026-10-21'));
 assert.throws(() => packagePaymentDeadline('2026-02-30', '2026-01-01'));
});
test('cash and bank transfers require receipt confirmation without image references or notes', () => {
 assert.throws(() => paymentEvidence('CASH', false, ''));
 assert.doesNotThrow(() => paymentEvidence('CASH', true, ''));
 assert.throws(() => paymentEvidence('BANK_TRANSFER', false, 'Group photo 123'));
 assert.doesNotThrow(() => paymentEvidence('BANK_TRANSFER', true, ''));
 assert.doesNotThrow(() => paymentEvidence('BANK_TRANSFER', true, '  '));
 assert.doesNotThrow(() => paymentEvidence('BANK_TRANSFER', true, 'Group photo 123'));
 assert.doesNotThrow(() => paymentEvidence('BANK_TRANSFER', true, '', 'GROUP/2026/123'));
});

test('cọc dư được dùng nhiều lần mà không tăng tổng tiền đã nhận', () => {
  let balance = 800000;
  let paid = 0;
  for (const amount of [200000, 350000, 100000]) {
    const result = allocationResult(balance, amountDue(900000, paid), amount);
    balance = result.balance;
    paid += amount;
    assert.equal(balance + paid, 800000);
    assert.equal(result.due, amountDue(900000, paid));
  }
  assert.equal(balance, 150000);
  assert.equal(invoiceState(900000, paid), 'PARTIALLY_PAID');
  assert.throws(() => allocationResult(balance, 250000, 150001));
  assert.throws(() => allocationResult(balance, 50000, 50001));
});
test('hạn thanh toán bao gồm ngày cuối và chuyển tháng/năm, không tự đặt số ngày', () => {
  assert.equal(packagePaymentDeadline('2027-01-01', '2026-12-31'), '2027-01-01');
  assert.equal(packagePaymentDeadline('2028-02-29', '2028-02-29'), '2028-02-29');
  assert.throws(() => packagePaymentDeadline('2027-02-29', '2027-02-01'));
});
test('chuyển khoản chấp nhận thiếu tham chiếu nhưng không chấp nhận xác nhận thực nhận sai kiểu', () => {
  for (const received of [false, undefined, null, 'true', 1]) {
    assert.throws(() => paymentEvidence('BANK_TRANSFER', received, 'GROUP-PHOTO-123'));
  }
  for (const reference of ['', ' ', 'ab']) assert.doesNotThrow(() => paymentEvidence('BANK_TRANSFER', true, '', reference));
  assert.doesNotThrow(() => paymentEvidence('BANK_TRANSFER', true, 'Ảnh nhóm lúc 10:30'));
});

 test('hóa đơn quà tặng và buổi liệu trình 0đ đã thanh toán, vẫn chặn tiền sai', () => {
  assert.equal(invoiceState(0, 0), 'PAID');
  assert.equal(invoiceState(100000, 0), 'OPEN');
  assert.equal(invoiceState(100000, 50000), 'PARTIALLY_PAID');
  assert.equal(invoiceState(100000, 100000), 'PAID');
  for (const [total, paid] of [[0, 1], [-1, 0], [0, -1], [NaN, 0], ['0', 0]]) assert.throws(() => invoiceState(total, paid));
});
