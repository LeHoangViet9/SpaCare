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
  const bill = data.invoice;
  return {
    filename: `Hoa-don-${id}.pdf`, title: 'HÓA ĐƠN BÁN HÀNG',
    subtitle: 'Thanh Thư Spa',
    receipt: { name: 'Thanh Thư Spa', address: 'CL12 Đầm Lau, xã Phụng Công, tỉnh Hưng Yên', phone: '0329 357 116', cashier: bill.creatorName || 'Chưa ghi nhận' },
    notes: ['Bản PDF tra cứu/giao khách, không phải hóa đơn điện tử có mã cơ quan thuế.',
      'Số tiền phản ánh dữ liệu tại thời điểm xuất. Hóa đơn còn nợ không phải xác nhận đã thanh toán.'],
    tables: [
      { columns: ['Thông tin', 'Chi tiết'], widths: [0.28, 0.72], rows: [
        ['Mã hóa đơn', id], ['Ngày tạo', date(bill.createdAt)],
        ['Khách hàng', data.customer?.name || '-'], ['Số điện thoại', data.customer?.phone || '-'],
        ['Người lập', bill.creatorName || 'Chưa ghi nhận'],
        ...(bill.kind === 'PACKAGE' ? [['Tư vấn bán gói', bill.saleParticipants?.length ? bill.saleParticipants.map((p:{staffName:string})=>p.staffName).join(', ') : bill.sellerName || 'Chưa ghi nhận']] : []),
      ] },
      { heading: 'Dịch vụ / gói / sản phẩm', columns: ['Nội dung', 'Thành tiền'], widths: [0.72, 0.28], rows: [
        [bill.description || 'Dịch vụ', money(bill.total)],
        ...data.gifts.map(gift => [`Quà tặng: ${gift.description || 'Gói tặng'}`, money(0)]),
      ] },
      { heading: 'Thanh toán', columns: ['Khoản mục', 'Số tiền'], widths: [0.65, 0.35], rows: [
        ['Tổng hóa đơn', money(bill.total)], ['Đã thanh toán', money(bill.paid)],
        ...(bill.cardPaid ? [['Trong đó dùng thẻ tiền (không thu mới)', money(bill.cardPaid)]] : []),
        ...(bill.giftCashCardAmount ? [['Mệnh giá thẻ tặng kèm', money(bill.giftCashCardAmount)]] : []),
        ...(bill.refunded ? [['Đã hoàn', money(bill.refunded)]] : []),
        ['Còn phải thanh toán', money(Math.max(0, bill.total - bill.paid))],
        ['Hạn thanh toán', bill.dueDate || 'Chưa đặt'],
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
