import mongoose from 'mongoose';
import { Appointment, Customer } from './models';
import type { Actor } from './auth';
import { customerFilter, customerQuery } from './customer-query';

export async function findCustomerPage(spaId: string, query: ReturnType<typeof customerQuery>, user?: Actor) {
  const filter = customerFilter(spaId, query.search, query.id);
  const total = await Customer.countDocuments(filter);
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
  const customers = await Customer.find(filter).select('name phone notes consultantId createdAt updatedAt')
    .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * query.pageSize).limit(query.pageSize).lean();
  if (!user || user.spaId !== spaId) return { customers, total, page, pageSize: query.pageSize };
  const now = new Date();
  const scope = { spaId: new mongoose.Types.ObjectId(spaId), customerId: { $in: customers.map(c => c._id) },
    ...(user.role === 'OWNER' || user.cashier ? {} : { staffId: new mongoose.Types.ObjectId(user.id) }) };
  const [last, next] = await Promise.all([
    Appointment.aggregate([{ $match: { ...scope, status: 'COMPLETED', startAt: { $lte: now } } }, { $group: { _id: '$customerId', at: { $max: '$startAt' } } }]),
    Appointment.aggregate([{ $match: { ...scope, status: 'CONFIRMED', startAt: { $gte: now } } }, { $group: { _id: '$customerId', at: { $min: '$startAt' } } }]),
  ]);
  return { customers: customers.map(c => ({ ...c, lastVisit: last.find(a => String(a._id) === String(c._id))?.at || null,
    nextVisit: next.find(a => String(a._id) === String(c._id))?.at || null })), total, page, pageSize: query.pageSize };
}
