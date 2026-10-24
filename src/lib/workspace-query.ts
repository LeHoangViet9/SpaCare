import { z } from 'zod';
type Choice = [string, string];
export const statusChoices: Record<string, Choice[]> = {
  appointments: [['CONFIRMED', 'Đã đặt'], ['POSTPONED', 'Đang hoãn'], ['COMPLETED', 'Hoàn thành'], ['CANCELLED', 'Đã hủy']],
  invoices: [['DEBT', 'Còn nợ'], ['OVERDUE', 'Nợ quá hạn'], ['UNPAID', 'Chưa trả'], ['PARTIALLY_PAID', 'Trả một phần'], ['PAID', 'Đã thanh toán'], ['SESSION', 'Buổi liệu trình 0đ'], ['GIFT', 'Quà tặng']],
  deposits: [['AVAILABLE', 'Còn số dư'], ['EXHAUSTED', 'Đã dùng hết']],
  packages: [['ACTIVE', 'Đang dùng'], ['PAUSED', 'Bảo lưu'], ['COMPLETED', 'Đã hết buổi'], ['GIFT', 'Gói được tặng']],
  services: [['ACTIVE', 'Đang hoạt động'], ['INACTIVE', 'Đã ngừng']],
  package_catalog: [['ACTIVE', 'Đang bán'], ['INACTIVE', 'Đã ngừng']],
  staff: [['ACTIVE', 'Đang hoạt động'], ['INACTIVE', 'Đã khóa']],
  days: [['OPEN', 'Đang mở'], ['CLOSED', 'Đã chốt']],
};


export const sectionCollection: Record<string, string> = {
  package_catalog: 'packageTemplates',
  customers: 'customers', services: 'services', staff: 'staff', appointments: 'appointments',
  invoices: 'invoices', deposits: 'deposits', packages: 'treatments', treatment_uses: 'uses',
  cash: 'cash', days: 'days', audit: 'audit',
};
const date = z.string().refine(s => !s || /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s).default('');
export function workspaceQuery(params: URLSearchParams) {
  return z.object({
    section: z.enum(['cash_cards', 'overview', 'products', 'product_groups', 'inventory', 'salary', 'commission', 'cashier', 'customers', 'services', 'staff', 'appointments', 'invoices', 'deposits', 'packages', 'package_catalog', 'treatment_uses', 'cash', 'days', 'reports', 'audit']).default('overview'),
    search: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    allocationPage: z.coerce.number().int().min(1).max(1_000_000).default(1),
    from: date, to: date,
    actor: z.union([z.literal(''), z.string().regex(/^[a-f\d]{24}$/i)]).default(''),
    action: z.string().max(100).default(''),
    status: z.string().max(30).default(''),
    employee: z.union([z.literal(''), z.string().regex(/^[a-f\d]{24}$/i)]).default(''),
    customer: z.union([z.literal(''), z.string().regex(/^[a-f\d]{24}$/i)]).default(''),
    method: z.enum(['', 'CASH', 'BANK_TRANSFER']).default(''),
    direction: z.enum(['', 'IN', 'OUT']).default(''),
    category: z.string().trim().max(100).default(''),
    order: z.enum(['asc', 'desc']).default('desc'),
  }).refine(q => !q.status || !!statusChoices[q.section]?.some(([key]) => key === q.status), 'Trạng thái không hợp lệ cho danh sách này.'
  ).refine(q => !q.from || !q.to || q.from <= q.to, 'Ngày kết thúc phải từ ngày bắt đầu trở đi.').parse(Object.fromEntries(params));
}
export function literalPattern(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
