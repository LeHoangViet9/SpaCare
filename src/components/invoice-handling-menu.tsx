'use client';
import { useId } from 'react';
import InvoiceReplacement from './invoice-replacement';
import { groupInvoiceHandlingReasons, type InvoiceHandling } from '@/lib/invoice-handling';
type Row=Record<string,any>;
const actionNames: Record<keyof InvoiceHandling,string>={edit:'Sửa nội dung',date:'Sửa ngày',replace:'Thay tư vấn',cancel:'Hủy',void:'Vô hiệu hóa'};
export default function InvoiceHandlingMenu({invoice,treatment,reasons,staff,onEdit,onDate,onCancel,onVoid,onReplaced}:{invoice:Row;treatment:Row|null;reasons?:InvoiceHandling;staff?:Row[];onEdit?:(invoice:Row,plan:Row|null)=>void;onDate?:(invoice:Row)=>void;onCancel?:(invoice:Row)=>void;onVoid?:(invoice:Row)=>void;onReplaced:()=>void}) {
  const prefix=useId();
  const unavailable=(action:keyof InvoiceHandling,allowed:boolean)=>!allowed?'Chỉ chủ spa được xử lý hóa đơn.':!reasons?'Chưa tải được điều kiện xử lý; hãy mở lại chi tiết hóa đơn.':reasons[action];
  const blocked:InvoiceHandling={edit:unavailable('edit',!!onEdit),date:unavailable('date',!!onDate),replace:unavailable('replace',!!staff),cancel:unavailable('cancel',!!onCancel),void:unavailable('void',!!onVoid)};
  const shared=groupInvoiceHandlingReasons(blocked);
  const reasonId=(action:keyof InvoiceHandling)=>blocked[action] ? `${prefix}-${shared.find(group=>group.actions.includes(action))?.actions.join('-') || action}` : undefined;
  const reason=(action:keyof InvoiceHandling)=>blocked[action] && !shared.some(group=>group.actions.includes(action)) ? <p id={reasonId(action)}>{blocked[action]}</p> : null;
  return <details className="invoice-handling"><summary>Xử lý hóa đơn</summary><div className="invoice-handling-body">
    {shared.map(group=><div className="invoice-handling-shared" id={`${prefix}-${group.actions.join('-')}`} key={group.reason}><p>{group.reason}</p><small>Áp dụng: {group.actions.map(action=>actionNames[action]).join(', ')}.</small></div>)}
    <div className="invoice-handling-groups"><section className="invoice-handling-group" aria-label="Chỉnh sửa"><h3>Chỉnh sửa</h3>
    <div className="invoice-handling-row"><button type="button" disabled={!!blocked.edit} aria-describedby={reasonId('edit')} onClick={()=>onEdit?.(invoice,treatment)}>Sửa hóa đơn</button><div><small>Sửa nội dung, giá hoặc quyền lợi chưa phát sinh.</small>{reason('edit')}</div></div>
    <div className="invoice-handling-row"><button type="button" disabled={!!blocked.date} aria-describedby={reasonId('date')} onClick={()=>onDate?.(invoice)}>Sửa ngày hóa đơn</button><div><small>Đổi ngày hóa đơn, giữ số tiền và lịch sử.</small>{reason('date')}</div></div>
    <div className="invoice-handling-row"><div>{blocked.replace?<button type="button" disabled aria-describedby={reasonId('replace')}>Thay người tư vấn bán gói</button>:<InvoiceReplacement key={`replacement:${invoice.activeDocumentId || invoice._id}`} invoice={invoice} staff={staff!} onChanged={onReplaced} buttonLabel="Thay người tư vấn bán gói"/>}</div><div><small>Đổi tư vấn bằng chứng từ thay thế, không đổi giá hoặc số buổi.</small>{reason('replace')}</div></div>
    </section><section className="invoice-handling-group" aria-label="Xử lý hóa đơn sai"><h3>Xử lý hóa đơn sai</h3>
    <div className="invoice-handling-row"><button type="button" disabled={!!blocked.void} aria-describedby={reasonId('void')} onClick={()=>onVoid?.(invoice)}>Vô hiệu hóa hóa đơn nhập nhầm</button><div><small>Giữ chứng từ gốc và xử lý phát sinh hợp lệ, không phải hoàn tiền.</small>{reason('void')}</div></div>
    <div className="invoice-handling-row"><button type="button" disabled={!!blocked.cancel} aria-describedby={reasonId('cancel')} onClick={()=>onCancel?.(invoice)}>Hủy hóa đơn chưa thanh toán</button><div><small>Hủy hóa đơn chưa phát sinh giao dịch và giữ lịch sử.</small>{reason('cancel')}</div></div>
    </section></div>
  </div></details>;
}
