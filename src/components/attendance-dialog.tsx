 'use client';
import {useEffect,useRef,useState} from 'react';
import EmployeeAttendance from './employee-attendance';
type Row=Record<string,any>;
export default function AttendanceDialog({person,month,today,user,refreshKey,onClose,onOpen}:{person:Row;month:string;today:string;user:Row;refreshKey:unknown;onClose:()=>void;onOpen:(...args:any[])=>void}) {
 const [data,setData]=useState<Row|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [leavePage,setLeavePage]=useState(1),[workPage,setWorkPage]=useState(1),[retry,setRetry]=useState(0);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const before=document.activeElement as HTMLElement|null;ref.current?.focus();return()=>before?.focus();},[]);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');fetch('/api/payroll?'+new URLSearchParams({view:'salary',month,employee:person.staffId,leavePage:String(leavePage),workPage:String(workPage)}),{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error || 'Không tải được công/nghỉ.');return d;}).then(d=>{if(!c.signal.aborted){setData(d);setLoading(false);}}).catch(e=>{if(!c.signal.aborted){setError(e.message);setLoading(false);}});return()=>c.abort();},[person.staffId,month,leavePage,workPage,retry,refreshKey]);
 return <div className="modal-backdrop attendance-dialog-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} className="modal attendance-dialog" role="dialog" aria-modal="true" aria-labelledby="attendance-title" tabIndex={-1} onKeyDown={e=>{
 if(e.key==='Escape')onClose();
 if(e.key==='Tab'){const items=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]');if(items?.length){const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 }}><div className="section-head"><h2 id="attendance-title">Công / nghỉ · {person.staffName} · {month}</h2><button type="button" onClick={onClose}>Đóng</button></div>{error?<p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>:<EmployeeAttendance data={data ? {...data,people:data.people.filter((p:Row)=>p._id===person.staffId)} : null} owner={user.role==='OWNER'} userId={user.id} employee={person.staffId} today={today} loading={loading} onOpen={(...args)=>{onClose();onOpen(...args);}} onLeavePage={setLeavePage} onWorkPage={setWorkPage}/>}</div></div>;
}
