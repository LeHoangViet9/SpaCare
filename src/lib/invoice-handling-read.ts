import { Appointment, Allocation, CashCard, CashCardUse, CashEntry, Commission, Day, InvoiceLineCommission, Payment, Payroll, SaleCommission, SharedSaleCommission, TreatmentUse } from './models';
import { invoiceHandlingReasons } from './invoice-handling';
import { spaDay } from './rules';
type Row = Record<string, any>;

export async function readInvoiceHandling(spaId: string, invoice: Row, family: Row[], plans: Row[]) {
  const scope = {spaId}, ids = [invoice._id,...family.map(row=>row._id)], planIds = plans.map(row=>row._id);
  const linked = {...scope,invoiceId:{$in:ids}};
  const visitFilter = {...scope,$or:[{treatmentId:{$in:planIds}},{treatmentIds:{$in:planIds}}]};
  const [used,appointments,pendingAppointments,payments,allocations,cardUses,cards,commission,line,sale,shared,oldDay,today] = await Promise.all([
    TreatmentUse.exists({...scope,treatmentId:{$in:planIds}}), Appointment.exists(visitFilter),
    Appointment.exists({...visitFilter,status:{$in:['CONFIRMED','POSTPONED']}}),
    Payment.find(linked).select('invoiceId amount reversed receiptId').lean(), Allocation.exists(linked), CashCardUse.exists(linked),
    CashCard.find({...scope,sourceInvoiceId:{$in:ids}}).select('amount balance').lean(),
    Commission.find(linked).select('payrollId').lean(), InvoiceLineCommission.find(linked).select('payrollId').lean(),
    SaleCommission.find(linked).select('payrollId').lean(), SharedSaleCommission.find(linked).select('payrollId').lean(),
    Day.findOne({...scope,day:spaDay(invoice.createdAt)}).select('status').lean(),
    Day.findOne({...scope,day:spaDay()}).select('status').lean(),
  ]);
  const ledgers=[...commission,...line,...sale,...shared];
  const ledgerIds=ledgers.map(row=>row._id);
  const settled=ledgers.some(row=>row.payrollId) || !!(ledgerIds.length && await Payroll.exists({...scope,status:{$in:['APPROVED','PAID']},$or:['commissionIds','invoiceLineCommissionIds','saleCommissionIds','sharedSaleCommissionIds'].map(field=>({[field]:{$in:ledgerIds}}))}));
  const ownPayments=payments.filter(row=>String(row.invoiceId)===String(invoice._id));
  const payment=ownPayments.length===1 ? ownPayments[0] : null;
  const receipt=payment && !payment.reversed ? await CashEntry.findOne({...scope,_id:payment.receiptId,kind:'PAYMENT',direction:'IN',reversed:{$ne:true}}).select('amount').lean() : null;
  const usedGiftCard=cards.some(card=>card.balance!==card.amount) || !!(cards.length && await CashCardUse.exists({...scope,cardId:{$in:cards.map(card=>card._id)}}));
  return invoiceHandlingReasons(invoice,{
    used:!!used || plans.some(plan=>(plan.usedSessions || 0)>0 || (plan.packageType!=='TIME' && plan.totalSessions != null && plan.remaining<plan.totalSessions)),
    appointments:!!appointments,pendingAppointments:!!pendingAppointments,
    changedPlan:plans.some(plan=>plan.status!=='ACTIVE'),history:!!(payments.length||allocations||cardUses||sale.length||shared.length),
    giftCards:!!cards.length,usedGiftCard,settled,lineCommission:!!line.length,packageCommission:!!commission.length && invoice.kind==='PACKAGE',
    oldDayClosed:oldDay?.status==='CLOSED',todayClosed:today?.status==='CLOSED',receiptDayOpen:today?.status==='OPEN',
    directPayment:!!(payment && !payment.reversed && payment.amount===invoice.total && receipt?.amount===payment.amount && !allocations && !cardUses),
    hasActivePayment:payments.some(row=>!row.reversed),
  },true);
}
