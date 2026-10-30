import mongoose from 'mongoose';
import { Appointment, CashEntry, Commission, InvoiceLineCommission, Customer, Invoice, TreatmentUse, User, SaleCommission, SharedSaleCommission } from './models';
import { ensure } from './rules';
import type { Actor } from './auth';
import type { workspaceQuery } from './workspace-query';

type Row = Record<string, any>;
export function reportDateRange(from: string, to: string) {
  return { ...(from ? { $gte: new Date(from + 'T00:00:00+07:00') } : {}),
    ...(to ? { $lt: new Date(new Date(to + 'T00:00:00+07:00').getTime() + 86400000) } : {}) };
}
export async function readReport(user: Actor, query: ReturnType<typeof workspaceQuery>) {
  ensure(user.role === 'OWNER', 'Chỉ chủ spa được xem báo cáo.', 403);
  const scope = { spaId: new mongoose.Types.ObjectId(user.spaId) };
  const range = reportDateRange(query.from, query.to);
  const dated = (field: string) => ({ ...scope, ...(Object.keys(range).length ? { [field]: range } : {}) });
  const [days, methods, invoiceStats, kinds, dailyInvoices, invoiceCount, staff] = await Promise.all([
    CashEntry.aggregate([{ $match: { ...scope, ...(query.from || query.to ? { day: { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) } } : {}) } },
      { $group: { _id: '$day', incoming: { $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$amount', 0] } }, outgoing: { $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$amount', 0] } } } }, { $sort: { _id: 1 } }]),
    CashEntry.aggregate([{ $match: { ...scope, ...(query.from || query.to ? { day: { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) } } : {}) } },
      { $group: { _id: '$method', incoming: { $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$amount', 0] } }, outgoing: { $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$amount', 0] } } } }]),
    Invoice.aggregate([{ $match: dated('createdAt') }, { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' }, paid: { $sum: '$paid' }, refunded:{$sum:{$ifNull:['$refunded',0]}}, debt: { $sum: { $subtract: ['$total', '$paid'] } } } }]),
    Invoice.aggregate([{ $match: dated('createdAt') }, { $group: { _id: { $ifNull: ['$kind', 'LEGACY'] }, count: { $sum: 1 }, total: { $sum: '$total' }, paid: { $sum: '$paid' } } }, { $sort: { total: -1, _id: 1 } }]),
    Invoice.aggregate([{ $match: dated('createdAt') }, { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: 'Asia/Ho_Chi_Minh' } }, count: { $sum: 1 }, total: { $sum: '$total' } } }, { $sort: { _id: 1 } }]),
    Invoice.countDocuments(dated('createdAt')),
    user.role === 'OWNER' ? User.find({ ...scope, role: { $in: ['OWNER', 'STAFF'] } }).select('name email role active cashier').sort({ name: 1, _id: 1 }).lean() : [],
  ]);
  const page = Math.min(query.page, Math.max(1, Math.ceil(invoiceCount / query.pageSize)));
  const invoices: Row[] = await Invoice.find(dated('createdAt')).select('code customerId description kind total paid createdAt consultantName').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * query.pageSize).limit(query.pageSize).lean();
  const customers = await Customer.find({ ...scope, _id: { $in: invoices.map(i => i.customerId) } }).select('name phone').lean();
  let employees: Row[] = [];
  if (user.role === 'OWNER') {
    const [appointments, sessions, commissions, consulting, salesCommissions] = await Promise.all([
      Appointment.aggregate([{ $match: dated('startAt') }, { $group: { _id: '$staffId', appointments: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } } } }]),
      TreatmentUse.aggregate([{ $match: dated('performedAt') }, { $group: { _id: '$staffId', sessions: { $sum: 1 } } }]),
      Commission.aggregate([{ $match: {...dated('earnedAt'),cancelledAt:{$exists:false}} },{$unionWith:{coll:InvoiceLineCommission.collection.name,pipeline:[{$match:{...dated('earnedAt'),cancelledAt:{$exists:false}}}]}}, { $group: { _id: '$staffId', commission: { $sum: '$amount' }, services: { $sum: 1 } } }]),
      Invoice.aggregate([{ $match: dated('createdAt') }, { $group: { _id: '$consultantId', invoices: { $sum: 1 }, sales: { $sum: '$total' } } }]),
      SaleCommission.aggregate([{$match:dated('earnedAt')},{$unionWith:{coll:SharedSaleCommission.collection.name,pipeline:[{$match:dated('earnedAt')}]}},{$group:{_id:'$staffId',saleCommission:{$sum:'$amount'}}}]),
    ]);
    const byId = (rows: Row[], id: unknown) => rows.find(r => String(r._id) === String(id)) || {};
    employees = staff.map(s => ({ ...s, appointments: byId(appointments, s._id).appointments || 0, completed: byId(appointments, s._id).completed || 0,
      cancelled: byId(appointments, s._id).cancelled || 0, sessions: byId(sessions, s._id).sessions || 0,
      saleCommission:byId(salesCommissions,s._id).saleCommission || 0, commission: byId(commissions, s._id).commission || 0, services: byId(commissions, s._id).services || 0,
      invoices: byId(consulting, s._id).invoices || 0, sales: byId(consulting, s._id).sales || 0 }));
  }
  return { inflow: days.reduce((s, d) => s + d.incoming, 0), outflow: days.reduce((s, d) => s + d.outgoing, 0), days, methods, kinds, dailyInvoices,
    invoices: invoices.map(i => ({ ...i, customerName: customers.find(c => String(c._id) === String(i.customerId))?.name || 'Khách hàng cũ' })),
    page, pageSize: query.pageSize, total: invoiceCount, summary: invoiceStats[0] || { count: 0, total: 0, paid: 0, debt: 0 }, employees };
}
