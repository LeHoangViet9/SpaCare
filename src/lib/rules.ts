export class DomainError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function ensure(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new DomainError(message, status);
}
export const MAX_MONEY = 1_000_000_000_000;
export function money(value: unknown, allowZero = false): number {
  ensure(typeof value === 'number' && Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= MAX_MONEY,
    'Số tiền phải là số nguyên VNĐ hợp lệ, tối đa 1.000 tỷ.');
  return value;
}
export function amountDue(total: number, paid: number): number { return total - paid; }
export function invoiceState(total: number, paid: number): 'OPEN' | 'PARTIALLY_PAID' | 'PAID' {
  money(total, true); money(paid, true);
  ensure(paid <= total, 'Số thanh toán vượt tổng hóa đơn.');
  return paid === total ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'OPEN';
}
export function allocationResult(balance: number, due: number, amount: number) {
  money(amount);
  ensure(amount <= balance, 'Không đủ số dư cọc.');
  ensure(amount <= due, 'Số tiền vượt công nợ hóa đơn.');
  return { balance: balance - amount, due: due - amount };
}
export function overlaps(start: Date, end: Date, otherStart: Date, otherEnd: Date) {
  return start < otherEnd && end > otherStart;
}
export function withinSpaHours(start: Date, end: Date): boolean {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return false;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = (date: Date) => Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const from = parts(start), to = parts(end);
  const startMinute = Number(from.hour) * 60 + Number(from.minute);
  const endMinute = Number(to.hour) * 60 + Number(to.minute);
  return from.year === to.year && from.month === to.month && from.day === to.day
    && startMinute >= 9 * 60 && endMinute <= 22 * 60;
}
export function spaDay(date = new Date()): string {
  return new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
export function dayBounds(day: string) {
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(day), 'Ngày không hợp lệ.');
  const start = new Date(`${day}T00:00:00+07:00`);
  ensure(!Number.isNaN(start.getTime()) && spaDay(start) === day, 'Ngày không hợp lệ.');
  return { start, end: new Date(start.getTime() + 86400_000) };
}
export function confirmation(method: string, reason: string, evidence: string) {
  ensure(['SIGNATURE_REFERENCE', 'ALTERNATIVE'].includes(method), 'Cần phương thức xác nhận.');
  ensure(evidence.trim().length >= 3, 'Cần tham chiếu bằng chứng xác nhận.');
  if (method === 'ALTERNATIVE') ensure(reason.trim().length >= 3, 'Xác nhận thay thế phải có lý do.');
}

// The date is selected for this sale; no default 7/14-day policy is inferred.
export function packagePaymentDeadline(dueDate: string, today = spaDay()) {
  dayBounds(dueDate);
  ensure(dueDate >= today, 'Hạn thanh toán không được trước ngày bán.');
  return dueDate;
}
export function paymentEvidence(_method: string, received: boolean, _note: string, _reference = '') {
  ensure(received === true, 'Cần xác nhận đã thực nhận tiền.');
}

export function staffBookingsToday(
  appointments: { staffId: string; startAt: string; status: string }[], today: string, staffId: string,
): number {
  return appointments.filter(row => row.staffId === staffId && row.status === 'CONFIRMED'
    && spaDay(new Date(row.startAt)) === today).length;
}
