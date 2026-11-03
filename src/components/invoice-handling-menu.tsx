'use client';
import InvoiceReplacement from './invoice-replacement';
import type { InvoiceHandling } from '@/lib/invoice-handling';
type Row=Record<string,any>;
export default function InvoiceHandlingMenu({invoice,treatment,reasons,staff,onEdit,onDate,onCancel,onVoid,onReplaced}:{invoice:Row;treatment:Row|null;reasons?:InvoiceHandling;staff?:Row[];onEdit?:(invoice:Row,plan:Row|null)=>void;onDate?:(invoice:Row)=>void;onCancel?:(invoice:Row)=>void;onVoid?:(invoice:Row)=>void;onReplaced:()=>void}) {
  const unavailable=(action:keyof InvoiceHandling,allowed:boolean)=>!allowed?'Chỉ chủ spa được thực hiện thao tác này.':!reasons?'Chưa tải được điều kiện xử lý. Đóng và mở lại chi tiết hóa đơn.':reasons[action];
  const edit=unavailable('edit',!!onEdit),date=unavailable('date',!!onDate),replace=unavailable('replace',!!staff),cancel=unavailable('cancel',!!onCancel),voidReason=unavailable('void',!!onVoid);
  return <details className="invoice-handling"><summary>Xử lý hóa đơn</summary><div className="invoice-handling-body">
    <p>Chọn đúng loại sai sót. Mỗi thao tác có bước nhập lý do và xác nhận riêng; hệ thống kiểm tra lại dữ liệu trước khi lưu.</p>
    <div className="invoice-handling-row"><button type="button" disabled={!!edit} onClick={()=>onEdit?.(invoice,treatment)}>Sửa hóa đơn</button><div><small>Sửa nội dung, giá hoặc quyền lợi gói chưa phát sinh theo phạm vi đang hỗ trợ.</small>{edit && <p>{edit}</p>}</div></div>
    <div className="invoice-handling-row"><button type="button" disabled={!!date} onClick={()=>onDate?.(invoice)}>Sửa ngày hóa đơn</button><div><small>Chỉ điều chỉnh ngày; giữ số tiền, buổi đã dùng và chữ ký. Ngày mới cũng phải chưa chốt sổ.</small>{date && <p>{date}</p>}</div></div>
    <div className="invoice-handling-row"><div>{replace?<button type="button" disabled>Thay người tư vấn bán gói</button>:<InvoiceReplacement key={`replacement:${invoice.activeDocumentId || invoice._id}`} invoice={invoice} staff={staff!} onChanged={onReplaced} buttonLabel="Thay người tư vấn bán gói"/>}</div><div><small>Thay đúng người tư vấn bằng chứng từ thay thế. Không sửa giá, tên gói, số buổi hay lịch sử thực hiện. Cần xem trước và nhập lý do.</small>{replace && <p>{replace}</p>}</div></div>
    <div className="invoice-handling-row"><button type="button" disabled={!!voidReason} onClick={()=>onVoid?.(invoice)}>Vô hiệu hóa hóa đơn nhập nhầm</button><div><small>Giữ chứng từ gốc; xử lý các phát sinh hợp lệ theo điều kiện hiện có. Không phải hoàn tiền thực tế.</small>{voidReason && <p>{voidReason}</p>}</div></div>
    <div className="invoice-handling-row"><button type="button" disabled={!!cancel} onClick={()=>onCancel?.(invoice)}>Hủy hóa đơn chưa thanh toán</button><div><small>Giữ lịch sử hóa đơn, chỉ dùng khi chưa phát sinh giao dịch và đủ điều kiện.</small>{cancel && <p>{cancel}</p>}</div></div>
    <small>Hệ thống kiểm tra lại hoa hồng, kỳ lương và sổ ngày trước khi lưu. Nếu dữ liệu thay đổi, thao tác có thể bị từ chối kèm lý do.</small>
  </div></details>;
}
