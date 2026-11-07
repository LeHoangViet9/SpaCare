'use client';
import {useRef,useState} from 'react';
import {formatCurrency as money} from '@/lib/currency';
import {invoiceCode} from '@/lib/invoice-code';
type Row=Record<string,any>;
function useAdjustmentRequest(){
  const keys=useRef(new Map<string,string>());
  return async(action:string,data:Row)=>{
    const fingerprint=JSON.stringify({action,data});
    const key=action==='previewInvoiceAdjustment'?crypto.randomUUID():keys.current.get(fingerprint)||crypto.randomUUID();
    keys.current.set(fingerprint,key);
    const response=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({action,data})});
    const body=await response.json();if(!response.ok)throw Error(body.error||'Không lưu được điều chỉnh.');return body;
  };
}
export default function InvoiceAdjustmentDialog({invoice,mode,onClose,onChanged}:{invoice:Row;mode:'CORRECT'|'VOID';onClose:()=>void;onChanged:()=>void}){
  const [description,setDescription]=useState(invoice.description||''),[total,setTotal]=useState(invoice.total||0),[reason,setReason]=useState('');
  const [issuedOn,setIssuedOn]=useState(invoice.createdAt?new Date(invoice.createdAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}):'');
  const [stockHandling,setStock]=useState(''),[entitlementHandling,setEntitlement]=useState(''),[giftHandling,setGift]=useState('');
  const [preview,setPreview]=useState<Row|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false),request=useAdjustmentRequest();
  const context=invoice.adjustmentContext||{},voiding=mode==='VOID';
  async function submit(){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    const data={id:invoice._id,expectedUpdatedAt:invoice.updatedAt,mode,description,total:voiding?0:total,reason,
      ...(!voiding&&issuedOn?{issuedOn}:{}),
      ...(context.stock&&stockHandling?{stockHandling}:{}),...(context.packages&&entitlementHandling?{entitlementHandling}:{}),...(context.gifts&&giftHandling?{giftHandling}:{})};
    try{
      if(preview){await request('applyInvoiceAdjustment',{...data,confirmed:true,expectedPreview:preview.previewToken});onChanged();}
      else setPreview(await request('previewInvoiceAdjustment',data));
    }catch(e){setError((e as Error).message);setPreview(null);}finally{setBusy(false);lock.current=false;}
  }
  const title=voiding?'Vô hiệu hóa hóa đơn':'Sửa hóa đơn';
  const day=(value:string)=>value?new Date(value).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
  return <div className="modal-backdrop"><section className="modal detail-modal invoice-adjustment-dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{if(e.key==='Escape'&&!busy)onClose();}}>
    <div className="section-head"><h2>{title}</h2></div>
    <p><strong>{invoiceCode(invoice)}</strong>{invoice.customerName&&<> · {invoice.customerName}{invoice.customerPhone&&' · '+invoice.customerPhone}</>}</p>
    <p>Đã thanh toán: <strong>{money(invoice.paid)}</strong> · Còn nợ: <strong>{money(Math.max(0,invoice.total-invoice.paid))}</strong></p>
    {!voiding&&<p>Chứng từ gốc và khoản thu được giữ nguyên. Thay đổi được lưu trong chứng từ điều chỉnh; sửa ngày hóa đơn không đổi ngày thu tiền hoặc ngày làm dịch vụ.</p>}
    <form onSubmit={e=>{e.preventDefault();void submit();}}>
      <fieldset disabled={busy||!!preview}>
        {!voiding&&<>
          <label>Ngày hóa đơn<input type="date" required value={issuedOn} onChange={e=>setIssuedOn(e.target.value)} /></label>
          <label>Nội dung hóa đơn<input required maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} /></label>
          <label>Tổng tiền sau sửa (VNĐ)<input type="number" name="revisedTotal" value={total} onChange={e=>setTotal(Number(e.target.value))} min={0} max={1_000_000_000_000} step={1} required /></label>
          <p>Giữ nguyên từng dịch vụ/sản phẩm và người thực hiện. Phần chênh lệch tiền được ghi riêng.</p>
          {invoice.kind==='PACKAGE'&&<p>Đổi người tư vấn hiện dùng mục “Thay người tư vấn bán gói” trong chi tiết hóa đơn vì cần đối soát hoa hồng riêng. Luồng đó chỉ nhận gói thu đủ bằng một khoản trực tiếp, chưa hoàn/đảo và chưa chốt hoa hồng; không gộp đổi tư vấn với sửa tiền hoặc ngày.</p>}
        </>}
        {voiding&&context.stock&&<label>Hàng đã bán<select required value={stockHandling} onChange={e=>setStock(e.target.value)}><option value="">Chọn cách xử lý hàng</option><option value="KEEP_OUT">Giữ nguyên hàng đã giao</option><option value="RETURN">Xác nhận nhập lại kho</option></select>{stockHandling==='RETURN'&&<small>Tôi xác nhận đã nhận lại hàng hoặc hàng chưa được giao thực tế.</small>}</label>}
        {voiding&&context.packages&&<label>Gói đã bán<select required value={entitlementHandling} onChange={e=>setEntitlement(e.target.value)}><option value="">Chọn cách xử lý gói</option><option value="KEEP">Giữ các buổi còn lại</option><option value="CANCEL_REMAINING">Dừng các buổi chưa dùng</option></select></label>}
        {voiding&&context.gifts&&<label>Quà tặng<select required value={giftHandling} onChange={e=>setGift(e.target.value)}><option value="">Chọn cách xử lý quà</option><option value="KEEP">Giữ quà đã tặng</option><option value="REVOKE_UNUSED">Thu hồi phần chưa dùng</option></select></label>}
        <label>Lý do<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} /></label>
      </fieldset>
      {preview&&<section aria-label="Đối chiếu điều chỉnh hóa đơn"><h3>{voiding?'Kiểm tra trước khi vô hiệu hóa':'Đối chiếu trước khi lưu'}</h3>
        {voiding?<p>Công nợ sau vô hiệu hóa: <strong>{money(0)}</strong>. Hóa đơn gốc và các buổi đã làm vẫn được giữ lại.</p>:<table><thead><tr><th>Thông tin</th><th>Trước</th><th>Sau</th></tr></thead><tbody>
          <tr><th>Ngày hóa đơn</th><td>{day(preview.before.createdAt)}</td><td>{day(preview.after.createdAt)}</td></tr>
          <tr><th>Nội dung</th><td>{preview.before.description}</td><td>{preview.after.description}</td></tr>
          {['total','paid'].map(key=><tr key={key}><th>{key==='total'?'Tổng hóa đơn':'Tiền áp dụng vào hóa đơn'}</th><td>{money(preview.before[key])}</td><td>{money(preview.after[key])}</td></tr>)}
        </tbody></table>}
        {!voiding&&<p>Chênh lệch tiền: <strong>{money(preview.delta)}</strong></p>}
        {!!preview.reconciliation.balance.depositReturn&&<p>Trả về số dư cọc của khách: {money(preview.reconciliation.balance.depositReturn)}.</p>}
        {!!preview.reconciliation.balance.cardReturn&&<p>Trả về thẻ tiền của khách: {money(preview.reconciliation.balance.cardReturn)}.</p>}
        {!!preview.after.adjustmentCredit&&<p>Tiền đã thu giữ chờ xử lý: <strong>{money(preview.after.adjustmentCredit)}</strong>. Chưa hoàn cho khách; chỉ ghi hoàn tiền bằng thao tác riêng khi thực tế đã trả.</p>}
        {preview.reconciliation.commissionChanges.map((c:Row)=><p key={c.category+String(c.staffId)}>Điều chỉnh hoa hồng {c.staffName}: {money(c.delta)} · kỳ {preview.reconciliation.commissionMonths[String(c.staffId)]}. Giữ bảng lương đã duyệt/đã chi.</p>)}
        <p>Lý do: {reason}</p><button type="button" disabled={busy} onClick={()=>setPreview(null)}>Quay lại chỉnh sửa</button>
      </section>}
      {error&&<p role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" autoFocus disabled={busy} onClick={onClose}>Quay lại</button><button className="primary" disabled={busy}>{busy?'Đang xử lý…':voiding?'Vô hiệu hóa hóa đơn':preview?'Xác nhận lưu hóa đơn':'Xem trước thay đổi'}</button></div>
    </form>
  </section></div>;
}

export function InvoiceAdjustmentRefund({invoice,onChanged}:{invoice:Row;onChanged:()=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false),request=useAdjustmentRequest();
  if(!(invoice.adjustmentCredit>0))return null;
  return <form className="invoice-adjustment-refund" aria-label="Hoàn tiền điều chỉnh thực tế" onSubmit={async e=>{
    e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
    const fields=new FormData(e.currentTarget);
    try{await request('refundInvoiceAdjustment',{id:invoice._id,expectedUpdatedAt:invoice.updatedAt,amount:Number(fields.get('amount')),method:fields.get('method'),reason:fields.get('reason'),transferReference:fields.get('transferReference')||undefined,receivedConfirmation:fields.get('receivedConfirmation')==='on'});onChanged();}
    catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }}><h3>Tiền trực tiếp chờ xử lý: {money(invoice.adjustmentCredit)}</h3><p>Chỉ ghi khi đã thực trả tiền cho khách; không dùng thao tác này để đảo sai sót.</p>
    <fieldset disabled={busy}><label>Số tiền hoàn (VNĐ)<input name="amount" type="number" min={1} max={invoice.adjustmentCredit} step={1} required /></label>
    <label>Phương thức<select name="method"><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></select></label>
    <label>Lý do<textarea name="reason" maxLength={2000} required /></label><label>Tham chiếu chuyển khoản<input name="transferReference" maxLength={500} /></label>
    <label><input name="receivedConfirmation" type="checkbox" required />Tôi xác nhận đã thực trả khoản tiền này cho khách</label></fieldset>
    {error&&<p role="alert">{error}</p>}<button disabled={busy}>Ghi nhận hoàn tiền thực tế</button></form>;
}
