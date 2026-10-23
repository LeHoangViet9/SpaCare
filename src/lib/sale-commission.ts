// Cumulative rounding ensures split payments earn exactly the same as one payment.
export function packageCommissionDelta(paid:number, refunded:number, total:number, accrued:number) {
 for (const value of [paid,refunded,total,accrued]) if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) throw new Error('Số tiền hoa hồng không hợp lệ.');
 if (paid > total || refunded > paid) throw new Error('Tiền thực thu / hoàn không hợp lệ.');
 const target = Math.floor((paid-refunded)/20);
 return {target, delta:target-accrued};
}
