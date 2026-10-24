import { formatCurrency } from './currency';
type Row = Record<string, any>;
export const auditActions: Record<string, string> = {
  updateInvoice:'Sửa hóa đơn chưa giao dịch',
  recordStaffLeave:'Ghi / sửa nghỉ phép',reviewStaffLeave:'Duyệt / từ chối nghỉ',recordWorkday:'Ghi ngày công',setSalaryPolicy:'Cài chính sách lương',refundPackage:'Ghi nhận hoàn tiền gói theo ngoại lệ',
  product: 'Thêm sản phẩm', updateProduct: 'Sửa sản phẩm', productStatus: 'Đổi trạng thái sản phẩm', productGroup: 'Thêm nhóm sản phẩm', updateProductGroup: 'Sửa nhóm sản phẩm', stockMovement: 'Nhập / xuất kho', sellProduct: 'Bán sản phẩm',
  setServiceCommission: 'Cài hoa hồng dịch vụ',
  setStaffSalary: 'Cài lương cơ bản', savePayroll: 'Lập / cập nhật lương nháp', approvePayroll: 'Duyệt bảng lương', payPayroll: 'Chi trả lương', completeInvoiceService: 'Hoàn thành dịch vụ lẻ',
  customer: 'Thêm khách hàng', updateCustomer: 'Sửa khách hàng', serviceGroup: 'Tạo nhóm dịch vụ', service: 'Thêm dịch vụ', updateService: 'Sửa dịch vụ', serviceStatus: 'Đổi trạng thái dịch vụ', user: 'Thêm nhân viên', updateUser: 'Sửa nhân viên', userStatus: 'Đổi trạng thái nhân viên', appointment: 'Đặt lịch hẹn', appointmentStatus: 'Đổi trạng thái lịch hẹn', completeAppointment: 'Hoàn thành lịch dịch vụ lẻ', completeTreatmentAppointment: 'Hoàn thành lịch liệu trình', rescheduleAppointment: 'Dời / xếp lại lịch hẹn', invoice: 'Tạo hóa đơn', sellCashCard: 'Bán thẻ tiền', redeemCashCard: 'Dùng thẻ tiền', sellPackage: 'Bán gói liệu trình', deposit: 'Nhận tiền cọc', allocate: 'Phân bổ tiền cọc', reverseAllocation: 'Đảo phân bổ cọc do sai sót', payment: 'Thu tiền hóa đơn', cash: 'Ghi thu / chi', reverseCash: 'Đảo khoản thu / chi do sai sót', treatment: 'Tạo liệu trình', use: 'Ghi nhận buổi liệu trình', pauseTreatment: 'Bảo lưu liệu trình', extendTreatmentHold: 'Gia hạn bảo lưu', resumeTreatment: 'Mở lại liệu trình', openDay: 'Mở sổ ngày', closeDay: 'Chốt sổ ngày', reopenDay: 'Mở lại sổ ngày',
};
const fields: Record<string, string> = {
  productId: 'Sản phẩm', sku: 'Mã sản phẩm', unit: 'Đơn vị', quantity: 'Số lượng', unitPrice: 'Đơn giá', groupId: 'Nhóm sản phẩm',
  commission: 'Hoa hồng / lần',
  month: 'Tháng lương', baseSalary: 'Lương cơ bản', commissionTotal: 'Tổng hoa hồng', commissionCount: 'Số ca / buổi', carryoverCount: 'Khoản từ tháng trước', bonus: 'Thưởng / phụ cấp', deductions: 'Khấu trừ', expectedTotal: 'Số tiền xác nhận',
  name: 'Tên', customerId: 'Khách hàng', serviceId: 'Dịch vụ', staffId: 'Nhân viên phục vụ', invoiceId: 'Hóa đơn', depositId: 'Khoản cọc', treatmentId: 'Liệu trình', appointmentId: 'Lịch hẹn', replacementAppointmentId: 'Lịch hẹn mới', treatmentUseId: 'Buổi liệu trình', amount: 'Số tiền', total: 'Tổng tiền', paid: 'Đã thanh toán', price: 'Giá dịch vụ', balance: 'Cọc còn lại', opening: 'Tiền mặt đầu ngày', expected: 'Tiền mặt dự kiến', counted: 'Tiền mặt kiểm đếm', difference: 'Chênh lệch', bankNet: 'Chuyển khoản ròng', method: 'Phương thức', direction: 'Thu / chi', kind: 'Loại giao dịch', status: 'Trạng thái', active: 'Đang hoạt động', cashier: 'Quyền thu ngân', reason: 'Lý do', note: 'Ghi chú', notes: 'Ghi chú', description: 'Nội dung', phone: 'Số điện thoại', email: 'Email', duration: 'Thời lượng (phút)', totalSessions: 'Tổng số buổi', remaining: 'Số buổi còn lại', remainingBefore: 'Số buổi trước khi ghi', startAt: 'Bắt đầu', endAt: 'Kết thúc', day: 'Ngày sổ', dueDate: 'Hạn thanh toán', holdUntil: 'Bảo lưu đến ngày', expiresOn: 'Hạn sử dụng', transferReference: 'Tham chiếu chuyển khoản', receivedConfirmation: 'Đã xác nhận thực nhận', evidenceRecorded: 'Đã lưu xác nhận buổi',
};
const money = new Set(['baseSalary', 'commissionTotal', 'bonus', 'deductions', 'expectedTotal', 'amount', 'total', 'paid', 'price', 'balance', 'opening', 'expected', 'counted', 'difference', 'bankNet']);
const enums: Record<string, string> = { DRAFT: 'Bản nháp', APPROVED: 'Đã duyệt', PAYROLL: 'Chi lương', CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', IN: 'Thu', OUT: 'Chi', CARD_SALE: 'Thu mua thẻ', PAYMENT: 'Thu hóa đơn', DEPOSIT: 'Nhận cọc', INCOME: 'Thu khác', EXPENSE: 'Chi phí', REVERSAL: 'Đảo sai sót', CONFIRMED: 'Đã đặt', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', POSTPONED: 'Đang hoãn', ACTIVE: 'Đang dùng', PAUSED: 'Đang bảo lưu', OPEN: 'Đang mở', CLOSED: 'Đã chốt', DRAWN_SIGNATURE: 'Khách ký trên màn hình', SIGNATURE_REFERENCE: 'Tham chiếu phiếu ký', ALTERNATIVE: 'Xác nhận thay thế' };
const collections: Record<string, string> = { customerId: 'customers', serviceId: 'services', staffId: 'staff', invoiceId: 'invoices', depositId: 'deposits', treatmentId: 'treatments', appointmentId: 'appointments', replacementAppointmentId: 'appointments', treatmentUseId: 'uses' };
export function auditValue(key: string, value: any, data: Row): string {
  if (value === undefined || value === null || value === '') return 'Chưa ghi nhận';
  if (collections[key]) {
    const record = (data[collections[key]] || []).find((r: Row) => String(r._id) === String(value));
    return (record?.name || record?.description || fields[key]) + ' #' + String(value).slice(-6);
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if ((money.has(key) || key === 'commission' || key === 'unitPrice') && typeof value === 'number') return formatCurrency(value);
  if (['startAt', 'endAt'].includes(key)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Ngày giờ không hợp lệ' : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  }
  if (['day', 'dueDate', 'holdUntil', 'expiresOn'].includes(key) && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value).split('-').reverse().join('/');
  return typeof value === 'object' ? 'Thông tin đã lưu' : enums[String(value)] || String(value);
}
export function auditLines(details: Row | null | undefined, data: Row): string[] {
  const d = details || {};
  const lines: string[] = [];
  const changed = new Set<string>();
  if (d.before && d.after) for (const key of Object.keys(fields)) {
    if (JSON.stringify(d.before[key]) !== JSON.stringify(d.after[key]) && (key in d.before || key in d.after)) {
      changed.add(key);
      lines.push(`${fields[key]}: ${auditValue(key, d.before[key], data)} → ${auditValue(key, d.after[key], data)}`);
    }
  }
  for (const [key, title] of Object.entries(fields)) if (key in d && !changed.has(key)) lines.push(`${title}: ${auditValue(key, d[key], data)}`);
  if (d.daySnapshot) for (const key of ['day', 'opening', 'expected', 'counted', 'difference', 'bankNet', 'status']) {
    if (!(key in d) && key in d.daySnapshot) lines.push(`${fields[key]}: ${auditValue(key, d.daySnapshot[key], data)}`);
  }
  return lines.length ? lines : ['Bản ghi cũ chưa có thông tin chi tiết để hiển thị.'];
}
