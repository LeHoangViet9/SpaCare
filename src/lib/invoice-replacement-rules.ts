import { packageCommissionDelta, sharedCommissionDeltas } from './sale-commission.ts';

type Participant = { staffId: unknown; staffName: string };
export function replacementParticipants(invoice: {
  kind?: string; status?: string; total: number; paid: number; refunded?: number;
  openingBalance?: boolean; saleCommissionVersion?: number; saleCommissionAccrued?: number;
  sellerId?: unknown; sellerName?: string; saleParticipants?: Participant[];
}, oldStaffId: string, newPerson: Participant) {
  if (invoice.kind !== 'PACKAGE' || invoice.status === 'CANCELLED' || invoice.openingBalance)
    throw new Error('Chỉ thay thế chứng từ bán gói còn hiệu lực, không phải số dư đầu kỳ.');
  if (invoice.total <= 0 || invoice.paid !== invoice.total || invoice.refunded)
    throw new Error('Phiên bản này chỉ hỗ trợ gói đã thu đủ, chưa hoàn tiền.');
  if (![1, 2].includes(invoice.saleCommissionVersion || 0) || !invoice.sellerId)
    throw new Error('Giao dịch thiếu phiên bản quy tắc hoa hồng gốc; cần đối soát riêng.');
  const before = invoice.saleParticipants?.length ? invoice.saleParticipants.map(p => ({staffId:String(p.staffId),staffName:p.staffName}))
    : [{staffId:String(invoice.sellerId),staffName:invoice.sellerName || ''}];
  if (new Set(before.map(p=>p.staffId)).size !== before.length ||
      (invoice.saleCommissionVersion === 1 ? before.length !== 1 : before.length < 2) ||
      before[0].staffId !== String(invoice.sellerId) || before.some(p=>!p.staffName))
    throw new Error('Danh sách tư vấn và phiên bản hoa hồng gốc không khớp.');
  if (!before.some(p=>p.staffId===oldStaffId) || before.some(p=>p.staffId===String(newPerson.staffId)))
    throw new Error('Chọn đúng người tư vấn cũ và người mới chưa có trong danh sách.');
  const {target} = packageCommissionDelta(invoice.paid, 0, invoice.total, invoice.saleCommissionAccrued || 0);
  if (invoice.saleCommissionAccrued !== target) throw new Error('Hoa hồng tích lũy không khớp quy tắc gốc; cần đối soát.');
  const after = before.map(p=>p.staffId===oldStaffId ? {staffId:String(newPerson.staffId),staffName:newPerson.staffName} : p);
  const shares = (people: typeof before) => sharedCommissionDeltas(target,0,people.map(p=>p.staffId));
  return {before,after,pool:target,beforeShares:shares(before),afterShares:shares(after),formula:'floor((paid - refunded) / 20)'};
}
