import mongoose from 'mongoose';
import { staffReadScope } from './staff-read-scope';
import { appointmentServiceName } from './appointment-services';
import { availableTreatmentFilter } from './treatment-rules';
import { Appointment, Audit, Customer, Deposit, Invoice, Service, PackageTemplate, Treatment, TreatmentUse, User } from './models';
import { saleablePackageTemplates } from './package-catalog';
import { invoiceScope } from './invoice-read';
import { ensure } from './rules';
import type { Actor } from './auth';
export async function readCustomerHistory(user: Actor, id: string, kind: 'invoices' | 'appointments' | 'treatments', requested: number) {
  ensure(/^[a-f\d]{24}$/i.test(id), 'ID không hợp lệ.');
  const scope = { spaId: user.spaId };
  const access = await staffReadScope(user);
  const customer = await Customer.findOne({ $and: [access.customers, { _id: id }] }).select('name phone notes consultantId createdAt').lean();
  ensure(customer, 'Không tìm thấy khách hàng.', 404);
  const invoiceFilter = { ...await invoiceScope(user), customerId: id };
  const appointmentsFilter = { ...scope, customerId: id, ...(user.role !== 'OWNER' && !user.cashier ? { staffId: user.id } : {}) };
  const sourceInvoiceIds = kind === 'treatments' ? await Treatment.find({ ...access.treatments, customerId: id }).distinct('invoiceId') : [];
  const cancelledSourceInvoiceIds = sourceInvoiceIds.length ? await Invoice.find({ ...scope, status: 'CANCELLED', _id: { $in: sourceInvoiceIds } }).distinct('_id') : [];
  const treatmentFilter = { $and: [access.treatments, { customerId: id, status: { $ne: 'CANCELLED' }, $or: [
    { invoiceId: { $nin: cancelledSourceInvoiceIds } },
    { retainedAfterVoid: true },
  ] }] };
  const models = { invoices: Invoice, appointments: Appointment, treatments: Treatment };
  const filter = kind === 'invoices' ? invoiceFilter : kind === 'appointments' ? appointmentsFilter : treatmentFilter;
  const total = await models[kind].countDocuments(filter);
  const page = Math.min(requested, Math.max(1, Math.ceil(total / 10)));
  const rows = await models[kind].find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10).lean();
  const recordedUses = kind === 'treatments' && rows.length ? await TreatmentUse.aggregate([
    { $match: { spaId: new mongoose.Types.ObjectId(user.spaId), treatmentId: { $in: rows.map(r => r._id) } } },
    { $group: { _id: '$treatmentId', count: { $sum: 1 } } },
  ]) : [];
  const recordedUseCounts = new Map(recordedUses.map(row => [String(row._id), row.count]));
  const changes = kind === 'treatments' ? await Audit.find({ ...scope, action: 'updateCustomerTreatment', targetId: { $in: rows.map(r => r._id) } }).select('targetId actorId createdAt details').sort({ createdAt: -1, _id: -1 }).lean() : [];
  const editors = await User.find({ ...scope, _id: { $in: changes.map(c => c.actorId) } }).select('name').lean();
  const editableServices = kind === 'treatments' && user.role === 'OWNER' ? await Service.find(scope).select('name active').sort({ name: 1 }).lean() : [];
  const editablePackageTemplates=kind==='treatments'&&user.role==='OWNER'
    ?saleablePackageTemplates(await PackageTemplate.find(scope).lean(),editableServices):[];
  const services = await Service.find({ ...scope, _id: { $in: rows.map(r => r.serviceId).filter(Boolean) } }).select('name').lean();
  const people = await User.find({ ...scope, _id: { $in: [...rows.map(r => r.staffId), customer.consultantId].filter(Boolean) } }).select('name').lean();
  const invoiceMatch = (Invoice.find(invoiceFilter) as any).cast(Invoice);
  const balances = await Invoice.aggregate([{ $match: {...invoiceMatch,status:{$ne:'CANCELLED'}} }, { $group: { _id: null, count: { $sum: 1 }, debt: { $sum: { $subtract: ['$total', '$paid'] } } } }]);
  const canSeeCredit = user.role === 'OWNER' || user.cashier || !!balances[0]?.count;
  const credit = canSeeCredit ? await Deposit.aggregate([{ $match: (Deposit.find({ ...scope, customerId: id }) as any).cast(Deposit) }, { $group: { _id: null, balance: { $sum: '$balance' } } }]) : [];
  const appointments = await Appointment.countDocuments(appointmentsFilter);
  const activePackages = await Treatment.countDocuments({ $and: [treatmentFilter, availableTreatmentFilter()] });
  const lastVisit = await Appointment.findOne({ ...appointmentsFilter, status: 'COMPLETED' }).sort({ startAt: -1 }).select('startAt').lean();
  return { customer: { ...customer, consultantName: people.find(p => String(p._id) === String(customer.consultantId))?.name },
    canEditTreatments: user.role === 'OWNER', editableServices, editablePackageTemplates,
    rows: rows.map(r => ({ ...r, ...(kind === 'treatments' ? { recordedUseCount: recordedUseCounts.get(String(r._id)) || 0, adjustments: changes.filter(c => String(c.targetId) === String(r._id)).map(c => ({ _id: c._id, createdAt: c.createdAt, actorName: editors.find(p => String(p._id) === String(c.actorId))?.name || 'Chủ spa', reason: c.details?.reason, rightsImpact:c.details?.rightsImpact,
      before: Object.fromEntries(['name','templateId','serviceId','serviceName','totalSessions','durationMonths','startsOn','expiresOn','remaining','notes'].map(k => [k, c.details?.before?.[k]])),
      after: Object.fromEntries(['name','templateId','serviceId','serviceName','totalSessions','durationMonths','startsOn','expiresOn','remaining','notes'].map(k => [k, c.details?.after?.[k]])) })) } : {}), serviceName: appointmentServiceName(r, services.find(s => String(s._id) === String(r.serviceId))?.name || '-'),
      staffName: people.find(p => String(p._id) === String(r.staffId))?.name })), kind, total, page,
    summary: { invoices: balances[0]?.count || 0, debt: balances[0]?.debt || 0, credit: canSeeCredit ? credit[0]?.balance || 0 : null, appointments, activePackages, lastVisit: lastVisit?.startAt || null } };
}
