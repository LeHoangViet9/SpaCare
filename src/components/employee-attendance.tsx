'use client';
import PayrollGrid from './payroll-grid';
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
 <p className="payroll-grid-hint">Xoay ngang điện thoại hoặc vuốt bảng để xem đủ các cột.</p>
 <p className="inline-note">Không dùng lịch hẹn để suy ngày công. Chỉ nghỉ đã duyệt được thống kê vào lương; chủ spa xác nhận đủ dữ liệu công khi lập nháp theo ngày.</p>
 {loading ? <p role="status">Đang tải…</p> : <>
 <PayrollGrid label="Tổng hợp ngày công và nghỉ trong tháng" headers={['Nhân viên','Ngày công đã ghi','Nghỉ có phép','Nghỉ không phép','Đề nghị hưởng lương','Không hưởng lương']} rows={people.filter(p=>!employee || employee===p._id).map(p=> {
  const r=data?.leaveSummary?.find((r:Row)=>r.staffId===p._id) || {};
  const work=data?.workSummary?.find((r:Row)=>r._id===p._id)?.days;
  return [<strong key="name">{p.name}</strong>,work ?? 'Chưa ghi',r.permitted || 0,r.unpermitted || 0,r.paid || 0,r.unpaid || 0];
 })} empty="Chưa có nhân viên phù hợp." />
 <small>Đơn vị: ngày. Ngày hưởng lương thực tính còn phụ thuộc hạn mức cấu hình.</small>
 <PayrollGrid label="Danh sách nghỉ phép" headers={['Nhân viên','Từ ngày','Đến ngày','Thời gian','Loại nghỉ','Hưởng lương đề nghị','Trạng thái','Lý do','Người duyệt / thời gian','Thao tác']} rows={(data?.leaves || []).map((r:Row)=>[
  r.staffName,r.startDay || r.day,r.endDay || r.day,r.period==='AM'?'Nửa ngày sáng':r.period==='PM'?'Nửa ngày chiều':'Cả ngày',r.type==='PERMITTED'?'Có phép':'Không phép',r.paid?'Có':'Không',leaveStatus[r.status] || 'Đã ghi trước quy trình duyệt',r.note || '—',
  r.reviewedAt?<span key="review">{people.find(p=>p._id===r.reviewedBy)?.name || 'Chủ spa'}<small>{new Date(r.reviewedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small></span>:'Chưa duyệt',
  <div key="actions" className="actions">{(owner || r.status==='PENDING') && <button onClick={()=>edit(r)}>Sửa</button>}{owner && r.status==='PENDING' && <><button onClick={()=>onOpen('Duyệt nghỉ','reviewStaffLeave',[{key:'paid',label:'Nghỉ hưởng lương',type:'checkbox',optional:true}],{id:r._id,status:'APPROVED',paid:r.paid || false})}>Duyệt</button><button onClick={()=>onOpen('Từ chối nghỉ','reviewStaffLeave',[],{id:r._id,status:'REJECTED',paid:false},'Bản bị từ chối không tính vào ngày nghỉ/lương.')}>Từ chối</button></>}</div>
 ])} empty="Chưa có bản ghi nghỉ trong tháng." />
 </>}
 {data && data.leaveTotal>10 && <div className="customer-picker-pages"><button disabled={loading || data.leavePage<=1} onClick={()=>onLeavePage(data.leavePage-1)}>Trước</button><span>Trang {data.leavePage}/{Math.ceil(data.leaveTotal/10)}</span><button disabled={loading || data.leavePage*10>=data.leaveTotal} onClick={()=>onLeavePage(data.leavePage+1)}>Sau</button></div>}
 </section>
 <section className="panel panel-padded"><div className="section-head"><h3>Ngày công thực tế đã ghi</h3>{owner && <button disabled={loading || !people.length} onClick={()=>onOpen('Ghi / sửa ngày công','recordWorkday',[select,{key:'day',label:'Ngày làm',type:'date'},period,{key:'note',label:'Ghi chú',optional:true}],{staffId:employee || people[0]?._id,day:today,period:'FULL'},'Ghi theo thực tế. Cùng người/ngày cập nhật bản hiện có; không tự tạo từ lịch hẹn.')}>＋ Ghi ngày công</button>}</div>
 {!loading && <PayrollGrid label="Ngày công thực tế đã ghi" headers={['Nhân viên','Ngày làm','Thời gian','Số công','Ghi chú']} rows={(data?.workdays || []).map((r:Row)=>[
  people.find(p=>p._id===r.staffId)?.name || 'Chưa ghi nhận',r.day,r.period==='FULL'?'Cả ngày':r.period==='AM'?'Nửa ngày sáng':'Nửa ngày chiều',r.period==='FULL'?1:'0,5',r.note || '—'
 ])} empty="Chưa có ngày công trong tháng." />}
 {data && data.workTotal>10 && <div className="customer-picker-pages"><button disabled={loading || data.workPage<=1} onClick={()=>onWorkPage(data.workPage-1)}>Trước</button><span>Trang {data.workPage}/{Math.ceil(data.workTotal/10)}</span><button disabled={loading || data.workPage*10>=data.workTotal} onClick={()=>onWorkPage(data.workPage+1)}>Sau</button></div>}
 </section></>;
}
