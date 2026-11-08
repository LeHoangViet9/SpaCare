import { readTreatmentSignature } from './treatment-signature';
import { Commission, InvoiceAdjustment, SaleCommission, SharedSaleCommission, StockMovement } from './models';
import { readInvoiceHandling } from './invoice-handling-read';
import { CashEntry, Payment } from './models';
import { CashCard } from './models';
import { Appointment, Audit, Customer, Invoice, InvoiceLineCommission, Treatment, TreatmentUse, User } from './models';
import { ensure, spaDay } from './rules';
import type { Actor } from './auth';
import {invoiceContentContext} from './invoice-content';

export async function invoiceScope(user: Actor) {
  const scope = { spaId: user.spaId };
  if (user.role === 'OWNER') return scope;
  const today = spaDay();
  const shiftStart = new Date(`${today}T00:00:00+07:00`);
  const shiftEnd = new Date(shiftStart.getTime() + 86_400_000);
  const visits = await Appointment.find({ ...scope, staffId: user.id, status: { $in: ['CONFIRMED', 'COMPLETED'] } }).select('_id treatmentId treatmentIds').lean();
  const packages = await Treatment.find({ ...scope, _id: { $in: visits.flatMap(v => v.treatmentIds?.length ? v.treatmentIds : [v.treatmentId]).filter(Boolean) } }).select('invoiceId').lean();
  const uses = await TreatmentUse.find({ ...scope, $or: [{ actorId: user.id }, { staffId: user.id }] }).select('_id').lean();
  const permitted = { ...scope, $or: [{ appointmentId: { $in: visits.map(v => v._id) } }, { _id: { $in: packages.map(p => p.invoiceId) } }, { treatmentUseId: { $in: uses.map(u => u._id) } }] };
  if (user.cashier) {
    const collected = await Payment.find({ ...scope, createdAt: { $gte: shiftStart, $lt: shiftEnd }, reversed: false }).select('invoiceId').lean();
    return { ...scope, $or: [{ status: { $ne: 'CANCELLED' }, $expr: { $gt: ['$total', '$paid'] } }, { createdAt: { $gte: shiftStart, $lt: shiftEnd } }, { _id: { $in: collected.map(p => p.invoiceId) } }, ...permitted.$or] };
  }
  return permitted;
}

export async function readInvoice(user: Actor, id: string, requestedSignaturePage = 1,includeEditContext=false) {
  ensure(/^[a-f\d]{24}$/i.test(id), 'ID không hợp lệ.');
  const scope = { spaId: user.spaId };
  const invoice = await Invoice.findOne({ ...await invoiceScope(user), _id: id }).lean();
  ensure(invoice, 'Không tìm thấy hóa đơn trong phạm vi được phép.', 404);
  const customer = await Customer.findOne({ ...scope, _id: invoice.customerId }).select('name phone').lean();
  const gifts = await Invoice.find({ ...scope, giftOfInvoiceId: invoice._id, customerId: invoice.customerId }).select('description promotion total').lean();
  const giftCards = await CashCard.find({ ...scope, sourceInvoiceId: invoice._id }).select('amount balance origin').lean();
  const use = invoice.treatmentUseId ? await TreatmentUse.findOne({ ...scope, _id: invoice.treatmentUseId }).select('+signature').lean() : null;
  // Signature access remains as strict as the existing treatment-use endpoint.
  const canSeeSignature = !!use && (user.role === 'OWNER' || String(use.actorId) === user.id || String(use.staffId) === user.id);
  const packages = await Treatment.find({ ...scope, customerId: invoice.customerId, invoiceId: { $in: [invoice._id, ...gifts.map(g => g._id)] } }).select('openingBalance openingRemaining name invoiceId packageType totalSessions remaining durationMonths startsOn expiresOn usedSessions status').lean();
  const performer = invoice.performedBy ? await User.findOne({ ...scope, _id: invoice.performedBy }).select('name').lean() : null;
  // Resolve only explicit line assignments; invoice-level staff is not a fallback.
  const performerIds = [...new Set([...(invoice.serviceItems || []), ...(invoice.treatmentSessions || [])].map((item: { performerId?: unknown }) => item.performerId).filter(Boolean))];
  const linePerformers = performerIds.length ? await User.find({ ...scope, _id: { $in: performerIds } }).select('name').lean() : [];
  const withPerformerNames = (items: Record<string, any>[] | undefined) => items?.map(item => ({ ...item,
    performerName: linePerformers.find(person => String(person._id) === String(item.performerId))?.name || null,
  }));
  const serviceItems = withPerformerNames(invoice.serviceItems);
  const treatmentSessions = withPerformerNames(invoice.treatmentSessions);
  const recordedPayments = await Payment.find({ ...scope, invoiceId: invoice._id, reversed: false }).select('amount receiptId createdAt').sort({ createdAt: 1, _id: 1 }).lean();
  const receipts = recordedPayments.length ? await CashEntry.find({ ...scope, _id: { $in: recordedPayments.map(payment => payment.receiptId) }, kind: 'PAYMENT', direction: 'IN', reversed: false }).select('method day amount').lean() : [];
  const payments = recordedPayments.map(payment => ({ _id: payment._id, amount: payment.amount,
    receiptId:payment.receiptId,day:receipts.find(receipt=>String(receipt._id)===String(payment.receiptId))?.day||null,
    method: receipts.find(receipt => String(receipt._id) === String(payment.receiptId))?.method || null,
  }));
  const signatureFilter = { ...scope, $and: [
    { $or: [
      {checkoutInvoiceId:invoice._id},
      ...(invoice.treatmentUseId ? [{ _id: invoice.treatmentUseId }] : []),
      ...(invoice.appointmentId ? [{ appointmentId: invoice.appointmentId }] : []),
      { treatmentId: { $in: packages.map(p => p._id) } },
    ] },
    ...(user.role === 'OWNER' ? [] : [{ $or: [{ actorId: user.id }, { staffId: user.id }] }]),
    ...(invoice.treatmentUseId ? [{confirmationUseId:{$exists:false}}] : []),
  ] };
  const signatureTotal = await TreatmentUse.countDocuments(signatureFilter);
  const signaturePage = Math.min(requestedSignaturePage, Math.max(1, Math.ceil(signatureTotal / 5)));
  const signatures = await TreatmentUse.find(signatureFilter).select('+signature').sort({ performedAt: -1, _id: -1 }).skip((signaturePage - 1) * 5).limit(5).lean();
  const events = await Audit.find({ ...scope, $or: [{ targetId: invoice._id }, { 'details.invoiceId': id }, ...(use ? [{ targetId: use._id }, { 'details.treatmentUseId': String(use._id) }] : [])] }).sort({ createdAt: -1 }).select('action actorId createdAt details.amount details.reason details.note').lean();
  const handling = user.role === 'OWNER' ? await readInvoiceHandling(user.spaId,invoice,gifts,packages) : undefined;
  if(handling && invoice.status!=='CANCELLED' && !invoice.openingBalance){
    handling.edit='';handling.void='';
    if(invoice.financialRevision){handling.replace='Hóa đơn đã điều chỉnh tài chính; không thay tư vấn bằng luồng cũ.';handling.date='Hóa đơn đã điều chỉnh tài chính; giữ ngày gốc của chứng từ.';handling.cancel='Dùng Vô hiệu hóa có đối soát cho hóa đơn đã điều chỉnh.';}
  }
  const packageSaleLedger=user.role==='OWNER'&&(
    !!await SaleCommission.exists({...scope,invoiceId:invoice._id,cancelledAt:{$exists:false}})||
    !!await SharedSaleCommission.exists({...scope,invoiceId:invoice._id,cancelledAt:{$exists:false}})
  );
  const canCorrectPerformedServices=user.role==='OWNER'&&invoice.status!=='CANCELLED'&&(!invoice.kind||invoice.kind==='SERVICE')
    &&!!(invoice.performedAt||await InvoiceLineCommission.exists({...scope,invoiceId:invoice._id,cancelledAt:{$exists:false}})||await Commission.exists({...scope,invoiceId:invoice._id,cancelledAt:{$exists:false},category:{$ne:'PACKAGE_SALE'}}));
  const adjustmentContext=user.role==='OWNER'?{
    stock:!!(invoice.productId||invoice.productItems?.length||await StockMovement.exists({...scope,$or:[{invoiceId:invoice._id},{checkoutInvoiceId:invoice._id}],direction:'OUT'})),
    packages:!!(invoice.packageItems?.length||packages.some(p=>String(p.invoiceId)===String(invoice._id))||packageSaleLedger),
    gifts:!!(gifts.length||giftCards.length),
  }:undefined;
  const editContext=includeEditContext&&user.role==='OWNER'?await invoiceContentContext(user.spaId,invoice):undefined;
  const adjustments=invoice.financialRevision||invoice.lastAdjustmentId ? await InvoiceAdjustment.find({...scope,invoiceId:invoice._id}).select('mode actorId reason createdAt before after delta receiptId reconciliation.receiptChanges reconciliation.createdReceiptReversals reconciliation.changedFields reconciliation.content.serviceCorrections reconciliation.content.before reconciliation.content.after reconciliation.content.displayBefore reconciliation.content.displayAfter reconciliation.content.stockChanges reconciliation.content.planChanges').sort({createdAt:1,_id:1}).lean() : [];
  const adjustmentPeople=adjustments.length?await User.find({...scope,_id:{$in:adjustments.map(a=>a.actorId)}}).select('name').lean():[];
  return { editContext,adjustmentContext,canAdjustInvoice:user.role==='OWNER',canCorrectPerformedServices,adjustments:adjustments.map(a=>({...a,actorName:adjustmentPeople.find(p=>String(p._id)===String(a.actorId))?.name||'Chủ spa'})), handling, payments, giftCards, treatments:packages.filter(p=>String(p.invoiceId)===String(invoice._id)), treatment: packages.find(p=>String(p.invoiceId)===String(invoice._id)) || null, invoice: { ...invoice, serviceItems, treatmentSessions, performerName: performer?.name }, customer, gifts, signature: canSeeSignature ? use?.signature || null : null,
    canCompleteService: !!(invoice.status !== 'CANCELLED' && (user.role === 'OWNER' || user.cashier) && !invoice.performedAt && !invoice.appointmentId && !invoice.treatmentUseId&&!invoice.treatmentSessions?.length&&(invoice.serviceId||invoice.serviceItems?.length) && (!invoice.kind || invoice.kind === 'SERVICE') && packages.every(p=>p.status==='CANCELLED'&&(p.packageType==='TIME'?p.usedSessions===0:Number.isSafeInteger(p.totalSessions)&&Number.isSafeInteger(p.remaining)&&p.totalSessions===p.remaining&&!p.usedSessions))),
    signatures: await Promise.all(signatures.map(async s => ({ id: s._id, signature: await readTreatmentSignature(user,s), sessionNumber: s.sessionNumber,
      packageName: invoice.treatmentSessions?.find((item: {treatmentUseId:unknown;name?:string})=>String(item.treatmentUseId)===String(s._id))?.name || packages.find(p => String(p._id) === String(s.treatmentId))?.name,
      performedAt: s.performedAt }))), signaturePage, signatureTotal,
    session: use ? { sessionNumber: use.sessionNumber, performedAt: use.performedAt, staffId: use.staffId } : null,
    events: user.role === 'OWNER' ? events : events.filter(e => String(e.actorId) === user.id) };
}
