import { leaveInputs } from './leave-rules';
import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ.');
const money = z.number().int().min(0).max(1_000_000_000_000);
export const payrollMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(value => Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 9998, 'Tháng không hợp lệ.');
export const payrollInputs = {
  ...leaveInputs,
  setServiceCommission: z.object({ serviceId: id, commission: money }),
  setStaffSalary: z.object({ staffId: id, baseSalary: money }),
  savePayroll: z.object({ id: id.optional(), staffId: id, month: payrollMonth, baseSalary: money.optional(), attendanceConfirmed: z.boolean().default(false), advance: money.default(0), bonus: money.default(0), deductions: money.default(0), note: z.string().trim().max(2000).default('') }),
  approvePayroll: z.object({ id, expectedTotal: money }),
  payPayroll: z.object({ id, method: z.enum(['CASH', 'BANK_TRANSFER']), receivedConfirmation: z.literal(true), note: z.string().trim().max(2000).default(''), transferReference: z.string().trim().max(500).optional() }),
  completeInvoiceService: z.object({ id, staffId: id }),
};
export function monthBounds(month: string) {
  payrollMonth.parse(month);
  const start = new Date(month + '-01T00:00:00+07:00');
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5));
  const nextMonth = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
  return { start, end: new Date(nextMonth + '-01T00:00:00+07:00') };
}
export function salaryTotal(base: number, commission: number, bonus: number, deductions: number) {
  for (const value of [base, commission, bonus, deductions]) money.parse(value);
  return money.parse(base + commission + bonus - deductions);
}
