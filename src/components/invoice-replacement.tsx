'use client';
import { useRef, useState } from 'react';
import { historicalInvoiceCode, invoiceCode } from '@/lib/invoice-code';
import { formatCurrency as money } from '@/lib/currency';
type Row=Record<string,any>;
export default function InvoiceReplacement({invoice,staff,onChanged}:{invoice:Row;staff:Row[];onChanged:()=>void}) {
  const [open,setOpen]=useState(false),[oldStaffId,setOld]=useState(''),[newStaffId,setNew]=useState('');
  const [reason,setReason]=useState(''),[preview,setPreview]=useState<Row|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const keys=useRef(new Map<string,string>()),sending=useRef(false);
  const participants=invoice.saleParticipants?.length ? invoice.saleParticipants : [{staffId:invoice.sellerId,staffName:invoice.sellerName}];
  const request=async(action:string,data:Row)=>{
    const fingerprint=JSON.stringify({action,data});
    const key=keys.current.get(fingerprint) || crypto.randomUUID();keys.current.set(fingerprint,key);
    const response=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({action,data})});
    const body=await response.json();if(!response.ok)throw Error(body.error || 'Không thể thay thế chứng từ.');
    return body;
  };
  const perform=async(commit:boolean)=>{
    if(sending.current)return;sending.current=true;setBusy(true);setError('');
    try {
      const data={id:invoice._id,expectedUpdatedAt:invoice.updatedAt,expectedDocumentId:invoice.activeDocumentId || invoice._id,oldStaffId,newStaffId};
      if(commit){await request('replacePackageAdvisor',{...data,reason:reason.trim()});setOpen(false);onChanged();}
      else setPreview(await request('previewPackageAdvisorReplacement',data));
    }catch(e){setError((e as Error).message);}finally{sending.current=false;setBusy(false);}
  };
  if(invoice.kind!=='PACKAGE' || invoice.status==='CANCELLED' || invoice.openingBalance)return null;
  return <section className="invoice-replacement" aria-label="Thay thế chứng từ bán gói">
    <button type="button" disabled={busy} onClick={()=>setOpen(!open)}>Thay thế chứng từ sửa tư vấn bán gói</button>
    {open && <form onSubmit={e=>{e.preventDefault();void perform(!!preview);}}>
      <p>Chứng từ hiện hành: <strong>{invoiceCode(invoice)}</strong>. Chỉ sửa người tư vấn bán gói; giữ nguyên khoản thu, gói và buổi thật.</p>
      <label>Người tư vấn cũ<select required disabled={busy} value={oldStaffId} onChange={e=>{setOld(e.target.value);setPreview(null);}}><option value="">Chọn người cần thay</option>{participants.map((p:Row)=><option key={p.staffId} value={p.staffId}>{p.staffName}</option>)}</select></label>
      <label>Người tư vấn mới<select required disabled={busy} value={newStaffId} onChange={e=>{setNew(e.target.value);setPreview(null);}}><option value="">Chọn người mới</option>{staff.filter(s=>s.active && ['OWNER','STAFF'].includes(s.role) && !participants.some((p:Row)=>String(p.staffId)===String(s._id))).map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
      {preview && <div role="region" aria-label="Xem trước thay thế">
        <p>Đã thu đủ: {money(preview.payment.amount)} · {preview.payment.method==='CASH'?'Tiền mặt':'Chuyển khoản'}. <a href={'/workspace/cash?search='+preview.payment.receiptId}>Xem phiếu thu gốc</a></p>
        <p>Gói liên quan: {(preview.treatments || preview.treatmentIds.map((id:string,i:number)=>({id,name:'Gói '+(i+1)}))).map((t:Row)=><a key={t.id} href={'/workspace/packages?search='+t.id}>{t.name}{' '}</a>)}. Buổi thật, SESSION 0đ, chữ ký và lịch hẹn giữ nguyên.</p>
        {preview.uses?.map((use:Row,i:number)=><p key={use._id}>Buổi đã ghi {i+1} · {use.checkoutInvoiceId && <a href={'/workspace/invoices?search='+use.checkoutInvoiceId}>Hóa đơn buổi 0đ</a>}{' · '}{use.appointmentId?<a href={'/workspace/appointments?search='+use.appointmentId}>Lịch hẹn liên quan</a>:'Không đặt lịch'}</p>)}
        <table><thead><tr><th>Tư vấn</th><th>Hoa hồng trước</th><th>Hoa hồng sau</th></tr></thead><tbody>{[...preview.before,...preview.after.filter((p:Row)=>!preview.before.some((q:Row)=>q.staffId===p.staffId))].map((p:Row)=><tr key={p.staffId}><td>{p.staffName}</td><td>{money(preview.beforeShares.find((s:Row)=>s.staffId===p.staffId)?.total || 0)}</td><td>{money(preview.afterShares.find((s:Row)=>s.staffId===p.staffId)?.total || 0)}</td></tr>)}</tbody></table>
        <p>Quỹ hoa hồng gốc: {money(preview.pool)}. Giữ quy tắc phân bổ và làm tròn của giao dịch gốc. Lương nháp liên quan phải tính lại.</p>
        <label>Lý do thay thế<textarea required disabled={busy} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>
      </div>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy || (!!preview && !reason.trim())}>{busy?'Đang xử lý…':preview?'Xác nhận tạo chứng từ thay thế':'Xem trước thay thế'}</button>
    </form>}
  </section>;
}

export function InvoiceDocumentHistory({invoice}:{invoice:Row}) {
  if(!invoice.documentHistory?.length)return null;
  return <section aria-label="Chuỗi chứng từ"><p id="current-invoice-document"><strong>Chứng từ hiện hành: {invoiceCode(invoice)}</strong> · Thay thế chứng từ <a href={'#document-'+invoice.documentHistory.at(-1).documentId}>{historicalInvoiceCode(invoice.documentHistory.at(-1))}</a></p>
    {invoice.documentHistory.map((doc:Row)=><details key={doc.documentId} id={'document-'+doc.documentId}><summary>{historicalInvoiceCode(doc)} · Đã thay thế</summary>
      <p>{doc.snapshot.description} · Ngày gốc: {new Date(doc.snapshot.createdAt).toLocaleString('vi-VN')} · Tổng {money(doc.snapshot.total)} · Đã trả {money(doc.snapshot.paid)}</p>
      <p>Người tư vấn bán gói: {doc.snapshot.saleParticipants?.map((p:Row)=>p.staffName).join(', ') || doc.snapshot.sellerName}. Người tạo gốc: {doc.snapshot.creatorName || 'Chưa ghi nhận'}.</p>
      <p>Lý do: {doc.reason} · Thời điểm thay thế: {new Date(doc.replacedAt).toLocaleString('vi-VN')}</p>
      <p>Được thay bằng <a href={String(doc.replacedById)===String(invoice.activeDocumentId)?'#current-invoice-document':'#document-'+doc.replacedById}>{doc.replacedByCode}</a>. Chứng từ này chỉ để tra cứu, đã hết hiệu lực.</p>
    </details>)}
  </section>;
}
