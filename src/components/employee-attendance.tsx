'use client';
import PayrollGrid from './payroll-grid';
import {leaveDays,dayUnits} from '@/lib/leave-rules';
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
   ...(owner?[{key:'paid',label:'Nghỉ hưởng lương',type:'checkbox',optional:true}]:[]),
   {key:'note',label:'Lý do nghỉ',optional:true}],
   {id:r?._id,staffId:r?.staffId || (owner?employee || people[0]?._id:userId),startDay:r?.startDay || r?.day || today,endDay:r?.endDay || r?.day || today,period:r?.period || 'FULL',type:r?.type || 'PERMITTED',paid:r?.paid || false,note:r?.note || ''},
   'Có phép không mặc định hưởng lương. Chỉ ngày đã duyệt mới tính vào lương. Khoảng nhiều ngày áp dụng cùng thời gian mỗi ngày, gồm cả ngày cuối.');
 }
 return <>
 <section className="panel panel-padded"><div className="section-head"><h3>Quản lý ngày nghỉ</h3><button disabled={loading || !people.length} onClick={()=>edit()}>＋ Ghi nghỉ phép</button></div>
 <p className="payroll-grid-hint">Xoay ngang điện thoại hoặc vuốt bảng để xem đủ các cột.</p>
 <p className="inline-note">Lương tháng không yêu cầu chấm công hằng ngày. Chỉ nghỉ đã duyệt được đưa vào đối soát lương; nghỉ hưởng lương không bị trừ.</p>
 {loading ? <p role="status">Đang tải…</p> : <>
 <PayrollGrid label="Tổng hợp nghỉ trong tháng" headers={['Nhân viên','Nghỉ có phép','Nghỉ không phép','Hưởng lương','Không hưởng lương']} rows={people.filter(p=>!employee || employee===p._id).map(p=> {
  const r=data?.leaveSummary?.find((r:Row)=>r.staffId===p._id) || {};
  return [<strong key="name">{p.name}</strong>,r.permitted || 0,r.unpermitted || 0,r.paid || 0,r.unpaid || 0];
 })} empty="Chưa có nhân viên phù hợp." />
 <small>Đơn vị: ngày. Nghỉ hưởng lương không tự giảm lương tháng.</small>
 <PayrollGrid label="Danh sách nghỉ phép" headers={['Nhân viên','Từ ngày','Đến ngày','Số ngày nghỉ','Thời gian','Loại nghỉ','Hưởng lương đề nghị','Trạng thái','Lý do','Người duyệt / thời gian','Thao tác']} rows={(data?.leaves || []).map((r:Row)=>[
  r.staffName,r.startDay || r.day,r.endDay || r.day,leaveDays(r as any).length*dayUnits(r.period),r.period==='AM'?'Nửa ngày sáng':r.period==='PM'?'Nửa ngày chiều':'Cả ngày',r.type==='PERMITTED'?'Có phép':'Không phép',r.paid?'Có':'Không',leaveStatus[r.status] || 'Đã ghi trước quy trình duyệt',r.note || '—',
  r.reviewedAt?<span key="review">{people.find(p=>p._id===r.reviewedBy)?.name || 'Chủ spa'}<small>{new Date(r.reviewedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small></span>:'Chưa duyệt',
  <div key="actions" className="actions">{(owner || r.status==='PENDING') && <button onClick={()=>edit(r)}>Sửa</button>}{owner && r.status==='PENDING' && <><button onClick={()=>onOpen('Duyệt nghỉ','reviewStaffLeave',[{key:'paid',label:'Nghỉ hưởng lương',type:'checkbox',optional:true}],{id:r._id,status:'APPROVED',paid:r.paid || false})}>Duyệt</button><button onClick={()=>onOpen('Từ chối nghỉ','reviewStaffLeave',[],{id:r._id,status:'REJECTED',paid:false},'Bản bị từ chối không tính vào ngày nghỉ/lương.')}>Từ chối</button></>}</div>
 ])} empty="Chưa có bản ghi nghỉ trong tháng." />
 </>}
 {data && data.leaveTotal>10 && <div className="customer-picker-pages"><button disabled={loading || data.leavePage<=1} onClick={()=>onLeavePage(data.leavePage-1)}>Trước</button><span>Trang {data.leavePage}/{Math.ceil(data.leaveTotal/10)}</span><button disabled={loading || data.leavePage*10>=data.leaveTotal} onClick={()=>onLeavePage(data.leavePage+1)}>Sau</button></div>}
 </section>
 </>;
}
