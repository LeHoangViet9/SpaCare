import { z } from 'zod';
import { Commission, Payroll, User, Service } from './models';
import { monthBounds, payrollMonth } from './payroll-rules';
import { ensure } from './rules';
import type { Actor } from './auth';
export function payrollQuery(params: URLSearchParams) {
  return z.object({ month: payrollMonth, employee: z.union([z.literal(''), z.string().regex(/^[a-f\d]{24}$/i)]).default(''),
    view: z.enum(['salary', 'commission']).default('salary'), page: z.coerce.number().int().min(1).max(1000000).default(1) }).parse(Object.fromEntries(params));
}
export function payrollStaffScope(user: Actor, employee = '') {
  ensure(user.role === 'OWNER' || user.role === 'STAFF', 'Vai trò không được xem bảng lương.', 403);
  ensure(user.role === 'OWNER' || !employee || employee === user.id, 'Chỉ được xem lương và hoa hồng của mình.', 403);
  return { spaId: user.spaId, ...(user.role === 'OWNER' ? employee ? { staffId: employee } : {} : { staffId: user.id }) };
}
export async function readPayroll(user: Actor, q: ReturnType<typeof payrollQuery>) {
  const scope = payrollStaffScope(user, q.employee);
  const { start, end } = monthBounds(q.month);
  const people = await User.find({ spaId: user.spaId, ...(user.role === 'OWNER' ? {} : { _id: user.id }) }).select('name active role +baseSalary').sort({ name: 1 }).lean();
  const payrollFilter = { ...scope, month: q.month };
  const commissionFilter = { ...scope, earnedAt: { $gte: start, $lt: end } };
  const collection = q.view === 'salary' ? Payroll : Commission;
  const filter = q.view === 'salary' ? payrollFilter : commissionFilter;
  const total = await collection.countDocuments(filter);
  const page = Math.min(q.page, Math.max(1, Math.ceil(total / 10)));
  const rows = await collection.find(filter).select('-commissionIds').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10).lean();
  const commissionMatch = (Commission.find(commissionFilter) as any).cast(Commission);
  const summary = await Commission.aggregate([{ $match: commissionMatch }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  const unsettled = await Commission.aggregate([{ $match: (Commission.find({ ...scope, payrollId: { $exists: false }, earnedAt: { $lt: end } }) as any).cast(Commission) }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  const payrolls = q.view === 'commission' ? await Payroll.find({ ...scope, _id: { $in: rows.map(r => r.payrollId).filter(Boolean) } }).select('month status').lean() : [];
  const services = user.role === 'OWNER' && q.view === 'commission' ? await Service.find({ spaId: user.spaId }).select('name commission active').sort({ name: 1, _id: 1 }).lean() : [];
  return { services, people: people.map(p => ({ _id: p._id, name: p.name, active: p.active, role: p.role, baseSalary: p.baseSalary ?? null })),
    rows: rows.map(r => ({ ...r, ...(q.view === 'commission' ? { payrollMonth: payrolls.find(p => String(p._id) === String(r.payrollId))?.month, payrollStatus: payrolls.find(p => String(p._id) === String(r.payrollId))?.status } : {}) })),
    page, total, summary: { commission: summary[0]?.amount || 0, sessions: summary[0]?.count || 0, unsettled: unsettled[0]?.amount || 0, unsettledCount: unsettled[0]?.count || 0 } };
}
