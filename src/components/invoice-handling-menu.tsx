'use client';
import { useId } from 'react';
import InvoiceReplacement from './invoice-replacement';
import { groupInvoiceHandlingReasons, type InvoiceHandling } from '@/lib/invoice-handling';
type Row=Record<string,any>;
const actionNames: Record<keyof InvoiceHandling,string>={edit:'Sửa hóa đơn',date:'Sửa ngày',replace:'Thay người tư vấn bán gói',cancel:'Hủy',void:'Vô hiệu hóa hóa đơn'};
export default function InvoiceHandlingMenu({invoice,treatment,reasons,staff,onEdit,onVoid,onReplaced}:{invoice:Row;treatment:Row|null;reasons?:InvoiceHandling;staff?:Row[];onEdit?:(invoice:Row,plan:Row|null)=>void;onDate?:(invoice:Row)=>void;onCancel?:(invoice:Row)=>void;onVoid?:(invoice:Row)=>void;onReplaced:()=>void}) {
  const prefix=useId();
  const unavailable=(action:keyof InvoiceHandling,allowed:boolean)=>!allowed?'Chỉ chủ spa được xử lý hóa đơn.':!reasons?'Chưa tải được điều kiện xử lý; hãy mở lại chi tiết hóa đơn.':reasons[action];
  const blocked:InvoiceHandling={edit:unavailable('edit',!!onEdit),date:'',replace:unavailable('replace',!!staff),cancel:'',void:unavailable('void',!!onVoid)};
  const shared=groupInvoiceHandlingReasons(blocked);
  const reasonId=(action:keyof InvoiceHandling)=>blocked[action] ? `${prefix}-${shared.find(group=>group.actions.includes(action))?.actions.join('-') || action}` : undefined;
  const reason=(action:keyof InvoiceHandling)=>blocked[action] && !shared.some(group=>group.actions.includes(action)) ? <p id={reasonId(action)}>{blocked[action]}</p> : null;
  return <details className="invoice-handling"><summary>Xử lý hóa đơn</summary><div className="invoice-handling-body">
    {shared.map(group=><div className="invoice-handling-shared" id={`${prefix}-${group.actions.join('-')}`} key={group.reason}><p>{group.reason}</p><small>Áp dụng: {group.actions.map(action=>actionNames[action]).join(', ')}.</small></div>)}
    <div className="invoice-handling-groups"><section className="invoice-handling-group" aria-label="Chỉnh sửa"><h3>Chỉnh sửa</h3>
    <div className="invoice-handling-row"><button type="button" disabled={!!blocked.edit} aria-describedby={reasonId('edit')} onClick={()=>onEdit?.(invoice,treatment)}>Sửa hóa đơn</button>{reason('edit')}</div>
    <div className="invoice-handling-row"><div>{blocked.replace?<button type="button" disabled aria-describedby={reasonId('replace')}>Thay người tư vấn bán gói</button>:<InvoiceReplacement key={`replacement:${invoice.activeDocumentId || invoice._id}`} invoice={invoice} staff={staff!} onChanged={onReplaced} buttonLabel="Thay người tư vấn bán gói"/>}</div>{reason('replace')}</div>
    </section><section className="invoice-handling-group" aria-label="Xử lý hóa đơn sai"><h3>Xử lý hóa đơn sai</h3>
    <div className="invoice-handling-row"><button type="button" disabled={!!blocked.void} aria-describedby={reasonId('void')} onClick={()=>onVoid?.(invoice)}>Vô hiệu hóa hóa đơn</button>{reason('void')}</div>
    </section></div>
  </div></details>;
}
