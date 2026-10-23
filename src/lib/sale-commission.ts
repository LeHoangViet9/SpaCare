// Cumulative rounding ensures split payments earn exactly the same as one payment.
export function packageCommissionDelta(paid:number, refunded:number, total:number, accrued:number) {
 for (const value of [paid,refunded,total,accrued]) if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) throw new Error('Số tiền hoa hồng không hợp lệ.');
 if (paid > total || refunded > paid) throw new Error('Tiền thực thu / hoàn không hợp lệ.');
 const target = Math.floor((paid-refunded)/20);
 return {target, delta:target-accrued};
}

// Divide cumulative integer VND, then take each person's delta. Stable ordering
// keeps installment payments and refunds exactly equal to a single settlement.
export function sharedCommissionDeltas(target: number, accrued: number, participantIds: string[]) {
  if (![target, accrued].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000_000)) throw new Error('Quỹ hoa hồng không hợp lệ.');
  const ids = [...participantIds].sort();
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Danh sách người tư vấn trống hoặc trùng.');
  const share = (pool: number, i: number) => Math.floor(pool / ids.length) + (i < pool % ids.length ? 1 : 0);
  return ids.map((staffId, i) => ({ staffId, total: share(target, i), amount: share(target, i) - share(accrued, i) }));
}
