import { summarizeLeave } from './leave-rules';
import { z } from 'zod';
import { Commission, Payroll, User, Service, StaffLeave, SaleCommission, Workday } from './models';
import { monthBounds, payrollMonth } from './payroll-rules';
import { ensure } from './rules';
import type { Actor } from './auth';
export function payrollQuery(params: URLSearchParams) {
  return z.object({ month: payrollMonth, employee: z.union([z.literal(''), z.string().regex(/^[a-f\d]{24}$/i)]).default(''),
    leavePage: z.coerce.number().int().min(1).max(1000000).default(1), workPage: z.coerce.number().int().min(1).max(1000000).default(1), view: z.enum(['salary', 'commission']).default('salary'), page: z.coerce.number().int().min(1).max(1000000).default(1) }).parse(Object.fromEntries(params));
}
export function payrollStaffScope(user: Actor, employee = '') {
  ensure(user.role === 'OWNER' || user.role === 'STAFF', 'Vai trò không được xem bảng lương.', 403);
  ensure(user.role === 'OWNER' || !employee || employee === user.id, 'Chỉ được xem lương và hoa hồng của mình.', 403);
  return { spaId: user.spaId, ...(user.role === 'OWNER' ? employee ? { staffId: employee } : {} : { staffId: user.id }) };
}
export async function readPayroll(user: Actor, q: ReturnType<typeof payrollQuery>) {
  const scope = payrollStaffScope(user, q.employee);
  const { start, end } = monthBounds(q.month);
  const people = await User.find({ spaId: user.spaId, role: { $in: ['OWNER', 'STAFF'] }, ...(user.role === 'OWNER' ? {} : { _id: user.id }) }).select('name active role +baseSalary +salaryPolicy').sort({ name: 1 }).lean();
  const payrollFilter = { ...scope, month: q.month };
  const commissionFilter = { ...scope, earnedAt: { $gte: start, $lt: end } };
  const combined = (filter: Record<string,unknown>): any[] => {
    const match = (Commission.find(filter) as any).cast(Commission);
    return [{$match:match}, {$addFields:{category:{$ifNull:['$category','SERVICE']}}}, {$unionWith:{coll:SaleCommission.collection.name,pipeline:[{$match:match}]}}];
  };
  const combinedFilter = combined(commissionFilter);
  const total = q.view === 'salary' ? await Payroll.countDocuments(payrollFilter) : (await Commission.aggregate([...combinedFilter,{$count:'total'}]))[0]?.total || 0;
  const page = Math.min(q.page, Math.max(1, Math.ceil(total / 10)));
  const rows = q.view === 'salary' ? await Payroll.find(payrollFilter).select('-commissionIds -saleCommissionIds').sort({createdAt:-1,_id:-1}).skip((page-1)*10).limit(10).lean()
    : await Commission.aggregate([...combinedFilter,{$sort:{earnedAt:-1,_id:-1}},{$skip:(page-1)*10},{$limit:10}]);
  const summary = await Commission.aggregate([...combinedFilter,{$group:{_id:'$category',amount:{$sum:'$amount'},count:{$sum:1}}}]);
  const unsettled = await Commission.aggregate([...combined({...scope,payrollId:{$exists:false},earnedAt:{$lt:end}}),{$group:{_id:null,amount:{$sum:'$amount'},count:{$sum:1}}}]);
  const salarySummary = q.view === 'salary' ? await Payroll.aggregate([
    { $match: (Payroll.find(payrollFilter) as any).cast(Payroll) },
    { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } },
  ]) : [];
  const payrolls = q.view === 'commission' ? await Payroll.find({ ...scope, _id: { $in: rows.map(r => r.payrollId).filter(Boolean) } }).select('month status').lean() : [];
  const services = user.role === 'OWNER' && q.view === 'commission' ? await Service.find({ spaId: user.spaId }).select('name commission active').sort({ name: 1, _id: 1 }).lean() : [];
  const last = end.toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'});
  const leaveFilter = {...scope,$or:[{startDay:{$lt:last},endDay:{$gte:q.month+'-01'}},{startDay:{$exists:false},day:{$gte:q.month+'-01',$lt:last}}]};
  const allLeaves = q.view === 'salary' ? await StaffLeave.find(leaveFilter).sort({day:-1,_id:-1}).lean() : [];
  const leaveTotal = allLeaves.length, leavePage = Math.min(q.leavePage,Math.max(1,Math.ceil(leaveTotal/10)));
  const leaves = allLeaves.slice((leavePage-1)*10,leavePage*10);
  const workFilter = {...scope,day:{$gte:q.month+'-01',$lt:last}};
  const workSummary = q.view === 'salary' ? await Workday.aggregate([{$match:(Workday.find(workFilter) as any).cast(Workday)},{$group:{_id:'$staffId',days:{$sum:{$cond:[{$eq:['$period','FULL']},1,0.5]}}}}]) : [];
  const workTotal = q.view === 'salary' ? await Workday.countDocuments(workFilter) : 0;
  const workPage = Math.min(q.workPage,Math.max(1,Math.ceil(workTotal/10)));
  const workdays = q.view === 'salary' ? await Workday.find(workFilter).sort({day:-1,_id:-1}).skip((workPage-1)*10).limit(10).lean() : [];
  const leaveSummary = people.filter(p=>!q.employee || String(p._id)===q.employee).map(p=>({staffId:p._id,...summarizeLeave(allLeaves.filter(r=>String(r.staffId)===String(p._id)),q.month)}));
  return { workdays,workSummary,workTotal,workPage, leaves, leaveSummary, leaveTotal, leavePage, salarySummary, services, people: people.map(p => ({ _id: p._id, name: p.name, active: p.active, role: p.role, baseSalary: p.baseSalary ?? null, salaryPolicy:p.salaryPolicy })),
    rows: rows.map(r => ({ ...r, ...(q.view === 'commission' ? { payrollMonth: payrolls.find(p => String(p._id) === String(r.payrollId))?.month, payrollStatus: payrolls.find(p => String(p._id) === String(r.payrollId))?.status } : {}) })),
    page, total, summary: { commission:summary.reduce((n,r)=>n+r.amount,0), serviceCommission:summary.find(r=>r._id==='SERVICE')?.amount || 0, saleCommission:summary.find(r=>r._id==='PACKAGE_SALE')?.amount || 0, sessions:summary.find(r=>r._id==='SERVICE')?.count || 0, unsettled: unsettled[0]?.amount || 0, unsettledCount: unsettled[0]?.count || 0 } };
}
