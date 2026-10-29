import { z } from 'zod';
import { ensure, money, MAX_MONEY } from './rules';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ.');
const amount = z.number().int().positive().max(MAX_MONEY);
const lineAllocations = z.array(z.object({ lineId: id, amount })).min(1).optional();
export const invoiceCardInput = z.object({ cardId: id, amount, additionalAmount: z.number().int().min(0).max(MAX_MONEY).default(0), method: z.enum(['CASH', 'BANK_TRANSFER']).optional(), receivedConfirmation: z.boolean().optional(), lineAllocations })
  .refine(d => !d.additionalAmount || (!!d.method && d.receivedConfirmation === true), { message: 'Xác nhận đã thực nhận phần tiền thu thêm.', path: ['receivedConfirmation'] });
export const cashCardInputs = {
  sellCashCard: z.object({ customerId: id, amount, method: z.enum(['CASH', 'BANK_TRANSFER']), receivedConfirmation: z.literal(true), note: z.string().trim().max(2000).default('') }),
  redeemCashCard: z.object({ cardId: id, invoiceId: id, amount, additionalAmount: z.number().int().min(0).max(MAX_MONEY).default(0), method: z.enum(['CASH', 'BANK_TRANSFER']).optional(), receivedConfirmation: z.boolean().optional(), lineAllocations })
    .refine(d => !d.additionalAmount || (!!d.method && d.receivedConfirmation === true), { message: 'Xác nhận đã thực nhận phần tiền thu thêm.', path: ['receivedConfirmation'] }),
};
export function cardPayment(balance: number, due: number, used: number, additional = 0) {
  money(balance, true); money(due, true); money(used); money(additional, true);
  ensure(used <= balance, 'Số dư thẻ không đủ.', 409);
  ensure(used <= due && additional <= due - used, 'Số thanh toán vượt công nợ hóa đơn.', 409);
  return { balance: balance - used, settled: used + additional };
}
export function ensureCardService(invoice: Record<string, any>) {
  ensure((!invoice.kind || invoice.kind === 'SERVICE') && (invoice.serviceId || (invoice.serviceItems?.length && invoice.serviceItems.every((item: Record<string, any>) => item.serviceId && item.total > 0))) && !invoice.productItems?.length && !invoice.productId && !invoice.treatmentId && !invoice.treatmentUseId && !invoice.giftOfInvoiceId,
    'Thẻ tiền chỉ dùng cho dịch vụ lẻ, không dùng cho sản phẩm hoặc gói liệu trình.', 409);
}
