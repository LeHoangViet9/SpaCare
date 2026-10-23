import { availableTreatmentFilter } from './treatment-rules';
import { Appointment, Customer, Deposit, Invoice, Service, Treatment, User } from './models';
import { invoiceScope } from './invoice-read';
import { ensure } from './rules';
import type { Actor } from './auth';
export async function readCustomerHistory(user: Actor, id: string, kind: 'invoices' | 'appointments' | 'treatments', requested: number) {
  ensure(/^[a-f\d]{24}$/i.test(id), 'ID không hợp lệ.');
  const scope = { spaId: user.spaId };
  const customer = await Customer.findOne({ ...scope, _id: id }).select('name phone notes consultantId createdAt').lean();
  ensure(customer, 'Không tìm thấy khách hàng.', 404);
  const invoiceFilter = { ...await invoiceScope(user), customerId: id };
  const appointmentsFilter = { ...scope, customerId: id, ...(user.role !== 'OWNER' && !user.cashier ? { staffId: user.id } : {}) };
  const treatmentFilter = { ...scope, customerId: id };
  const models = { invoices: Invoice, appointments: Appointment, treatments: Treatment };
  const filter = kind === 'invoices' ? invoiceFilter : kind === 'appointments' ? appointmentsFilter : treatmentFilter;
  const total = await models[kind].countDocuments(filter);
  const page = Math.min(requested, Math.max(1, Math.ceil(total / 10)));
  const rows = await models[kind].find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10).lean();
  const services = await Service.find({ ...scope, _id: { $in: rows.map(r => r.serviceId).filter(Boolean) } }).select('name').lean();
  const people = await User.find({ ...scope, _id: { $in: [...rows.map(r => r.staffId), customer.consultantId].filter(Boolean) } }).select('name').lean();
  const invoiceMatch = (Invoice.find(invoiceFilter) as any).cast(Invoice);
  const balances = await Invoice.aggregate([{ $match: invoiceMatch }, { $group: { _id: null, count: { $sum: 1 }, debt: { $sum: { $subtract: ['$total', '$paid'] } } } }]);
  const canSeeCredit = user.role === 'OWNER' || user.cashier || !!balances[0]?.count;
  const credit = canSeeCredit ? await Deposit.aggregate([{ $match: (Deposit.find({ ...scope, customerId: id }) as any).cast(Deposit) }, { $group: { _id: null, balance: { $sum: '$balance' } } }]) : [];
  const appointments = await Appointment.countDocuments(appointmentsFilter);
  const activePackages = await Treatment.countDocuments({ ...treatmentFilter, ...availableTreatmentFilter() });
  const lastVisit = await Appointment.findOne({ ...appointmentsFilter, status: 'COMPLETED' }).sort({ startAt: -1 }).select('startAt').lean();
  return { customer: { ...customer, consultantName: people.find(p => String(p._id) === String(customer.consultantId))?.name },
    rows: rows.map(r => ({ ...r, serviceName: services.find(s => String(s._id) === String(r.serviceId))?.name,
      staffName: people.find(p => String(p._id) === String(r.staffId))?.name })), kind, total, page,
    summary: { invoices: balances[0]?.count || 0, debt: balances[0]?.debt || 0, credit: canSeeCredit ? credit[0]?.balance || 0 : null, appointments, activePackages, lastVisit: lastVisit?.startAt || null } };
}
