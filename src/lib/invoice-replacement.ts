import mongoose, { type ClientSession } from 'mongoose';
import { Allocation, Audit, CashCardUse, CashEntry, Commission, Control, Customer, Day, Invoice,
  InvoiceLineCommission, Payment, Payroll, SaleCommission, SharedSaleCommission, Service, Treatment, TreatmentUse, User } from './models';
import { hasSettledCommissionLedgers } from './commission-settlement';
import { replacementParticipants } from './invoice-replacement-rules';
import { invoiceCode, sequenceInvoiceCode } from './invoice-code';
import { ensure, spaDay } from './rules';
import type { Actor } from './auth';

export type ReplacementInput = { id:string; expectedUpdatedAt:string; expectedDocumentId:string; oldStaffId:string; newStaffId:string; reason?:string };
const snapshot = (invoice:any) => {
  const {documentHistory, ...value} = invoice.toObject();
  return value;
};

// Called only inside operate's active-user / OWNER / Control transaction.
export async function replacePackageAdvisor(actor:Actor, d:ReplacementInput, session:ClientSession, commit:boolean) {
  ensure(actor.role==='OWNER','Chỉ chủ spa được thay thế chứng từ.',403);
  const scope={spaId:actor.spaId};
  const invoice=await Invoice.findOne({...scope,_id:d.id}).session(session);
  ensure(invoice,'Không tìm thấy hóa đơn trong spa này.',404);
  ensure(!invoice.financialRevision,'Hóa đơn đã điều chỉnh tài chính: không thay tư vấn bằng luồng cũ.',409);
  ensure(invoice.updatedAt.toISOString()===d.expectedUpdatedAt && String(invoice.activeDocumentId || invoice._id)===d.expectedDocumentId,
    'Chứng từ đã thay đổi hoặc đã hết hiệu lực. Tải lại trước khi thay thế.',409);
  ensure(await Customer.exists({...scope,_id:invoice.customerId}).session(session),'Khách không thuộc spa.',409);
  const person=await User.findOne({...scope,_id:d.newStaffId,active:true,role:{$in:['OWNER','STAFF']}}).session(session);
  ensure(person,'Người tư vấn mới không hoạt động trong spa.',404);
  let plan;
  try { plan=replacementParticipants(invoice,d.oldStaffId,{staffId:person._id,staffName:person.name}); }
  catch(error) { ensure(false,(error as Error).message,409); }
  const p=plan!;
  ensure(!invoice.cardPaid && !invoice.productItems?.length && !invoice.serviceItems?.length && !invoice.treatmentSessions?.length &&
    !invoice.treatmentUseId && !invoice.appointmentId && !invoice.performedAt,'Hóa đơn hỗn hợp hoặc có liên kết thực hiện cần đối soát riêng.',409);
  for(const participant of p.before) ensure(await User.exists({...scope,_id:participant.staffId}).session(session),'Người tư vấn gốc không thuộc spa.',409);
  const treatments=await Treatment.find({...scope,invoiceId:invoice._id}).session(session);
  ensure(treatments.length>0 && treatments.every(t=>String(t.customerId)===String(invoice.customerId)),'Liên kết gói không hợp lệ.',409);
  // Mixed/legacy per-line sellers need their own allocation policy, never guess.
  ensure((invoice.packageItems || []).every((line:any)=>!line.sellerId || String(line.sellerId)===String(invoice.sellerId)),
    'Các dòng gói có người bán khác nhau cần quy tắc phân bổ riêng.',409);
  ensure((invoice.packageItems || []).every((line:any)=>treatments.some(t=>String(t._id)===String(line.treatmentId))), 'Dòng gói không thuộc hóa đơn.',409);
  for(const serviceId of new Set([invoice.serviceId,...treatments.map(t=>t.serviceId),...(invoice.packageItems || []).map((l:any)=>l.serviceId)].filter(Boolean).map(String)))
    ensure(await Service.exists({...scope,_id:serviceId}).session(session),'Dịch vụ không thuộc spa.',409);
  const payments=await Payment.find({...scope,invoiceId:invoice._id}).session(session);
  ensure(payments.length===1 && !payments[0].reversed && payments[0].amount===invoice.total,
    'Phiên bản này chỉ hỗ trợ một khoản thu trực tiếp đầy đủ, chưa đảo.',409);
  ensure(!await Allocation.exists({...scope,invoiceId:invoice._id}).session(session) &&
    !await CashCardUse.exists({...scope,invoiceId:invoice._id}).session(session), 'Phân bổ cọc/thẻ cần quy tắc thay thế riêng.',409);
  const payment=payments[0];
  const receipt=await CashEntry.findOne({...scope,_id:payment.receiptId,customerId:invoice.customerId,kind:'PAYMENT',direction:'IN',reversed:{$ne:true}}).session(session);
  ensure(receipt && receipt.amount===payment.amount && ['CASH','BANK_TRANSFER'].includes(receipt.method),'Khoản thu không còn nguyên trạng.',409);
  ensure(!await CashEntry.exists({...scope,originalId:receipt._id}).session(session) &&
    !await Payment.exists({...scope,receiptId:receipt._id,_id:{$ne:payment._id}}).session(session), 'Khoản thu đã đảo hoặc dùng chung.',409);
  const filter={...scope,invoiceId:invoice._id};
  const rows={commission:await Commission.find(filter).session(session),invoiceLineCommission:await InvoiceLineCommission.find(filter).session(session),
    saleCommission:await SaleCommission.find(filter).session(session),sharedSaleCommission:await SharedSaleCommission.find(filter).session(session)};
  ensure(!await hasSettledCommissionLedgers(scope,rows,session),'Hoa hồng đã thuộc payroll duyệt/đã chi, kể cả snapshot legacy; chưa hỗ trợ adjustment.',409);
  const ledgerIdsInHistory=Object.values(rows).flat().map(row=>row._id);
  if(ledgerIdsInHistory.length) ensure(!await Payroll.exists({...scope,status:{$in:['APPROVED','PAID']},$or:
    ['commissionIds','invoiceLineCommissionIds','saleCommissionIds','sharedSaleCommissionIds'].map(field=>({[field]:{$in:ledgerIdsInHistory}}))}).session(session),
    'Hoa hồng đã được payroll legacy tham chiếu; chưa hỗ trợ adjustment.',409);
  ensure(!rows.commission.length && !rows.invoiceLineCommission.length,'Giao dịch có ledger khác cần đối soát riêng.',409);
  const model=invoice.saleCommissionVersion===2 ? SharedSaleCommission : SaleCommission;
  const all=[...rows.saleCommission,...rows.sharedSaleCommission];
  ensure(invoice.saleCommissionVersion===2 ? !rows.saleCommission.length : !rows.sharedSaleCommission.length,'Ledger không khớp phiên bản quy tắc gốc.',409);
  const active=all.filter(row=>!row.cancelledAt && (invoice.activeDocumentId
    ? row.sourceType==='REPLACEMENT' && String(row.sourceId)===String(invoice.activeDocumentId)
    : row.sourceType==='PAYMENT' && String(row.sourceId)===String(payment._id)));
  // PAYMENT.sourceId is the original transaction identity. Replacement rows
  // keep that identity explicitly; dates must never be used to infer grouping.
  ensure(active.every(row=>invoice.activeDocumentId ? String(row.paymentId)===String(payment._id)
    : !row.paymentId || String(row.paymentId)===String(payment._id)), 'Ledger không liên kết đúng khoản thu gốc.',409);
  ensure(active.length===p.beforeShares.filter(s=>s.amount!==0).length && p.beforeShares.every(share=>
    active.filter(row=>String(row.staffId)===share.staffId).reduce((n,row)=>n+row.amount,0)===share.amount), 'Ledger không khớp phân bổ gốc.',409);
  ensure(all.reduce((n,row)=>n+(row.cancelledAt?0:row.amount),0)===p.pool,'Tổng ledger không khớp hoa hồng tích lũy.',409);
  ensure(invoice.activeDocumentId || all.length===active.length,'Giao dịch có điều chỉnh lịch sử cần đối soát riêng.',409);
  ensure(active.every(row=>row.earnedAt instanceof Date && Number.isFinite(row.earnedAt.getTime())), 'Ledger thiếu ngày hưởng hoa hồng gốc.',409);
  const earnedByStaff=new Map<string,Date>(active.map(row=>[String(row.staffId),row.earnedAt]));
  const earnedAt=earnedByStaff.get(d.oldStaffId) || payment.createdAt;
  const grants=p.afterShares.filter(s=>s.amount!==0).map(share=>({...share,
    earnedAt:earnedByStaff.get(share.staffId) || earnedAt}));
  const changes=[...active.map(row=>({staffId:String(row.staffId),earnedAt:row.earnedAt as Date})),...grants];
  const periods=Array.from(new Map(changes.map(change=>{
    const period={staffId:change.staffId,month:spaDay(change.earnedAt).slice(0,7)};
    return [period.staffId+':'+period.month,period];
  })).values());
  const days=new Set([spaDay(invoice.createdAt),...changes.map(change=>spaDay(change.earnedAt)),spaDay()]);
  for(const day of days) ensure(!await Day.exists({...scope,day,status:'CLOSED'}).session(session),'Ngày '+day+' đã chốt. Cần mở lại trước khi thay thế.',409);
  ensure(!periods.length || !await Payroll.exists({...scope,$or:periods,status:{$in:['APPROVED','PAID']}}).session(session),
    'Kỳ lương người tư vấn đã chốt; chưa hỗ trợ điều chỉnh kỳ đã chốt.',409);
  const uses=await TreatmentUse.find({...scope,treatmentId:{$in:treatments.map(t=>t._id)}}).select('_id checkoutInvoiceId appointmentId').session(session).lean();
  const preview={id:String(invoice._id),invoiceId:String(invoice._id),expectedUpdatedAt:d.expectedUpdatedAt,expectedDocumentId:d.expectedDocumentId,
    currentCode:invoiceCode(invoice),...p,payment:{id:String(payment._id),receiptId:String(receipt._id),amount:payment.amount,method:receipt.method},
    treatmentIds:treatments.map(t=>String(t._id)),treatments:treatments.map(t=>({id:String(t._id),name:t.name})),uses,
    unchanged:['Khách, giá, ngày bán, khoản thu và bằng chứng','Gói, buổi thật, SESSION, chữ ký và lịch hẹn'],earnedAt};
  if(!commit) return preview;
  ensure(d.reason?.trim(),'Nhập lý do thay thế.');
  const before=snapshot(invoice), documentId=new mongoose.Types.ObjectId();
  const counter=await Control.findOneAndUpdate(scope,{$inc:{invoiceSequence:1}},{session,returnDocument:'after'});
  ensure(counter,'Spa chưa sẵn sàng cấp mã chứng từ.',503);
  const code=sequenceInvoiceCode(counter.invoiceSequence);
  ensure(!await Invoice.exists({...scope,$or:[{code},{effectiveCode:code},{'documentHistory.code':code}]}).session(session),'Mã chứng từ đã tồn tại. Cần đối soát bộ đếm.',409);
  const ledgerBefore=all.map(row=>row.toObject()), ledgerIds=[];
  for(const row of active) {
    const ledger=(await model.create([{...scope,staffId:row.staffId,staffName:row.staffName,invoiceId:invoice._id,serviceId:row.serviceId,
      serviceName:row.serviceName,customerId:invoice.customerId,sourceType:'REPLACEMENT_REVERSAL',sourceId:row._id,paymentId:payment._id,amount:-row.amount,earnedAt:row.earnedAt,
      ...(invoice.saleCommissionVersion===2 ? {shareCount:p.before.length} : {})}],{session}))[0];
    ledgerIds.push(ledger._id);
  }
  for(const share of grants) {
    const ledger=(await model.create([{...scope,staffId:share.staffId,staffName:p.after.find(s=>s.staffId===share.staffId)!.staffName,
      invoiceId:invoice._id,serviceId:invoice.serviceId || invoice.packageItems?.[0]?.serviceId,serviceName:invoice.description,customerId:invoice.customerId,
      sourceType:'REPLACEMENT',sourceId:documentId,paymentId:payment._id,amount:share.amount,earnedAt:share.earnedAt,...(invoice.saleCommissionVersion===2 ? {shareCount:p.after.length} : {})}],{session}))[0];
    ledgerIds.push(ledger._id);
  }
  invoice.documentHistory=[...(invoice.documentHistory || []),{documentId:invoice.activeDocumentId || invoice._id,
    ...(invoice.effectiveCode || invoice.code ? {code:invoice.effectiveCode || invoice.code} : {legacyInvoiceId:invoice._id}),status:'REPLACED',
    replacedById:documentId,replacedByCode:code,replacedAt:new Date(),actorId:actor.id,reason:d.reason,snapshot:before}];
  invoice.activeDocumentId=documentId;invoice.effectiveCode=code;
  invoice.saleParticipants=p.after;invoice.sellerId=p.after[0].staffId;invoice.sellerName=p.after[0].staffName;
  for(const line of invoice.packageItems || []) if(line.sellerId && String(line.sellerId)===d.oldStaffId) {line.sellerId=person._id;line.sellerName=person.name;}
  // Preserve createdAt/recordedAt/createdBy/consultantId and every operational reference.
  await invoice.save({session});
  const draftChanges=periods.length ? await Payroll.updateMany({...scope,status:'DRAFT',$or:periods},
    {$set:{needsRecalculation:true}},{session}) : {modifiedCount:0};
  const ledgerAfter=await model.find({...scope,invoiceId:invoice._id}).session(session).lean();
  await Audit.create([{...scope,actorId:actor.id,action:'replacePackageAdvisor',targetId:invoice._id,details:{reason:d.reason,before,after:snapshot(invoice),
    previousDocumentId:d.expectedDocumentId,documentId,ledgerBefore,ledgerAfter,ledgerIds,paymentId:payment._id,receiptId:receipt._id,
    treatmentIds:preview.treatmentIds,affectedPayrollPeriods:periods,draftsMarked:draftChanges.modifiedCount}}],{session});
  return {id:String(invoice._id),invoiceId:String(invoice._id),documentId:String(documentId),code,message:'Đã thay thế chứng từ và điều chỉnh hoa hồng. Giữ nguyên khoản thu và buổi thật.'};
}
