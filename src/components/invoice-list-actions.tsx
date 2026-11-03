'use client';
import InvoiceCorrectionMenu from './invoice-correction-menu';

type Row=Record<string,any>;
export default function InvoiceListActions({invoice,owner,busy,onEdit,onCancel,onDelete,onPayment}:{invoice:Row;owner:boolean;busy:boolean;onEdit:(invoice:Row)=>void;onCancel:(invoice:Row)=>void;onDelete:(invoice:Row)=>void;onPayment:(invoice:Row,method:string)=>void}) {
  const owing=invoice.total>invoice.paid;
  return <div className="invoice-list-actions">
    {(owner || owing) && <details className="row-action-menu" onClick={event=>{if(event.target instanceof Element && event.target.closest('button:not(:disabled)'))event.currentTarget.open=false;}}>
      <summary>Thao tác <span aria-hidden="true">⌄</span></summary>
      <div className="row-action-options"><div className="actions">
        {owner && invoice.status!=='CANCELLED' && <button type="button" disabled={busy} onClick={()=>onEdit(invoice)}>Sửa hóa đơn</button>}
        {owner && <InvoiceCorrectionMenu compact invoice={invoice} onCancel={onCancel} onDelete={onDelete} disabled={busy}/>}
        {owing && <><button type="button" disabled={busy} onClick={()=>onPayment(invoice,'CASH')}>Tiền mặt</button><button type="button" disabled={busy} onClick={()=>onPayment(invoice,'BANK_TRANSFER')}>Chuyển khoản / QR</button></>}
      </div></div>
    </details>}
    {!owing && <small>{invoice.status==='CANCELLED'?'Đã hủy · không tính nợ':invoice.total===0?'Không thu tiền':'Đã thu đủ'}</small>}
  </div>;
}
