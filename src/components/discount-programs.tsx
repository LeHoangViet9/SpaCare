'use client';
import {useEffect,useRef,useState} from 'react';
import {programActive,programPhase} from '@/lib/discount-program-rules';
import ValidatedForm from './validated-form';
type Row=Record<string,any>;
const blank={name:'',startsOn:'',endsOn:'',percent:0,enabled:true};
export default function DiscountPrograms(){
 const [data,setData]=useState<Row>({rows:[],total:0,page:1,today:''}),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [draft,setDraft]=useState<Row|null>(null),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const request=useRef<{body:string;key:string}|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch('/api/discount-programs?manage=1&page='+page,{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error);return body;}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return ()=>controller.abort();},[page,revision]);
 async function save(event:React.FormEvent){event.preventDefault();if(!draft)return;setBusy(true);setError('');
  const body=JSON.stringify({action:'saveDiscountProgram',data:{...(draft._id?{id:draft._id,expectedUpdatedAt:draft.updatedAt}:{}),name:draft.name,startsOn:draft.startsOn,endsOn:draft.endsOn,percent:Number(draft.percent),enabled:draft.enabled,confirmedRunning:confirmed}});
  if(request.current?.body!==body)request.current={body,key:crypto.randomUUID()};
  try{const response=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':request.current.key},body});const result=await response.json();if(!response.ok)throw Error(result.error||'Không lưu được chương trình.');request.current=null;setDraft(null);setRevision(v=>v+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 // Confirmation depends on the persisted source, even when draft dates/status change.
 const source=data.rows.find((row:Row)=>row._id===draft?._id);
 const requiresConfirmation=!!source&&programActive(source,data.today);
 return <section className="panel panel-padded"><div className="section-head"><h2>Chương trình giảm giá</h2><button disabled={busy} onClick={()=>{setDraft({...blank});setConfirmed(false);setError('');}}>Tạo chương trình</button></div>
 <p>Áp dụng chung cho các hóa đơn bán mới đủ điều kiện trong spa, theo ngày hóa đơn tại Việt Nam. Chỉ một chương trình bật cho mỗi ngày.</p>
 {error&&<p role="alert">{error}</p>}
 {draft&&<ValidatedForm onSubmit={save}><fieldset disabled={busy}><legend>{draft._id?'Sửa chương trình':'Tạo chương trình'}</legend>
 <label>Tên chương trình<input required maxLength={200} value={draft.name} onChange={e=>{setDraft({...draft,name:e.target.value});setConfirmed(false);}}/></label>
 <label>Ngày bắt đầu<input type="date" required value={draft.startsOn} onChange={e=>{setDraft({...draft,startsOn:e.target.value});setConfirmed(false);}}/></label>
 <label>Ngày kết thúc<input type="date" required min={draft.startsOn||undefined} value={draft.endsOn} onChange={e=>{setDraft({...draft,endsOn:e.target.value});setConfirmed(false);}}/></label>
 <label>Phần trăm giảm<input type="number" required min={0} max={100} step={1} value={draft.percent} onChange={e=>{setDraft({...draft,percent:e.target.value});setConfirmed(false);}}/></label>
 <label><input type="checkbox" checked={draft.enabled} onChange={e=>{setDraft({...draft,enabled:e.target.checked});setConfirmed(false);}}/>Bật chương trình</label>
 {requiresConfirmation&&<label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Xác nhận sửa/tắt chương trình đang chạy. Chỉ ảnh hưởng hóa đơn tạo sau; hóa đơn cũ giữ nguyên.</label>}
 <button className="primary" disabled={busy||requiresConfirmation&&!confirmed}>Lưu chương trình</button><button type="button" disabled={busy} onClick={()=>setDraft(null)}>Hủy</button>
 </fieldset></ValidatedForm>}
 <div className="invoice-history">{data.rows.map((row:Row)=><article key={row._id}><strong>{row.name}</strong><p>{row.code} · {row.startsOn} → {row.endsOn} · {row.percent}%</p><p>{programPhase(row as any,data.today)} · {row.enabled?'Đang bật':'Đã tắt'}</p><button disabled={busy} onClick={()=>{setDraft({...row});setConfirmed(false);setError('');}}>Sửa / bật / tắt</button></article>)}</div>
 {!data.total&&<p>Chưa có chương trình.</p>}{data.total>20&&<div className="actions"><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Trước</button><span>Trang {data.page}/{Math.ceil(data.total/20)}</span><button disabled={page*20>=data.total} onClick={()=>setPage(v=>v+1)}>Sau</button></div>}
 </section>;
}
