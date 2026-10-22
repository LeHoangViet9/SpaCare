import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ.');
const positiveMoney = z.number().int().positive().max(1_000_000_000_000);
export const packageTemplateInput = z.object({ name: z.string().trim().min(1).max(500), serviceId: id,
  totalSessions: z.number().int().min(1).max(1000), price: positiveMoney });
export const packageSaleInput = z.object({ customerId: id, templateId: id, total: positiveMoney.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), consultantId: id.optional(),
  promotion: z.string().trim().max(2000).default(''),
  gifts: z.array(z.object({ templateId: id }).strict()).max(20).default([]),
}).refine(d => !d.gifts.length || !!d.promotion, { message: 'Nhập đợt khuyến mãi khi có quà tặng.', path: ['promotion'] });

export function invoiceCharge(price: number, requested: number | undefined, covered: boolean) {
  if (covered) return 0;
  const total = requested ?? price;
  if (!Number.isSafeInteger(total) || total <= 0 || total > 1_000_000_000_000) throw new Error('Giá dịch vụ mua lẻ không hợp lệ.');
  return total;
}
