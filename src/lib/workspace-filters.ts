export type ListFilters = { status: string; employee: string; method: string; direction: string; category: string; customer: string; from: string; to: string };
export function listFilter(collection: string, q: ListFilters, today: string): Record<string, any> {
  const clauses: Record<string, any>[] = [];
  if (q.status) {
    if (collection === 'invoices') {
      const debt = { $expr: { $gt: ['$total', '$paid'] } };
      if (q.status === 'DEBT') clauses.push(debt);
      if (q.status === 'OVERDUE') clauses.push(debt, { dueDate: { $gt: '', $lt: today } });
      if (q.status === 'PAID') clauses.push({ $expr: { $gte: ['$paid', '$total'] } });
      if (q.status === 'UNPAID') clauses.push({ total: { $gt: 0 }, paid: 0 });
      if (q.status === 'PARTIALLY_PAID') clauses.push(debt, { paid: { $gt: 0 } });
      if (['SESSION', 'GIFT'].includes(q.status)) clauses.push({ kind: q.status });
    } else if (collection === 'deposits') clauses.push({ balance: q.status === 'AVAILABLE' ? { $gt: 0 } : 0 });
    else if (['services', 'staff', 'packageTemplates'].includes(collection)) clauses.push({ active: q.status === 'ACTIVE' });
    else if (collection === 'treatments' && q.status === 'GIFT') clauses.push({ giftOfInvoiceId: { $exists: true } });
    else clauses.push({ status: q.status });
  }
  if (q.category && collection === 'services') clauses.push({ category: q.category });
  if (q.customer && ['appointments', 'invoices', 'deposits', 'treatments', 'cash', 'uses'].includes(collection)) clauses.push({ customerId: q.customer });
  if (q.employee) {
    if (collection === 'appointments') clauses.push({ staffId: q.employee });
    if (collection === 'cash') clauses.push({ actorId: q.employee });
    if (collection === 'uses') clauses.push({ $or: [{ staffId: q.employee }, { actorId: q.employee }] });
  }
  if (q.method && collection === 'cash') clauses.push({ method: q.method });
  if (q.direction && collection === 'cash') clauses.push({ direction: q.direction });
  if (q.from || q.to) {
    if (['cash', 'days'].includes(collection)) clauses.push({ day: { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) } });
    else if (!['services', 'staff', 'packageTemplates', 'allocations'].includes(collection)) {
      const field = collection === 'appointments' ? 'startAt' : collection === 'uses' ? 'performedAt' : 'createdAt';
      clauses.push({ [field]: { ...(q.from ? { $gte: new Date(q.from + 'T00:00:00+07:00') } : {}), ...(q.to ? { $lt: new Date(new Date(q.to + 'T00:00:00+07:00').getTime() + 86400000) } : {}) } });
    }
  }
  return clauses.length ? { $and: clauses } : {};
}
export function datePreset(kind: 'today' | 'week' | 'month', today: string) {
  if (kind === 'today') return { from: today, to: today };
  if (kind === 'month') return { from: today.slice(0, 8) + '01', to: today };
  return { from: today, to: new Date(new Date(today + 'T00:00:00Z').getTime() + 6 * 86400000).toISOString().slice(0, 10) };
}
