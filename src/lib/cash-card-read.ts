import { literalPattern } from './workspace-query';
import { CashCard, CashCardUse, Customer, Invoice } from './models';
import { invoiceScope } from './invoice-read';
import type { Actor } from './auth';
import { ensure } from './rules';
import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ.');
export const cashCardQuery = z.object({ customerId: id, cardId: id.optional(), invoiceId: id.optional(), page: z.coerce.number().int().min(1).max(1_000_000).default(1), usePage: z.coerce.number().int().min(1).max(1_000_000).default(1) });
export async function readCashCards(user: Actor, query: z.infer<typeof cashCardQuery>) {
  ensure(user.role === 'OWNER' || user.role === 'STAFF', 'Không có quyền xem thẻ tiền.', 403);
  const canSell = user.role === 'OWNER' || user.cashier;
  if (!canSell) {
    ensure(query.invoiceId, 'Chỉ xem thẻ qua hóa đơn mình phụ trách.', 403);
    const invoice = await Invoice.findOne({ ...await invoiceScope(user), _id: query.invoiceId, customerId: query.customerId }).select('_id').lean();
    ensure(invoice, 'Không có quyền xem thẻ của khách này.', 403);
  }
  const filter = { spaId: user.spaId, customerId: query.customerId, ...(query.cardId ? {_id:query.cardId} : {}) };
  ensure(await Customer.exists({ spaId: user.spaId, _id: query.customerId }), 'Không tìm thấy khách trong spa.', 404);
  const total = await CashCard.countDocuments(filter);
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / 10)));
  const cards = await CashCard.find(filter).select('sourceLabel openingDate amount balance origin sourceInvoiceId promotion createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10).lean();
  // Ordinary staff only see redemptions for the invoice whose access was checked above.
  const useFilter = { spaId:user.spaId,customerId:query.customerId,...(query.cardId ? {cardId:query.cardId}:{}), ...(!canSell ? { invoiceId: query.invoiceId } : {}) };
  const useTotal = await CashCardUse.countDocuments(useFilter);
  const usePage = Math.min(query.usePage, Math.max(1, Math.ceil(useTotal / 10)));
  const uses = await CashCardUse.find(useFilter).select('cardId invoiceId amount balanceBefore balanceAfter createdAt').sort({ createdAt: -1, _id: -1 }).skip((usePage - 1) * 10).limit(10).lean();
  return { cards, total, page, uses, useTotal, usePage, canSell };
}

export const cashCardListQuery = z.object({
  search: z.string().trim().max(100).default(''),
  status: z.enum(['', 'AVAILABLE', 'EXHAUSTED']).default(''),
  origin: z.enum(['', 'PURCHASE', 'GIFT', 'OPENING']).default(''),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
});
export async function readCashCardList(user: Actor, query: z.infer<typeof cashCardListQuery>) {
  ensure((user.role === 'OWNER' || user.role === 'STAFF' && user.cashier), 'Chỉ chủ spa hoặc thu ngân được quản lý danh sách thẻ.', 403);
  const scope = {spaId:user.spaId};
  const filters: Record<string,any>[] = [scope];
  if(query.status) filters.push({balance:query.status === 'AVAILABLE' ? {$gt:0} : 0});
  if(query.origin) filters.push({origin:query.origin});
  if(query.search) {
    const expression={$regex:literalPattern(query.search),$options:'i'};
    const customerIds=await Customer.find({...scope,$or:[{name:expression},{phone:expression}]}).distinct('_id');
    const code=query.search.replace(/^TM-/i,'');
    const clauses:Record<string,any>[]=[{customerId:{$in:customerIds}}];
    if(/^[a-f\d]{24}$/i.test(code))clauses.push({_id:code});
    else if(/^[a-f\d]{6,23}$/i.test(code))clauses.push({$expr:{$regexMatch:{input:{$toString:'$_id'},regex:literalPattern(code),options:'i'}}});
    filters.push({$or:clauses});
  }
  const filter={$and:filters};
  const total=await CashCard.countDocuments(filter);
  const page=Math.min(query.page,Math.max(1,Math.ceil(total/10)));
  const cards=await CashCard.find(filter).select('sourceLabel openingDate customerId amount balance origin sourceInvoiceId promotion createdAt').sort({createdAt:-1,_id:-1}).skip((page-1)*10).limit(10).lean();
  const people=cards.length ? await Customer.find({...scope,_id:{$in:cards.map(c=>c.customerId)}}).select('name phone').lean() : [];
  return {total,page,pageSize:10,cards:cards.map(card=>{
    const customer=people.find(c=>String(c._id)===String(card.customerId));
    return {...card,customerName:customer?.name || 'Chưa ghi nhận',customerPhone:customer?.phone || ''};
  })};
}
