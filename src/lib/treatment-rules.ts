// Date strings are local spa days (Asia/Ho_Chi_Minh), inclusive at both ends.
type Plan = { openingBalance?: boolean; openingRemaining?: number; packageType?: string; remaining?: number; totalSessions?: number; usedSessions?: number; startsOn?: string; expiresOn?: string; status?: string; durationMonths?: number };
export const treatmentDay = (at = new Date()) => at.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
export const timedPackage = (p: Plan) => p.packageType === 'TIME';
export const useToken = (p: Plan) => timedPackage(p) ? (p.usedSessions || 0) : (p.remaining || 0);
export function treatmentAvailable(p: Plan, day = treatmentDay()) {
  return p.status === 'ACTIVE' && (!p.startsOn || p.startsOn <= day) && (!p.expiresOn || p.expiresOn >= day)
    && (timedPackage(p) ? !!p.startsOn && !!p.expiresOn : (p.remaining || 0) > 0);
}
export function packageLabel(p: Plan) {
  if (timedPackage(p)) return p.expiresOn ? `Không giới hạn · ${p.startsOn} – ${p.expiresOn}` : `${p.durationMonths} tháng · không giới hạn số lần`;
  if(p.openingBalance) return `Còn ${p.remaining || 0} buổi chuyển từ sổ cũ`;
  return p.remaining === undefined ? `${p.totalSessions} buổi` : `Còn ${p.remaining}/${p.totalSessions} buổi`;
}
export function packageExpiry(start: string, months: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(months) || months < 1 || months > 120) throw new Error('Ngày bắt đầu hoặc thời hạn không hợp lệ.');
  const initial = new Date(start + 'T00:00:00Z');
  if (!Number.isFinite(initial.getTime()) || initial.toISOString().slice(0, 10) !== start) throw new Error('Ngày bắt đầu không hợp lệ.');
  const lastDay = new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth() + months + 1, 0));
  lastDay.setUTCDate(Math.min(initial.getUTCDate(), lastDay.getUTCDate()));
  return lastDay.toISOString().slice(0, 10);
}
export function packageSnapshot(p: Plan, startsOn?: string) {
  if (timedPackage(p)) return { packageType: 'TIME', durationMonths: p.durationMonths, startsOn, expiresOn: packageExpiry(startsOn || '', p.durationMonths!), usedSessions: 0 };
  return { packageType: 'SESSIONS', totalSessions: p.totalSessions, remaining: p.totalSessions };
}
export function availableTreatmentFilter(day = treatmentDay()) {
  return { status: 'ACTIVE', $and: [
    { $or: [{ startsOn: { $exists: false } }, { startsOn: { $lte: day } }] },
    { $or: [{ expiresOn: { $exists: false } }, { expiresOn: { $gte: day } }] },
    { $or: [{ packageType: { $ne: 'TIME' }, remaining: { $gt: 0 } }, { packageType: 'TIME', startsOn: { $lte: day }, expiresOn: { $gte: day } }] },
  ] };
}

// Confirmed for the spa's 36-month hair-removal catalog; other plans retain their agreed start date.
export function packageStartOnPurchase(p: Plan, category: string | undefined, today: string, requested?: string) {
  return timedPackage(p) && p.durationMonths === 36 && category?.normalize('NFC').trim().toLocaleLowerCase('vi') === 'triệt lông' ? today : requested;
}

// Imported rights have unknown original quota; numbering starts at transfer, not the original purchase.
export function nextSessionNumber(p: Plan) {
  return timedPackage(p) || p.openingBalance ? (p.usedSessions || 0) + 1 : (p.totalSessions || 0) - (p.remaining || 0) + 1;
}
