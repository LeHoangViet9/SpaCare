import type {ClientSession} from 'mongoose';
import type {Actor} from './auth';
import {CashEntry,Day,InvoiceAdjustment} from './models';
import {dayBounds,ensure,spaDay} from './rules';

// Caller has acquired Control and verified OWNER, invoice version and source balances.
export async function prepareMistakenReceipts(spaId:string,invoice:any,paymentIds:string[],payments:any[],receipts:any[],session:ClientSession){
  const rows=paymentIds.map(id=>{
    const payment=payments.find(p=>String(p._id)===id);
    ensure(payment,'Khoản thu không còn hợp lệ hoặc không thuộc hóa đơn này.',409);
    const receipt=receipts.find(r=>String(r._id)===String(payment.receiptId));
    ensure(receipt&&['CASH','BANK_TRANSFER'].includes(receipt.method),'Thiếu nguồn/phương thức khoản thu; cần đối soát.',409);
    ensure(Number.isSafeInteger(payment.amount)&&payment.amount>=0,'Số tiền khoản thu không hợp lệ; cần đối soát.',409);
    return {paymentId:String(payment._id),receiptId:String(receipt._id),amount:payment.amount,method:receipt.method,originalDay:receipt.day,reversalDay:spaDay()};
  }).sort((a,b)=>a.paymentId.localeCompare(b.paymentId));
  if(rows.length){
    ensure(!invoice.activeDocumentId,'Hóa đơn đã thay tư vấn cần đối soát chuỗi chứng từ trước khi đảo khoản thu.',409);
    ensure(!invoice.refunded,'Hóa đơn đã hoàn tiền; cần đối soát nguồn trước, không đảo khoản đã trả thật cho khách.',409);
    ensure(!await InvoiceAdjustment.exists({spaId,invoiceId:invoice._id,mode:'REFUND'}).session(session),'Hóa đơn có lịch sử hoàn tiền; cần đối soát nguồn trước khi đảo.',409);
  }
  const books=[];
  for(const day of new Set(rows.flatMap(r=>[r.originalDay,r.reversalDay]))){
    dayBounds(day);ensure(day<=spaDay(),'Ngày khoản thu không hợp lệ.',409);
    const book=await Day.findOne({spaId,day,status:'OPEN'}).session(session);
    ensure(book,'Không thể đảo khoản thu: sổ ngày '+day+' chưa mở hoặc đã chốt. Cần đối soát và mở lại sổ; không sửa snapshot đã chốt.',409);
    books.push(book.toObject());
  }
  return {rows,books,total:rows.reduce((n,r)=>n+r.amount,0)};
}

export async function applyMistakenReceipts(actor:Actor,prepared:Awaited<ReturnType<typeof prepareMistakenReceipts>>,payments:any[],receipts:any[],adjustmentId:unknown,reason:string,session:ClientSession){
  const scope={spaId:actor.spaId},created=[];
  for(const book of prepared.books){
    ensure(await Day.findOneAndUpdate({...scope,_id:book._id,status:'OPEN'},{$inc:{revision:1}},{session,returnDocument:'after'}),'Sổ ngày '+book.day+' không còn mở; tải lại trước khi đảo khoản thu.',409);
  }
  for(const row of prepared.rows){
    const payment=payments.find(p=>String(p._id)===row.paymentId)!,receipt=receipts.find(r=>String(r._id)===row.receiptId)!;
    // Unique CashEntry.originalId, invoice version, Control and Idempotency jointly prevent duplicates.
    const reversal=(await CashEntry.create([{...scope,actorId:actor.id,customerId:receipt.customerId,amount:receipt.amount,method:receipt.method,
      direction:'OUT',kind:'REVERSAL',originalId:receipt._id,day:row.reversalDay,note:`Hủy/đối soát hóa đơn · Điều chỉnh #${adjustmentId}: ${reason}`}],{session}))[0];
    payment.reversed=true;receipt.reversed=true;await payment.save({session});await receipt.save({session});
    created.push({...row,reversalId:String(reversal._id)});
  }
  return created;
}
