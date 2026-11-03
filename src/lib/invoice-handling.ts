type Row = Record<string, any>;
export type InvoiceHandling = Record<'edit' | 'date' | 'replace' | 'cancel' | 'void', string>;

export function groupInvoiceHandlingReasons(reasons: InvoiceHandling) {
  const groups = new Map<string, (keyof InvoiceHandling)[]>();
  for (const action of Object.keys(reasons) as (keyof InvoiceHandling)[]) {
    const reason = reasons[action];
    if (reason) groups.set(reason, [...(groups.get(reason) || []), action]);
  }
  return [...groups].filter(([, actions]) => actions.length > 1).map(([reason, actions]) => ({ reason, actions }));
}
export type HandlingContext = {
  used: boolean; appointments: boolean; pendingAppointments: boolean;
  changedPlan: boolean; history: boolean; giftCards: boolean; usedGiftCard: boolean;
  settled: boolean; lineCommission: boolean; packageCommission: boolean;
  oldDayClosed: boolean; todayClosed: boolean; receiptDayOpen: boolean;
  directPayment: boolean; hasActivePayment: boolean;
};

// Read-side explanations only. Mutations still recheck every guard in their transaction.
export function invoiceHandlingReasons(invoice: Row, c: HandlingContext, owner: boolean): InvoiceHandling {
  const all = (reason: string): InvoiceHandling => ({edit:reason,date:reason,replace:reason,cancel:reason,void:reason});
  if (!owner) return all('Chỉ chủ spa được xử lý hóa đơn.');
  if (invoice.status === 'CANCELLED') return all('Hóa đơn đã vô hiệu hóa, chỉ được tra cứu.');
  if (invoice.openingBalance) return all('Chứng từ chuyển số dư ban đầu cần đối soát riêng.');
  const chain = invoice.activeDocumentId ? 'Chứng từ đã thay thế; chưa hỗ trợ điều chỉnh cả chuỗi.' : '';
  const used = c.used ? 'Gói đã có buổi sử dụng; cần giữ nguyên lịch sử thực hiện.' : '';
  const locked = c.oldDayClosed ? 'Ngày lập hóa đơn đã chốt sổ; cần mở lại trước.' : '';
  const settled = c.settled ? 'Hoa hồng đã chốt lương; cần điều chỉnh riêng.' : '';
  const operational = invoice.treatmentUseId || invoice.treatmentId || invoice.giftOfInvoiceId ||
    (invoice.kind && !['SERVICE','PACKAGE'].includes(invoice.kind)) ||
    (invoice.kind === 'PACKAGE' && (invoice.appointmentId || invoice.performedAt));
  const editCancelBlock = chain || used || (c.appointments ? 'Liệu trình đã có lịch hẹn; cần xử lý liên kết trước.' : '') ||
    (c.changedPlan ? 'Liệu trình đã thay đổi trạng thái hoặc quyền lợi; cần đối soát riêng.' : '') ||
    (invoice.paid || invoice.refunded || c.history ? 'Hóa đơn đã có thanh toán, cọc/thẻ hoặc lịch sử giao dịch.' : '') ||
    (c.giftCards ? 'Hóa đơn đã phát hành thẻ tặng; cần đối soát riêng.' : '') ||
    (operational ? 'Chứng từ có liên kết vận hành hoặc loại chưa hỗ trợ điều chỉnh trực tiếp.' : '') ||
    (invoice.productItems?.length ? 'Hóa đơn có sản phẩm; chưa hỗ trợ sửa/hủy từng dòng.' : '') || settled || locked;
  let replace = invoice.kind !== 'PACKAGE' ? 'Chỉ áp dụng cho hóa đơn bán gói.' : '';
  replace ||= invoice.total <= 0 || invoice.paid !== invoice.total || invoice.refunded ? 'Chỉ áp dụng cho gói đã thu đủ, chưa hoàn tiền.' : '';
  replace ||= !c.directPayment ? 'Cần một khoản thu trực tiếp đủ tiền, chưa đảo và không dùng cọc/thẻ.' : '';
  replace ||= invoice.cardPaid || invoice.productItems?.length || invoice.serviceItems?.length || invoice.treatmentSessions?.length || invoice.treatmentUseId || invoice.appointmentId || invoice.performedAt ? 'Hóa đơn hỗn hợp hoặc liên kết thực hiện cần đối soát riêng.' : '';
  replace ||= !invoice.sellerId || ![1,2].includes(invoice.saleCommissionVersion) ? 'Thiếu thông tin tư vấn hoặc quy tắc hoa hồng gốc.' : '';
  replace ||= settled || locked || (c.todayClosed ? 'Sổ hôm nay đã chốt; cần mở lại trước khi thay tư vấn.' : '');
  const voidReason = chain || used || (c.pendingAppointments ? 'Gói còn lịch đang đặt hoặc hoãn; cần xử lý lịch trước khi vô hiệu hóa.' : '') || settled ||
    (invoice.treatmentUseId || invoice.giftOfInvoiceId || invoice.refunded ? 'Chứng từ buổi dùng, quà tặng hoặc đã hoàn tiền cần đối soát riêng.' : '') ||
    (c.usedGiftCard ? 'Thẻ tặng đã được sử dụng; cần đối soát riêng.' : '') ||
    (c.hasActivePayment && !c.receiptDayOpen ? 'Có khoản thu cần đảo; sổ hôm nay phải đang mở.' : '');
  return {
    edit: editCancelBlock || (invoice.packageItems?.length ? 'Hóa đơn dạng dòng gói chỉ hỗ trợ sửa ngày.' : '') || (c.lineCommission ? 'Đã có hoa hồng theo dòng; chưa hỗ trợ sửa nội dung trực tiếp.' : '') || (c.packageCommission ? 'Đã có hoa hồng gói; cần đối soát riêng.' : ''),
    date: chain || (!['SERVICE','SESSION','PACKAGE','PRODUCT'].includes(invoice.kind || 'SERVICE') ? 'Loại hóa đơn này chưa hỗ trợ sửa ngày.' : '') || locked,
    replace, cancel: editCancelBlock || (c.packageCommission ? 'Đã có hoa hồng gói; cần đối soát riêng.' : ''), void: voidReason,
  };
}
