import { z } from 'zod';
import { treatmentUsed } from './treatment-rules.ts';
export { treatmentUsed } from './treatment-rules.ts';

const day = z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Ngày không hợp lệ.');
export const customerTreatmentInput = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  expectedUseCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  name: z.string().trim().min(1).max(500),
  serviceId: z.string().regex(/^[a-f\d]{24}$/i),
  totalSessions: z.number().int().min(1).max(10000).optional(),
  durationMonths: z.number().int().min(1).max(120).optional(),
  startsOn: day.optional(), expiresOn: day.optional(),
  notes: z.string().trim().max(2000),
  reason: z.string().trim().min(1).max(500),
  confirmUsedFloor: z.boolean().optional(),
}).strict().refine(d => !d.startsOn || !d.expiresOn || d.startsOn <= d.expiresOn, 'Ngày hết hạn phải từ ngày bắt đầu.');

type Plan = { packageType?: string; totalSessions?: number; remaining?: number; usedSessions?: number; openingBalance?: boolean; status?: string };
export function treatmentEditRights(p: Plan, d: Pick<z.infer<typeof customerTreatmentInput>, 'totalSessions' | 'durationMonths' | 'startsOn' | 'expiresOn' | 'confirmUsedFloor'>, recorded = 0) {
  if (p.status === 'CANCELLED') throw Error('Không sửa gói đã hủy.');
  const used = treatmentUsed(p, recorded);
  if (p.packageType === 'TIME') {
    if (!d.durationMonths || d.totalSessions !== undefined || !d.startsOn || !d.expiresOn) throw Error('Gói thời hạn cần số tháng, ngày bắt đầu và hết hạn; không nhập số buổi.');
    return { durationMonths: d.durationMonths, usedSessions: used };
  }
  if (!d.totalSessions || d.durationMonths !== undefined) throw Error('Gói theo buổi cần tổng số buổi; không nhập số tháng.');
  if (d.totalSessions < used && !d.confirmUsedFloor) throw Error(`Đã dùng ${used} buổi. Cần xác nhận giữ tổng hiệu lực bằng số đã dùng và còn lại 0; tổng yêu cầu được lưu riêng trong audit.`);
  const totalSessions=Math.max(d.totalSessions,used),remaining = totalSessions - used;
  return { totalSessions, remaining, ...(p.openingBalance ? { usedSessions: used } : {}),
    status: p.status === 'PAUSED' ? 'PAUSED' : remaining ? 'ACTIVE' : 'COMPLETED' };
}
