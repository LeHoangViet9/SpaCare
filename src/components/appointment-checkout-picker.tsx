'use client';
import {useEffect,useRef,useState} from 'react';
type Row=Record<string,any>;
export default function AppointmentCheckoutPicker({customerId,initialId,selectedId,busy,onSelect,onInvoice}:{customerId?:string;initialId?:string;selectedId?:string;busy:boolean;onSelect:(detail:Row|null)=>void;onInvoice?:(id:string)=>void}) {
 const [rows,setRows]=useState<Row[]>([]),[page,setPage]=useState(1),[more,setMore]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const callbacks=useRef({onSelect,onInvoice});callbacks.current={onSelect,onInvoice};
 useEffect(()=>{setPage(1);setRows([]);},[customerId]);
 useEffect(()=>{
  if(!customerId)return;
  const controller=new AbortController();setLoading(true);setError('');
  fetch('/api/appointments/checkout?'+new URLSearchParams({customerId,page:String(page)}),{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;}).then(d=>{setRows(d.appointments);setMore(d.hasMore);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[customerId,page]);
 async function choose(id:string,signal?:AbortSignal){
  if(!id){callbacks.current.onSelect(null);return;}
  setLoading(true);setError('');
  try{const r=await fetch('/api/appointments/checkout?'+new URLSearchParams({appointmentId:id,...(customerId?{customerId}:{})}),{signal,cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);if(!signal?.aborted)callbacks.current.onSelect(d);}
  catch(e){if(!signal?.aborted)setError((e as Error).message);}finally{if(!signal?.aborted)setLoading(false);}
 }
 useEffect(()=>{if(!initialId)return;const controller=new AbortController();void choose(initialId,controller.signal);return ()=>controller.abort();},[initialId]);
 return <section className="cashier-appointment"><h3>Lịch hẹn của lần làm này</h3><p>Chọn lịch để lưu hóa đơn và hoàn thành lịch cùng một lần. Khách không đặt lịch có thể bỏ qua.</p>
 <label>Chọn lịch hẹn<select aria-label="Lịch hẹn thu ngân" disabled={busy || loading} value={selectedId || ''} onChange={e=>void choose(e.target.value)}><option value="">Không gắn lịch hẹn</option>{rows.map(row=><option key={row._id} value={row._id}>{new Date(row.startAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {(row.requestedServices||[]).map((s:Row)=>s.name).join(' + ')} · {row.invoice?'Đã có hóa đơn':row.status==='COMPLETED'?'Đã hoàn thành':'Chưa hoàn thành'}</option>)}{selectedId && !rows.some(row=>row._id===selectedId) && <option value={selectedId}>Lịch đang chọn</option>}</select></label>
 {loading && <p role="status">Đang tải lịch…</p>}{error && <p role="alert">{error}</p>}
 <div className="actions"><button type="button" disabled={busy || loading || page===1} onClick={()=>setPage(p=>p-1)}>Lịch trước</button><span>Trang {page}</span><button type="button" disabled={busy || loading || !more} onClick={()=>setPage(p=>p+1)}>Lịch tiếp</button></div>
 </section>;
}
