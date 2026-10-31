/** Pure accounting checks for explicit line allocations; no database or environment access. */
export type InvoiceLineBalance = {
  lineId: string;
  total: number;
  paid: number;
  refunded?: number;
};
export type InvoiceLineAllocation = { lineId: string; amount: number };
const limit = 1_000_000_000_000;
export function resolveInvoiceLineAllocations(
  lines: readonly InvoiceLineBalance[], allocations: readonly InvoiceLineAllocation[] | undefined,
  amount: number, invoicePaid: number, direction: 'PAY' | 'REVERSE' = 'PAY',
): readonly InvoiceLineAllocation[] | undefined {
  if (direction === 'REVERSE' && !allocations) return undefined;
  if (!lines.length || lines.every(line => !line.lineId)) {
    if (allocations) throw new Error('Hóa đơn cũ chưa có mã dòng để phân bổ thanh toán.');
    return undefined;
  }
  if (lines.some(line => !line.lineId)) throw new Error('Hóa đơn thiếu mã dòng; cần đối soát trước khi thu tiền.');
  if (lines.reduce((sum, line) => sum + line.paid, 0) !== invoicePaid)
    throw new Error('Tiền đã trả theo dòng không khớp hóa đơn; cần đối soát trước khi thu tiền.');
  if (allocations) return allocations;
  const outstanding = lines.filter(line => line.total > line.paid);
  if (outstanding.length === 1) return [{lineId:outstanding[0].lineId,amount}];
  if (amount === outstanding.reduce((sum,line)=>sum+line.total-line.paid,0))
    return outstanding.map(line=>({lineId:line.lineId,amount:line.total-line.paid}));
  throw new Error('Cần chỉ định phân bổ theo từng dòng khi thanh toán một phần.');
}
function money(value: number, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > limit)
    throw new Error('Invalid integer VND amount.');
  return value;
}
function identity(value: string) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
    throw new Error('Invalid invoice line ID.');
  return value.toLowerCase();
}

/**
 * Apply an explicitly supplied allocation, or reverse the stored allocation.
 * The caller must load balances and the original ledger in its transaction,
 * enforce authorization/idempotency, and mark the ledger reversed atomically.
 * Never infer allocations for a legacy invoice that lacks line balances.
 */
export function applyInvoiceLinePayment<T extends InvoiceLineBalance>(
  lines: readonly T[],
  allocations: readonly InvoiceLineAllocation[],
  amount: number,
  direction: 'PAY' | 'REVERSE' = 'PAY',
): T[] {
  money(amount, true);
  if (direction !== 'PAY' && direction !== 'REVERSE') throw new Error('Invalid allocation direction.');
  if (!lines.length || !allocations.length) throw new Error('Explicit invoice line allocations are required.');
  const byId = new Map<string, T>();
  let total = 0;
  for (const line of lines) {
    const id = identity(line.lineId);
    if (byId.has(id)) throw new Error('Duplicate invoice line ID.');
    money(line.total); money(line.paid); money(line.refunded ?? 0);
    if (line.paid > line.total || (line.refunded ?? 0) > line.paid)
      throw new Error('Invalid invoice line balance.');
    total = money(total + line.total);
    byId.set(id, line);
  }
  const deltas = new Map<string, number>();
  let allocated = 0;
  for (const allocation of allocations) {
    const id = identity(allocation.lineId);
    if (deltas.has(id)) throw new Error('Duplicate payment allocation.');
    const line = byId.get(id);
    if (!line) throw new Error('Allocation is not a line of this invoice.');
    money(allocation.amount, true);
    allocated = money(allocated + allocation.amount);
    const next = line.paid + (direction === 'PAY' ? allocation.amount : -allocation.amount);
    if (next > line.total || next < (line.refunded ?? 0))
      throw new Error('Allocation exceeds the available invoice line balance.');
    deltas.set(id, direction === 'PAY' ? allocation.amount : -allocation.amount);
  }
  if (allocated !== amount) throw new Error('Line allocations must equal the payment amount.');
  return lines.map(line => ({ ...line, paid: line.paid + (deltas.get(identity(line.lineId)) ?? 0) }));
}
