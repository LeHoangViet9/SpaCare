import { z } from 'zod';

const id = z.string().regex(/^[a-f\d]{24}$/i);
const amount = z.number().int().min(0).max(1_000_000_000_000);
const issueDay=z.string().refine(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,'Ngày hóa đơn không hợp lệ.');
export const invoiceAdjustmentInput = z.object({
  id, expectedUpdatedAt:z.string().datetime({offset:true}),
  mode:z.enum(['CORRECT','VOID']), description:z.string().trim().min(1).max(500), total:amount,
  reason:z.string().trim().min(1).max(2000),
  issuedOn:issueDay.optional(),
  stockHandling:z.enum(['KEEP_OUT','RETURN']).optional(),
  entitlementHandling:z.enum(['KEEP','CANCEL_REMAINING']).optional(),
  giftHandling:z.enum(['KEEP','REVOKE_UNUSED']).optional(),
  confirmed:z.boolean().default(false),
  expectedPreview:z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict().refine(d=>d.mode==='CORRECT'||d.issuedOn===undefined,'Không sửa ngày khi vô hiệu hóa hóa đơn.');
export const invoiceAdjustmentRefundInput = z.object({
  id, expectedUpdatedAt:z.string().datetime({offset:true}), amount:amount.refine(n=>n>0),
  method:z.enum(['CASH','BANK_TRANSFER']), reason:z.string().trim().min(1).max(2000),
  receivedConfirmation:z.literal(true), transferReference:z.string().trim().max(500).optional(),
}).strict();

// Retain real receipts. Excess stored-value credit is returned to its source first.
// Remaining direct money is a separately disclosed liability until an actual refund.
export function adjustmentBalance(paid:number, credit:number, refunded:number, revised:boolean, total:number, deposit:number, card:number) {
  for(const n of [paid,credit,refunded,total,deposit,card]) if(!Number.isSafeInteger(n)||n<0) throw Error('Số dư đối soát không hợp lệ.');
  const funded=paid+credit-(revised ? 0 : refunded);
  if(funded<0) throw Error('Tiền hoàn lịch sử vượt số tiền đã ghi nhận.');
  let excess=Math.max(0,funded-total);
  const depositReturn=Math.min(excess,deposit);excess-=depositReturn;
  const cardReturn=Math.min(excess,card);excess-=cardReturn;
  const nextPaid=Math.min(total,funded-depositReturn-cardReturn);
  return {paid:nextPaid,credit:excess,depositReturn,cardReturn};
}
