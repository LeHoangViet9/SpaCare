import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ.');
const positiveMoney = z.number().int().positive().max(1_000_000_000_000);
export const packageTemplateInput = z.object({ name: z.string().trim().min(1).max(500), serviceId: id,
  packageType: z.enum(['SESSIONS', 'TIME']).default('SESSIONS'),
  totalSessions: z.number().int().min(1).max(1000).optional(),
  durationMonths: z.number().int().min(1).max(120).optional(), price: positiveMoney
}).refine(d => d.packageType === 'TIME' ? d.durationMonths !== undefined && d.totalSessions === undefined : d.totalSessions !== undefined && d.durationMonths === undefined,
  { message: 'Chọn số buổi hoặc thời hạn theo tháng, không nhập cả hai.', path: ['packageType'] });
export const packageSaleInput = z.object({
  participantIds: z.array(id.transform(value => value.toLowerCase())).min(1).max(20).refine(ids => new Set(ids).size === ids.length, 'Không chọn trùng người tư vấn.').optional(),
  sellerId: z.string().regex(/^[a-f\d]{24}$/i).optional(), customerId: id, templateId: id, total: positiveMoney.optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), consultantId: id.optional(),
  promotion: z.string().trim().max(2000).default(''),
  gifts: z.array(z.object({ templateId: id }).strict()).max(20).default([]),
}).refine(d => !d.participantIds || !d.sellerId || d.participantIds[0] === d.sellerId.toLowerCase(), { message: 'Người bán phải là người đầu tiên trong danh sách tư vấn.', path: ['participantIds'] }).refine(d => !d.gifts.length || !!d.promotion, { message: 'Nhập đợt khuyến mãi khi có quà tặng.', path: ['promotion'] });

export function invoiceCharge(price: number, requested: number | undefined, covered: boolean) {
  if (covered) return 0;
  const total = requested ?? price;
  if (!Number.isSafeInteger(total) || total <= 0 || total > 1_000_000_000_000) throw new Error('Giá dịch vụ mua lẻ không hợp lệ.');
  return total;
}
