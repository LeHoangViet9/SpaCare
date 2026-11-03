type Row = Record<string, any>;
export type InvoiceHandling = Record<'edit' | 'date' | 'replace' | 'cancel' | 'void', string>;
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
  if (invoice.status === 'CANCELLED') return all('Hóa đơn đã vô hiệu hóa; chỉ còn tra cứu lịch sử.');
  if (invoice.openingBalance) return all('Chứng từ chuyển số dư ban đầu cần đối soát riêng.');
  const chain = invoice.activeDocumentId ? 'Chứng từ đã thay thế; chưa hỗ trợ sửa hoặc vô hiệu hóa cả chuỗi.' : '';
  const used = c.used ? 'Gói đã có buổi sử dụng. Chưa có luồng sửa nội dung an toàn; giữ nguyên buổi, chữ ký và lịch sử.' : '';
  const locked = c.oldDayClosed ? 'Ngày lập hóa đơn đã chốt sổ. Chủ spa cần mở lại trước.' : '';
  const settled = c.settled ? 'Hoa hồng đã thuộc bảng lương duyệt/đã chi; cần quy trình điều chỉnh riêng.' : '';
  const operational = invoice.treatmentUseId || invoice.treatmentId || invoice.giftOfInvoiceId ||
    (invoice.kind && !['SERVICE','PACKAGE'].includes(invoice.kind)) ||
    (invoice.kind === 'PACKAGE' && (invoice.appointmentId || invoice.performedAt));
  const content = chain || used || (c.appointments ? 'Liệu trình đã có lịch hẹn. Cần xử lý liên kết trước khi sửa nội dung.' : '') ||
    (c.changedPlan ? 'Liệu trình đã thay đổi trạng thái hoặc quyền lợi; cần đối soát riêng.' : '') ||
    (invoice.paid || invoice.refunded || c.history ? 'Hóa đơn đã thanh toán, áp cọc/thẻ hoặc có lịch sử giao dịch. Không sửa nội dung trực tiếp.' : '') ||
    (c.giftCards ? 'Hóa đơn đã phát hành thẻ tặng; chưa hỗ trợ sửa trực tiếp.' : '') ||
    (operational ? 'Hóa đơn có liên kết vận hành hoặc loại chứng từ chưa hỗ trợ sửa nội dung.' : '') ||
    (invoice.productItems?.length ? 'Hóa đơn có sản phẩm; chưa hỗ trợ sửa/hủy từng dòng.' : '') || settled || locked;
  let replace = invoice.kind !== 'PACKAGE' ? 'Chỉ áp dụng cho hóa đơn bán gói.' : '';
  replace ||= invoice.total <= 0 || invoice.paid !== invoice.total || invoice.refunded ? 'Chỉ áp dụng cho gói đã thu đủ, chưa hoàn tiền.' : '';
  replace ||= !c.directPayment ? 'Cần đúng một khoản thu trực tiếp đầy đủ, chưa đảo; không hỗ trợ cọc/thẻ hoặc nhiều lần thu.' : '';
  replace ||= invoice.cardPaid || invoice.productItems?.length || invoice.serviceItems?.length || invoice.treatmentSessions?.length || invoice.treatmentUseId || invoice.appointmentId || invoice.performedAt ? 'Hóa đơn hỗn hợp hoặc liên kết thực hiện cần đối soát riêng.' : '';
  replace ||= !invoice.sellerId || ![1,2].includes(invoice.saleCommissionVersion) ? 'Thiếu thông tin quy tắc hoa hồng/tư vấn gốc; cần đối soát riêng.' : '';
  replace ||= settled || locked || (c.todayClosed ? 'Ngày hiện tại đã chốt sổ. Cần mở lại trước khi thay tư vấn.' : '');
  const voidReason = chain || used || (c.pendingAppointments ? 'Gói còn lịch hẹn đang đặt hoặc hoãn. Cần xử lý lịch trước khi vô hiệu hóa.' : '') || settled ||
    (invoice.treatmentUseId || invoice.giftOfInvoiceId || invoice.refunded ? 'Chứng từ buổi dùng, quà tặng hoặc đã hoàn tiền cần đối soát riêng.' : '') ||
    (c.usedGiftCard ? 'Thẻ tặng đã được sử dụng; cần đối soát riêng.' : '') ||
    (c.hasActivePayment && !c.receiptDayOpen ? 'Có khoản thu cần đảo: sổ hôm nay phải đang mở trước khi vô hiệu hóa.' : '');
  return {
    edit: content || (invoice.packageItems?.length ? 'Hóa đơn nhiều dòng gói chỉ hỗ trợ sửa ngày; chưa hỗ trợ sửa nội dung từng gói.' : '') || (c.lineCommission ? 'Đã có hoa hồng theo dòng; chưa hỗ trợ sửa nội dung trực tiếp.' : '') || (c.packageCommission ? 'Đã có hoa hồng gói; cần đối soát riêng.' : ''),
    date: chain || (!['SERVICE','SESSION','PACKAGE','PRODUCT'].includes(invoice.kind || 'SERVICE') ? 'Loại hóa đơn này chưa hỗ trợ sửa ngày.' : '') || locked,
    replace, cancel: content || (c.packageCommission ? 'Đã có hoa hồng gói; cần đối soát riêng.' : ''), void: voidReason,
  };
}
