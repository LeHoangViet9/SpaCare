import { availableTreatmentFilter } from './treatment-rules';
import mongoose from 'mongoose';
import { readReport } from './report-read';
import { Customer, Service, Product, ProductGroup, PackageTemplate, User, Appointment, Invoice, Deposit, Allocation, CashEntry, Treatment, TreatmentUse, Day, Audit } from './models';
import { invoiceScope } from './invoice-read';
import { canViewPage } from './navigation';
import { ensure, spaDay, invoiceState } from './rules';
import { auditActions } from './audit-view';
import { sectionCollection, literalPattern, workspaceQuery } from './workspace-query';
import { listFilter } from './workspace-filters';
import type { Actor } from './auth';

type Row = Record<string, any>;
export async function readWorkspace(user: Actor, query: ReturnType<typeof workspaceQuery>) {
  ensure(canViewPage(query.section, user), 'Bạn không có quyền mở mục này.', 403);
  const scope = { spaId: user.spaId };
  const finance = user.role === 'OWNER' || user.cashier;
  const today = spaDay();
  const todayDay = finance ? await Day.findOne({ ...scope, day: today }).lean() : null;
  const assignedQuery = user.role === 'OWNER' ? scope : await invoiceScope({ ...user, role: 'STAFF', cashier: false });
  const assignedBills = user.role === 'OWNER' ? [] : await Invoice.find(assignedQuery).select('_id customerId').lean();
  const assignableIds = new Set(assignedBills.map(i => String(i._id)));
  const filters: Record<string, Row> = {
    packageTemplates: scope,
    customers: scope, services: scope, staff: { ...scope, role: { $in: ['OWNER', 'STAFF'] } }, treatments: scope, uses: scope,
    appointments: { ...scope, ...(finance ? {} : { staffId: user.id }) },
    invoices: finance ? scope : assignedQuery,
    deposits: finance ? scope : { ...scope, customerId: { $in: assignedBills.map(i => i.customerId) } },
    allocations: finance ? scope : { ...scope, invoiceId: { $in: assignedBills.map(i => i._id) } },
    cash: { ...scope, ...(finance ? {} : { actorId: user.id }) },
    days: finance ? scope : { ...scope, _id: { $in: [] } },
    audit: user.role === 'OWNER' ? scope : { ...scope, _id: { $in: [] } },
  };
  const models: Record<string, any> = { packageTemplates: PackageTemplate, customers: Customer, services: Service, staff: User, appointments: Appointment, invoices: Invoice, deposits: Deposit, allocations: Allocation, cash: CashEntry, treatments: Treatment, uses: TreatmentUse, days: Day, audit: Audit };
  const fields: Record<string, string> = { staff: user.role === 'OWNER' ? 'name email phone role cashier active' : 'name role cashier active', uses: '-snapshot -digest -signatureDigest -evidenceReference' };
  const search = query.search;
  const expression = { $regex: literalPattern(search), $options: 'i' };
  const customerIds = search ? await Customer.find({ ...scope, $or: [{ name: expression }, { phone: expression }, { notes: expression }] }).distinct('_id') : [];
  const staffIds = search ? await User.find({ ...scope, name: expression }).distinct('_id') : [];
  const serviceIds = search ? await Service.find({ ...scope, name: expression }).distinct('_id') : [];
  const treatmentIds = search ? await Treatment.find({ ...scope, $or: [{ name: expression }, { customerId: { $in: customerIds } }] }).distinct('_id') : [];
  function searchFilter(collection: string) {
      if (collection === 'days') return {};
    if (!search) return {};
    const textFields: Record<string, string[]> = {
      packageTemplates: ['name'],
      customers: ['name', 'phone', 'notes'], services: ['name'], staff: ['name', ...(user.role === 'OWNER' ? ['email', 'phone'] : [])],
      appointments: ['notes', 'changeReason', 'status'], invoices: ['description', 'status', 'dueDate'], deposits: ['note'],
      allocations: ['reason'], cash: ['note', 'transferReference', 'kind', 'method', 'day'], treatments: ['name', 'status'],
      uses: ['reason', 'method'], days: ['day', 'status', 'note'], audit: ['action', 'targetId', 'details.reason', 'details.note', 'details.name', 'details.description', 'details.before.name', 'details.after.name'],
    };
    const clauses: Row[] = (textFields[collection] || []).filter(key => key !== 'targetId').map(key => ({ [key]: expression }));
    const numericFields: Record<string, string[]> = { services: ['price', 'duration'], invoices: ['total', 'paid'], deposits: ['amount', 'balance'], allocations: ['amount'], cash: ['amount'], treatments: ['remaining', 'totalSessions'], days: ['opening', 'expected', 'counted', 'difference'] };
    if (/^-?\d+$/.test(search) && Number.isSafeInteger(Number(search))) clauses.push(...(numericFields[collection] || []).map(key => ({ [key]: Number(search) })));
    if (/^[a-f\d]{6,23}$/i.test(search)) clauses.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: literalPattern(search), options: 'i' } } });
    if (/^[a-f\d]{24}$/i.test(search)) clauses.push({ _id: search }, ...(collection === 'audit' ? [{ targetId: search }] : []));
    if (['appointments', 'invoices', 'deposits', 'treatments', 'cash'].includes(collection)) clauses.push({ customerId: { $in: customerIds } });
    if (collection === 'appointments') clauses.push({ staffId: { $in: staffIds } }, { serviceId: { $in: serviceIds } });
    if (collection === 'uses') clauses.push({ treatmentId: { $in: treatmentIds } }, { actorId: { $in: staffIds } });
    if (collection === 'uses') {
      const methods: Record<string, string> = { DRAWN_SIGNATURE: 'Khách ký trên màn hình', SIGNATURE_REFERENCE: 'Tham chiếu phiếu ký', ALTERNATIVE: 'Xác nhận thay thế' };
      clauses.push({ method: { $in: Object.keys(methods).filter(k => methods[k].toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) } });
    }
    if (collection === 'allocations' && /^[a-f\d]{24}$/i.test(search)) clauses.push({ depositId: search }, { invoiceId: search });
    if (collection === 'audit') clauses.push({ actorId: { $in: staffIds } }, { 'details.customerId': { $in: customerIds } }, { 'details.before.customerId': { $in: customerIds } }, { 'details.after.customerId': { $in: customerIds } }, { action: { $in: Object.keys(auditActions).filter(k => auditActions[k].toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) } });
    return { $or: clauses };
  }
  async function page(collection: string, requestedPage = query.page) {
    const extra: Row = collection === 'audit' ? {
      ...(query.actor ? { actorId: query.actor } : {}), ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to ? { createdAt: { ...(query.from ? { $gte: new Date(query.from + 'T00:00:00+07:00') } : {}), ...(query.to ? { $lt: new Date(new Date(query.to + 'T00:00:00+07:00').getTime() + 86400_000) } : {}) } } : {}),
    } : {};
    if (collection === 'packageTemplates' && query.category) extra.serviceId = { $in: await Service.find({ ...scope, category: query.category }).distinct('_id') };
    const filter = { $and: [filters[collection], searchFilter(collection), listFilter(collection, query, today), extra] };
    const total = await models[collection].countDocuments(filter);
    const number = Math.min(requestedPage, Math.max(1, Math.ceil(total / query.pageSize)));
    const sort = collection === 'appointments' ? { startAt: query.order === 'asc' ? 1 : -1, _id: -1 } : { createdAt: -1, _id: -1 };
    const rows = await models[collection].find(filter).select(fields[collection] || '').sort(sort).skip((number - 1) * query.pageSize).limit(query.pageSize).lean();
    let summary;
    if (collection === 'cash') {
      const match = models.cash.find(filter).cast(models.cash);
      const result = await CashEntry.aggregate([{ $match: match }, { $group: { _id: null,
        incoming: { $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$amount', 0] } },
        outgoing: { $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$amount', 0] } },
      } }]);
      summary = { incoming: result[0]?.incoming || 0, outgoing: result[0]?.outgoing || 0 };
    }
    return { rows, total, page: number, pageSize: query.pageSize, summary };
  }
  const pages: Record<string, any> = {};
  const collection = sectionCollection[query.section];
  if (collection) pages[collection] = await page(collection);
  if (query.section === 'deposits') pages.allocations = await page('allocations', query.allocationPage);
  const listed = (key: string): Row[] => pages[key]?.rows || [];
  const auditIds = (key: string) => listed('audit').flatMap(a => [a.details?.[key], a.details?.before?.[key], a.details?.after?.[key]])
    .filter(id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id));
  // Catalogs and usable balances support form choices; history is loaded only by page.
  // Independent reads can share a network round trip; no transaction writes here.
  const [services, packageTemplates, productGroups, products, staff] = await Promise.all([
    Service.find(scope).lean(),
    PackageTemplate.find(scope).lean(),
    query.section === 'cashier' && finance ? ProductGroup.find(scope).select('name').lean() : [],
    query.section === 'cashier' && finance ? Product.find({ ...scope, active: true }).select('name sku unit groupId price stock active').lean() : [],
    User.find({ ...scope, role: { $in: ['OWNER', 'STAFF'] } }).select(fields.staff).lean(),
  ]);
  const appointments: Row[] = query.section === 'overview'
    ? await Appointment.find({ ...filters.appointments, status: 'CONFIRMED', endAt: { $gte: new Date() } }).sort({ startAt: 1, _id: 1 }).limit(6).lean()
    : listed('appointments');
  if (auditIds('appointmentId').length || auditIds('replacementAppointmentId').length) {
    const references = await Appointment.find({ ...filters.appointments, _id: { $in: [...auditIds('appointmentId'), ...auditIds('replacementAppointmentId')] } }).lean();
    appointments.push(...references.filter(a => !appointments.some(r => String(r._id) === String(a._id))));
  }
  if (appointments.length) {
    const related = await Appointment.find({ ...filters.appointments, $or: [{ rescheduledFromId: { $in: appointments.map(a => a._id) } }, { _id: { $in: appointments.map(a => a.rescheduledFromId).filter(Boolean) } }] }).lean();
    appointments.push(...related.filter(a => !appointments.some(r => String(r._id) === String(a._id))));
  }
  const invoiceChoices = await Invoice.find({ $and: [filters.invoices, { $or: [
    { $expr: { $gt: ['$total', '$paid'] } }, { _id: { $in: listed('invoices').map(i => i._id) } },
    { _id: { $in: auditIds('invoiceId') } },
    { appointmentId: { $in: appointments.map(a => a._id) } },
    { appointmentId: { $exists: false }, customerId: { $in: appointments.map(a => a.customerId) } },
  ] }] }).lean();
  const invoices = invoiceChoices.map(i => ({ ...i, status: invoiceState(i.total, i.paid), canAllocate: user.role === 'OWNER' || assignableIds.has(String(i._id)) }));
  const deposits = await Deposit.find({ $and: [filters.deposits, { $or: [{ balance: { $gt: 0 } }, { _id: { $in: [...listed('deposits').map(d => d._id), ...auditIds('depositId')] } }] }] }).lean();
  const treatments = await Treatment.find({ ...scope, $or: [
    availableTreatmentFilter(), { _id: { $in: listed('treatments').map(t => t._id) } },
    { _id: { $in: auditIds('treatmentId') } },
    { _id: { $in: [...appointments.map(a => a.treatmentId), ...listed('uses').map(u => u.treatmentId)].filter(Boolean) } },
    { invoiceId: { $in: invoices.map(i => i._id) } },
  ] }).lean();
  const packageInvoices = await Invoice.find({ ...scope, _id: { $in: treatments.map(t => t.invoiceId) } }).select('_id serviceId dueDate total paid').lean();
  const packages = treatments.map(t => { const bill = packageInvoices.find(i => String(i._id) === String(t.invoiceId)); return { ...t, serviceId: t.serviceId || bill?.serviceId, paymentDueDate: bill?.dueDate, paymentOverdue: !!bill?.dueDate && bill.dueDate < today && bill.paid < bill.total }; });
  const customerRefs = [...appointments, ...invoices, ...deposits, ...packages, ...listed('cash'), ...listed('uses')].map(r => r.customerId).filter(Boolean);
  const customers = await Customer.find({ ...scope, _id: { $in: [...customerRefs, ...listed('customers').map(c => c._id), ...auditIds('customerId'), ...(query.customer ? [query.customer] : [])] } }).lean();
  if (pages.invoices) pages.invoices.rows = listed('invoices').map(i => ({ ...i, status: invoiceState(i.total, i.paid), canAllocate: user.role === 'OWNER' || assignableIds.has(String(i._id)) }));
  if (pages.treatments) pages.treatments.rows = listed('treatments').map(t => packages.find(p => String(p._id) === String(t._id)) || t);
  const spaObjectId = new mongoose.Types.ObjectId(user.spaId);
  const aggregateScope = { spaId: spaObjectId };
  const [debt, credit, flow, bookings, treatmentStats, useCount] = await Promise.all([
    finance ? Invoice.aggregate([{ $match: aggregateScope }, { $group: { _id: null, total: { $sum: { $subtract: ['$total', '$paid'] } } } }]) : [],
    finance ? Deposit.aggregate([{ $match: aggregateScope }, { $group: { _id: null, total: { $sum: '$balance' } } }]) : [],
    finance ? CashEntry.aggregate([{ $match: { ...aggregateScope, day: today } }, { $group: { _id: '$direction', total: { $sum: '$amount' } } }]) : [],
    Appointment.countDocuments({ ...filters.appointments, startAt: { $gte: new Date(today + 'T00:00:00+07:00'), $lt: new Date(new Date(today + 'T00:00:00+07:00').getTime() + 86400_000) }, status: { $in: finance ? ['CONFIRMED', 'COMPLETED'] : ['CONFIRMED'] } }),
    Treatment.aggregate([{ $match: aggregateScope }, { $group: { _id: null, count: { $sum: 1 }, remaining: { $sum: '$remaining' }, active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } } } }]),
    TreatmentUse.countDocuments(scope),
  ]);
  let report: Row = { inflow: 0, outflow: 0, days: [] };
  if (query.section === 'reports') {
    report = await readReport(user, query);
  }
  const paymentInfo = finance || invoices.length ? { bankName: process.env.BANK_NAME || '', accountNumber: process.env.BANK_ACCOUNT_NUMBER || '', accountName: process.env.BANK_ACCOUNT_NAME || '', qrImagePath: /^\/[a-zA-Z0-9_./-]+$/.test(process.env.BANK_QR_IMAGE_PATH || '') && !(process.env.BANK_QR_IMAGE_PATH || '').includes('..') && !(process.env.BANK_QR_IMAGE_PATH || '').startsWith('//') ? process.env.BANK_QR_IMAGE_PATH : '' } : undefined;
  return { user, today, todayDay, pages, products, productGroups, packageTemplates, customers, services, staff, appointments, invoices, deposits, allocations: listed('allocations'), cash: listed('cash'), treatments: packages, uses: listed('uses'), days: listed('days'), audit: listed('audit'), paymentInfo, report,
    totals: { debt: debt[0]?.total || 0, credit: credit[0]?.total || 0, inflow: flow.find(f => f._id === 'IN')?.total || 0, outflow: flow.find(f => f._id === 'OUT')?.total || 0, bookings, treatments: treatmentStats[0]?.count || 0, remaining: treatmentStats[0]?.remaining || 0, activeTreatments: treatmentStats[0]?.active || 0, uses: useCount } };
}
