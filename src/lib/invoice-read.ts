import { CashCard } from './models';
import { Appointment, Audit, Customer, Invoice, Treatment, TreatmentUse, User } from './models';
import { ensure } from './rules';
import type { Actor } from './auth';

export async function invoiceScope(user: Actor) {
  const scope = { spaId: user.spaId };
  if (user.role === 'OWNER' || user.cashier) return scope;
  const visits = await Appointment.find({ ...scope, staffId: user.id, status: { $in: ['CONFIRMED', 'COMPLETED'] } }).select('_id treatmentId').lean();
  const packages = await Treatment.find({ ...scope, _id: { $in: visits.map(v => v.treatmentId).filter(Boolean) } }).select('invoiceId').lean();
  const uses = await TreatmentUse.find({ ...scope, $or: [{ actorId: user.id }, { staffId: user.id }] }).select('_id').lean();
  return { ...scope, $or: [{ appointmentId: { $in: visits.map(v => v._id) } }, { _id: { $in: packages.map(p => p.invoiceId) } }, { treatmentUseId: { $in: uses.map(u => u._id) } }] };
}

export async function readInvoice(user: Actor, id: string, requestedSignaturePage = 1) {
  ensure(/^[a-f\d]{24}$/i.test(id), 'ID không hợp lệ.');
  const scope = { spaId: user.spaId };
  const invoice = await Invoice.findOne({ ...await invoiceScope(user), _id: id }).lean();
  ensure(invoice, 'Không tìm thấy hóa đơn trong phạm vi được phép.', 404);
  const customer = await Customer.findOne({ ...scope, _id: invoice.customerId }).select('name phone').lean();
  const gifts = await Invoice.find({ ...scope, giftOfInvoiceId: invoice._id, customerId: invoice.customerId }).select('description promotion total').lean();
  const giftCards = invoice.giftCashCardAmount ? await CashCard.find({ ...scope, sourceInvoiceId: invoice._id }).select('amount balance origin').lean() : [];
  const use = invoice.treatmentUseId ? await TreatmentUse.findOne({ ...scope, _id: invoice.treatmentUseId }).select('+signature').lean() : null;
  // Signature access remains as strict as the existing treatment-use endpoint.
  const canSeeSignature = !!use && (user.role === 'OWNER' || String(use.actorId) === user.id || String(use.staffId) === user.id);
  const packages = await Treatment.find({ ...scope, customerId: invoice.customerId, invoiceId: { $in: [invoice._id, ...gifts.map(g => g._id)] } }).select('openingBalance openingRemaining name invoiceId packageType totalSessions remaining durationMonths startsOn expiresOn usedSessions status').lean();
  const performer = invoice.performedBy ? await User.findOne({ ...scope, _id: invoice.performedBy }).select('name').lean() : null;
  const signatureFilter = { ...scope, $and: [
    { $or: [
      ...(invoice.treatmentUseId ? [{ _id: invoice.treatmentUseId }] : []),
      ...(invoice.appointmentId ? [{ appointmentId: invoice.appointmentId }] : []),
      { treatmentId: { $in: packages.map(p => p._id) } },
    ] },
    ...(user.role === 'OWNER' ? [] : [{ $or: [{ actorId: user.id }, { staffId: user.id }] }]),
  ] };
  const signatureTotal = await TreatmentUse.countDocuments(signatureFilter);
  const signaturePage = Math.min(requestedSignaturePage, Math.max(1, Math.ceil(signatureTotal / 5)));
  const signatures = await TreatmentUse.find(signatureFilter).select('+signature').sort({ performedAt: -1, _id: -1 }).skip((signaturePage - 1) * 5).limit(5).lean();
  const events = await Audit.find({ ...scope, $or: [{ targetId: invoice._id }, { 'details.invoiceId': id }, ...(use ? [{ targetId: use._id }, { 'details.treatmentUseId': String(use._id) }] : [])] }).sort({ createdAt: -1 }).select('action actorId createdAt details.amount details.reason details.note').lean();
  return { giftCards, treatment: packages.find(p=>String(p.invoiceId)===String(invoice._id)) || null, invoice: { ...invoice, performerName: performer?.name }, customer, gifts, signature: canSeeSignature ? use?.signature || null : null,
    canCompleteService: !!((user.role === 'OWNER' || user.cashier) && !invoice.performedAt && !invoice.appointmentId && invoice.serviceId && (!invoice.kind || invoice.kind === 'SERVICE') && !packages.length),
    signatures: signatures.map(s => ({ id: s._id, signature: s.signature || null, sessionNumber: s.sessionNumber,
      packageName: packages.find(p => String(p._id) === String(s.treatmentId))?.name,
      performedAt: s.performedAt })), signaturePage, signatureTotal,
    session: use ? { sessionNumber: use.sessionNumber, performedAt: use.performedAt, staffId: use.staffId } : null,
    events: user.role === 'OWNER' ? events : events.filter(e => String(e.actorId) === user.id) };
}
