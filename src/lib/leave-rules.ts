import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i);
export const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
 const d = new Date(value + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}, 'Ngày không hợp lệ.');
export const salaryPolicy = z.object({ standardDays: z.number().min(1).max(31).multipleOf(0.5), paidLeaveDays: z.number().min(0).max(31).multipleOf(0.5), mode: z.enum(['NONE','DAILY']) });
export const leaveInputs = {
 recordStaffLeave: z.object({ id: id.optional(), staffId: id, day: calendarDay.optional(), startDay: calendarDay.optional(), endDay: calendarDay.optional(), period: z.enum(['FULL','AM','PM']).default('FULL'), type: z.enum(['PERMITTED','UNPERMITTED']), note: z.string().trim().max(2000).default(''), paid: z.boolean().default(false) }).superRefine((v,ctx) => {
  const start = v.startDay || v.day, end = v.endDay || start;
  if (!start || !end || end < start || (Date.parse(end)-Date.parse(start))/86400000 > 365) ctx.addIssue({code:'custom',path:['endDay'],message:'Chọn khoảng ngày hợp lệ, tối đa 366 ngày.'});
 }),
 reviewStaffLeave: z.object({id, status:z.enum(['APPROVED','REJECTED']), paid:z.boolean().default(false)}),
 setSalaryPolicy: z.object({staffId:id, ...salaryPolicy.shape}),
 recordWorkday: z.object({staffId:id, day:calendarDay, period:z.enum(['FULL','AM','PM']), note:z.string().trim().max(2000).default('')}),
};
export type LeaveRow = {day?:string; startDay?:string; endDay?:string; period?:string; type:string; status?:string; paid?:boolean};
export function leaveDays(row: LeaveRow, month?:string) {
 const start = row.startDay || row.day!, end = row.endDay || start;
 const days: string[] = [];
 for (let date = new Date(start+'T00:00:00Z'); date <= new Date(end+'T00:00:00Z'); date = new Date(date.getTime()+86400000)) {
  const day = date.toISOString().slice(0,10); if (!month || day.startsWith(month+'-')) days.push(day);
 }
 return days;
}
export const dayUnits = (period?: string) => !period || period === 'FULL' ? 1 : 0.5;
export function leavesOverlap(a: LeaveRow, b: LeaveRow) {
 if (a.status === 'REJECTED' || b.status === 'REJECTED') return false;
 return leaveDays(a).some(day => leaveDays(b).includes(day)) && (!a.period || !b.period || a.period === 'FULL' || b.period === 'FULL' || a.period === b.period);
}
export function summarizeLeave(rows: LeaveRow[], month:string) {
 const summary = {permitted:0, unpermitted:0, paid:0, unpaid:0};
 for (const r of rows) if (!r.status || r.status === 'APPROVED') {
  const units = leaveDays(r,month).length * dayUnits(r.period);
  summary[r.type === 'PERMITTED' ? 'permitted' : 'unpermitted'] += units;
  summary[r.paid ? 'paid' : 'unpaid'] += units;
 }
 return summary;
}
export function attendanceSalary(base:number, policy: z.infer<typeof salaryPolicy> | undefined, workdays:number | null, leave: ReturnType<typeof summarizeLeave>) {
 if (!policy || policy.mode === 'NONE') return {earnedBase:base, leaveDeduction:0};
 salaryPolicy.parse(policy);
 // Only explicitly confirmed attendance can drive a prorated salary.
 if (workdays === null) throw new Error('Chưa xác nhận đủ dữ liệu ngày công tháng; không tự suy công từ lịch hẹn.');
 const payable = Math.min(policy.standardDays, workdays + Math.min(leave.paid,policy.paidLeaveDays));
 if (workdays < 0 || workdays > 31) throw new Error('Ngày công không hợp lệ.');
 const earnedBase = Math.round(base * payable / policy.standardDays);
 return {earnedBase, leaveDeduction:base-earnedBase};
}
