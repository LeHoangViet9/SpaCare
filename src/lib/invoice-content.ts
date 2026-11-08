import mongoose,{type ClientSession} from 'mongoose';
import {createHash} from 'node:crypto';
import {Allocation,Appointment,CashCard,CashCardUse,Commission,Customer,Invoice,InvoiceLineCommission,PackageTemplate,Payment,Payroll,Product,SaleCommission,Service,SharedSaleCommission,StockMovement,Treatment,TreatmentUse,User} from './models';
import {contentDisplayRecords,contentEqual,contentLineTotal,invoiceContentKinds,type InvoiceContentInput} from './invoice-content-rules';
import {ensure,MAX_MONEY,spaDay,packagePaymentDeadline} from './rules';
import {stockBalance} from './product-rules';
import {packageSnapshot,packageStartOnPurchase,treatmentUsed} from './treatment-rules';
import {saleablePackage} from './package-catalog';
import {assertTreatmentTemplateCompatible,treatmentEditRights} from './treatment-edit';

const plain=(v:any)=>JSON.parse(JSON.stringify(v?.toObject?.()||v));
const sid=(v:any)=>v?String(v):null;
const ledgerModels=[Commission,InvoiceLineCommission,SaleCommission,SharedSaleCommission];
export async function invoiceContentContext(spaId:string,invoice:any,session?:ClientSession){
  const scope={spaId};
  const rows=async(model:mongoose.Model<any>,filter:any={})=>model.find({...scope,...filter}).sort({_id:1}).session(session||null).lean();
  const plans=await rows(Treatment,{invoiceId:invoice._id});
  const uses=await rows(TreatmentUse,{$or:[{checkoutInvoiceId:invoice._id},{_id:invoice.treatmentUseId||null},{treatmentId:{$in:plans.map(p=>p._id)}}]});
  const appointments=await rows(Appointment,{$or:[{_id:invoice.appointmentId||null},{treatmentId:{$in:plans.map(p=>p._id)}},{treatmentIds:{$in:plans.map(p=>p._id)}}]});
  const payments=await rows(Payment,{invoiceId:invoice._id}),allocations=await rows(Allocation,{invoiceId:invoice._id}),cardUses=await rows(CashCardUse,{invoiceId:invoice._id});
  const gifts=await rows(Invoice,{giftOfInvoiceId:invoice._id}),giftCards=await rows(CashCard,{sourceInvoiceId:invoice._id});
  const movements=await rows(StockMovement,{$or:[{invoiceId:invoice._id},{checkoutInvoiceId:invoice._id}]});
  const ledgers:any[]=[];for(const model of ledgerModels)ledgers.push(...await rows(model,{invoiceId:invoice._id,cancelledAt:{$exists:false}}));
  const ids=ledgers.map(r=>r._id);
  const payrolls=ids.length?await rows(Payroll,{status:{$in:['DRAFT','APPROVED','PAID']},$or:[...['commissionIds','invoiceLineCommissionIds','saleCommissionIds','sharedSaleCommissionIds'].map(field=>({[field]:{$in:ids}})),...ledgers.filter(l=>l.earnedAt).map(l=>({staffId:l.staffId,month:spaDay(new Date(l.earnedAt)).slice(0,7)}))]}):[];
  const finalizedPayroll=payrolls.some(p=>p.status==='APPROVED'||p.status==='PAID')||ledgers.some(l=>l.payrollId&&!payrolls.some(p=>sid(p._id)===sid(l.payrollId)&&p.status==='DRAFT'));
  const settled=ledgers.some(r=>r.payrollId)||finalizedPayroll;
  const financialHistory=payments.length+allocations.length+cardUses.length>0||!!invoice.refunded||!!invoice.adjustmentCredit;
  const allocationHistory=[...payments,...allocations,...cardUses].some(r=>r.lineAllocations?.length)||['serviceItems','productItems','packageItems','treatmentSessions'].some(field=>(invoice[field]||[]).some((r:any)=>r.paid>0));
  const replaced=!!invoice.activeDocumentId;
  const performed=!!invoice.performedAt||!!invoice.treatmentUseId||uses.length>0||appointments.some(a=>a.status==='COMPLETED');
  const raw=plain(invoice),sessions=raw.treatmentSessions||[];
  const customer=await Customer.findOne({...scope,_id:invoice.customerId}).select('name phone').session(session||null).lean();
  const serviceRows=raw.serviceItems?.length?raw.serviceItems:raw.serviceId&&!['PACKAGE','PRODUCT','GIFT'].includes(raw.kind)&&!raw.treatmentId&&!raw.treatmentUseId?[{serviceId:raw.serviceId,name:raw.description,total:raw.total,commission:raw.commission||0,performerId:raw.performedBy}]:[];
  const productRows=raw.productItems?.length?raw.productItems:raw.productId?[{productId:raw.productId,name:raw.productName,unit:raw.productUnit,quantity:raw.quantity,unitPrice:raw.unitPrice,total:(raw.quantity||0)*(raw.unitPrice||0)}]:[];
  const packageRows=(raw.packageItems?.length?raw.packageItems:plans.length===1&&raw.kind==='PACKAGE'&&!serviceRows.length&&!productRows.length&&!sessions.length?[{treatmentId:String(plans[0]._id),templateId:sid(plans[0].templateId),serviceId:sid(plans[0].serviceId),name:plans[0].name,total:raw.total}]:[]).map((r:any)=>{
    const plan=plans.find(p=>sid(p._id)===sid(r.treatmentId));
    return {...r,packageType:r.packageType||plan?.packageType,totalSessions:r.totalSessions??plan?.totalSessions,durationMonths:r.durationMonths??plan?.durationMonths,startsOn:r.startsOn||plan?.startsOn,expiresOn:plan?.expiresOn};
  });
  const client={customerId:String(invoice.customerId),description:invoice.description||'',dueDate:invoice.dueDate||null,promotion:invoice.promotion||'',consultantId:sid(invoice.consultantId),
    participantIds:(invoice.saleParticipants?.length?invoice.saleParticipants.map((p:any)=>String(p.staffId)):invoice.sellerId?[String(invoice.sellerId)]:[]),
    serviceItems:serviceRows.map((r:any,index:number)=>({key:r.lineId||'service-'+index,sourceIndex:index,serviceId:String(r.serviceId),total:r.total,performerId:sid(r.performerId)})),
    productItems:productRows.map((r:any,index:number)=>({key:r.lineId||'product-'+index,sourceIndex:index,productId:String(r.productId),quantity:r.quantity,unitPrice:r.unitPrice})),
    packageItems:packageRows.map((r:any,index:number)=>({key:r.lineId||'package-'+index,sourceIndex:index,templateId:sid(r.templateId),total:r.total,promotion:r.promotion||'',...(r.totalSessions!==undefined?{totalSessions:r.totalSessions}:{}),...(r.durationMonths!==undefined?{durationMonths:r.durationMonths}:{}),...(r.startsOn?{startsOn:r.startsOn}:{}),...(r.expiresOn?{expiresOn:r.expiresOn}:{})}))};
  const unpricedPackages=plans.filter(p=>p.status!=='CANCELLED'&&!packageRows.some((r:any)=>sid(r.treatmentId)===sid(p._id)));
  const globalLock=unpricedPackages.length?'Gói cũ thiếu giá từng dòng; cần đối soát nguồn, không suy ra từ tổng hóa đơn.':invoice.kind==='GIFT'?'Quà đã phát hành; giữ nguồn quyền lợi.':replaced?'Chứng từ đã thay tư vấn: đối soát chuỗi chứng từ trước.':settled?'Hoa hồng đã thuộc lương chốt; không sửa nguồn tính lương.':allocationHistory?'Khoản thu có phân bổ dòng lịch sử; cần đối soát phân bổ trước.':'';
  const correctionScope=invoice.status!=='CANCELLED'&&(!invoice.kind||invoice.kind==='SERVICE')&&!invoice.treatmentId&&!invoice.treatmentUseId&&!invoice.appointmentId
    &&!plans.length&&!uses.length&&!appointments.length&&!packageRows.length&&!productRows.length&&!sessions.length&&!movements.length&&!gifts.length&&!giftCards.length&&!replaced&&!finalizedPayroll;
  const serviceLocks=serviceRows.map((r:any)=>{
    const linked=ledgers.some(l=>(!!r.lineId&&sid(l.lineId)===sid(r.lineId))||(!l.lineId&&serviceRows.length===1));
    const completed=!!invoice.performedAt||linked;
    const session=sessions.find((s:any)=>s.lineId&&sid(s.lineId)===sid(r.lineId));
    const use=session?.treatmentUseId&&uses.find((u:any)=>sid(u._id)===sid(session.treatmentUseId));
    const sessionCorrection=invoice.status!=='CANCELLED'&&invoice.kind==='SESSION'&&!!session?.lineId&&!!use?.performedAt
      &&sid(use.treatmentId)===sid(session.treatmentId)&&sid(use.staffId)===sid(r.performerId)&&sid(session.performerId||use.staffId)===sid(r.performerId)
      &&String(use.checkoutInvoiceId||invoice._id)===String(invoice._id)&&!use.appointmentId&&!appointments.length&&!productRows.length&&!packageRows.length&&!movements.length
      &&(linked||!(r.commission||0))
      &&!gifts.length&&!giftCards.length&&!replaced&&!finalizedPayroll;
    const correctionOnly=correctionScope&&completed||sessionCorrection;
    const blocked=finalizedPayroll?'Hoa hồng thuộc lương đã chốt; không thể đổi dịch vụ hoặc kỹ thuật viên.'
      :replaced?'Chứng từ đã thay tư vấn; đối soát chuỗi chứng từ trước khi đổi dịch vụ hoặc kỹ thuật viên.'
      :session?'Dòng thuộc buổi của gói; chỉ cho đổi KTV khi đủ nguồn đối soát. Dịch vụ, quyền lợi và số buổi được giữ nguyên.'
      :plans.length||uses.length||invoice.treatmentUseId?'Dòng thuộc gói/buổi; chưa có đối soát an toàn cho dịch vụ hoặc kỹ thuật viên.'
      :appointments.length?'Dịch vụ đã gắn lịch hẹn; xử lý lịch hẹn trước khi đổi dòng.'
      :gifts.length||giftCards.length?'Đã phát hành quà/thẻ; đối soát quyền lợi trước khi đổi dịch vụ hoặc kỹ thuật viên.'
      :packageRows.length||productRows.length||movements.length?'Hóa đơn có nội dung gói/sản phẩm hoặc phiếu kho; chưa có đối soát an toàn cho dịch vụ hoặc kỹ thuật viên.'
      :globalLock||(completed?'Dòng đã thực hiện/có hoa hồng nhưng chưa đủ nguồn để đính chính an toàn.':'');
    return {identity:correctionOnly?'':blocked,price:correctionOnly?'Đính chính không thay đổi giá dịch vụ.':globalLock,correctionOnly,technicianOnly:!!sessionCorrection};
  });
  const correctionOnly=serviceLocks.some((r:any)=>r.correctionOnly);
  const packageLocks=packageRows.map((r:any)=>{
    const plan=plans.find(p=>sid(p._id)===sid(r.treatmentId)),count=uses.filter(u=>sid(u.treatmentId)===sid(r.treatmentId)).length;
    return globalLock||(financialHistory?'Gói đã có giao dịch; sửa quyền lợi tại Sửa gói, giá qua điều chỉnh tổng.':gifts.length||giftCards.length?'Gói có quà đã cấp; đối soát chứng từ quà trước.':!plan?'Thiếu nguồn quyền lợi gốc; cần đối soát.':treatmentUsed(plan,count)>0?'Gói đã dùng buổi; giữ nguồn, dùng Sửa gói cho quyền lợi còn lại.':appointments.some(a=>sid(a.treatmentId)===sid(plan._id)||(a.treatmentIds||[]).some((id:any)=>sid(id)===sid(plan._id)))?'Gói đã có lịch hẹn; đối soát lịch trước.':'');
  });
  const catalogs={services:await rows(Service),products:await rows(Product),packageTemplates:await rows(PackageTemplate),staff:await rows(User,{role:{$in:['OWNER','STAFF']}}).then(people=>people.map(p=>({_id:p._id,name:p.name,role:p.role,active:p.active})))};
  const sessionSnapshots=sessions.map((r:any)=>{const use=uses.find(u=>sid(u._id)===sid(r.treatmentUseId));return {...r,recipientName:use?.recipientName,recipientPhone:use?.recipientPhone,performerName:catalogs.staff.find(p=>sid(p._id)===sid(r.performerId||use?.staffId))?.name};});
  return {client,customer,unpricedPackages:unpricedPackages.map(p=>({id:p._id,name:p.name})),source:{serviceItems:serviceRows,productItems:productRows,packageItems:packageRows,treatmentSessions:sessionSnapshots},
    locks:{correctionOnly,metadata:correctionOnly?'Chỉ đính chính dịch vụ hoặc kỹ thuật viên đã thực hiện.':replaced?'Chứng từ đã thay tư vấn; đối soát chuỗi chứng từ trước.':'',customer:'Khách hàng được giữ nguyên khi sửa hóa đơn.',
      consultant:correctionOnly?'Chỉ đính chính dịch vụ hoặc kỹ thuật viên đã thực hiện.':globalLock||(ledgers.length?'Đã có hoa hồng; đối soát người hưởng trước.':''),participants:correctionOnly?'Chỉ đính chính dịch vụ hoặc kỹ thuật viên đã thực hiện.':globalLock||(financialHistory||ledgers.length?'Dùng Thay người tư vấn bán gói để đối soát hoa hồng.':''),
      promotion:correctionOnly?'Chỉ đính chính dịch vụ hoặc kỹ thuật viên đã thực hiện.':gifts.length||giftCards.length?'Quà/thẻ đã phát hành; giữ nguồn khuyến mãi.':'',services:serviceLocks,products:globalLock,packages:packageLocks,
      treatmentSessions:sessions.length?(serviceLocks.some((r:any)=>r.technicianOnly)?'Chỉ đính chính KTV; dịch vụ, số buổi, chữ ký và thời điểm thực hiện được giữ nguyên.':'Buổi thuộc gói/quyền lợi; chưa có luồng đính chính an toàn cho dịch vụ hoặc kỹ thuật viên. Giữ nguyên số buổi, chữ ký và thời điểm thực hiện.'):'',
      addService:globalLock||(performed||appointments.length?'Đã có thực hiện/lịch hẹn; không thêm lượt thực hiện qua sửa nội dung.':''),addPackage:globalLock||(financialHistory||performed||ledgers.length?'Có lịch sử tiền/thực hiện; không cấp thêm gói qua sửa nội dung.':'')},
    lineTotal:contentLineTotal(client,sessions),totalAdjustment:invoice.total-contentLineTotal(client,sessions),catalogs,
    references:{plans,uses,appointments,payments,allocations,cardUses,gifts,giftCards,movements,ledgers,payrolls}};
}

export async function prepareInvoiceContent(spaId:string,invoice:any,input:InvoiceContentInput,total:number,session:ClientSession,issuedOn=spaDay(invoice.createdAt)){
  const context=await invoiceContentContext(spaId,invoice,session),{client,locks,catalogs,source,references}=context;
  const patch:Record<string,any>={},changedFields:string[]=[],planChanges:any[]=[],stockChanges:any[]=[];
  const serviceCommissionChanges:any[]=[],serviceCorrections:any[]=[],useChanges:any[]=[];
  const after=plain(client),customerName=context.customer?.name;
  const set=(field:string,value:any)=>{if(!contentEqual((invoice as any)[field],value)){patch[field]=value;changedFields.push(field);}};
  const validatePerson=(id:string)=>{const person=catalogs.staff.find(p=>String(p._id)===id);ensure(person?.active,'Nhân sự đã ngừng hoạt động hoặc ngoài spa.',409);return person;};
  ensure(input.customerId===undefined||input.customerId===client.customerId,'Không đổi khách hàng khi sửa hóa đơn.',409);
  for(const field of ['description','dueDate','promotion'] as const)if(input[field]!==undefined&&!contentEqual(input[field],client[field])){
    ensure(!locks.metadata,locks.metadata,409);
    if(field==='promotion')ensure(!locks.promotion,locks.promotion,409);
    set(field,input[field]===null?undefined:input[field]);after[field]=input[field];
  }
  if(input.consultantId!==undefined&&input.consultantId!==client.consultantId){ensure(!locks.consultant,locks.consultant,409);const person=input.consultantId?validatePerson(input.consultantId):null;set('consultantId',person?._id);set('consultantName',person?.name);after.consultantId=input.consultantId;}
  if(input.participantIds!==undefined&&!contentEqual(input.participantIds,client.participantIds)){
    ensure(source.packageItems.length>0,'Hóa đơn không có gói dịch vụ để sửa người tư vấn bán gói.',409);
    ensure(input.participantIds.length>0,'Cần ít nhất một người tư vấn bán gói.');
    ensure(!locks.participants,locks.participants,409);const people=input.participantIds.map(validatePerson);
    set('saleParticipants',people.map(p=>({staffId:p!._id,staffName:p!.name})));set('sellerId',people[0]!._id);set('sellerName',people[0]!.name);set('saleCommissionVersion',people.length>1?2:1);set('saleCommissionAccrued',0);after.participantIds=input.participantIds;
  }
  const lineId=(kind:string,row:any)=>new mongoose.Types.ObjectId(createHash('sha256').update(String(invoice._id)+':'+invoice.updatedAt.toISOString()+':'+kind+':'+row.key).digest('hex').slice(0,24));
  for(const kind of ['serviceItems','productItems','packageItems'] as const){
    const requested=input[kind];if(requested===undefined||contentEqual(requested,client[kind]))continue;
    ensure(invoiceContentKinds(source).includes(kind),'Chỉ sửa loại nội dung đã có trong hóa đơn; không thêm chéo dịch vụ, sản phẩm hoặc gói.',409);
    if(kind==='serviceItems'&&locks.correctionOnly)ensure(requested.length===client.serviceItems.length&&requested.every((row,index)=>row.sourceIndex===index),'Không được thêm, bỏ hoặc đổi thứ tự dịch vụ đã thực hiện.',409);
    ensure(new Set(requested.map(r=>r.key)).size===requested.length,'Không lặp mã dòng trong hóa đơn.');
    const indices=requested.filter(r=>r.sourceIndex!==undefined).map(r=>r.sourceIndex);
    ensure(new Set(indices).size===indices.length&&indices.every(i=>i!==undefined&&i<source[kind].length),'Dòng nguồn không thuộc hóa đơn.',409);
    const output:any[]=[];
    for(const old of client[kind])if(!requested.some(r=>r.sourceIndex===old.sourceIndex)){
      const reason=kind==='serviceItems'?locks.services[old.sourceIndex!]?.identity:kind==='productItems'?locks.products:locks.packages[old.sourceIndex!];ensure(!reason,reason,409);
      if(kind==='packageItems')planChanges.push({id:source.packageItems[old.sourceIndex!].treatmentId,remove:true});
    }
    for(const row of requested){
      const index=row.sourceIndex,old=index===undefined?undefined:source[kind][index],oldClient=index===undefined?undefined:client[kind][index];
      if(oldClient&&contentEqual(row,oldClient)){const {expiresOn:_,...snapshot}=old;output.push(kind==='packageItems'?snapshot:old);continue;}
      if(kind==='serviceItems'){
        const item=row as NonNullable<InvoiceContentInput['serviceItems']>[number];
        const identity=!!old&&(sid(old.serviceId)!==item.serviceId||sid(old.performerId)!==(item.performerId||null));
        const serviceChanged=sid(old?.serviceId)!==item.serviceId;
        const rowLock=locks.services[index!],correction=!!old&&!!rowLock?.correctionOnly;
        const reason=old?(identity?rowLock?.identity:rowLock?.price):locks.addService;ensure(!reason,reason,409);
        if(locks.correctionOnly)ensure(correction&&identity&&item.total===oldClient.total,'Luồng này chỉ cho đính chính dịch vụ hoặc kỹ thuật viên đã thực hiện.',409);
        const linkedSession=rowLock?.technicianOnly?source.treatmentSessions.find((s:any)=>sid(s.lineId)===sid(old?.lineId)):undefined;
        const linkedUse=linkedSession&&references.uses.find((u:any)=>sid(u._id)===sid(linkedSession.treatmentUseId));
        if(rowLock?.technicianOnly){
          ensure(linkedSession&&linkedUse&&!serviceChanged,'Buổi không còn đủ nguồn để chỉ đính chính KTV.',409);
          ensure(sid(linkedUse.staffId)===oldClient.performerId&&sid(linkedSession.performerId||linkedUse.staffId)===oldClient.performerId,'KTV gốc của buổi không khớp dòng hóa đơn; cần đối soát trước.',409);
        }
        const service=catalogs.services.find(s=>String(s._id)===item.serviceId);ensure(service&&(service.active||!!old&&sid(old.serviceId)===item.serviceId),'Dịch vụ không còn khả dụng trong spa.',409);
        if(item.performerId&&sid(old?.performerId)!==item.performerId)validatePerson(item.performerId);
        const performerId=item.performerId||null,performerChanged=sid(old?.performerId)!==performerId;
        const commission=correction?(performerId?(serviceChanged?service.commission||0:old.commission??service.commission??0):0):old&&!identity?old.commission||0:service.commission||0;
        if(correction&&identity){
          const roots=new Set<string>(references.ledgers.filter((l:any)=>(!!old.lineId&&sid(l.lineId)===sid(old.lineId))||(!l.lineId&&source.serviceItems.length===1)).map((l:any)=>String(l._id)));
          let expanded=true;
          while(expanded){expanded=false;for(const l of references.ledgers)if(l.originalLedgerIds?.some((id:any)=>roots.has(String(id)))&&!roots.has(String(l._id))){roots.add(String(l._id));expanded=true;}}
          const linked=references.ledgers.filter((l:any)=>roots.has(String(l._id)));
          const currentByStaff=new Map<string,number>();
          for(const l of linked){const staffId=String(l.staffId);currentByStaff.set(staffId,(currentByStaff.get(staffId)||0)+l.amount);}
          const expectedByStaff=new Map<string,number>();
          if(oldClient.performerId&&(old.commission??0))expectedByStaff.set(String(oldClient.performerId),old.commission??0);
          ensure(contentEqual([...currentByStaff].filter(([,amount])=>amount).sort(),[...expectedByStaff].filter(([,amount])=>amount).sort()),'Hoa hồng gốc của dòng không khớp; cần đối soát trước khi đính chính.',409);
          const desiredByStaff=new Map<string,number>();
          if(performerId&&commission)desiredByStaff.set(performerId,commission);
          serviceCorrections.push({lineId:old.lineId||lineId(kind,row),before:{serviceId:oldClient.serviceId,performerId:oldClient.performerId,performerName:catalogs.staff.find(p=>sid(p._id)===oldClient.performerId)?.name,total:oldClient.total,commission:old.commission||0},after:{serviceId:item.serviceId,performerId,performerName:catalogs.staff.find(p=>sid(p._id)===performerId)?.name,total:item.total,commission},serviceName:service.name,
            ...(rowLock?.technicianOnly?{treatmentUseId:linkedSession.treatmentUseId}: {})});
          if(rowLock?.technicianOnly&&performerChanged){
            useChanges.push({id:linkedUse._id,treatmentId:linkedUse.treatmentId,before:{staffId:oldClient.performerId,sessionNumber:linkedUse.sessionNumber,performedAt:linkedUse.performedAt},after:{staffId:performerId,sessionNumber:linkedUse.sessionNumber,performedAt:linkedUse.performedAt}});
            const updatedSessions=(invoice.treatmentSessions||[]).map((s:any)=>sid(s.lineId)===sid(linkedSession.lineId)?{...plain(s),performerId:performerId?new mongoose.Types.ObjectId(performerId):undefined}:plain(s));
            set('treatmentSessions',updatedSessions);
          }
          const sourceMonth=linked.filter((l:any)=>l.earnedAt).map((l:any)=>spaDay(new Date(l.earnedAt)).slice(0,7)).sort()[0];
          const staffIds=new Set([...currentByStaff.keys(),...desiredByStaff.keys()]);
          for(const staffId of staffIds){
            const delta=(desiredByStaff.get(staffId)||0)-(currentByStaff.get(staffId)||0);if(!delta)continue;
            const staff=catalogs.staff.find((p:any)=>sid(p._id)===staffId),prior=linked.find((l:any)=>sid(l.staffId)===staffId);
            const draft=sourceMonth?await Payroll.findOne({spaId,staffId,month:sourceMonth,status:'DRAFT'}).session(session).lean():null;
            serviceCommissionChanges.push({staffId,staffName:staff?.name||prior?.staffName||'Nhân viên',serviceId:item.serviceId,serviceName:service.name,amount:delta,delta,ids:linked.map((l:any)=>l._id),category:'SERVICE',...(draft?{commissionMonth:sourceMonth}:{})});
          }
        }
        output.push({...old,lineId:correction?(old.lineId||lineId(kind,row)):old?.lineId&&!identity?old.lineId:lineId(kind,row),serviceId:item.serviceId,name:old&&!serviceChanged?old.name:service.name,total:item.total,commission,performerId:performerId||undefined});
        if(correction&&(serviceChanged||performerChanged)&&source.serviceItems.length===1&&invoice.performedAt)set('performedBy',performerId?new mongoose.Types.ObjectId(performerId):undefined);
      }else if(kind==='productItems'){
        ensure(!locks.products,locks.products,409);const item=row as NonNullable<InvoiceContentInput['productItems']>[number];
        const product=catalogs.products.find(p=>String(p._id)===item.productId);ensure(product&&(product.active||sid(old?.productId)===item.productId),'Sản phẩm không còn khả dụng trong spa.',409);
        ensure(Number.isSafeInteger(item.quantity*item.unitPrice)&&item.quantity*item.unitPrice<=MAX_MONEY,'Tổng dòng sản phẩm vượt giới hạn.');
        output.push({...old,lineId:old?.lineId&&sid(old.productId)===item.productId?old.lineId:lineId(kind,row),productId:item.productId,name:sid(old?.productId)===item.productId?old.name:product.name,unit:product.unit,quantity:item.quantity,unitPrice:item.unitPrice,total:item.quantity*item.unitPrice});
      }else{
        const reason=old?locks.packages[index!]:locks.addPackage;ensure(!reason,reason,409);
        const item=row as NonNullable<InvoiceContentInput['packageItems']>[number],plan=old?references.plans.find(p=>sid(p._id)===sid(old.treatmentId)):undefined;
        const template=item.templateId?catalogs.packageTemplates.find(t=>String(t._id)===item.templateId):undefined;
        ensure(template||plan,'Chọn gói dịch vụ có trong danh mục.',409);
        const serviceId=sid(template?.serviceId||plan?.serviceId),service=catalogs.services.find(s=>String(s._id)===serviceId);
        if(template)ensure(saleablePackage(template,service),'Gói dịch vụ đã ngừng bán.',409);
        const definition=template||plan!,type=definition.packageType||'SESSIONS';
        if(plan)assertTreatmentTemplateCompatible(plan,definition,0);
        ensure(!item.startsOn||!item.expiresOn||item.startsOn<=item.expiresOn,'Ngày hết hạn phải từ ngày bắt đầu.');
        ensure(!old?.giftCashCardAmount&&!(old&&references.gifts.some(g=>sid(g.giftOfTreatmentId)===sid(old.treatmentId))),'Gói có quà đã cấp; đối soát chứng từ quà trước khi thay nguồn.',409);
        const startsOn=plan?item.startsOn:packageStartOnPurchase(definition,service?.category,issuedOn,item.startsOn);
        const rights=plan?treatmentEditRights(plan,item,0):packageSnapshot({...definition,...item},startsOn);
        const treatmentId=old?.treatmentId||lineId('treatment',row);
        const values={...rights,name:definition.name,serviceId,templateId:template?._id||plan?.templateId,startsOn,expiresOn:plan?item.expiresOn:(rights as any).expiresOn};
        planChanges.push({id:treatmentId,before:plan,values});
        const {expiresOn:_,...snapshot}=old||{};
        output.push({...snapshot,lineId:old?.lineId||lineId(kind,row),treatmentId,templateId:values.templateId,serviceId,name:definition.name,total:item.total,promotion:item.promotion||'',packageType:type,totalSessions:(rights as any).totalSessions,durationMonths:(rights as any).durationMonths,startsOn:values.startsOn,sellerId:patch.sellerId||invoice.sellerId,sellerName:patch.sellerName||invoice.sellerName});
      }
    }
    // Preserve zero-value mirrored session rows outside editable services.
    const saved=kind==='serviceItems'?[...output,...(invoice.serviceItems||[]).filter((r:any)=>source.treatmentSessions.some((s:any)=>s.lineId&&sid(s.lineId)===sid(r.lineId)&&s.total===0&&r.total===0)&&!output.some((line:any)=>line.lineId&&sid(line.lineId)===sid(r.lineId))).map(plain)]:output;
    set(kind,saved);after[kind]=requested;
    if(kind==='productItems'){
      const quantities=(lines:any[])=>{const map=new Map<string,number>();for(const r of lines)map.set(String(r.productId),(map.get(String(r.productId))||0)+r.quantity);return map;};
      const oldCounts=quantities(source.productItems),newCounts=quantities(output);
      for(const productId of new Set([...oldCounts.keys(),...newCounts.keys()])){
        const delta=(newCounts.get(productId)||0)-(oldCounts.get(productId)||0);if(!delta)continue;
        const net=references.movements.filter(m=>sid(m.productId)===productId).reduce((n,m)=>n+(m.direction==='OUT'?m.quantity:-m.quantity),0);
        ensure(net===(oldCounts.get(productId)||0),'Phiếu kho không khớp dòng sản phẩm; cần đối soát trước khi đổi số lượng.',409);
        const product=catalogs.products.find(p=>String(p._id)===productId);ensure(product,'Thiếu sản phẩm nguồn để đối soát kho.',409);
        stockChanges.push({productId,quantity:Math.abs(delta),direction:delta>0?'OUT':'IN',before:product.stock,after:stockBalance(product.stock,delta>0?'OUT':'IN',Math.abs(delta))});
      }
      if(invoice.productId)for(const field of ['productId','productName','productSku','productUnit','quantity','unitPrice'])set(field,undefined);
    }
  }
  if(patch.saleParticipants&&after.packageItems.length){
    ensure(!locks.participants,locks.participants,409);
    const items=(patch.packageItems||source.packageItems).map((r:any)=>{const {expiresOn:_,...snapshot}=r;return {...snapshot,sellerId:patch.sellerId,sellerName:patch.sellerName};});set('packageItems',items);
  }
  if(after.packageItems.length&&(changedFields.includes('dueDate')||planChanges.some(p=>!p.before&&!p.remove)))packagePaymentDeadline(after.dueDate||undefined,issuedOn);
  if(['serviceItems','productItems','packageItems'].some(k=>changedFields.includes(k))){
    ensure(after.serviceItems.length+after.productItems.length+after.packageItems.length+source.treatmentSessions.length>0,'Hóa đơn phải còn dòng nội dung; dùng Vô hiệu hóa nếu toàn bộ chứng từ sai.',409);
    if(after.packageItems.length){ensure((patch.saleParticipants||invoice.saleParticipants||[]).length||patch.sellerId||invoice.sellerId,'Chọn người tư vấn khi thêm gói.',409);set('kind','PACKAGE');}
    else if(!source.treatmentSessions.length&&!invoice.treatmentUseId)set('kind',after.serviceItems.length?'SERVICE':'PRODUCT');
    if(changedFields.includes('serviceItems')){set('serviceId',patch.serviceItems.length===1?patch.serviceItems[0].serviceId:undefined);set('commission',patch.serviceItems.reduce((n:number,r:any)=>n+(r.commission||0),0));}
    const hasPackage=after.packageItems.length>0,hasOther=after.serviceItems.length+after.productItems.length+source.treatmentSessions.length>0;
    ensure(!(hasPackage&&hasOther&&(references.ledgers.length||references.payments.length||references.allocations.length||references.cardUses.length)),'Hóa đơn hỗn hợp có tiền/hoa hồng: cần đối soát phân bổ trước khi đổi dòng.',409);
  }
  const display=(record:any,customerName:any,changes:any[]=[])=>({...record,customerName,
    ...Object.fromEntries(['serviceItems','productItems','packageItems','treatmentSessions'].map(kind=>[kind,
      (record[kind]||source[kind as keyof typeof source]).map((r:any)=>{
        const plan=kind==='packageItems'?(changes.find(c=>sid(c.id)===sid(r.treatmentId))?.values||references.plans.find(p=>sid(p._id)===sid(r.treatmentId))):undefined;
        return {...r,...(plan?{expiresOn:plan.expiresOn,totalSessions:r.totalSessions??plan.totalSessions,durationMonths:r.durationMonths??plan.durationMonths}:{}),performerName:catalogs.staff.find(p=>sid(p._id)===sid(r.performerId))?.name||r.performerName};
      })]))});
  // Use the edit form's canonical legacy rows in both columns. Apply the patch last
  // so an explicit empty array after removing rows never falls back to old content.
  const displayRecords=contentDisplayRecords(plain(invoice),source,patch);
  return {patch,changedFields,stockChanges,planChanges,serviceCorrections,useChanges,serviceCommissionChanges,before:client,after,displayBefore:display(displayRecords.before,context.customer?.name),displayAfter:display(displayRecords.after,customerName,planChanges),lineTotal:contentLineTotal(after,source.treatmentSessions),totalAdjustment:total-contentLineTotal(after,source.treatmentSessions),context};
}

export async function applyInvoiceContent(actor:{spaId:string;id:string;name:string},invoice:any,prepared:Awaited<ReturnType<typeof prepareInvoiceContent>>,session:ClientSession,evidence:{reason:string;adjustmentId:unknown}){
  const scope={spaId:actor.spaId};
  for(const change of prepared.stockChanges){
    const product=await Product.findOne({...scope,_id:change.productId}).session(session);ensure(product&&product.stock===change.before,'Tồn kho đã thay đổi. Xem trước lại.',409);
    product.stock=change.after;await product.save({session});
    await StockMovement.create([{...scope,productId:product._id,productName:product.name,sku:product.sku,unit:product.unit,actorId:actor.id,actorName:actor.name,checkoutInvoiceId:invoice._id,direction:change.direction,kind:'MANUAL',quantity:change.quantity,before:change.before,after:change.after,reason:`Điều chỉnh #${evidence.adjustmentId}: ${evidence.reason}`}],{session});
  }
  for(const change of prepared.planChanges){
    if(change.before||change.remove){const plan=await Treatment.findOne({...scope,_id:change.id,invoiceId:invoice._id}).session(session);ensure(plan,'Không tìm thấy nguồn gói.',409);Object.assign(plan,change.remove?{status:'CANCELLED'}:change.values);await plan.save({session});}
    else await Treatment.create([{...scope,_id:change.id,invoiceId:invoice._id,customerId:prepared.patch.customerId||invoice.customerId,...change.values}],{session});
  }
  for(const change of prepared.useChanges){
    const use=await TreatmentUse.findOne({...scope,_id:change.id,treatmentId:change.treatmentId}).session(session);
    ensure(use&&sid(use.checkoutInvoiceId||invoice._id)===sid(invoice._id)&&sid(use.staffId)===change.before.staffId
      &&use.sessionNumber===change.before.sessionNumber&&new Date(use.performedAt).toISOString()===new Date(change.before.performedAt).toISOString(),'Lịch sử buổi đã thay đổi. Tải lại và đối soát trước khi đính chính.',409);
    use.staffId=change.after.staffId?new mongoose.Types.ObjectId(change.after.staffId):undefined;
    await use.save({session});
  }
  for(const [field,value]of Object.entries(prepared.patch))invoice[field]=value;
}
