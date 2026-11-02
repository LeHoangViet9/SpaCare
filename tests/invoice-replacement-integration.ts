import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {operate} from '../src/lib/operations';
import {readInvoice} from '../src/lib/invoice-read';
import {readCustomerHistory} from '../src/lib/customer-history';
import {invoiceExport} from '../src/lib/export-read';
import {readReport} from '../src/lib/report-read';
import {workspaceQuery} from '../src/lib/workspace-query';
import {sharedCommissionDeltas} from '../src/lib/sale-commission';
import {backfillInvoiceCodes} from '../src/lib/invoice-code-migration';
import {historicalInvoiceCode,invoiceCode} from '../src/lib/invoice-code';
import {spaDay} from '../src/lib/rules';
import {Spa,User,Control,Customer,Service,Invoice,Treatment,TreatmentUse,Appointment,Payment,CashEntry,SaleCommission,SharedSaleCommission,Payroll,Audit,Day,Allocation,Deposit,CashCard,CashCardUse} from '../src/lib/models';
import type {Actor} from '../src/lib/auth';

export async function invoiceReplacementIntegration(extraSpaIds:mongoose.Types.ObjectId[]) {
  const spa=await Spa.create({name:'Synthetic replacement fixture'});extraSpaIds.push(spa._id);
  const scope={spaId:spa._id};await Control.create({...scope,invoiceSequence:100});
  const people=[];
  for(const name of ['Owner fixture','Advisor A fixture','Advisor B fixture','Advisor C fixture']) people.push(await User.create({...scope,name,
    email:randomUUID()+'@example.test',passwordHash:'synthetic-test-only',role:name.startsWith('Owner')?'OWNER':'STAFF',active:true}));
  const [owner,old,other,next]=people;
  const actor:Actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER',cashier:true};
  const call=(action:string,data:unknown,key=randomUUID())=>operate(actor,action,data,key);
  const customer=await Customer.create({...scope,name:'Synthetic customer'});
  const service=await Service.create({...scope,name:'Synthetic service',price:100,duration:30});
  let sequence=800000;
  const fixture=async(shared=false)=>{
    const participants=[old,...(shared?[other]:[])].map(s=>({staffId:s._id,staffName:s.name}));
    const total=1750061,pool=Math.floor(total/20);
    const invoice=await Invoice.create({...scope,code:'HD'+(++sequence),customerId:customer._id,serviceId:service._id,description:'Synthetic paid package',
      kind:'PACKAGE',total,paid:total,status:'PAID',createdBy:owner._id,creatorName:owner.name,consultantId:other._id,consultantName:other.name,
      sellerId:old._id,sellerName:old.name,saleParticipants:participants,saleCommissionVersion:shared?2:1,saleCommissionAccrued:pool});
    const treatment=await Treatment.create({...scope,invoiceId:invoice._id,customerId:customer._id,serviceId:service._id,name:'Synthetic rights',totalSessions:10,remaining:9,status:'ACTIVE'});
    invoice.packageItems=[{lineId:new mongoose.Types.ObjectId(),treatmentId:treatment._id,serviceId:service._id,name:'Synthetic package',total,paid:total,sellerId:old._id,sellerName:old.name}];await invoice.save();
    const session=await Invoice.create({...scope,customerId:customer._id,total:0,paid:0,kind:'SESSION',treatmentId:treatment._id});
    const appointment=await Appointment.create({...scope,customerId:customer._id,serviceId:service._id,staffId:other._id,treatmentId:treatment._id,startAt:new Date(),endAt:new Date(Date.now()+1800000),status:'COMPLETED'});
    const use=await TreatmentUse.create({...scope,customerId:customer._id,treatmentId:treatment._id,checkoutInvoiceId:session._id,appointmentId:appointment._id,actorId:owner._id,staffId:other._id,
      method:'DRAWN_SIGNATURE',signature:{version:1,strokes:[[[0.1,0.2],[0.3,0.4],[0.5,0.6]]]},signatureDigest:'synthetic-signature-digest',snapshot:'synthetic immutable signed snapshot',digest:'synthetic-digest',performedAt:new Date()});
    session.treatmentUseId=use._id;await session.save();
    const receipt=await CashEntry.create({...scope,customerId:customer._id,actorId:owner._id,amount:total,direction:'IN',method:'CASH',kind:'PAYMENT',day:spaDay()});
    const payment=await Payment.create({...scope,invoiceId:invoice._id,receiptId:receipt._id,amount:total,receivedConfirmation:true});
    const Ledger=shared?SharedSaleCommission:SaleCommission;
    for(const share of sharedCommissionDeltas(pool,0,participants.map(p=>String(p.staffId)))) await Ledger.create({...scope,invoiceId:invoice._id,staffId:share.staffId,
      staffName:participants.find(p=>String(p.staffId)===share.staffId)!.staffName,serviceId:service._id,customerId:customer._id,amount:share.amount,
      sourceType:'PAYMENT',sourceId:payment._id,earnedAt:payment.createdAt,...(shared?{shareCount:2}:{})});
    return {invoice,treatment,use,session,appointment,payment,receipt,Ledger};
  };
  const input=(invoice:any)=>({id:String(invoice._id),expectedUpdatedAt:invoice.updatedAt.toISOString(),expectedDocumentId:String(invoice.activeDocumentId || invoice._id),oldStaffId:String(old._id),newStaffId:String(next._id),reason:'Synthetic correction reason'});
  const f=await fixture(true),d=input(f.invoice),{reason,...previewInput}=d;
  const immutable=async()=>({payments:await Payment.find(scope).lean(),cash:await CashEntry.find(scope).lean(),plans:await Treatment.find(scope).lean(),
    uses:await TreatmentUse.find(scope).select('+signature').lean(),appointments:await Appointment.find(scope).lean(),sessions:await Invoice.find({...scope,kind:'SESSION'}).lean()});
  const before=await immutable(),count=await Invoice.countDocuments(scope),draft=await Payroll.create({...scope,staffId:old._id,month:spaDay().slice(0,7),baseSalary:0,commissionTotal:0,total:0});
  const preview:any=await call('previewPackageAdvisorReplacement',previewInput);assert.equal(preview.pool,87503);assert.equal(preview.uses.length,1);
  const key=randomUUID(),result:any=await call('replacePackageAdvisor',d,key);
  assert.deepEqual(await call('replacePackageAdvisor',d,key),result);
  await assert.rejects(call('replacePackageAdvisor',d),e=>(e as any).status===409);
  assert.equal(await Invoice.countDocuments(scope),count);assert.deepEqual(await immutable(),before);
  const current=await Invoice.findById(f.invoice._id);assert.notEqual(current!.effectiveCode,f.invoice.code);
  assert.equal(current!.documentHistory[0].status,'REPLACED');assert.equal(current!.documentHistory[0].snapshot.sellerName,old.name);
  assert.equal(String(current!.consultantId),String(other._id));assert.equal(String(current!.createdBy),String(owner._id));
  assert.equal(current!.saleCommissionAccrued,87503);assert.equal((await Payroll.findById(draft._id))!.needsRecalculation,true);
  await assert.rejects(call('approvePayroll',{id:String(draft._id),expectedTotal:0}),/Cập nhật bản nháp/);
  const ledgers=await SharedSaleCommission.find({...scope,invoiceId:f.invoice._id}).lean();
  const sum=(staffId:unknown)=>ledgers.filter(r=>String(r.staffId)===String(staffId)).reduce((n,r)=>n+r.amount,0);
  assert.equal(sum(old._id),0);assert.equal(ledgers.reduce((n,r)=>n+r.amount,0),87503);
  assert.equal((await readInvoice(actor,d.id)).invoice.effectiveCode,result.code);
  const pdf=await invoiceExport(actor,d.id);assert.equal(pdf.filename,result.code+'.pdf');
  const history=await readCustomerHistory(actor,String(customer._id),'invoices',1);assert.equal(history.total,count);
  const report=await readReport(actor,workspaceQuery(new URLSearchParams()));assert.equal(report.summary.total,1750061);assert.equal(report.summary.paid,1750061);
  // Sequential replacement changes only the current document and preserves chain links.
  const again={...input(current),oldStaffId:String(next._id),newStaffId:String(old._id)};
  await call('replacePackageAdvisor',again);const head=await Invoice.findById(f.invoice._id);
  assert.equal(head!.documentHistory.length,2);assert.equal(String(head!.documentHistory[0].replacedById),String(head!.documentHistory[1].documentId));
  await assert.rejects(call('replacePackageAdvisor',{...again,expectedUpdatedAt:head!.updatedAt.toISOString()}),e=>(e as any).status===409);
  for(const [field,value] of [['paid',0],['paid',100],['refunded',10]] as const) {
    const x=await fixture();x.invoice[field]=value;await x.invoice.save();await assert.rejects(call('replacePackageAdvisor',input(x.invoice)),e=>(e as any).status===409);
  }
  const unsupported: Array<[string,(f:Awaited<ReturnType<typeof fixture>>)=>Promise<unknown>]>=[
    ['reversed payment',f=>Payment.updateOne({_id:f.payment._id},{$set:{reversed:true}})],
    ['reversed receipt',f=>CashEntry.updateOne({_id:f.receipt._id},{$set:{reversed:true}})],
    ['receipt reversal',f=>CashEntry.create({...scope,customerId:customer._id,actorId:owner._id,amount:f.receipt.amount,direction:'OUT',method:'CASH',kind:'REVERSAL',day:spaDay(),originalId:f.receipt._id})],
    ['multiple payments',f=>Payment.create({...scope,invoiceId:f.invoice._id,receiptId:f.receipt._id,amount:1})],
    ['deposit allocation',async f=>{const deposit=await Deposit.create({...scope,customerId:customer._id,amount:10,balance:0});return Allocation.create({...scope,depositId:deposit._id,invoiceId:f.invoice._id,amount:10,approvedBy:owner._id,reason:'Synthetic allocation'});}],
    ['cash card use',async f=>{const card=await CashCard.create({...scope,customerId:customer._id,amount:10,balance:0,origin:'PURCHASE',actorId:owner._id});return CashCardUse.create({...scope,cardId:card._id,customerId:customer._id,invoiceId:f.invoice._id,amount:10,balanceBefore:10,balanceAfter:0,actorId:owner._id});}],
    ['mixed service',f=>Invoice.updateOne({_id:f.invoice._id},{$set:{serviceItems:[{serviceId:service._id,name:'Synthetic mixed service',total:10,commission:0}]}})],
    ['independent payment source',async f=>{const independent=await fixture(true);return SaleCommission.updateOne({...scope,invoiceId:f.invoice._id},{$set:{sourceId:independent.payment._id}});}],
  ];
  for(const [label,change] of unsupported){
    const x=await fixture();await change(x);const fresh=await Invoice.findById(x.invoice._id);
    const before=await Invoice.findById(x.invoice._id).lean(),ledgerBefore=await SaleCommission.find({invoiceId:x.invoice._id}).lean();
    await assert.rejects(call('replacePackageAdvisor',input(fresh)),e=>(e as any).status===409,label);
    assert.deepEqual(await Invoice.findById(x.invoice._id).lean(),before,label);
    assert.deepEqual(await SaleCommission.find({invoiceId:x.invoice._id}).lean(),ledgerBefore,label);
  }
  const x=await fixture();const ledger=await SaleCommission.findOne({...scope,invoiceId:x.invoice._id});
  const payroll=await Payroll.create({...scope,staffId:old._id,month:'2020-01',baseSalary:0,total:0,commissionTotal:0,status:'APPROVED',saleCommissionIds:[ledger!._id]});
  for(const status of ['APPROVED','PAID']) {payroll.status=status;await payroll.save();await assert.rejects(call('replacePackageAdvisor',input(x.invoice)),/payroll/);}
  payroll.saleCommissionIds=[];payroll.commissionIds=[ledger!._id];await payroll.save();await assert.rejects(call('replacePackageAdvisor',input(x.invoice)),/payroll/);
  payroll.commissionIds=[];
  payroll.saleCommissionIds=[];await payroll.save();ledger!.payrollId=payroll._id;await ledger!.save();
  await assert.rejects(call('replacePackageAdvisor',input(x.invoice)),/payroll/);
  const y=await fixture();
  await assert.rejects(operate({...actor,id:String(old._id),role:'STAFF'},'replacePackageAdvisor',input(y.invoice),randomUUID()),e=>(e as any).status===403);
  await User.updateOne({_id:owner._id},{$set:{active:false}});await assert.rejects(call('replacePackageAdvisor',input(y.invoice)),e=>(e as any).status===401);await User.updateOne({_id:owner._id},{$set:{active:true}});
  await assert.rejects(call('replacePackageAdvisor',{...input(y.invoice),newStaffId:new mongoose.Types.ObjectId().toString()}),e=>(e as any).status===404);
  const foreignSpa=await Spa.create({name:'Synthetic foreign spa'});extraSpaIds.push(foreignSpa._id);await Control.create({spaId:foreignSpa._id});
  const foreign=await User.create({spaId:foreignSpa._id,name:'Synthetic foreign owner',email:randomUUID()+'@example.test',passwordHash:'synthetic-test-only',role:'OWNER',active:true});
  await assert.rejects(call('replacePackageAdvisor',{...input(y.invoice),newStaffId:String(foreign._id)}),e=>(e as any).status===404);
  await assert.rejects(operate({...actor,id:String(foreign._id),spaId:String(foreignSpa._id)},'replacePackageAdvisor',input(y.invoice),randomUUID()),e=>(e as any).status===404);
  const closedPeriod=await Payroll.create({...scope,staffId:next._id,month:spaDay().slice(0,7),baseSalary:0,total:0,commissionTotal:0,status:'APPROVED'});
  await assert.rejects(call('replacePackageAdvisor',input(y.invoice)),/Kỳ lương/);closedPeriod.status='DRAFT';await closedPeriod.save();
  await Day.create({...scope,day:spaDay(),opening:0,status:'CLOSED'});await assert.rejects(call('replacePackageAdvisor',input(y.invoice)),/đã chốt/);await Day.deleteOne({...scope,day:spaDay()});
  // Fail after ledger/projection writes: the enclosing MongoDB transaction must roll back.
  const originalCreate=Audit.create;
  const rollbackBefore=await Invoice.findById(y.invoice._id).lean(),ledgerCount=await SaleCommission.countDocuments(scope),controlBefore=await Control.findOne(scope).lean();
  try {
    Audit.create=(async()=>{throw new Error('synthetic late audit failure');}) as any;
    await assert.rejects(call('replacePackageAdvisor',input(y.invoice)),/synthetic late audit failure/);
  } finally {Audit.create=originalCreate;}
  assert.deepEqual(await Invoice.findById(y.invoice._id).lean(),rollbackBefore);assert.equal(await SaleCommission.countDocuments(scope),ledgerCount);
  assert.deepEqual(await Control.findOne(scope).lean(),controlBefore);
  const race=await Promise.allSettled([call('replacePackageAdvisor',input(y.invoice)),call('replacePackageAdvisor',input(y.invoice))]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  // Using another real session after correction remains possible without touching the old evidence.
  const oldUse=await TreatmentUse.findById(y.use._id).select('+signature').lean();
  await call('use',{treatmentId:String(y.treatment._id),remainingBefore:9,staffId:String(other._id)});
  assert.equal((await Treatment.findById(y.treatment._id))!.remaining,8);
  assert.deepEqual(await TreatmentUse.findById(y.use._id).select('+signature').lean(),oldUse);
  // Financial changes serialize with replacement; whichever wins invalidates the other.
  const r=await fixture();await Day.create({...scope,day:spaDay(),opening:0,status:'OPEN'});
  const refundRace=await Promise.allSettled([call('replacePackageAdvisor',input(r.invoice)),call('refundPackage',{
    invoiceId:String(r.invoice._id),amount:100,method:'CASH',receivedConfirmation:true,exceptionApproved:true,reason:'Synthetic approved exception'})]);
  assert.equal(refundRace.filter(r=>r.status==='fulfilled').length,1);
  const settled=await fixture();await call('savePayroll',{staffId:String(old._id),id:String(draft._id),month:spaDay().slice(0,7),baseSalary:1000000,attendanceConfirmed:false});
  const refreshed=await Payroll.findById(draft._id);
  const payrollRace=await Promise.allSettled([call('replacePackageAdvisor',input(settled.invoice)),call('approvePayroll',{id:String(draft._id),expectedTotal:refreshed!.total})]);
  assert.equal(payrollRace.filter(r=>r.status==='fulfilled').length,1);
}

export async function invoiceReplacementP2Integration(extraSpaIds:mongoose.Types.ObjectId[]) {
  const spa=await Spa.create({name:'Synthetic P2 transfer fixture'});extraSpaIds.push(spa._id);
  const scope={spaId:spa._id};await Control.create({...scope,invoiceSequence:0});
  const people=[];
  for(const [name,role] of [['Fixture owner','OWNER'],['Fixture advisor A','STAFF'],['Fixture advisor B','STAFF'],['Fixture advisor C','STAFF']])
    people.push(await User.create({...scope,name,role,email:randomUUID()+'@example.test',passwordHash:'synthetic-only',active:true}));
  const [owner,old,other,next]=people;
  const actor:Actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER',cashier:true};
  const call=(action:string,data:unknown)=>operate(actor,action,data,randomUUID());
  const customer:any=await call('customer',{name:'Synthetic transfer customer',phone:'0900000071'});
  const service:any=await call('service',{name:'Synthetic transfer service',price:1750000,duration:30});
  const template:any=await call('packageTemplate',{name:'Synthetic transfer package',serviceId:service.id,packageType:'SESSIONS',totalSessions:10,price:1750000});
  await call('openDay',{day:spaDay(),opening:0});
  const sale:any=await call('sellPackage',{customerId:customer.id,templateId:template.id,total:1750000,participantIds:[String(old._id),String(other._id)]});
  // Keep the real payment path and actual timestamps. A small delay after each
  // insert guarantees distinct milliseconds without rewriting ledger dates.
  const originalCreate=SharedSaleCommission.create;
  try {
    (SharedSaleCommission as any).create=async function(...args:any[]){
      const result=await (originalCreate as any).apply(SharedSaleCommission,args);
      await new Promise(resolve=>setTimeout(resolve,5));return result;
    };
    await call('payment',{invoiceId:sale.invoiceId,amount:1750000,method:'BANK_TRANSFER',receivedConfirmation:true,transferReference:'Synthetic bank evidence'});
  } finally {SharedSaleCommission.create=originalCreate;}
  const originalRows=await SharedSaleCommission.find({...scope,invoiceId:sale.invoiceId}).lean();
  assert.equal(originalRows.length,2);assert.notEqual(originalRows[0].earnedAt.getTime(),originalRows[1].earnedAt.getTime());
  const payment=(await Payment.findOne({...scope,invoiceId:sale.invoiceId}))!;
  assert.ok(originalRows.every(row=>row.sourceType==='PAYMENT' && String(row.sourceId)===String(payment._id)));
  const visit=await Appointment.create({...scope,customerId:customer.id,serviceId:service.id,staffId:other._id,treatmentId:sale.id,
    startAt:new Date(Date.now()-3600000),endAt:new Date(Date.now()-1800000),status:'CONFIRMED'});
  await call('completeTreatmentAppointment',{id:String(visit._id),signature:{version:1,strokes:[[[0.1,0.2],[0.4,0.5],[0.7,0.6]]]},remainingBefore:10});
  const immutable=async()=>({payments:await Payment.find(scope).lean(),receipts:await CashEntry.find(scope).lean(),treatments:await Treatment.find(scope).lean(),
    uses:await TreatmentUse.find(scope).select('+signature').lean(),sessions:await Invoice.find({...scope,kind:'SESSION'}).lean(),appointments:await Appointment.find(scope).lean()});
  const before=await immutable();assert.equal(before.uses.length,1);assert.ok(before.uses[0].signature);assert.equal(before.sessions[0].total,0);
  assert.equal(before.treatments[0].remaining,9);assert.equal(before.appointments[0].status,'COMPLETED');
  const month=spaDay().slice(0,7),prior=spaDay(new Date(new Date(month+'-01T00:00:00+07:00').getTime()-1)).slice(0,7);
  const drafts=[];
  for(const person of [old,other,next])for(const period of [month,prior]){
    const result:any=await call('savePayroll',{staffId:String(person._id),month:period,baseSalary:1000000});
    drafts.push((await Payroll.findById(result.id))!.toObject());
  }
  const invoice=(await Invoice.findById(sale.invoiceId))!;
  const data={id:sale.invoiceId,expectedUpdatedAt:invoice.updatedAt.toISOString(),expectedDocumentId:String(invoice._id),oldStaffId:String(old._id),newStaffId:String(next._id),reason:'Synthetic wrong package advisor'};
  const {reason,...previewData}=data;await call('previewPackageAdvisorReplacement',previewData);
  const result:any=await call('replacePackageAdvisor',data);
  assert.deepEqual(await immutable(),before);
  assert.equal(await Invoice.countDocuments(scope),2);
  const rows=await SharedSaleCommission.find({...scope,invoiceId:invoice._id}).lean();
  assert.equal(rows.reduce((sum,row)=>sum+row.amount,0),87500);
  for(const person of [old,other,next])assert.equal(rows.filter(row=>String(row.staffId)===String(person._id)).reduce((sum,row)=>sum+row.amount,0),person===old?0:43750);
  for(const row of originalRows){
    assert.deepEqual(rows.find(r=>String(r._id)===String(row._id)),row);
    const reversal=rows.find(r=>r.sourceType==='REPLACEMENT_REVERSAL' && String(r.sourceId)===String(row._id))!;
    assert.equal(reversal.earnedAt.getTime(),row.earnedAt.getTime());assert.equal(reversal.amount,-row.amount);
    assert.equal(String(reversal.paymentId),String(payment._id));
  }
  const grants=rows.filter(row=>row.sourceType==='REPLACEMENT');
  for(const row of grants){
    const original=originalRows.find(r=>String(r.staffId)===String(row.staffId)) || originalRows.find(r=>String(r.staffId)===String(old._id))!;
    assert.equal(row.earnedAt.getTime(),original.earnedAt.getTime());assert.equal(String(row.paymentId),String(payment._id));
  }
  assert.equal((await Invoice.findById(invoice._id))!.saleCommissionAccrued,87500);
  for(const draft of drafts){
    const after=(await Payroll.findById(draft._id))!;
    if(draft.month===month){assert.equal(after.needsRecalculation,true);await assert.rejects(call('approvePayroll',{id:String(after._id),expectedTotal:after.total}),/Cập nhật bản nháp/);}
    else {assert.deepEqual(after.toObject(),draft);await call('approvePayroll',{id:String(after._id),expectedTotal:after.total});}
  }
  const report=await readReport(actor,workspaceQuery(new URLSearchParams()));
  assert.equal(report.summary.total,1750000);assert.equal(report.summary.paid,1750000);assert.equal(report.summary.debt,0);assert.equal(report.inflow,1750000);
  assert.equal((await readCustomerHistory(actor,customer.id,'invoices',1)).total,2);
  assert.equal((await invoiceExport(actor,sale.invoiceId)).filename,result.code+'.pdf');
  // Legacy source has no issued code: keep its ObjectId identity separately.
  const legacy:any=await call('sellPackage',{customerId:customer.id,templateId:template.id,total:1750000,participantIds:[String(old._id)]});
  await call('payment',{invoiceId:legacy.invoiceId,amount:1750000,method:'BANK_TRANSFER',receivedConfirmation:true});
  await Invoice.updateOne({_id:legacy.invoiceId},{$unset:{code:1}});
  const legacyInvoice=(await Invoice.findById(legacy.invoiceId))!,legacyLabel=invoiceCode(legacyInvoice);
  await call('replacePackageAdvisor',{...data,id:legacy.invoiceId,expectedDocumentId:legacy.invoiceId,expectedUpdatedAt:legacyInvoice.updatedAt.toISOString()});
  const replaced=(await Invoice.findById(legacy.invoiceId))!;
  assert.equal(replaced.documentHistory[0].code,undefined);assert.equal(String(replaced.documentHistory[0].legacyInvoiceId),legacy.invoiceId);
  assert.equal(historicalInvoiceCode(replaced.documentHistory[0]),legacyLabel);
  const historyBefore=replaced.toObject().documentHistory,legacyImmutable=await immutable(),headId=String(replaced.activeDocumentId),headCode=replaced.effectiveCode;
  await backfillInvoiceCodes(spa._id);
  const migrated=(await Invoice.findById(legacy.invoiceId))!;
  assert.ok(migrated.code);assert.equal(migrated.effectiveCode,headCode);assert.equal(String(migrated.activeDocumentId),headId);
  assert.deepEqual(migrated.toObject().documentHistory,historyBefore);assert.deepEqual(await immutable(),legacyImmutable);
  assert.equal(historicalInvoiceCode(migrated.documentHistory[0]),legacyLabel);
  const sequence=(await Control.findOne(scope))!.invoiceSequence;
  assert.equal(await backfillInvoiceCodes(spa._id),0);assert.equal((await Control.findOne(scope))!.invoiceSequence,sequence);
}
