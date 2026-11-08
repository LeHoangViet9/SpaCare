'use client';
import {useEffect,useRef,useState} from 'react';
import {formatCurrency as money} from '@/lib/currency';
import {invoiceCode} from '@/lib/invoice-code';
type Row=Record<string,any>;
const invalidMoney=(value:number)=>!Number.isSafeInteger(value)||value<0||value>1_000_000_000_000;
const receiptDayLabel=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'Thiếu ngày thu';
export function invoiceAdjustmentErrorText(message:string){
  const book=message.match(/^Sổ ngày (\d{4}-\d{2}-\d{2}) (chưa mở hoặc đã chốt|không còn mở)\./);
  if(book)return `Không thể chỉnh khoản thu: sổ ngày ${receiptDayLabel(book[1])} ${book[2]}.`;
  if(message.startsWith('Số tiền đã thanh toán vượt tổng hóa đơn hoặc không hợp lệ.'))return 'Số tiền đã thanh toán không hợp lệ hoặc vượt tổng hóa đơn.';
  return message;
}
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
  const [total,setTotal]=useState(invoice.total||0),[reason,setReason]=useState('');
  const originalReceipts:Row[]=invoice.payments||[];
  const [editedReceipts,setEditedReceipts]=useState<Row[]>(()=>originalReceipts.map(row=>({...row})));
  const [issuedOn,setIssuedOn]=useState(invoice.createdAt?new Date(invoice.createdAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}):'');
  const [stockHandling,setStock]=useState(''),[entitlementHandling,setEntitlement]=useState(''),[giftHandling,setGift]=useState('');
  const [preview,setPreview]=useState<Row|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false),scrollRef=useRef<HTMLDivElement>(null),request=useAdjustmentRequest();
  useEffect(()=>{scrollRef.current?.scrollTo({top:0});},[invoice._id,mode]);
  useEffect(()=>{if(error&&scrollRef.current)scrollRef.current.scrollTo({top:scrollRef.current.scrollHeight});},[error]);
  const context=invoice.adjustmentContext||{},voiding=mode==='VOID';
  const receiptCorrections=editedReceipts.filter(row=>{const old=originalReceipts.find(original=>original._id===row._id);return old&&(old.amount!==row.amount||old.day!==row.day);}).map(row=>({paymentId:String(row._id),amount:row.amount,day:row.day}));
  const receiptDelta=editedReceipts.reduce((sum,row)=>sum+row.amount,0)-originalReceipts.reduce((sum,row)=>sum+row.amount,0);
  const funding=invoice.paid+(invoice.adjustmentCredit||0)-(invoice.financialRevision?0:(invoice.refunded||0));
  const revisedPaid=receiptCorrections.length?funding+receiptDelta:Math.min(total,funding);
  const updateReceipt=(id:string,change:Row)=>setEditedReceipts(rows=>rows.map(row=>String(row._id)===id?{...row,...change}:row));
  async function submit(){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    const data={id:invoice._id,expectedUpdatedAt:invoice.updatedAt,mode,total:voiding?0:total,reason,
      ...(!voiding&&issuedOn?{issuedOn}:{}),
      ...(!voiding&&receiptCorrections.length?{paid:revisedPaid,receiptCorrections}:{}),
      ...(context.stock&&stockHandling?{stockHandling}:{}),...(context.packages&&entitlementHandling?{entitlementHandling}:{}),...(context.gifts&&giftHandling?{giftHandling}:{})};
    try{
      if(preview){await request('applyInvoiceAdjustment',{...data,confirmed:true,expectedPreview:preview.previewToken});onChanged();}
      else setPreview(await request('previewInvoiceAdjustment',data));
    }catch(e){setError((e as Error).message);setPreview(null);}finally{setBusy(false);lock.current=false;}
  }
  const title=voiding?'Vô hiệu hóa hóa đơn':'Sửa hóa đơn';
  const day=(value:string)=>value?new Date(value).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
  return <div className="modal-backdrop"><section className="modal detail-modal invoice-adjustment-dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{if(e.key==='Escape'&&!busy)onClose();}}>
    <header className="section-head invoice-adjustment-header"><h2>{title}</h2></header>
    <form className="invoice-adjustment-form" onSubmit={e=>{e.preventDefault();void submit();}}>
      <div className="invoice-adjustment-scroll" ref={scrollRef} data-testid="invoice-adjustment-scroll">
        <p><strong>{invoiceCode(invoice)}</strong>{invoice.customerName&&<> · {invoice.customerName}{invoice.customerPhone&&' · '+invoice.customerPhone}</>}</p>
        {voiding&&<p>Đã thanh toán: <strong>{money(invoice.paid)}</strong> · Còn nợ: <strong>{money(Math.max(0,invoice.total-invoice.paid))}</strong></p>}
        {!voiding&&<div className="invoice-adjustment-original-description" aria-label="Nội dung hóa đơn gốc"><strong>Nội dung gốc</strong><p>{invoice.description}</p></div>}
        <fieldset disabled={busy||!!preview}>
          {!voiding&&<>
            <div className="invoice-adjustment-fields">
              <label>Ngày hóa đơn<input type="date" required value={issuedOn} onChange={e=>setIssuedOn(e.target.value)} /></label>
              <label>Tổng hóa đơn (VNĐ)<input type="number" aria-label="Tổng tiền sau sửa (VNĐ)" name="revisedTotal" value={total} onChange={e=>setTotal(Number(e.target.value))} min={0} max={1_000_000_000_000} step={1} required aria-invalid={invalidMoney(total)||undefined} aria-describedby={invalidMoney(total)?'invoice-total-error':undefined} />{invalidMoney(total)&&<small id="invoice-total-error" role="alert">Số tiền không hợp lệ.</small>}</label>
            </div>
            <InvoiceReceiptFields original={originalReceipts} edited={editedReceipts} paid={revisedPaid} oldPaid={invoice.paid} total={total} onChange={updateReceipt} />
          </>}
          {voiding&&context.stock&&<label>Hàng đã bán<select required value={stockHandling} onChange={e=>setStock(e.target.value)}><option value="">Chọn cách xử lý hàng</option><option value="KEEP_OUT">Giữ nguyên hàng đã giao</option><option value="RETURN">Xác nhận nhập lại kho</option></select>{stockHandling==='RETURN'&&<small>Tôi xác nhận đã nhận lại hàng hoặc hàng chưa được giao thực tế.</small>}</label>}
          {voiding&&context.packages&&<label>Gói đã bán<select required value={entitlementHandling} onChange={e=>setEntitlement(e.target.value)}><option value="">Chọn cách xử lý gói</option><option value="KEEP">Giữ các buổi còn lại</option><option value="CANCEL_REMAINING">Dừng các buổi chưa dùng</option></select></label>}
          {voiding&&context.gifts&&<label>Quà tặng<select required value={giftHandling} onChange={e=>setGift(e.target.value)}><option value="">Chọn cách xử lý quà</option><option value="KEEP">Giữ quà đã tặng</option><option value="REVOKE_UNUSED">Thu hồi phần chưa dùng</option></select></label>}
          <label>Lý do<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} /></label>
        </fieldset>
        {preview&&<section aria-label="Đối chiếu điều chỉnh hóa đơn"><h3>{voiding?'Kiểm tra trước khi vô hiệu hóa':'Đối chiếu trước khi lưu'}</h3>
          {voiding?<p>Công nợ sau vô hiệu hóa: <strong>{money(0)}</strong>. Hóa đơn gốc và các buổi đã làm vẫn được giữ lại.</p>:<table><thead><tr><th>Thông tin</th><th>Trước</th><th>Sau</th></tr></thead><tbody>
            <tr><th>Ngày hóa đơn</th><td>{day(preview.before.createdAt)}</td><td>{day(preview.after.createdAt)}</td></tr>
            {['total','paid'].map(key=><tr key={key}><th>{key==='total'?'Tổng hóa đơn':'Đã thanh toán'}</th><td>{money(preview.before[key])}</td><td>{money(preview.after[key])}</td></tr>)}
          </tbody></table>}
          {!voiding&&<>{preview.delta!==0&&<p>Chênh lệch: <strong>{money(preview.delta)}</strong></p>}<InvoiceAdjustmentCashReview preview={preview} /></>}
          {!!preview.reconciliation.balance.depositReturn&&<p>Trả về số dư cọc của khách: {money(preview.reconciliation.balance.depositReturn)}.</p>}
          {!!preview.reconciliation.balance.cardReturn&&<p>Trả về thẻ tiền của khách: {money(preview.reconciliation.balance.cardReturn)}.</p>}
          {!!preview.after.adjustmentCredit&&<p>Tiền chờ xử lý: <strong>{money(preview.after.adjustmentCredit)}</strong> · Chưa hoàn.</p>}
          {preview.reconciliation.commissionChanges.map((c:Row)=><p key={c.category+String(c.staffId)}>Hoa hồng {c.staffName}: {money(c.delta)} · kỳ {preview.reconciliation.commissionMonths[String(c.staffId)]}.</p>)}
          <p>Lý do: {reason}</p><button type="button" disabled={busy} onClick={()=>setPreview(null)}>Quay lại chỉnh sửa</button>
        </section>}
        {error&&<p role="alert">{invoiceAdjustmentErrorText(error)}</p>}
      </div>
      <div className="modal-actions invoice-adjustment-actions"><button type="button" disabled={busy} onClick={onClose}>Quay lại</button><button className="primary" disabled={busy}>{busy?'Đang xử lý…':voiding?'Vô hiệu hóa hóa đơn':preview?'Xác nhận lưu hóa đơn':'Xem trước thay đổi'}</button></div>
    </form>
  </section></div>;
}

export function InvoiceAdjustmentCashReview({preview}:{preview:Row}){
  const changes:Row[]=preview.reconciliation.receiptChanges||[];
  return <section aria-label="Đối chiếu khoản thu thực tế">
    {changes.length?<><strong>Khoản thu điều chỉnh</strong><ul>{changes.map(change=><li key={change.paymentId}>{change.method==='CASH'?'Tiền mặt':'Chuyển khoản'}: {money(change.before.amount)} · {receiptDayLabel(change.before.day)} → {money(change.after.amount)} · {receiptDayLabel(change.after.day)}</li>)}</ul></>:<p>Khoản thu giữ nguyên.</p>}
    {preview.after.total>preview.after.paid&&<p>Còn nợ: <strong>{money(Math.max(0,preview.after.total-preview.after.paid))}</strong></p>}
  </section>;
}

export function InvoiceReceiptFields({original,edited,paid,oldPaid,total,onChange}:{original:Row[];edited:Row[];paid:number;oldPaid:number;total:number;onChange:(id:string,change:Row)=>void}){
  const single=edited.length===1?edited[0]:null;
  const otherFunding=oldPaid-original.reduce((sum,row)=>sum+row.amount,0);
  const singlePaid=!!single&&otherFunding===0;
  const paidError=invalidMoney(paid)?'Số tiền không hợp lệ.':paid>total?'Số đã thanh toán vượt tổng hóa đơn.':'';
  const paidField=<label>{singlePaid?'Số tiền (VNĐ)':'Đã thanh toán (VNĐ)'}<input aria-label="Số tiền đã thanh toán (VNĐ)" name="revisedPaid" type="number" min={0} max={1_000_000_000_000} step={1} required value={paid} readOnly={!single||otherFunding!==0} onChange={e=>{if(single&&otherFunding===0)onChange(String(single._id),{amount:Number(e.target.value)});}} aria-invalid={!!paidError||undefined} aria-describedby={paidError?'invoice-paid-error':undefined} />{paidError&&<small id="invoice-paid-error" role="alert">{paidError}</small>}</label>;
  return <section className="invoice-receipt-fields" aria-label="Điều chỉnh số tiền đã thanh toán">
    {!singlePaid&&paidField}
    <div className="invoice-adjustment-balances"><span>Đã thanh toán: <strong>{money(oldPaid)} → {money(paid)}</strong></span>{total>paid&&<span>Còn nợ: <strong>{money(total-paid)}</strong></span>}</div>
    {!edited.length&&<small>Chưa có khoản thu để điều chỉnh.</small>}
    {edited.map((row,index)=><div className="invoice-receipt-group" role="group" aria-label={'Khoản thu '+(index+1)} key={String(row._id)}><p>Khoản thu {index+1} · {row.method==='CASH'?'Tiền mặt':row.method==='BANK_TRANSFER'?'Chuyển khoản':'Chưa rõ phương thức'} · Gốc {money(original[index].amount)} · {receiptDayLabel(original[index].day)}</p>
      <div className="invoice-adjustment-fields">
        {singlePaid?paidField:<label>Số tiền (VNĐ)<input aria-label={'Số tiền khoản thu '+(index+1)+' (VNĐ)'} type="number" required min={0} max={1_000_000_000_000} step={1} value={row.amount} onChange={e=>onChange(String(row._id),{amount:Number(e.target.value)})} aria-invalid={invalidMoney(row.amount)||undefined} aria-describedby={invalidMoney(row.amount)?'receipt-amount-error-'+index:undefined} />{invalidMoney(row.amount)&&<small id={'receipt-amount-error-'+index} role="alert">Số tiền không hợp lệ.</small>}</label>}
        <label>Ngày thực nhận<input aria-label={'Ngày thực nhận khoản thu '+(index+1)} type="date" required value={row.day||''} onChange={e=>onChange(String(row._id),{day:e.target.value})} /></label>
      </div>
    </div>)}
  </section>;
}

export function InvoiceReceiptCorrectionHistory({changes}:{changes:Row[]}){
  return <ul aria-label="Lịch sử sửa khoản thu">{changes.map(change=><li key={change.paymentId}>Khoản thu #{change.receiptId}: {change.before.day} · {money(change.before.amount)} → {change.after.day} · {money(change.after.amount)}. Điều chỉnh giao dịch gốc, không phải khoản thu mới.</li>)}</ul>;
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
