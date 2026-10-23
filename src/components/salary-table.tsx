import { formatCurrency as money } from '@/lib/currency';
type Row = Record<string, any>;
const statuses: Record<string,string> = { DRAFT:'Bản nháp', APPROVED:'Chờ chi', PAID:'Đã chi' };
export default function SalaryTable({rows,owner,onEdit,onApprove,onPay}: {
 rows:Row[];owner:boolean;onEdit:(row:Row)=>void;onApprove:(row:Row)=>void;onPay:(row:Row)=>void;
}) {
 const headers=['Nhân viên','Lương cơ bản','Ngày công / nghỉ','Lương tính','HH dịch vụ','HH bán gói','Thưởng / phụ cấp','Khấu trừ','Tạm ứng','Thực nhận','Trạng thái','Thao tác'];
 return <><p className="salary-table-hint">Xoay ngang điện thoại để xem bảng rộng hơn. Vuốt ngang để xem đầy đủ các cột. Đơn vị: đồng.</p><div className="table-scroll salary-table-scroll" role="region" aria-label="Bảng lương chi tiết, cuộn ngang để xem các cột" tabIndex={0}><table className="salary-table"><caption className="salary-caption">Lương tính + hoa hồng dịch vụ + hoa hồng bán gói + thưởng − khấu trừ − tạm ứng = Thực nhận</caption><thead><tr>{headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r._id}>
 <td><div className="salary-cell"><strong>{r.staffName}</strong><small>Kỳ {r.month}</small>{r.carryoverCount>0&&<small>Gồm {r.carryoverCount} khoản hoa hồng tồn kỳ trước</small>}{r.note&&<small>Ghi chú: {r.note}</small>}</div></td>
 <td className="salary-money">{money(r.baseSalary)}</td>
 <td><span>Công: {r.workdays ?? 'Chưa xác nhận'}</span><small>Nghỉ có phép: {r.leaveStats?.permitted || 0} ngày</small><small>Không phép: {r.leaveStats?.unpermitted || 0} ngày</small></td>
 <td className="salary-money">{money(r.earnedBase ?? r.baseSalary)}<small>Giảm theo công: {money(r.leaveDeduction || 0)}<br/>(đã tính trong lương)</small></td>
 <td className="salary-money">{money(r.serviceCommissionTotal ?? r.commissionTotal)}</td><td className="salary-money">{money(r.saleCommissionTotal)}</td>
 <td className="salary-money">{money(r.bonus)}</td><td className="salary-money">{money(r.deductions)}</td><td className="salary-money">{money(r.advance)}</td>
 <td className="salary-money salary-net"><strong>{money(r.total)}</strong></td>
 <td><span className={'badge '+String(r.status).toLowerCase()}>{statuses[r.status] || r.status}</span>{r.paidAt&&<small>{new Date(r.paidAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small>}</td>
 <td className="table-actions"><div className="actions">{owner&&r.status==='DRAFT'&&<><button type="button" onClick={()=>onEdit(r)}>Cập nhật nháp</button><button type="button" className="primary" onClick={()=>onApprove(r)}>Duyệt lương</button></>}{owner&&r.status==='APPROVED'&&<button type="button" className="primary" onClick={()=>onPay(r)}>Ghi nhận chi</button>}{r.status==='PAID'?<small>Đã hoàn tất</small>:!owner?<small>Chỉ xem</small>:null}</div></td>
 </tr>)}</tbody></table></div></>;
}
