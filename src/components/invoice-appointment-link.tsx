'use client';
import {useState} from 'react';
import AppointmentCheckoutPicker from './appointment-checkout-picker';
import ValidatedForm from './validated-form';
type Row=Record<string,any>;
export default function InvoiceAppointmentLink({invoice,onLink}:{invoice:Row;onLink:(values:Row)=>Promise<void>}) {
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<Row|null>(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 if(invoice.appointmentId || !['SERVICE','SESSION'].includes(invoice.kind))return null;
 return <section><button type="button" onClick={()=>setOpen(v=>!v)}>Liên kết lịch hẹn đã thực hiện</button>{open && <ValidatedForm onSubmit={async e=>{e.preventDefault();if(!selected)return;setBusy(true);setError('');try{await onLink({appointmentId:selected.appointment._id,invoiceId:invoice._id,reason});setOpen(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
 <p>Chủ spa đối chiếu đúng lần làm trước khi liên kết. Không tạo hóa đơn, trừ buổi hoặc cộng hoa hồng lần nữa.</p>
 <AppointmentCheckoutPicker customerId={String(invoice.customerId)} busy={busy} selectedId={selected?.appointment?._id} onSelect={setSelected}/>
 <label>Lý do liên kết<input required minLength={3} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 {error && <p role="alert">{error}</p>}
 <button type="submit" disabled={busy || !selected || !!selected.invoice}>Xác nhận liên kết & hoàn thành lịch</button>
 </ValidatedForm>}</section>;
}
