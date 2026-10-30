'use client';
type Row=Record<string,any>;
export default function InvoiceCorrectionMenu({invoice,onCancel,onDelete,disabled=false}:{invoice:Row;onCancel?:(invoice:Row)=>void;onDelete?:(invoice:Row)=>void;disabled?:boolean}){
 if(!onCancel && !onDelete)return null;
 return <details className="record-details"><summary>Xử lý hóa đơn sai</summary><div className="cell-stack">
 <button type="button" disabled={disabled || !onCancel || invoice.status==='CANCELLED' || invoice.paid>0} onClick={()=>onCancel?.(invoice)}>Hủy hóa đơn — giữ lịch sử</button>
 <small>Ưu tiên khi hóa đơn chưa thanh toán. Hóa đơn vẫn còn để tra cứu.</small>
 <button type="button" disabled={disabled || !onDelete} onClick={()=>onDelete?.(invoice)}>Vô hiệu hóa hóa đơn nhập nhầm</button>
 <small>Bước tiếp theo yêu cầu lý do và xác nhận riêng. Chứng từ gốc vẫn được giữ để đối chiếu.</small>
 </div></details>;
}
