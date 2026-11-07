'use client';

type Row=Record<string,any>;
export default function InvoiceListActions({invoice,owner,busy,onEdit,onDelete,onPayment}:{invoice:Row;owner:boolean;busy:boolean;onEdit:(invoice:Row)=>void;onCancel?:(invoice:Row)=>void;onDelete:(invoice:Row)=>void;onPayment:(invoice:Row)=>void}) {
  const owing=invoice.status!=='CANCELLED'&&invoice.total>invoice.paid;
  return <div className="invoice-list-actions">
    {(owner || owing) && <div className="actions invoice-action-buttons">
        {owner && <button type="button" disabled={busy||invoice.status==='CANCELLED'} title="Sửa hóa đơn" aria-label="Sửa hóa đơn" onClick={()=>onEdit(invoice)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5" /></svg></button>}
        {owner && <button type="button" disabled={busy||invoice.status==='CANCELLED'} title="Vô hiệu hóa hóa đơn" aria-label="Vô hiệu hóa hóa đơn" onClick={()=>onDelete(invoice)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7" /></svg></button>}
        {owing && <button type="button" disabled={busy} onClick={()=>onPayment(invoice)}>Thanh toán</button>}
    </div>}
    {!owing && <small>{invoice.status==='CANCELLED'?'Đã hủy · không tính nợ':invoice.total===0?'Không thu tiền':'Đã thu đủ'}</small>}
  </div>;
}
