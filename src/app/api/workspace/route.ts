import { actor } from '@/lib/auth';
import { Customer, Service, User, Appointment, Invoice, Deposit, Allocation, CashEntry, Treatment, TreatmentUse, Day, Audit } from '@/lib/models';
import { failure } from '@/lib/http';
import { spaDay, invoiceState } from '@/lib/rules';
import mongoose from 'mongoose';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await actor(); const scope = { spaId: user.spaId };
    const finance = user.role === 'OWNER' || user.cashier;
    const recent = (model: any, fields = '') => model.find(scope).select(fields).sort({ createdAt: -1 }).limit(500).lean();
    const [customers, services, staff, appointments, initialInvoices, initialDeposits, initialAllocations, cash, treatments, uses, days, audit] = await Promise.all([
      recent(Customer), recent(Service), recent(User, user.role === 'OWNER' ? 'name email role cashier active' : 'name role cashier active'),
      Appointment.find({ ...scope, ...(finance ? {} : { staffId: user.id }) }).sort({ startAt: -1 }).limit(500).lean(),
      finance ? recent(Invoice) : [], finance ? recent(Deposit) : [], finance ? recent(Allocation) : [], finance ? recent(CashEntry) : CashEntry.find({ ...scope, actorId: user.id }).sort({ createdAt: -1 }).limit(500).lean(),
      recent(Treatment), recent(TreatmentUse, '-snapshot -digest -evidenceReference'), finance ? recent(Day) : [], user.role === 'OWNER' ? recent(Audit) : [],
    ]);
    // Use all assigned visits for access; the 500-row display limit must not grant/revoke access.
    const assignedVisits = await Appointment.find({ ...scope, staffId: user.id, status: { $in: ['CONFIRMED', 'COMPLETED'] } }).select('_id treatmentId').lean();
    const assignedPackages = await Treatment.find({ ...scope, _id: { $in: assignedVisits.map((a: any) => a.treatmentId).filter(Boolean) } }).select('invoiceId').lean();
    const assignedQuery = { ...scope, $or: [{ appointmentId: { $in: assignedVisits.map((a: any) => a._id) } }, { _id: { $in: assignedPackages.map((t: any) => t.invoiceId) } }] };
    const invoices = finance ? initialInvoices : await Invoice.find(assignedQuery).sort({ createdAt: -1 }).limit(500).lean();
    const assignableInvoices = user.role === 'OWNER' ? invoices : await Invoice.find(assignedQuery).select('_id').lean();
    const assignableIds = new Set(assignableInvoices.map((i: any) => String(i._id)));
    const deposits = finance ? initialDeposits : await Deposit.find({ ...scope, customerId: { $in: invoices.map((i: any) => i.customerId) } }).sort({ createdAt: -1 }).limit(500).lean();
    const allocations = finance ? initialAllocations : await Allocation.find({ ...scope, invoiceId: { $in: invoices.map((i: any) => i._id) } }).sort({ createdAt: -1 }).limit(500).lean();
    // Enrich legacy packages with service only; do not expose invoices to ordinary STAFF.
    const packageInvoices = await Invoice.find({ ...scope, _id: { $in: treatments.map((t: any) => t.invoiceId) } }).select('_id serviceId dueDate total paid').lean();
    const packages = treatments.map((t: any) => { const bill = packageInvoices.find((i: any) => String(i._id) === String(t.invoiceId)); return { ...t, serviceId: t.serviceId || bill?.serviceId, paymentDueDate: bill?.dueDate, paymentOverdue: !!bill?.dueDate && bill.dueDate < spaDay() && bill.paid < bill.total }; });
    const paymentInfo = (finance || invoices.length > 0) ? { bankName: process.env.BANK_NAME || '', accountNumber: process.env.BANK_ACCOUNT_NUMBER || '', accountName: process.env.BANK_ACCOUNT_NAME || '', qrImagePath: /^\/[a-zA-Z0-9_./-]+$/.test(process.env.BANK_QR_IMAGE_PATH || '') && !(process.env.BANK_QR_IMAGE_PATH || '').includes('..') && !(process.env.BANK_QR_IMAGE_PATH || '').startsWith('//') ? process.env.BANK_QR_IMAGE_PATH : '' } : undefined;
    const today = spaDay();
    const spaObjectId = new mongoose.Types.ObjectId(user.spaId);
    // Totals aggregate all matching records; tables show at most the latest 500.
    const [debt, credit, flow, bookingCount] = finance ? await Promise.all([
      Invoice.aggregate([{ $match: { spaId: spaObjectId } }, { $group: { _id: null, total: { $sum: { $subtract: ['$total', '$paid'] } } } }]),
      Deposit.aggregate([{ $match: { spaId: spaObjectId } }, { $group: { _id: null, total: { $sum: '$balance' } } }]),
      CashEntry.aggregate([{ $match: { spaId: spaObjectId, day: today } }, { $group: { _id: '$direction', total: { $sum: '$amount' } } }]),
      Appointment.countDocuments({ ...scope, startAt: { $gte: new Date(`${today}T00:00:00+07:00`), $lt: new Date(new Date(`${today}T00:00:00+07:00`).getTime() + 86400_000) }, status: { $in: ['CONFIRMED', 'COMPLETED'] } }),
    ]) : [[], [], [], 0];
    return Response.json({ user, today, customers, services, staff, appointments, invoices: invoices.map((i: any) => ({ ...i, status: invoiceState(i.total, i.paid), canAllocate: assignableIds.has(String(i._id)) })), deposits, allocations, cash, treatments: packages, uses, days, audit, paymentInfo,
      totals: { debt: debt[0]?.total || 0, credit: credit[0]?.total || 0, inflow: flow.find((f: any) => f._id === 'IN')?.total || 0, outflow: flow.find((f: any) => f._id === 'OUT')?.total || 0, bookings: bookingCount }, tableLimit: 500 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
