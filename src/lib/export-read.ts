import {invoiceSummary,discountLabel} from './invoice-discount';
import {visibleInvoiceDeadline} from './invoice-deadline';
import { historicalInvoiceCode, invoiceCode } from './invoice-code';
import type { Actor } from './auth';
import type { ExportDocument } from './export-document';
import { readInvoice } from './invoice-read';
import { payrollStaffScope, commissionPipeline, commissionCustomers } from './payroll-read';
import { monthBounds } from './payroll-rules';
import { Commission, User } from './models';
import { formatCurrency } from './currency';
import { ensure } from './rules';
const money = (value: unknown) => formatCurrency(Number(value || 0));
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-';
export async function invoiceExport(user: Actor, id: string): Promise<ExportDocument> {
  ensure(['OWNER', 'STAFF'].includes(user.role), 'Không có quyền xuất hóa đơn.', 403);
  const data = await readInvoice(user, id);
  return invoiceExportDocument(data);
}
export function invoiceExportDocument(data: Awaited<ReturnType<typeof readInvoice>>): ExportDocument {
  const bill = data.invoice;
  const summary=invoiceSummary(bill);
  const services=[...(bill.serviceItems || []),...(bill.treatmentSessions || []).filter((session:any)=>!bill.serviceItems?.some((item:any)=>item.lineId && String(item.lineId)===String(session.lineId) && item.total===0 && session.total===0))];
  const serviceRow=(item:{name?:string;total:number;performerName?:string|null})=>[`${item.name || 'Dịch vụ'}\nKỹ thuật viên: ${item.performerName || 'Chưa có'}`,money(item.total)];
  const replacementNotes = bill.activeDocumentId && !bill.financialRevision ? [`Chứng từ thay thế hiện hành. Chứng từ trước đã hết hiệu lực: ${(bill.documentHistory || []).map(historicalInvoiceCode).join(', ')}. Giữ nguyên khoản thu và quyền lợi; không thu tiền lần nữa.`] : [];
  return {
    filename: `${invoiceCode(bill)}.pdf`, title: bill.status === 'CANCELLED' ? 'HÓA ĐƠN ĐÃ HỦY' : bill.openingBalance ? 'CHỨNG TỪ CHUYỂN SỐ DƯ' : 'HÓA ĐƠN BÁN HÀNG',
    subtitle: 'Thanh Thư Spa',
    receipt: { name: 'Thanh Thư Spa', address: 'CL12 Đầm Lau, xã Phụng Công, tỉnh Hưng Yên', phone: '0329 357 116', cashier: bill.creatorName || 'Chưa ghi nhận' },
    notes: [...replacementNotes, ...(bill.financialRevision ? ['Hóa đơn có chứng từ điều chỉnh. Các dòng hàng/dịch vụ gốc giữ nguyên; tổng hiện hành gồm các điều chỉnh. Vô hiệu hóa không có nghĩa đã hoàn tiền.'] : []), ...(bill.status === 'CANCELLED' ? [`Đã hủy, không tính công nợ. Giá trị trước hủy: ${money(bill.cancelledTotal)}. Lý do: ${bill.cancelReason || '-'}`] : []), ...(bill.openingBalance ? [bill.kind === 'PACKAGE' ? 'Liệu trình đã trả đủ trước chuyển đổi. Chưa có giá mua gốc; 0đ là không thu thêm, không phải gói tặng.' : 'Công nợ chuyển từ sổ cũ, không phải lần bán hoặc xuất kho mới.'] : [])],
    tables: [
      { columns: ['Thông tin', 'Chi tiết'], widths: [0.28, 0.72], rows: [
        ['Mã hóa đơn', invoiceCode(bill)], ['Ngày tạo', date(bill.createdAt)],
        ['Khách hàng', data.customer?.name || '-'], ['Số điện thoại', data.customer?.phone || '-'],
        ['Người lập', bill.creatorName || 'Chưa ghi nhận'],
        ...(bill.kind === 'PACKAGE' ? [['Tư vấn bán gói', bill.saleParticipants?.length ? bill.saleParticipants.map((p:{staffName:string})=>p.staffName).join(', ') : bill.sellerName || 'Chưa ghi nhận']] : []),
      ] },
      { heading: 'Dịch vụ / gói / sản phẩm', columns: ['Nội dung', 'Thành tiền'], widths: [0.72, 0.28], rows: [
        ...(bill.packageItems || []).map((item:any)=>[item.name || 'Gói',money(item.total)]),
        ...services.map(serviceRow),
        ...(!bill.packageItems?.length && !services.length && !bill.productItems?.length ?
          (!bill.kind || ['SERVICE','SESSION','GIFT'].includes(bill.kind) ? [serviceRow({name:bill.description,total:summary.subtotal,performerName:bill.performerName})] : [[bill.description || 'Nội dung',money(summary.subtotal)]]) : []),
        ...(bill.productItems || []).map((item:any)=>[`${item.name} · ${item.quantity} ${item.unit} × ${money(item.unitPrice)}`,money(item.total)]),
        ...data.gifts.map(gift => [`Quà tặng: ${gift.description || 'Gói tặng'}`, money(0)]),
      ] },
      ...(data.adjustments?.length ? [{heading:'Chứng từ điều chỉnh',columns:['Thời điểm / người sửa','Nội dung / lý do','Chênh lệch chứng từ'],widths:[0.25,0.5,0.25],rows:data.adjustments.map(a=>[date(a.createdAt)+' · '+a.actorName, a.mode+' · '+a.reason+' · #'+String(a._id)+(a.before?.createdAt&&a.after?.createdAt&&String(a.before.createdAt)!==String(a.after.createdAt)?' · Ngày hóa đơn: '+date(a.before.createdAt)+' → '+date(a.after.createdAt):''),money(a.delta)])}] : []),
      { heading: 'Thanh toán', columns: ['Khoản mục', 'Số tiền'], widths: [0.65, 0.35], rows: [
        ...(bill.adjustmentCredit ? [['Tiền trực tiếp giữ chờ xử lý (chưa hoàn)', money(bill.adjustmentCredit)]] : []),
        ['Tạm tính',money(summary.subtotal)], ['Giảm giá ('+discountLabel(bill.discount)+')',money(summary.discountAmount)],
        ...(summary.adjustment!==0 ? [['Điều chỉnh sau lập',money(summary.adjustment)]] : []),
        ['Tổng thanh toán sau giảm', money(bill.total)], ['Đã trả', money(bill.paid)],
        ...(bill.cardPaid ? [['Trong đó dùng thẻ tiền (không thu mới)', money(bill.cardPaid)]] : []),
        ...(bill.giftCashCardAmount ? [['Mệnh giá thẻ tặng kèm', money(bill.giftCashCardAmount)]] : []),
        ...(bill.refunded ? [['Đã hoàn', money(bill.refunded)]] : []),
        ['Còn nợ', money(Math.max(0, bill.total - bill.paid))],
        ...(visibleInvoiceDeadline(bill) ? [['Hạn thanh toán',visibleInvoiceDeadline(bill)!]] : []),
      ] },
    ],
  };
}
export async function commissionExport(user: Actor, month: string, employee: string): Promise<ExportDocument> {
  const scope = payrollStaffScope(user, employee);
  const { start, end } = monthBounds(month);
  const selectedId = user.role === 'OWNER' ? employee : user.id;
  const person = selectedId ? await User.findOne({ spaId: user.spaId, _id: selectedId, role: { $in: ['OWNER', 'STAFF'] } }).select('name').lean() : null;
  ensure(!selectedId || person, 'Không tìm thấy nhân viên trong spa.', 404);
  const sourceRows = await Commission.aggregate([...commissionPipeline({ ...scope, earnedAt: { $gte: start, $lt: end } }),
    { $sort: { staffName: 1, staffId: 1, earnedAt: 1, _id: 1 } },
    { $project: { staffId: 1, staffName: 1, serviceName: 1, category: 1, amount: 1, earnedAt: 1, invoiceId: 1, customerId: 1, shareCount: 1 } }]);
  const rows = await commissionCustomers(user.spaId, sourceRows);
  const sums = new Map<string, { name: string; service: number; sale: number }>();
  for (const row of rows) {
    const id = String(row.staffId);
    const sum = sums.get(id) || { name: row.staffName || person?.name || 'Nhân viên', service: 0, sale: 0 };
    if (row.category === 'PACKAGE_SALE') sum.sale += row.amount; else sum.service += row.amount;
    sums.set(id, sum);
  }
  const summary = [...sums.values()];
  return {
    filename: `Hoa-hong-${month}-${selectedId || 'tat-ca'}.pdf`, title: 'BẢNG KÊ HOA HỒNG',
    subtitle: `Tháng ${month.slice(5)}/${month.slice(0, 4)} | ${person?.name || 'Tất cả nhân viên'}`,
    notes: ['Tổng hợp toàn bộ phát sinh trong tháng theo giờ Việt Nam, không chỉ trang đang xem.',
      'Hoa hồng dịch vụ và bán gói được tách riêng; khoản điều chỉnh âm được giữ nguyên. Bảng kê không xác nhận đã chi lương.'],
    tables: [
      { heading: 'Tổng hợp theo nhân viên', columns: ['Nhân viên', 'Dịch vụ', 'Bán gói', 'Tổng'], widths: [0.34, 0.22, 0.22, 0.22], rows: [
        ...summary.map(sum => [sum.name, money(sum.service), money(sum.sale), money(sum.service + sum.sale)]),
        ['TỔNG CỘNG', money(summary.reduce((n, sum) => n + sum.service, 0)), money(summary.reduce((n, sum) => n + sum.sale, 0)), money(summary.reduce((n, sum) => n + sum.service + sum.sale, 0))],
      ] },
      { heading: `Chi tiết (${rows.length} khoản)`, columns: ['Ngày', 'Nhân viên', 'Nội dung', 'Hoa hồng'], widths: [0.2, 0.22, 0.36, 0.22],
        rows: rows.length ? rows.map(row => [date(row.earnedAt), row.staffName || person?.name || '-',
          `${row.category === 'PACKAGE_SALE' ? (row.shareCount > 1 ? `Chia 5% / ${row.shareCount} người` : 'Bán gói 5%') : 'Dịch vụ'}: ${row.serviceName || '-'}${row.invoiceId ? ' | HĐ #' + String(row.invoiceId).slice(-6) : ''}\nKhách: ${row.customerName || 'Chưa ghi nhận'}${row.customerPhone ? ' · ' + row.customerPhone : ''}`, money(row.amount)]) : [['-', '-', 'Chưa có phát sinh trong tháng', money(0)]] },
    ],
  };
}
