'use client';
import PayrollGrid from './payroll-grid';
import {leaveDays,dayUnits} from '@/lib/leave-rules';
type Row = Record<string, any>;
type Field = {key:string;label:string;type?:string;optional?:boolean;options?:[string,string][]};
const displayDay = (day:string) => day.split('-').reverse().join('/');
const displayUnits = (units:number) => units.toLocaleString('vi-VN');
const leaveStatus:Record<string,string>={PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Từ chối'};
export default function EmployeeAttendance({data,owner,userId,employee,today,loading,onOpen,onLeavePage,onWorkPage}: {
 data:Row|null;owner:boolean;userId:string;employee:string;today:string;loading:boolean;
 onOpen:(title:string,action:string,fields:Field[],defaults?:Row,description?:string)=>void;
 onLeavePage:(p:number)=>void;onWorkPage:(p:number)=>void;
}) {
 const people:Row[]=(data?.people || []).filter((p:Row)=>p.role === 'STAFF');
 const singleEmployee=!!employee;
 const selectedPeople=people.filter(p=>!employee || employee===p._id);
 const leaves:Row[]=data?.leaves || [];
 const select:Field={key:'staffId',label:'Nhân viên',options:people.map(p=>[p._id,p.name])};
 const period:Field={key:'period',label:'Thời gian mỗi ngày',options:[['FULL','Cả ngày'],['AM','Nửa ngày buổi sáng'],['PM','Nửa ngày buổi chiều']]};
 function edit(r?:Row) {
  onOpen(r?'Sửa ngày nghỉ':'Ghi nhận nghỉ phép','recordStaffLeave',[
   ...(owner && !r ? [select]:[]),{key:'startDay',label:'Từ ngày',type:'date'},{key:'endDay',label:'Đến ngày',type:'date'},period,
   {key:'type',label:'Loại nghỉ',options:[['PERMITTED','Có phép'],['UNPERMITTED','Không phép']]},
   ...(owner?[{key:'paid',label:'Nghỉ hưởng lương',type:'checkbox',optional:true}]:[]),
   {key:'note',label:'Lý do nghỉ',optional:true}],
   {id:r?._id,staffId:r?.staffId || (owner?employee || people[0]?._id:userId),startDay:r?.startDay || r?.day || today,endDay:r?.endDay || r?.day || today,period:r?.period || 'FULL',type:r?.type || 'PERMITTED',paid:r?.paid || false,note:r?.note || ''},
   'Có phép không mặc định hưởng lương. Chỉ ngày đã duyệt mới tính vào lương. Khoảng nhiều ngày áp dụng cùng thời gian mỗi ngày, gồm cả ngày cuối.');
 }
 const actions=(r:Row)=><div className="actions leave-actions">
  {(owner || r.status==='PENDING') && <button type="button" onClick={()=>edit(r)}>Sửa</button>}
  {owner && r.status==='PENDING' && <>
   <button type="button" onClick={()=>onOpen('Duyệt nghỉ','reviewStaffLeave',[{key:'paid',label:'Nghỉ hưởng lương',type:'checkbox',optional:true}],{id:r._id,status:'APPROVED',paid:r.paid || false})}>Duyệt</button>
   <button type="button" onClick={()=>onOpen('Từ chối nghỉ','reviewStaffLeave',[],{id:r._id,status:'REJECTED',paid:false},'Bản bị từ chối không tính vào ngày nghỉ/lương.')}>Từ chối</button>
  </>}
 </div>;
 const periodLabel=(r:Row)=>r.period==='AM'?'Nửa ngày sáng':r.period==='PM'?'Nửa ngày chiều':'Cả ngày';
 return <section className="panel panel-padded leave-management">
  <div className="section-head leave-management-heading"><h3>Quản lý ngày nghỉ</h3><button type="button" className="leave-create-button" disabled={loading || !people.length} onClick={()=>edit()}>＋ Ghi nghỉ phép</button></div>
  <p className="inline-note leave-note">Lương tháng không cần chấm công hằng ngày. Nghỉ không lương cần đối soát trước khi duyệt lương.</p>
  {loading ? <p role="status">Đang tải ngày nghỉ…</p> : <>
   <div className="leave-mobile leave-month-summary">
    <div className="leave-block-heading"><h4>Tổng hợp tháng</h4><small>Đơn vị: ngày</small></div>
    {selectedPeople.length ? selectedPeople.map(p=>{
     const summary=data?.leaveSummary?.find((r:Row)=>r.staffId===p._id) || {};
     return <div key={p._id} className="leave-person-summary">
      {!singleEmployee && <strong>{p.name}</strong>}
      <dl className="leave-metrics">{[['Có phép',summary.permitted],['Không phép',summary.unpermitted],['Hưởng lương',summary.paid],['Không hưởng lương',summary.unpaid]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{displayUnits(Number(value) || 0)}</dd></div>)}</dl>
     </div>;
    }):<p className="leave-empty">Chưa có nhân viên phù hợp.</p>}
   </div>
   <div className="leave-desktop">
    <PayrollGrid label="Tổng hợp nghỉ trong tháng" headers={[...(!singleEmployee?['Nhân viên']:[]),'Nghỉ có phép','Nghỉ không phép','Hưởng lương','Không hưởng lương']} rows={selectedPeople.map(p=> {
     const r=data?.leaveSummary?.find((r:Row)=>r.staffId===p._id) || {};
     return [...(!singleEmployee?[<strong key="name">{p.name}</strong>]:[]),r.permitted || 0,r.unpermitted || 0,r.paid || 0,r.unpaid || 0];
    })} empty="Chưa có nhân viên phù hợp." />
    <small>Đơn vị: ngày. Nghỉ hưởng lương không tự giảm lương tháng.</small>
    <PayrollGrid label="Danh sách nghỉ phép" headers={[...(!singleEmployee?['Nhân viên']:[]),'Từ ngày','Đến ngày','Số ngày nghỉ','Thời gian','Loại nghỉ','Hưởng lương đề nghị','Trạng thái','Lý do','Người duyệt / thời gian','Thao tác']} rows={leaves.map(r=>[
     ...(!singleEmployee?[r.staffName]:[]),r.startDay || r.day,r.endDay || r.day,leaveDays(r as any).length*dayUnits(r.period),periodLabel(r),r.type==='PERMITTED'?'Có phép':'Không phép',r.paid?'Có':'Không',leaveStatus[r.status] || 'Đã ghi trước quy trình duyệt',r.note || '—',
     r.reviewedAt?<span key="review">{people.find(p=>p._id===r.reviewedBy)?.name || 'Chủ spa'}<small>{new Date(r.reviewedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small></span>:'Chưa duyệt',
     actions(r),
    ])} empty="Chưa có bản ghi nghỉ trong tháng." />
   </div>
   <div className="leave-mobile leave-request-list">
    <div className="leave-block-heading"><h4>Đơn nghỉ</h4><small>{data?.leaveTotal || 0} đơn</small></div>
    {leaves.length ? <ul className="leave-cards">{leaves.map(r=>{
     const start=r.startDay || r.day, end=r.endDay || start;
     return <li key={r._id}><article className="leave-card" aria-labelledby={'leave-card-'+r._id}>
      {!singleEmployee && <strong className="leave-card-person">{r.staffName}</strong>}
      <div className="leave-card-heading">
       <h5 id={'leave-card-'+r._id}><time dateTime={start}>{displayDay(start)}</time>{end!==start && <> <span aria-hidden="true">–</span> <time dateTime={end}>{displayDay(end)}</time></>}</h5>
       <span className={'leave-status '+String(r.status || 'legacy').toLowerCase()}>{leaveStatus[r.status] || 'Đã ghi'}</span>
      </div>
      <dl className="leave-card-facts">
       <div><dt>Số ngày nghỉ</dt><dd>{displayUnits(leaveDays(r as any).length*dayUnits(r.period))} ngày</dd></div>
       <div><dt>Thời gian mỗi ngày</dt><dd>{periodLabel(r)}</dd></div>
       <div><dt>Loại nghỉ</dt><dd>{r.type==='PERMITTED'?'Có phép':'Không phép'}</dd></div>
       <div><dt>Hưởng lương</dt><dd>{r.paid?'Có hưởng lương':'Không hưởng lương'}</dd></div>
      </dl>
      <p className="leave-card-reason"><span>Lý do</span><span>{r.note || 'Chưa ghi lý do'}</span></p>
      {actions(r)}
     </article></li>;
    })}</ul>:<p className="leave-empty">Chưa có đơn nghỉ trong tháng này.</p>}
   </div>
  </>}
  {data && data.leaveTotal>10 && <div className="customer-picker-pages leave-pagination"><button type="button" disabled={loading || data.leavePage<=1} onClick={()=>onLeavePage(data.leavePage-1)}>Trước</button><span>Trang {data.leavePage}/{Math.ceil(data.leaveTotal/10)}</span><button type="button" disabled={loading || data.leavePage*10>=data.leaveTotal} onClick={()=>onLeavePage(data.leavePage+1)}>Sau</button></div>}
 </section>;
}
