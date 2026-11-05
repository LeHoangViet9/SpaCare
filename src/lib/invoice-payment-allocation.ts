import { applyInvoiceLinePayment, resolveInvoiceLineAllocations, type InvoiceLineAllocation } from './invoice-line-payments.ts';

type Invoice = Record<string, any>;
type Payment = { amount: number; lineAllocations?: InvoiceLineAllocation[] };

/** Match the backend's line order and avoid counting session mirrors twice. */
export function invoicePaymentAllocation(invoice: Invoice, amount: number) {
  const lines = ['serviceItems', 'treatmentSessions', 'packageItems', 'productItems'].flatMap(group =>
    (invoice[group] || []).filter((line: Invoice) => group !== 'treatmentSessions' || !invoice.serviceItems?.some((item: Invoice) =>
      item.lineId && String(item.lineId) === String(line.lineId) && item.total === 0 && line.total === 0))
      .map((line: Invoice) => ({ ...line, lineId: String(line.lineId || ''), total: line.total as number, paid: (line.paid || 0) as number })));
  if (!lines.length || lines.every(line => !line.lineId)) return { mode: 'legacy' as const, lines };
  if (lines.some(line => !line.lineId) || lines.reduce((sum, line) => sum + line.total, 0) !== invoice.total ||
      lines.reduce((sum, line) => sum + line.paid, 0) !== invoice.paid)
    return { mode: 'reconcile' as const, lines };
  const outstanding = lines.filter(line => line.total > line.paid);
  return { mode: outstanding.length <= 1 || amount === invoice.total - invoice.paid ? 'automatic' as const : 'manual' as const, lines };
}

/** Prepare explicit sources for the existing backend validators; never change invoice balances. */
export function allocateInvoicePayments<T extends Payment>(invoice: Invoice, payments: T[]): T[] {
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (!payments.length || payments.some(payment => !Number.isSafeInteger(payment.amount) || payment.amount <= 0) || total > invoice.total - invoice.paid)
    throw new Error('Tổng thu phải lớn hơn 0 và không vượt công nợ.');
  const state = invoicePaymentAllocation(invoice, total);
  if (state.mode === 'reconcile') throw new Error('Số tiền theo dòng cần được đối soát trước khi thu thêm.');
  let lines = state.lines, paid = invoice.paid;
  return payments.map(payment => {
    let allocations = payment.lineAllocations;
    if (state.mode === 'automatic') {
      let remaining = payment.amount;
      allocations = [];
      for (const line of lines) {
        const amount = Math.min(remaining, line.total - line.paid);
        if (amount > 0) { allocations.push({ lineId: line.lineId, amount }); remaining -= amount; }
      }
    }
    const resolved = resolveInvoiceLineAllocations(lines, allocations, payment.amount, paid);
    if (resolved) lines = applyInvoiceLinePayment(lines, resolved, payment.amount);
    paid += payment.amount;
    return { ...payment, lineAllocations: resolved ? [...resolved] : undefined };
  });
}
