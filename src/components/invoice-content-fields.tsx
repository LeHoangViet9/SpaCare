'use client';
import SaleParticipants from './sale-participants';
import {saleablePackageTemplates} from '@/lib/package-catalog';
import {packageExpiry,treatmentDay} from '@/lib/treatment-rules';
import {contentEqual,contentLineTotal,invoiceContentKinds} from '@/lib/invoice-content-rules';
import {formatCurrency as money} from '@/lib/currency';
type Row=Record<string,any>;
export function invoiceContentPatch(original:Row,edited:Row){
  const kinds=invoiceContentKinds(original);
  return Object.fromEntries(Object.entries(edited).filter(([key,value])=>key!=='customerId'&&
    (!['serviceItems','productItems','packageItems'].includes(key)||kinds.includes(key as typeof kinds[number]))&&
    (key!=='participantIds'||kinds.includes('packageItems'))&&!contentEqual(original[key],value)));
}
export default function InvoiceContentFields({context,value,onChange,disabled,invoice}:{context:Row;value:Row;onChange:(next:Row)=>void;disabled:boolean;invoice:Row}){
  const {catalogs,locks,source}=context;
  const kinds=invoiceContentKinds(source);
  const templates=saleablePackageTemplates<Row>(catalogs.packageTemplates,catalogs.services);
  // Retain an inactive original advisor for no-op edits; the server still rejects new inactive assignments.
  const advisorOptions=catalogs.staff.map((p:Row)=>context.client.participantIds.includes(p._id)&&!p.active?{...p,active:true,name:p.name+' (ngừng hoạt động)'}:p);
  const set=(patch:Row)=>onChange({...value,...patch});
  const update=(kind:string,key:string,patch:Row)=>set({[kind]:value[kind].map((r:Row)=>r.key===key?{...r,...patch}:r)});
  const remove=(kind:string,key:string)=>set({[kind]:value[kind].filter((r:Row)=>r.key!==key)});
  const add=(kind:string)=>{
    const base={key:crypto.randomUUID()},first=templates[0],startsOn=treatmentDay();
    const row=kind==='serviceItems'?{...base,serviceId:'',total:0,performerId:null}:kind==='productItems'?{...base,productId:'',quantity:1,unitPrice:0}:
      {...base,templateId:first?._id||null,total:first?.price||0,promotion:'',...(first?.packageType==='TIME'?{durationMonths:first.durationMonths,startsOn,expiresOn:packageExpiry(startsOn,first.durationMonths)}:{totalSessions:first?.totalSessions||1})};
    set({[kind]:[...value[kind],row],...(kind==='packageItems'&&!value.participantIds.length?{participantIds:['']}:{})});
  };
  const options=(rows:Row[],current:string)=>rows.filter(r=>r.active||r._id===current);
  const number=(label:string,current:number,onValue:(v:number)=>void,min=0,locked=false)=><label>{label}<input type="number" required min={min} max={1_000_000_000_000} step={1} value={current} disabled={disabled||locked} onChange={e=>onValue(Number(e.target.value))}/></label>;
  return <section className="invoice-content-fields" aria-label="Nội dung hóa đơn sau sửa">
    {!!context.unpricedPackages?.length&&<p role="status">Gói cũ thiếu giá từng dòng: {context.unpricedPackages.map((p:Row)=>p.name).join(', ')}. Cần đối soát nguồn trước khi sửa dòng.</p>}
    <label>Nội dung<input required maxLength={500} value={value.description} disabled={disabled||!!locks.metadata} onChange={e=>set({description:e.target.value})}/></label>
    <div className="invoice-adjustment-fields">
      <label>Hạn thanh toán<input type="date" value={value.dueDate||''} disabled={disabled||!!locks.metadata} onChange={e=>set({dueDate:e.target.value||null})}/></label>
      {!!context.client.consultantId&&<label>Người tư vấn khách hàng<select aria-label="Người tư vấn khách hàng" value={value.consultantId||''} disabled={disabled||!!locks.consultant} onChange={e=>set({consultantId:e.target.value||null})}><option value="">Chưa chọn</option>{catalogs.staff.filter((p:Row)=>p.active||p._id===value.consultantId).map((p:Row)=><option key={p._id} value={p._id}>{p.name}</option>)}</select>{locks.consultant&&<small>{locks.consultant}</small>}</label>}
    </div>
    {!!context.client.promotion&&<label>Đợt khuyến mãi<input maxLength={2000} value={value.promotion} disabled={disabled||!!locks.promotion||!!locks.metadata} onChange={e=>set({promotion:e.target.value})}/>{locks.promotion&&<small>{locks.promotion}</small>}</label>}
    {kinds.map(kind=><section key={kind} aria-label={kind==='serviceItems'?'Dịch vụ':kind==='productItems'?'Sản phẩm':'Gói dịch vụ'}>
      <div className="section-head"><h3>{kind==='serviceItems'?'Dịch vụ':kind==='productItems'?'Sản phẩm':'Gói dịch vụ'}</h3>{!(kind==='serviceItems'?locks.addService:kind==='productItems'?locks.products:locks.addPackage)&&<button type="button" disabled={disabled||value[kind].length>=30} onClick={()=>add(kind)}>+ {kind==='serviceItems'?'Dịch vụ':kind==='productItems'?'Sản phẩm':'Gói'}</button>}</div>
      {value[kind].map((row:Row,index:number)=>{
        const old=row.sourceIndex===undefined?null:source[kind][row.sourceIndex];
        const correctionOnly=kind==='serviceItems'&&!!locks.services[row.sourceIndex]?.correctionOnly;
        const technicianOnly=kind==='serviceItems'&&!!locks.services[row.sourceIndex]?.technicianOnly;
        const lock=kind==='serviceItems'?(row.sourceIndex===undefined?locks.addService:correctionOnly?'':locks.services[row.sourceIndex]?.identity):kind==='productItems'?locks.products:row.sourceIndex===undefined?locks.addPackage:locks.packages[row.sourceIndex];
        const priceLock=kind==='serviceItems'?locks.services[row.sourceIndex]?.price:lock;
        const catalog=kind==='serviceItems'?catalogs.services:kind==='productItems'?catalogs.products:templates;
        const field=kind==='serviceItems'?'serviceId':kind==='productItems'?'productId':'templateId',selected=catalog.find((r:Row)=>r._id===row[field]);
        const name=old&&row[field]===context.client[kind][row.sourceIndex]?.[field]?old.name:selected?.name||'Chưa chọn';
        const time=kind==='packageItems'&&(selected?.packageType||old?.packageType)==='TIME';
        if(old&&lock)return <div className="invoice-content-row" key={row.key} role="group" aria-label={`${kind==='serviceItems'?'Dịch vụ':kind==='productItems'?'Sản phẩm':'Gói'} ${index+1}`}>
          <strong>{index+1}. {name}</strong><p>{money(kind==='productItems'?row.quantity*row.unitPrice:row.total)}{kind==='serviceItems'&&` · KTV: ${catalogs.staff.find((p:Row)=>p._id===row.performerId)?.name||'Chưa có'}`}{kind==='productItems'&&` · ${row.quantity} × ${money(row.unitPrice)}`}{kind==='packageItems'&&(time?` · ${row.durationMonths} tháng · ${row.startsOn||'—'} – ${row.expiresOn||'—'}`:` · ${row.totalSessions} buổi`)}</p>
          <small className="invoice-content-lock">{kind==='serviceItems'&&lock.includes('đã thực hiện')?'Đã thực hiện/có hoa hồng · Chỉ xem.':kind==='packageItems'&&lock.includes('đã dùng')?'Đã dùng buổi · Chỉ xem.':lock}</small>
        </div>;
        return <div className="invoice-content-row" key={row.key} role="group" aria-label={`${kind==='serviceItems'?'Dịch vụ':kind==='productItems'?'Sản phẩm':'Gói'} ${index+1}`}>
          <div className="section-head"><strong>{index+1}. {name}</strong>{!correctionOnly&&<button type="button" disabled={disabled||!!lock} onClick={()=>remove(kind,row.key)}>Bỏ dòng</button>}</div>
          {lock&&<small className="invoice-content-lock">{lock}</small>}
          <label>{kind==='serviceItems'?'Dịch vụ':kind==='productItems'?'Sản phẩm':'Gói dịch vụ'}<select aria-label={kind==='serviceItems'?'Dịch vụ':kind==='productItems'?'Sản phẩm':'Gói dịch vụ'} required={!(old&&!row[field])} value={row[field]||''} onChange={e=>{
            const chosen=catalog.find((r:Row)=>r._id===e.target.value),patch:Row={[field]:e.target.value};
            if(kind==='productItems')patch.unitPrice=chosen?.price||0;
            else patch.total=correctionOnly?row.total:chosen?.price||0;
            if(kind==='packageItems'){
              const next={key:row.key,...(row.sourceIndex===undefined?{}:{sourceIndex:row.sourceIndex}),...patch,promotion:row.promotion||''};
              if(chosen?.packageType==='TIME')Object.assign(next,{durationMonths:chosen.durationMonths,startsOn:row.startsOn||treatmentDay(),expiresOn:packageExpiry(row.startsOn||treatmentDay(),chosen.durationMonths)});
              else Object.assign(next,{totalSessions:chosen?.totalSessions||1});
              set({[kind]:value[kind].map((r:Row)=>r.key===row.key?next:r)});
            }else update(kind,row.key,patch);
          }} disabled={disabled||!!lock||technicianOnly}><option value="">{old&&!row[field]?old.name+' (nguồn cũ)':'Chọn…'}</option>{old&&row[field]&&!catalog.some((r:Row)=>r._id===row[field])&&<option value={row[field]}>{old.name} (nguồn cũ)</option>}{options(catalog,row[field]).map((r:Row)=><option key={r._id} value={r._id}>{r.name}</option>)}</select></label>
          <div className="invoice-adjustment-fields">
            {kind==='productItems'?<>{number('Số lượng',row.quantity,n=>update(kind,row.key,{quantity:n}),1,!!lock)}{number('Đơn giá (VNĐ)',row.unitPrice,n=>update(kind,row.key,{unitPrice:n}),0,!!lock)}</>:number(kind==='serviceItems'?'Giá dịch vụ (VNĐ)':'Giá gói (VNĐ)',row.total,n=>update(kind,row.key,{total:n}),0,!!priceLock)}
            {kind==='serviceItems'&&<label>Kỹ thuật viên<select aria-label="Kỹ thuật viên" required={correctionOnly} value={row.performerId||''} disabled={disabled||!!lock} onChange={e=>update(kind,row.key,{performerId:e.target.value||null})}><option value="">Chưa chọn</option>{catalogs.staff.filter((p:Row)=>p.active||p._id===row.performerId).map((p:Row)=><option key={p._id} value={p._id}>{p.name}</option>)}</select></label>}
            {kind==='packageItems'&&(time?<>{number('Số tháng',row.durationMonths,n=>update(kind,row.key,{durationMonths:n}),1,!!lock)}<label>Ngày bắt đầu<input type="date" required disabled={disabled||!!lock} value={row.startsOn||''} onChange={e=>update(kind,row.key,{startsOn:e.target.value,expiresOn:e.target.value?packageExpiry(e.target.value,row.durationMonths):''})}/></label><label>Ngày hết hạn<input type="date" required min={row.startsOn} disabled={disabled||!!lock} value={row.expiresOn||''} onChange={e=>update(kind,row.key,{expiresOn:e.target.value})}/></label></>:number('Tổng số buổi',row.totalSessions,n=>update(kind,row.key,{totalSessions:n}),1,!!lock))}
          </div>
          {kind==='packageItems'&&<><label>Khuyến mãi gói<input maxLength={2000} value={row.promotion||''} disabled={disabled||!!lock} onChange={e=>update(kind,row.key,{promotion:e.target.value})}/></label>{!!old?.giftCashCardAmount&&<p>Thẻ tiền tặng: {money(old.giftCashCardAmount)} · Giữ chứng từ đã cấp.</p>}</>}
          <p className="invoice-content-subtotal">Thành tiền: <strong>{money(kind==='productItems'?row.quantity*row.unitPrice:row.total)}</strong></p>
        </div>;
      })}
    </section>)}
    {!!value.packageItems.length&&(locks.participants||locks.packages.some(Boolean)?<p>Người tư vấn gói: {value.participantIds.map((id:string)=>invoice.saleParticipants?.find((p:Row)=>p.staffId===id)?.staffName||catalogs.staff.find((p:Row)=>p._id===id)?.name).filter(Boolean).join(', ')||invoice.sellerName||'Chưa có'} · Chỉ xem.</p>:<SaleParticipants people={advisorOptions} value={value.participantIds} onChange={participantIds=>set({participantIds})} total={contentLineTotal(value)} disabled={disabled} showPreview={false}/>)}
    {!!source.treatmentSessions.length&&<section aria-label="Buổi đã xác nhận"><h3>Buổi đã xác nhận · Giữ lịch sử</h3>{source.treatmentSessions.map((r:Row,index:number)=><p key={r.lineId||index}>{r.name} · {r.recipientName||invoice.customerName} {r.recipientPhone||''}{r.performerName&&` · ${r.performerName}`} · {money(r.total||0)}</p>)}{locks.treatmentSessions&&!locks.services.some((row:Row)=>row?.technicianOnly)&&<small className="invoice-content-lock">{locks.treatmentSessions}</small>}</section>}
    {!!context.references.gifts.length&&<p>Quà đã cấp: {context.references.gifts.map((r:Row)=>r.description).join(', ')} · Giữ chứng từ gốc.</p>}
    {!!context.references.giftCards.length&&<p>Thẻ tiền tặng đã cấp: {context.references.giftCards.map((r:Row)=>money(r.amount)).join(', ')} · Giữ chứng từ gốc.</p>}
    {!!invoice.cardPaid&&<p>Đã dùng thẻ tiền: {money(invoice.cardPaid)} · Giữ giao dịch gốc.</p>}
    <p>Tổng các dòng: <strong>{money(contentLineTotal(value,source.treatmentSessions))}</strong></p>
    {locks.metadata&&!locks.correctionOnly&&<small>{locks.metadata}</small>}
  </section>;
}

export function InvoiceContentComparison({before,after,showCustomer=true}:{before:Row;after:Row;showCustomer?:boolean}){
  const render=(invoice:Row)=><><p>{invoice.description}</p>{showCustomer&&<p>Khách: {invoice.customerName||invoice.customerId}</p>}<p>Hạn: {invoice.dueDate||'—'} · Tư vấn: {invoice.consultantName||'—'}</p>{['serviceItems','productItems','packageItems','treatmentSessions'].filter(kind=>invoice[kind]?.length).map(kind=><ul key={kind}>{(invoice[kind]||[]).map((r:Row,i:number)=><li key={r.lineId||i}>{r.name} · {kind==='productItems'?`${r.quantity} × ${money(r.unitPrice)} = ${money(r.quantity*r.unitPrice)}`:money(r.total||0)}{(r.performerName||r.performerId)&&` · KTV ${r.performerName||'#'+String(r.performerId).slice(-6)}`}{r.totalSessions&&` · ${r.totalSessions} buổi`}{r.durationMonths&&` · ${r.durationMonths} tháng`}{r.startsOn&&` · ${r.startsOn}`}{r.expiresOn&&` – ${r.expiresOn}`}{r.promotion&&` · ${r.promotion}`}</li>)}</ul>)}{!!invoice.packageItems?.length&&<p>Người tư vấn gói: {invoice.saleParticipants?.map((p:Row)=>p.staffName).join(', ')||invoice.sellerName||'—'}</p>}{invoice.promotion&&<p>{invoice.promotion}</p>}</>;
  return <div className="invoice-content-comparison" aria-label="Nội dung trước và sau"><section><h4>Trước sửa</h4>{render(before)}</section><section><h4>Sau sửa</h4>{render(after)}</section></div>;
}

export function InvoiceTechnicianChanges({corrections}:{corrections:Row[]}){
  const changed=corrections.filter(row=>row.before?.performerId!==row.after?.performerId);
  if(!changed.length)return null;
  const name=(value:Row)=>value.performerName||(value.performerId?'KTV #'+String(value.performerId).slice(-6):'Chưa có');
  return <section aria-label="Đối chiếu kỹ thuật viên">{changed.map(row=><p key={String(row.lineId)}>Kỹ thuật viên: <strong>{name(row.before)}</strong> → <strong>{name(row.after)}</strong></p>)}</section>;
}
