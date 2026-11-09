export type CashFlowEntry = {
  amount: number;
  direction: 'IN' | 'OUT';
  method: 'CASH' | 'BANK_TRANSFER';
  kind?: string;
  originalId?: unknown;
  reversed?: boolean;
};

export function cashFlowMatch(criteria: Record<string, unknown> = {}) {
  return {
    $and: [
      criteria,
      { reversed: { $ne: true } },
      { $nor: [{ kind: 'REVERSAL', originalId: { $exists: true, $ne: null } }] },
    ],
  };
}

export function cashFlowEntries<T extends CashFlowEntry>(entries: readonly T[]) {
  return entries.filter(entry =>
    entry.reversed !== true && !(entry.kind === 'REVERSAL' && entry.originalId != null),
  );
}

export function cashFlowNet(entries: readonly CashFlowEntry[], method: CashFlowEntry['method']) {
  return cashFlowEntries(entries)
    .filter(entry => entry.method === method)
    .reduce((sum, entry) => sum + (entry.direction === 'IN' ? entry.amount : -entry.amount), 0);
}

export function cashFlowTotals(entries: readonly CashFlowEntry[]) {
  const totals = { cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0 };
  for (const entry of cashFlowEntries(entries)) {
    if (entry.method === 'CASH') totals[entry.direction === 'IN' ? 'cashIn' : 'cashOut'] += entry.amount;
    if (entry.method === 'BANK_TRANSFER') totals[entry.direction === 'IN' ? 'bankIn' : 'bankOut'] += entry.amount;
  }
  return totals;
}
