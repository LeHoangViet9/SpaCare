import mongoose, {type ClientSession} from 'mongoose';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from './auth';
import {Allocation, Audit, CashCard, CashCardUse, CashEntry, Commission, Customer, Day, Deposit, Invoice, InvoiceAdjustment, InvoiceLineCommission, Payment, Payroll, Product, SaleCommission, Service, SharedSaleCommission, StockMovement, Treatment, User} from './models';
import {adjustmentBalance, invoiceAdjustmentInput, invoiceAdjustmentRefundInput} from './invoice-adjustment-rules';
import {ensure, invoiceState, paymentEvidence, spaDay} from './rules';
import {stockBalance} from './product-rules';
import {monthBounds} from './payroll-rules';
import {sharedCommissionDeltas} from './sale-commission';

type Input=z.infer<typeof invoiceAdjustmentInput>;
const copy=(row:any)=>row.toObject();
const sum=(rows:any[],field:string)=>rows.reduce((n,row)=>n+(row[field]||0),0);

// Invoked only after operate has revalidated the active OWNER and acquired Control.
export async function adjustInvoice(actor:Actor,d:Input,session:ClientSession,commit:boolean) {
  ensure(actor.role==='OWNER','Chỉ chủ spa được xử lý hóa đơn.',403);
  const scope={spaId:actor.spaId};
  const get=async(model:mongoose.Model<any>,id:unknown)=>{
    const row=await model.findOne({...scope,_id:id}).session(session);
    ensure(row,'Không tìm thấy tham chiếu trong spa này.',404);return row;
  };
  const invoice=await get(Invoice,d.id);
  ensure(invoice.status!=='CANCELLED','Hóa đơn đã vô hiệu hóa, chỉ được tra cứu.',409);
  ensure(invoice.updatedAt.toISOString()===d.expectedUpdatedAt,'Hóa đơn đã thay đổi. Tải lại và đối chiếu lại.',409);
  await get(Customer,invoice.customerId);
  if(invoice.financialRevision)ensure(await InvoiceAdjustment.exists({...scope,_id:invoice.lastAdjustmentId,invoiceId:invoice._id,customerId:invoice.customerId}).session(session),'Chuỗi chứng từ điều chỉnh không thuộc hóa đơn/khách hiện tại.',409);
  for(const serviceId of new Set([invoice.serviceId,...(invoice.packageItems||[]).map((line:any)=>line.serviceId)].filter(Boolean).map(String)))await get(Service,serviceId);
  ensure(!invoice.openingBalance,'Chứng từ chuyển số dư chưa có đủ nguồn tiền gốc để điều chỉnh tài chính.',409);
  const before=copy(invoice),newTotal=d.mode==='VOID'?0:d.total;
  ensure(d.mode==='VOID'||invoice.kind!=='GIFT'||newTotal===invoice.total,'Hóa đơn quà tặng luôn giữ giá gốc; không được điều chỉnh tổng tiền.',409);
  const oldDay=spaDay(invoice.createdAt),dateChanged=!!d.issuedOn&&d.issuedOn!==oldDay;
  if(d.issuedOn){
    ensure(d.issuedOn<=spaDay(),'Không nhập hóa đơn ngày tương lai.');
    if(dateChanged)for(const day of new Set([oldDay,d.issuedOn]))ensure(!await Day.exists({...scope,day,status:'CLOSED'}).session(session),'Ngày '+day+' đã chốt sổ. Chủ spa cần mở lại trước khi sửa ngày hóa đơn.',409);
  }
  const correctedDate=dateChanged?new Date(d.issuedOn+'T12:00:00+07:00'):undefined;
  const gifts=await Invoice.find({...scope,giftOfInvoiceId:invoice._id}).session(session);
  const family=[invoice,...gifts],ids=family.map(r=>r._id);
  ensure(family.every(row=>String(row.customerId)===String(invoice.customerId)),'Chứng từ quà không cùng khách.',409);
  const plans=await Treatment.find({...scope,invoiceId:{$in:ids}}).session(session);
  ensure(plans.every(p=>String(p.customerId)===String(invoice.customerId)),'Gói không cùng khách.',409);
  const giftCards=await CashCard.find({...scope,sourceInvoiceId:invoice._id}).session(session);
  ensure(giftCards.every(c=>String(c.customerId)===String(invoice.customerId)),'Thẻ tặng không cùng khách.',409);
  const allocations=await Allocation.find({...scope,invoiceId:invoice._id,reversed:false}).sort({_id:1}).session(session);
  const cardUses=await CashCardUse.find({...scope,invoiceId:invoice._id,reversedAt:{$exists:false}}).sort({_id:1}).session(session);
  const payments=await Payment.find({...scope,invoiceId:invoice._id,reversed:false}).session(session);
  const receipts=[];
  for(const payment of payments){
    const receipt=await get(CashEntry,payment.receiptId);
    ensure(!receipt.reversed && receipt.kind==='PAYMENT' && receipt.direction==='IN' && receipt.amount===payment.amount && String(receipt.customerId)===String(invoice.customerId),'Khoản thu gốc không khớp; cần đối soát.',409);
    ensure(!await Payment.exists({...scope,receiptId:receipt._id,_id:{$ne:payment._id}}).session(session),'Phiếu thu được nhiều khoản thanh toán tham chiếu; cần đối soát.',409);
    ensure(!await CashEntry.exists({...scope,originalId:receipt._id}).session(session),'Phiếu thu đã có chứng từ đảo; cần đối soát.',409);
    receipts.push(receipt);
  }
  const deposits=[];for(const a of allocations){const source=await get(Deposit,a.depositId);ensure(String(source.customerId)===String(invoice.customerId),'Cọc không cùng khách.',409);deposits.push(source);}
  const cards=[];for(const use of cardUses){const source=await get(CashCard,use.cardId);ensure(String(source.customerId)===String(invoice.customerId),'Thẻ không cùng khách.',409);cards.push(source);}
  const available=(row:any)=>{const value=row.amount-(row.adjustmentReturned||0);ensure(Number.isSafeInteger(value)&&value>=0,'Nguồn thanh toán đã điều chỉnh không hợp lệ.',409);return value;};
  const giftIds=gifts.map(gift=>gift._id);
  const giftPayments=giftIds.length?await Payment.find({...scope,invoiceId:{$in:giftIds},reversed:false}).sort({_id:1}).session(session):[];
  const giftAllocations=giftIds.length?await Allocation.find({...scope,invoiceId:{$in:giftIds},reversed:false}).sort({_id:1}).session(session):[];
  const giftCardUses=giftIds.length?await CashCardUse.find({...scope,invoiceId:{$in:giftIds},reversedAt:{$exists:false}}).sort({_id:1}).session(session):[];
  const giftReceipts=[],giftDeposits=[],giftCardSources=[];
  const giftFunding=[];
  for(const gift of gifts){
    const childPayments=giftPayments.filter(payment=>String(payment.invoiceId)===String(gift._id));
    const childAllocations=giftAllocations.filter(allocation=>String(allocation.invoiceId)===String(gift._id));
    const childCardUses=giftCardUses.filter(use=>String(use.invoiceId)===String(gift._id));
    for(const payment of childPayments){
      const receipt=await get(CashEntry,payment.receiptId);
      ensure(!receipt.reversed&&receipt.kind==='PAYMENT'&&receipt.direction==='IN'&&receipt.amount===payment.amount&&String(receipt.customerId)===String(gift.customerId),'Nguồn thu của hóa đơn quà không khớp; cần đối soát.',409);
      ensure(!await Payment.exists({...scope,receiptId:receipt._id,_id:{$ne:payment._id}}).session(session),'Phiếu thu của hóa đơn quà được dùng chung; cần đối soát.',409);
      ensure(!await CashEntry.exists({...scope,originalId:receipt._id}).session(session),'Phiếu thu của hóa đơn quà đã có chứng từ đảo; cần đối soát.',409);
      giftReceipts.push(receipt);
    }
    const childDeposits=[],childCards=[];
    for(const allocation of childAllocations){
      const source=await get(Deposit,allocation.depositId);
      ensure(String(source.customerId)===String(gift.customerId),'Cọc của hóa đơn quà không cùng khách.',409);
      childDeposits.push(source);giftDeposits.push(source);
    }
    for(const use of childCardUses){
      const source=await get(CashCard,use.cardId);
      ensure(String(source.customerId)===String(gift.customerId),'Thẻ của hóa đơn quà không cùng khách.',409);
      childCards.push(source);giftCardSources.push(source);
    }
    const sourceTotal=sum(childPayments,'amount')+childAllocations.reduce((n,row)=>n+available(row),0)+childCardUses.reduce((n,row)=>n+available(row),0)-(gift.refunded||0);
    const amountToResolve=gift.paid+(gift.adjustmentCredit||0)-(gift.financialRevision?0:(gift.refunded||0));
    ensure(amountToResolve>=0&&sourceTotal===amountToResolve,'Nguồn tiền của hóa đơn quà không khớp số đã thu/chờ xử lý/đã hoàn; cần đối soát trước.',409);
    if(d.mode==='VOID'&&d.giftHandling==='REVOKE_UNUSED')ensure(amountToResolve===0,'Hóa đơn quà còn tiền đã thu hoặc đang chờ xử lý/hoàn. Chọn giữ quà hoặc đối soát/hoàn tiền riêng trước khi thu hồi.',409);
    giftFunding.push({invoice:copy(gift),payments:childPayments.map(copy),receipts:giftReceipts.filter(receipt=>childPayments.some(payment=>String(payment.receiptId)===String(receipt._id))).map(copy),
      allocations:childAllocations.map(copy),deposits:childDeposits.map(copy),cardUses:childCardUses.map(copy),cards:childCards.map(copy),amountToResolve});
  }
  const depositBalance=allocations.reduce((n,r)=>n+available(r),0),cardBalance=cardUses.reduce((n,r)=>n+available(r),0);
  const sourceTotal=sum(payments,'amount')+depositBalance+cardBalance-(invoice.refunded||0);
  const funded=invoice.paid+(invoice.adjustmentCredit||0)-(invoice.financialRevision?0:(invoice.refunded||0));
  ensure(sourceTotal===funded,'Tổng cọc/thẻ/khoản thu trừ hoàn tiền không khớp hóa đơn; cần đối soát nguồn trước.',409);
  let balance:ReturnType<typeof adjustmentBalance>;
  try{balance=adjustmentBalance(invoice.paid,invoice.adjustmentCredit||0,invoice.refunded||0,!!invoice.financialRevision,newTotal,depositBalance,cardBalance);}
  catch(e){ensure(false,(e as Error).message,409);}
  const movements=await StockMovement.find({...scope,$or:[{invoiceId:invoice._id},{checkoutInvoiceId:invoice._id}],direction:'OUT'}).session(session);
  const products=[];for(const movement of movements)products.push(await get(Product,movement.productId));
  if(d.mode==='VOID'){
    ensure(d.stockHandling!=='RETURN'||!(invoice.productId||invoice.productItems?.length)||movements.length>0,'Không có phiếu xuất gốc để nhập bù kho; cần đối soát kho trước.',409);
    ensure(!movements.length || !!d.stockHandling,'Chọn giữ xuất kho hoặc xác nhận đã nhận lại hàng vào kho.');
    ensure(!(plans.some(p=>String(p.invoiceId)===String(invoice._id))||invoice.packageItems?.length) || !!d.entitlementHandling,'Chọn giữ quyền lợi hoặc dừng phần quyền lợi còn lại.');
    ensure(!(gifts.length||giftCards.length) || !!d.giftHandling,'Chọn giữ quà hoặc thu hồi phần quà chưa dùng.');
  }
  const ledgers=[];
  for(const [kind,model] of [['commission',Commission],['line',InvoiceLineCommission],['sale',SaleCommission],['shared',SharedSaleCommission]] as const){
    const rows=await model.find({...scope,invoiceId:invoice._id,cancelledAt:{$exists:false}}).session(session);
    for(const row of rows) ledgers.push({kind,row});
  }
  const serviceGroups=new Map<string,any>(),saleGroups=new Map<string,any>();
  for(const {kind,row} of ledgers){
    await get(User,row.staffId);
    if(row.serviceId)await get(Service,row.serviceId);
    const groups=row.category==='PACKAGE_SALE'||kind==='sale'||kind==='shared'?saleGroups:serviceGroups,key=String(row.staffId);
    const group=groups.get(key)||{staffId:row.staffId,staffName:row.staffName,serviceId:row.serviceId,amount:0,ids:[]};
    group.amount+=row.amount;group.ids.push(row._id);groups.set(key,group);
  }
  const packageEvidence=!!invoice.packageItems?.length||plans.some(p=>String(p.invoiceId)===String(invoice._id))||saleGroups.size>0;
  const otherLineEvidence=!!invoice.serviceItems?.length||!!invoice.treatmentSessions?.length||!!invoice.productItems?.length||serviceGroups.size>0||movements.length>0;
  const mixedPackageInvoice=packageEvidence&&otherLineEvidence;
  const purePackageInvoice=packageEvidence&&!mixedPackageInvoice;
  if(d.mode==='VOID'&&(packageEvidence||invoice.kind==='PACKAGE'))ensure(!!d.entitlementHandling,'Chọn giữ quyền lợi hoặc dừng phần quyền lợi còn lại.');
  // Fixed performed-service commission changes only on void. Sale commission follows
  // the existing 5% received-money rule and cumulative equal-share rounding.
  const salePool=[...saleGroups.values()].reduce((n,g)=>n+g.amount,0);
  ensure(d.mode==='VOID'||!mixedPackageInvoice||newTotal===invoice.total,'Hóa đơn hỗn hợp có gói chưa hỗ trợ phân bổ chênh lệch giá theo dòng; chỉ sửa nội dung hoặc vô hiệu hóa.',409);
  ensure(d.mode==='VOID'||newTotal===invoice.total||!purePackageInvoice||!(invoice.packageItems||[]).some((line:any)=>line.sellerId&&String(line.sellerId)!==String(invoice.sellerId)), 'Các dòng gói có tư vấn khác nhau cần phân bổ chênh lệch theo dòng; chỉ sửa nội dung hoặc vô hiệu hóa.',409);
  ensure([...saleGroups.values()].every(g=>g.amount>=0),'Hoa hồng bán gói đã âm; cần đối soát.',409);
  const targetSale=d.mode==='VOID'?0:purePackageInvoice&&[1,2].includes(invoice.saleCommissionVersion)?Math.floor(balance!.paid/20):salePool;
  const desiredSale=new Map<string,number>();
  if(d.mode==='CORRECT'&&purePackageInvoice&&[1,2].includes(invoice.saleCommissionVersion)){
    ensure(salePool===(invoice.saleCommissionAccrued||0),'Hoa hồng tích lũy không khớp ledger gốc; cần đối soát.',409);
    const participants=invoice.saleCommissionVersion===2?invoice.saleParticipants||[]:[{staffId:invoice.sellerId,staffName:invoice.sellerName}];
    ensure(participants.length>0&&participants.every((p:any)=>p.staffId)&&new Set(participants.map((p:any)=>String(p.staffId))).size===participants.length,'Thiếu hoặc trùng người hưởng hoa hồng gốc.',409);
    const shares=sharedCommissionDeltas(targetSale,0,participants.map((p:any)=>String(p.staffId)));
    for(const share of shares){
      const participant=participants.find((p:any)=>String(p.staffId)===share.staffId),person=await get(User,share.staffId);
      desiredSale.set(share.staffId,share.total);
      if(!saleGroups.has(share.staffId))saleGroups.set(share.staffId,{staffId:person._id,staffName:participant.staffName||person.name,serviceId:invoice.serviceId||invoice.packageItems?.[0]?.serviceId,amount:0,ids:[]});
    }
    ensure([...saleGroups.values()].every(g=>!g.amount||desiredSale.has(String(g.staffId))),'Ledger có người hưởng khác với chứng từ hiện hành; cần đối soát.',409);
  }
  const commissionChanges:any[]=[];
  for(const g of serviceGroups.values())if(d.mode==='VOID'&&g.amount)commissionChanges.push({...g,category:'SERVICE',delta:-g.amount});
  const saleParts=[...saleGroups.values()].sort((a,b)=>String(a.staffId).localeCompare(String(b.staffId))).map(g=>({...g,target:d.mode==='VOID'?0:desiredSale.size?(desiredSale.get(String(g.staffId))||0):g.amount}));
  for(const g of saleParts)if(g.target!==g.amount)commissionChanges.push({...g,category:'PACKAGE_SALE',delta:g.target-g.amount});
  const now=new Date();
  // Compensations enter the first unclosed month; never alter APPROVED/PAID snapshots.
  const commissionMonths:Record<string,string>={};
  for(const change of commissionChanges){
    let month=spaDay(now).slice(0,7);
    for(let i=0;i<120;i++){
      if(!await Payroll.exists({...scope,staffId:change.staffId,month,status:{$in:['APPROVED','PAID']}}).session(session))break;
      const end=monthBounds(month).end;month=spaDay(end).slice(0,7);
    }
    ensure(!await Payroll.exists({...scope,staffId:change.staffId,month,status:{$in:['APPROVED','PAID']}}).session(session),'Không tìm thấy kỳ lương mở cho điều chỉnh.',409);
    commissionMonths[String(change.staffId)]=month;
  }
  const reconciliation={
    payments:payments.map(copy),receipts:receipts.map(copy),allocations:allocations.map(copy),cardUses:cardUses.map(copy),
    deposits:deposits.map(copy),cards:cards.map(copy),plans:plans.map(copy),gifts:gifts.map(copy),giftCards:giftCards.map(copy),
    movements:movements.map(copy),products:products.map(copy),ledgers:ledgers.map(({kind,row})=>({kind,...copy(row)})),giftFunding,
    balance:balance!,commissionChanges,commissionMonths,
    stockHandling:d.stockHandling,entitlementHandling:d.entitlementHandling,giftHandling:d.giftHandling,
  };
  const after={...before,description:d.mode==='VOID'?invoice.description:d.description,total:newTotal,paid:balance!.paid,adjustmentCredit:balance!.credit,
    status:d.mode==='VOID'?'CANCELLED':invoiceState(newTotal,balance!.paid),...(correctedDate?{createdAt:correctedDate.toISOString(),recordedAt:invoice.recordedAt||invoice.createdAt}:{})};
  const previewToken=createHash('sha256').update(JSON.stringify({before,after,reconciliation})).digest('hex');
  const preview={before,after,reconciliation,previewToken,delta:newTotal-invoice.total};
  if(!commit)return preview;
  ensure(d.confirmed && d.expectedPreview===previewToken,'Cần xem trước và xác nhận lại đối soát mới nhất.',409);
  const adjustmentId=new mongoose.Types.ObjectId();
  const returnSource=async(rows:any[],sources:any[],amount:number)=>{
    for(let i=0;i<rows.length&&amount>0;i++){
      const row=rows[i],restored=Math.min(amount,available(row));if(!restored)continue;
      // Reload sequentially: more than one allocation/use can point at the same balance.
      const model=row.depositId?Deposit:CashCard,source=await get(model,sources[i]._id);
      source.balance+=restored;ensure(source.balance<=source.amount,'Số dư nguồn vượt giá trị gốc.',409);
      row.adjustmentReturned=(row.adjustmentReturned||0)+restored;
      await source.save({session});await row.save({session});amount-=restored;
    }
    ensure(amount===0,'Không hoàn được đủ số dư nguồn.',409);
  };
  await returnSource(allocations,deposits,balance!.depositReturn);
  await returnSource(cardUses,cards,balance!.cardReturn);
  const createdCommissions=[];
  for(const change of commissionChanges){
    const month=commissionMonths[String(change.staffId)],earnedAt=month===spaDay(now).slice(0,7)?now:monthBounds(month).start;
    const values={...scope,staffId:change.staffId,staffName:change.staffName,serviceId:change.serviceId,serviceName:invoice.description,customerId:invoice.customerId,invoiceId:invoice._id,amount:change.delta,earnedAt,sourceType:'INVOICE_ADJUSTMENT',sourceId:adjustmentId};
    const lineId=new mongoose.Types.ObjectId();
    const row=change.category==='PACKAGE_SALE'
      ? (await SharedSaleCommission.create([{...values,shareCount:saleParts.length}],{session}))[0]
      : (await InvoiceLineCommission.create([{...values,lineId,sourceId:lineId,adjustmentId,originalLedgerIds:change.ids}],{session}))[0];
    createdCommissions.push(row._id);
    await Payroll.updateMany({...scope,staffId:change.staffId,status:'DRAFT'},{$set:{needsRecalculation:true}},{session});
  }
  if(d.mode==='VOID'){
    for(const plan of plans){
      const gift=String(plan.invoiceId)!==String(invoice._id);
      if(gift ? d.giftHandling==='REVOKE_UNUSED' : d.entitlementHandling==='CANCEL_REMAINING')plan.status='CANCELLED';
      else if(!gift)plan.retainedAfterVoid=true;
      await plan.save({session});
    }
    if(d.giftHandling==='REVOKE_UNUSED'){
      for(const card of giftCards){card.balance=0;await card.save({session});}
      for(const gift of gifts){gift.cancelledTotal=gift.total;gift.total=0;gift.paid=0;gift.status='CANCELLED';gift.cancelledAt=now;gift.cancelledBy=actor.id;gift.cancelReason=d.reason;await gift.save({session});}
    }
    if(d.stockHandling==='RETURN')for(const movement of movements){
      ensure(!await StockMovement.exists({...scope,reversalOf:movement._id}).session(session),'Phiếu kho đã được bù trước đó.',409);
      const product=await get(Product,movement.productId),stockBefore=product.stock;
      product.stock=stockBalance(product.stock,'IN',movement.quantity);await product.save({session});
      await StockMovement.create([{...scope,productId:product._id,productName:product.name,sku:product.sku,unit:product.unit,actorId:actor.id,actorName:actor.name,direction:'IN',kind:'MANUAL',quantity:movement.quantity,before:stockBefore,after:product.stock,reason:d.reason,reversalOf:movement._id}],{session});
    }
    invoice.cancelledTotal=invoice.total;invoice.cancelledAt=now;invoice.cancelledBy=actor.id;invoice.cancelReason=d.reason;
  }
  Object.assign(invoice,{description:after.description,total:after.total,paid:after.paid,status:after.status,adjustmentCredit:after.adjustmentCredit,
    financialRevision:(invoice.financialRevision||0)+1,lastAdjustmentId:adjustmentId,cardPaid:Math.max(0,(invoice.cardPaid||0)-balance!.cardReturn)});
  if(saleGroups.size||invoice.saleCommissionAccrued!==undefined)invoice.saleCommissionAccrued=targetSale;
  await invoice.save({session});
  // createdAt is immutable under Mongoose timestamps; update only the invoice's
  // displayed issue date explicitly. Never move receipt day or commission earnedAt.
  if(correctedDate)await Invoice.updateOne({...scope,_id:invoice._id},{$set:{createdAt:correctedDate,recordedAt:invoice.recordedAt||invoice.createdAt}},{session,timestamps:false,overwriteImmutable:true});
  const savedAfter={...copy(invoice),...(correctedDate?{createdAt:correctedDate,recordedAt:invoice.recordedAt||invoice.createdAt}:{})};
  await InvoiceAdjustment.create([{...scope,_id:adjustmentId,invoiceId:invoice._id,customerId:invoice.customerId,actorId:actor.id,mode:d.mode,reason:d.reason,
    before,after:savedAfter,delta:preview.delta,reconciliation:{...reconciliation,createdCommissions},previousAdjustmentId:before.lastAdjustmentId}],{session});
  await Audit.create([{...scope,actorId:actor.id,action:d.mode==='VOID'?'voidInvoice':'correctInvoice',targetId:invoice._id,
    details:{invoiceId:String(invoice._id),adjustmentId,reason:d.reason,before,after:savedAfter,delta:preview.delta,reconciliation:{...reconciliation,createdCommissions}}}],{session});
  return {id:String(invoice._id),adjustmentId:String(adjustmentId),message:'Đã lưu chứng từ điều chỉnh, giữ khoản thu và lịch sử gốc.'};
}

export async function refundInvoiceAdjustment(actor:Actor,d:z.infer<typeof invoiceAdjustmentRefundInput>,session:ClientSession,receipt:(values:Record<string,unknown>)=>Promise<any>) {
  ensure(actor.role==='OWNER','Chỉ chủ spa được hoàn tiền điều chỉnh.',403);
  const scope={spaId:actor.spaId};
  const invoice=await Invoice.findOne({...scope,_id:d.id}).session(session);
  ensure(invoice,'Không tìm thấy hóa đơn trong spa này.',404);
  ensure(invoice.updatedAt.toISOString()===d.expectedUpdatedAt,'Hóa đơn đã thay đổi. Tải lại trước khi hoàn.',409);
  ensure(invoice.financialRevision && d.amount<=(invoice.adjustmentCredit||0),'Số hoàn vượt tiền trực tiếp đang giữ chờ xử lý.',409);
  ensure(await Customer.exists({...scope,_id:invoice.customerId}).session(session),'Khách không thuộc spa.',409);
  ensure(await InvoiceAdjustment.exists({...scope,_id:invoice.lastAdjustmentId,invoiceId:invoice._id,customerId:invoice.customerId}).session(session),'Chuỗi điều chỉnh không thuộc hóa đơn/khách hiện tại.',409);
  paymentEvidence(d.method,d.receivedConfirmation,d.reason,d.transferReference);
  const before=copy(invoice),entry=await receipt({amount:d.amount,method:d.method,direction:'OUT',kind:'REFUND',customerId:invoice.customerId,note:d.reason,transferReference:d.transferReference});
  invoice.adjustmentCredit-=d.amount;invoice.refunded=(invoice.refunded||0)+d.amount;
  const adjustmentId=new mongoose.Types.ObjectId();invoice.lastAdjustmentId=adjustmentId;await invoice.save({session});
  await InvoiceAdjustment.create([{...scope,_id:adjustmentId,invoiceId:invoice._id,customerId:invoice.customerId,actorId:actor.id,mode:'REFUND',reason:d.reason,before,after:copy(invoice),delta:0,receiptId:entry._id,previousAdjustmentId:before.lastAdjustmentId}],{session});
  await Audit.create([{...scope,actorId:actor.id,action:'refundInvoiceAdjustment',targetId:invoice._id,details:{invoiceId:String(invoice._id),adjustmentId,receiptId:entry._id,amount:d.amount,reason:d.reason,before,after:copy(invoice)}}],{session});
  return {id:String(invoice._id),adjustmentId:String(adjustmentId),message:'Đã ghi nhận khoản hoàn thực tế.'};
}
