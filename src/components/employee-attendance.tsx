'use client';
type Row = Record<string, any>;
type Field = {key:string;label:string;type?:string;optional?:boolean;options?:[string,string][]};
const leaveStatus:Record<string,string>={PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Từ chối'};
export default function EmployeeAttendance({data,owner,userId,employee,today,loading,onOpen,onLeavePage,onWorkPage}: {
 data:Row|null;owner:boolean;userId:string;employee:string;today:string;loading:boolean;
 onOpen:(title:string,action:string,fields:Field[],defaults?:Row,description?:string)=>void;
 onLeavePage:(p:number)=>void;onWorkPage:(p:number)=>void;
}) {
 const people:Row[]=(data?.people || []).filter((p:Row)=>p.role === 'STAFF');
 const select:Field={key:'staffId',label:'Nhân viên',options:people.map(p=>[p._id,p.name])};
 const period:Field={key:'period',label:'Thời gian mỗi ngày',options:[['FULL','Cả ngày'],['AM','Nửa ngày buổi sáng'],['PM','Nửa ngày buổi chiều']]};
 function edit(r?:Row) {
  onOpen(r?'Sửa ngày nghỉ':'Ghi nhận nghỉ phép','recordStaffLeave',[
   ...(owner && !r ? [select]:[]),{key:'startDay',label:'Từ ngày',type:'date'},{key:'endDay',label:'Đến ngày',type:'date'},period,
   {key:'type',label:'Loại nghỉ',options:[['PERMITTED','Có phép'],['UNPERMITTED','Không phép']]},
   ...(owner?[{key:'paid',label:'Hưởng lương (trong hạn mức chính sách)',type:'checkbox',optional:true}]:[]),
   {key:'note',label:'Lý do nghỉ',optional:true}],
   {id:r?._id,staffId:r?.staffId || (owner?employee || people[0]?._id:userId),startDay:r?.startDay || r?.day || today,endDay:r?.endDay || r?.day || today,period:r?.period || 'FULL',type:r?.type || 'PERMITTED',paid:r?.paid || false,note:r?.note || ''},
   'Có phép không mặc định hưởng lương. Chỉ ngày đã duyệt mới tính vào lương. Khoảng nhiều ngày áp dụng cùng thời gian mỗi ngày, gồm cả ngày cuối.');
 }
 return <>
 <section className="panel panel-padded"><div className="section-head"><h3>Ngày nghỉ và ngày công</h3><button disabled={loading || !people.length} onClick={()=>edit()}>＋ Ghi nghỉ phép</button></div>
 <p className="inline-note">Không dùng lịch hẹn để suy ngày công. Chỉ nghỉ đã duyệt được thống kê vào lương; chủ spa xác nhận đủ dữ liệu công khi lập nháp theo ngày.</p>
 {!loading && <div className="payroll-people">{people.filter(p=>!employee || employee===p._id).map(p=> {
  const r=data?.leaveSummary?.find((r:Row)=>r.staffId===p._id) || {};
  const work=data?.workSummary?.find((r:Row)=>r._id===p._id)?.days;
  return <article key={p._id}><div><strong>{p.name}</strong><p>Ngày công đã ghi: {work ?? 'Chưa ghi'}</p><p>Có phép: {r.permitted || 0} · Không phép: {r.unpermitted || 0}</p><p>Hưởng lương đề nghị: {r.paid || 0} · Không hưởng lương: {r.unpaid || 0}</p><small>Ngày hưởng lương thực tính còn phụ thuộc hạn mức cấu hình.</small></div></article>;
 })}</div>}
 {loading?<p role="status">Đang tải…</p>:<div className="payroll-people">{data?.leaves?.map((r:Row)=><article key={r._id}><div><strong>{r.staffName} · {r.startDay || r.day} → {r.endDay || r.day}</strong><p>{r.type==='PERMITTED'?'Có phép':'Không phép'} · {r.period==='AM'?'Nửa ngày sáng':r.period==='PM'?'Nửa ngày chiều':'Cả ngày'} · {leaveStatus[r.status] || 'Đã ghi trước quy trình duyệt'}</p><p>{r.paid?'Đề nghị hưởng lương':'Không hưởng lương'}{r.note?' · '+r.note:''}</p>{r.reviewedAt && <small>Duyệt bởi {people.find(p=>p._id===r.reviewedBy)?.name || 'Chủ spa'} · {new Date(r.reviewedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small>}</div>
 <div className="actions">{(owner || r.status==='PENDING') && <button onClick={()=>edit(r)}>Sửa</button>}{owner && r.status==='PENDING' && <><button onClick={()=>onOpen('Duyệt nghỉ','reviewStaffLeave',[{key:'paid',label:'Nghỉ hưởng lương',type:'checkbox',optional:true}],{id:r._id,status:'APPROVED',paid:r.paid || false})}>Duyệt</button><button onClick={()=>onOpen('Từ chối nghỉ','reviewStaffLeave',[],{id:r._id,status:'REJECTED',paid:false},'Bản bị từ chối không tính vào ngày nghỉ/lương.')}>Từ chối</button></>}</div></article>)}{!data?.leaveTotal && <p>Chưa có bản ghi nghỉ trong tháng.</p>}</div>}
 {data && data.leaveTotal>10 && <div className="customer-picker-pages"><button disabled={loading || data.leavePage<=1} onClick={()=>onLeavePage(data.leavePage-1)}>Trước</button><span>Trang {data.leavePage}/{Math.ceil(data.leaveTotal/10)}</span><button disabled={loading || data.leavePage*10>=data.leaveTotal} onClick={()=>onLeavePage(data.leavePage+1)}>Sau</button></div>}
 </section>
 <section className="panel panel-padded"><div className="section-head"><h3>Ngày công thực tế đã ghi</h3>{owner && <button disabled={loading || !people.length} onClick={()=>onOpen('Ghi / sửa ngày công','recordWorkday',[select,{key:'day',label:'Ngày làm',type:'date'},period,{key:'note',label:'Ghi chú',optional:true}],{staffId:employee || people[0]?._id,day:today,period:'FULL'},'Ghi theo thực tế. Cùng người/ngày cập nhật bản hiện có; không tự tạo từ lịch hẹn.')}>＋ Ghi ngày công</button>}</div>
 {!loading && <div className="payroll-people">{data?.workdays?.map((r:Row)=><article key={r._id}><strong>{people.find(p=>p._id===r.staffId)?.name} · {r.day}</strong><span>{r.period==='FULL'?'1 ngày':r.period==='AM'?'0,5 ngày sáng':'0,5 ngày chiều'}{r.note?' · '+r.note:''}</span></article>)}</div>}
 {data && data.workTotal>10 && <div className="customer-picker-pages"><button disabled={loading || data.workPage<=1} onClick={()=>onWorkPage(data.workPage-1)}>Trước</button><span>Trang {data.workPage}/{Math.ceil(data.workTotal/10)}</span><button disabled={loading || data.workPage*10>=data.workTotal} onClick={()=>onWorkPage(data.workPage+1)}>Sau</button></div>}
 </section></>;
}
