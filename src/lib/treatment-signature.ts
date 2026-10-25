import { TreatmentUse } from './models';
import type { Actor } from './auth';
import { ensure } from './rules';

export async function readTreatmentSignature(user: Actor, use: Record<string, any>) {
  ensure(user.role === 'OWNER' || String(use.actorId) === user.id || String(use.staffId) === user.id, 'Chỉ xem chữ ký buổi mình thực hiện.', 403);
  if (!use.confirmationUseId) return use.signature || null;
  ensure(use.checkoutInvoiceId && use.customerId, 'Thiếu liên kết xác nhận chung của hóa đơn.', 409);
  // A shared signature can only be followed within this customer's checkout.
  const source = await TreatmentUse.findOne({
    _id: use.confirmationUseId, spaId: user.spaId,
    customerId: use.customerId, checkoutInvoiceId: use.checkoutInvoiceId,
  }).select('+signature').lean();
  ensure(source && !source.confirmationUseId, 'Không tìm thấy xác nhận chung của hóa đơn.', 409);
  ensure(user.role === 'OWNER' || String(source.actorId) === user.id || String(source.staffId) === user.id, 'Chỉ xem chữ ký buổi mình thực hiện.', 403);
  return source.signature || null;
}
