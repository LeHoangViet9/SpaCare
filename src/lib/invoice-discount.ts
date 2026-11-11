import { ensure, money } from './rules';

export type InvoiceDiscountInput = { type: 'AMOUNT' | 'PERCENT'; value: number };
export type InvoiceDiscount = InvoiceDiscountInput & { amount: number };

// Technical choice: whole percentages, rounded to the nearest integer VND.
export function invoiceDiscount(subtotal: number, input?: InvoiceDiscountInput) {
  money(subtotal, true);
  if (!input) return { subtotal, total: subtotal };
  ensure(input.type === 'AMOUNT' || input.type === 'PERCENT', 'Loại giảm giá không hợp lệ.');
  ensure(Number.isSafeInteger(input.value) && input.value >= 0, 'Giảm giá phải là số nguyên không âm.');
  if (input.type === 'PERCENT') ensure(input.value <= 100, 'Phần trăm giảm giá phải từ 0 đến 100.');
  const amount = input.type === 'PERCENT' ? Math.round(subtotal * input.value / 100) : money(input.value, true);
  ensure(amount <= subtotal, 'Số tiền giảm giá vượt tạm tính.');
  return { subtotal, discount: { ...input, amount }, total: subtotal - amount };
}

export function discountLabel(discount?: InvoiceDiscount | null) {
  return discount ? discount.type === 'PERCENT' ? `${discount.value}%` : 'Số tiền' : 'Không áp dụng';
}

// Keep the original creation snapshot after a correction/void; expose its delta.
export function invoiceSummary(invoice: { subtotal?: number; discount?: InvoiceDiscount | null; total: number }) {
  const subtotal = invoice.subtotal ?? invoice.total;
  const discountAmount = invoice.discount?.amount ?? 0;
  return { subtotal, discountAmount, adjustment: invoice.total - (subtotal - discountAmount) };
}
