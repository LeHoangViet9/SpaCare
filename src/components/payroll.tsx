'use client';
import { formatCurrency } from '@/lib/currency';
import EmployeeAttendance from './employee-attendance';
import { useEffect, useState } from 'react';
type Row = Record<string, any>;
type Field = { key: string; label: string; type?: string; min?: number; step?: number; max?: number; optional?: boolean; options?: [string, string][]; hint?: string };
const money = formatCurrency;
const status: Record<string, string> = { DRAFT: 'Bản nháp', APPROVED: 'Đã duyệt', PAID: 'Đã chi' };
export default function PayrollPanel({ user, section, today, refreshKey, onOpen }: {
  user: Row; section: 'salary' | 'commission'; today: string; refreshKey: unknown;
  onOpen: (title: string, action: string, fields: Field[], defaults?: Row, description?: string) => void;
}) {
  const owner = user.role === 'OWNER';
  const [month, setMonth] = useState(today.slice(0, 7));
  const [employee, setEmployee] = useState('');
  const [page, setPage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const [workPage,setWorkPage] = useState(1);
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [serviceSearch, setServiceSearch] = useState('');
  const [servicePage, setServicePage] = useState(1);
  const query = new URLSearchParams({ month, employee, view: section, page: String(page), leavePage: String(leavePage), workPage:String(workPage) }).toString();
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    fetch('/api/payroll?' + query, { signal: controller.signal, cache: 'no-store' }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); return body; })
      .then(result => { if (!controller.signal.aborted) { setData(result); setLoading(false); } }).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [query, refreshKey, retry]);
  const people: Row[] = data?.people || [];
  const numberField = (key: string, label: string): Field => ({ key, label, type: 'number', min: 0, max: 1_000_000_000_000 });
  const services: Row[] = data?.services || [];
  const filteredServices = services.filter(s => s.name.toLocaleLowerCase('vi').includes(serviceSearch.trim().toLocaleLowerCase('vi')));
  const configPage = Math.min(servicePage, Math.max(1, Math.ceil(filteredServices.length / 10)));
  function configureCommission(service?: Row) {
    onOpen(service ? 'Sửa hoa hồng dịch vụ' : 'Tạo hoa hồng dịch vụ', 'setServiceCommission', [
      { key: 'serviceId', label: 'Dịch vụ', options: services.map(s => [s._id, s.name + (s.active ? '' : ' (đã ngừng)')]) },
      numberField('commission', 'Hoa hồng cố định / lần thực hiện (VNĐ)'),
    ], { serviceId: service?._id || '', commission: service?.commission ?? 0 }, 'Ví dụ: Gội đầu 10.000đ, Nặn mụn 20.000đ. Mỗi dịch vụ có một mức cố định, dùng chung cho nhân viên thực hiện. Không đổi khoản hoa hồng đã ghi nhận hoặc snapshot trên hóa đơn đã tạo.');
  }
  function editPayroll(person: Row, record?: Row) {
    onOpen(record ? 'Cập nhật bảng lương nháp' : 'Lập bảng lương tháng', 'savePayroll', [numberField('baseSalary', 'Lương cơ bản tháng (VNĐ)'), {...numberField('bonus', 'Thưởng / phụ cấp (VNĐ)'),optional:true}, {...numberField('deductions', 'Khấu trừ khác (VNĐ)'),optional:true}, {...numberField('advance','Tạm ứng đã nhận (VNĐ)'),optional:true}, {key:'attendanceConfirmed',label:'Đã kiểm tra đủ dữ liệu ngày công của tháng (khi tính theo ngày)',type:'checkbox',optional:true}, { key: 'note', label: 'Lý do thưởng / khấu trừ', optional: true }],
      { ...(record ? { id: record._id } : {}), staffId: person._id, month, advance:record?.advance || 0, attendanceConfirmed:record?.attendanceConfirmed || false, baseSalary: record?.baseSalary ?? person.baseSalary ?? 0, bonus: record?.bonus || 0, deductions: record?.deductions || 0, note: record?.note || '' },
      `${person.name} · ${month}. Cộng hoa hồng chưa vào bảng lương đến hết tháng, gồm khoản còn lại từ tháng trước. Lập nháp chưa ghi chi tiền. Tạm ứng nhập là khoản đã nhận, không tạo thêm phiếu chi.`);
  }
  function pay(record: Row) {
    onOpen('Ghi nhận chi lương', 'payPayroll', [
      { key: 'method', label: 'Phương thức chi', options: [['CASH', 'Tiền mặt'], ['BANK_TRANSFER', 'Chuyển khoản']] },
      { key: 'receivedConfirmation', label: 'Đã thực chi / chuyển tiền cho nhân viên', type: 'checkbox' },
      { key: 'transferReference', label: 'Tham chiếu chuyển khoản (nếu có)', optional: true }, { key: 'note', label: 'Ghi chú chi lương', optional: true },
    ], { id: record._id, method: 'CASH' }, `${record.staffName} · ${record.month} · ${money(record.total)}. Số tiền lấy từ bảng đã duyệt; chi thực tế mới ghi sổ. Khoản dương cần sổ hôm nay đang mở.`);
  }
  return <div className="payroll-workspace">
    <section className="list-filters"><div className="filter-controls"><label>Tháng<input type="month" value={month} required onChange={e => { if (e.target.value) { setMonth(e.target.value); setPage(1); setLeavePage(1); setWorkPage(1); } }} /></label>
      {owner && <label>Nhân viên<select value={employee} onChange={e => { setEmployee(e.target.value); setPage(1); setLeavePage(1); setWorkPage(1); }}><option value="">Tất cả</option>{people.map(p => <option key={p._id} value={p._id}>{p.name}{p.active ? '' : ' (đã ngừng)'}</option>)}</select></label>}
    </div></section>
    {error && <div className="alert error" role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Thử lại</button></div>}
    {section === 'salary' && <div className="report-stats">{[['DRAFT', 'Lương nháp'], ['APPROVED', 'Chờ chi'], ['PAID', 'Đã chi']].map(([key, title]) => {
      const item = data?.salarySummary?.find((r: Row) => r._id === key);
      return <div className="report-stat" key={key}><small>{title}</small><strong>{loading ? '…' : money(item?.total)}</strong><span>{loading ? '…' : item?.count || 0} bảng lương</span></div>;
    })}</div>}
    {section === 'salary' && <p className="inline-note">Lập nháp → Duyệt → Ghi nhận chi lương. Tổng số tính toàn bộ tháng và nhân viên đã chọn, gồm cả các trang tiếp theo.</p>}
    <div className="profile-summary"><div><small>Hoa hồng dịch vụ</small><strong>{loading ? "…" : money(data?.summary.serviceCommission)}</strong></div><div><small>Hoa hồng bán gói 5%</small><strong>{loading ? "…" : money(data?.summary.saleCommission)}</strong></div><div><small>Hoa hồng trong tháng</small><strong>{loading ? '…' : money(data?.summary.commission)}</strong></div><div><small>Ca / buổi dịch vụ ghi nhận</small><strong>{loading ? '…' : data?.summary.sessions || 0}</strong></div><div><small>Chưa vào bảng lương</small><strong>{loading ? '…' : money(data?.summary.unsettled)}</strong></div></div>
    {section === 'salary' && <section className="panel payroll-config"><h3>{owner ? 'Lương cơ bản nhân viên' : 'Lương cơ bản của bạn'}</h3><div className="payroll-people">{people.filter(p => !employee || p._id === employee).map(p => <article key={p._id}><div><strong>{p.name}</strong><p>{p.baseSalary === null ? 'Chưa cài lương cơ bản' : money(p.baseSalary) + ' / tháng'}</p></div>{owner && <div className="actions"><button disabled={loading} onClick={() => onOpen('Cài lương cơ bản', 'setStaffSalary', [numberField('baseSalary', 'Lương cơ bản / tháng (VNĐ)')], { staffId: p._id, baseSalary: p.baseSalary ?? 0 }, p.name + '. Chỉ áp dụng cấu hình, không sửa bảng lương đã lập.')}>Cài lương</button><button disabled={loading} onClick={()=>onOpen('Chính sách lương theo ngày','setSalaryPolicy',[
 {key:'standardDays',label:'Ngày công chuẩn / tháng',type:'number',min:1,max:31,step:0.5},
 {key:'paidLeaveDays',label:'Hạn mức ngày nghỉ hưởng lương / tháng',type:'number',min:0,max:31,step:0.5},
 {key:'mode',label:'Cách tính lương',options:[['NONE','Lương tháng, không tự khấu trừ'],['DAILY','Theo ngày công đã xác nhận']]},
],{staffId:p._id,...(p.salaryPolicy || {standardDays:26,paidLeaveDays:0,mode:'NONE'})},'Các giá trị ban đầu chỉ là gợi ý. Chủ spa lưu mới áp dụng. Theo ngày: lương cơ bản × (công thực tế + nghỉ hưởng lương trong hạn mức) / công chuẩn, tối đa lương cơ bản; làm tròn VNĐ. Không suy công từ lịch hẹn.')}>Chính sách lương</button><button disabled={loading || month > today.slice(0, 7)} onClick={() => editPayroll(p, data?.rows.find((r: Row) => r.staffId === p._id))}>Lập / cập nhật nháp</button></div>}</article>)}</div></section>}
    {section === 'salary' && <EmployeeAttendance data={data} owner={owner} userId={user.id} employee={employee} today={today} loading={loading} onOpen={onOpen} onLeavePage={setLeavePage} onWorkPage={setWorkPage} />}
    <section className="panel panel-padded"><h3>{section === 'salary' ? 'Bảng lương tháng' : 'Chi tiết hoa hồng'}</h3>
      {loading ? <p role="status">Đang tải…</p> : !data?.rows.length ? <p>Chưa có bản ghi trong tháng này.</p> : <div className="payroll-records">{data.rows.map((r: Row) => section === 'salary' ? <article key={r._id} className="payroll-record"><div className="section-head"><strong>{r.staffName} · {r.month}</strong><span className={'badge ' + r.status.toLowerCase()}>{status[r.status]}</span></div>
        <dl><dt>Lương cơ bản</dt><dd>{money(r.baseSalary)}</dd><dt>Lương theo công</dt><dd>{money(r.earnedBase ?? r.baseSalary)}</dd><dt>Ngày công xác nhận</dt><dd>{r.workdays ?? "Chưa xác nhận"}</dd><dt>Nghỉ có phép / không phép</dt><dd>{r.leaveStats?.permitted || 0} / {r.leaveStats?.unpermitted || 0} ngày</dd><dt>Khấu trừ theo chính sách ngày công</dt><dd>{money(r.leaveDeduction || 0)} (đã tính trong lương theo công)</dd><dt>Hoa hồng dịch vụ</dt><dd>{money(r.serviceCommissionTotal ?? r.commissionTotal)}</dd><dt>Hoa hồng bán gói 5%</dt><dd>{money(r.saleCommissionTotal)}</dd><dt>Tạm ứng đã nhận</dt><dd>−{money(r.advance)}</dd><dt>Thưởng / phụ cấp</dt><dd>+{money(r.bonus)}</dd><dt>Khấu trừ</dt><dd>−{money(r.deductions)}</dd><dt>Thực nhận</dt><dd><strong>{money(r.total)}</strong></dd></dl>
        {r.carryoverCount > 0 && <small>Gồm {r.carryoverCount} khoản chưa chốt từ tháng trước.</small>}{r.note && <p>{r.note}</p>}
        {r.paidAt && <small>Đã chi: {new Date(r.paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small>}
        {owner && <div className="actions">{r.status === 'DRAFT' && <><button onClick={() => editPayroll(people.find(p => p._id === r.staffId) || { _id: r.staffId, name: r.staffName }, r)}>Cập nhật nháp</button><button className="primary" onClick={() => onOpen('Duyệt bảng lương', 'approvePayroll', [], { id: r._id, expectedTotal: r.total }, `${r.staffName} · ${r.month} · ${money(r.total)}. Duyệt sẽ khóa số liệu và gắn các khoản hoa hồng vào bảng này. Chưa chi tiền.`)}>Duyệt</button></>}{r.status === 'APPROVED' && <button className="primary" onClick={() => pay(r)}>Ghi nhận chi lương</button>}</div>}
      </article> : <article key={r._id} className="payroll-record"><div className="section-head"><strong>{r.serviceName}</strong><strong className="positive">{money(r.amount)}</strong></div><p>{r.staffName} · {new Date(r.earnedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p><small>{r.category === 'PACKAGE_SALE' ? 'Bán gói 5% · hóa đơn #' + String(r.invoiceId).slice(-6) : r.sourceType === 'TREATMENT_USE' ? 'Buổi liệu trình' : 'Dịch vụ lẻ'} · #{String(r.sourceId).slice(-6)}</small><p>{r.payrollId ? `${status[r.payrollStatus] || 'Đã vào bảng lương'} · ${r.payrollMonth || ''}` : 'Chưa vào bảng lương'}</p></article>)}</div>}
      {!loading && data && data.total > 10 && <div className="customer-picker-pages"><button disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Trước</button><span>Trang {data.page}/{Math.ceil(data.total / 10)}</span><button disabled={data.page * 10 >= data.total} onClick={() => setPage(data.page + 1)}>Sau</button></div>}
    </section>
    {owner && section === 'commission' && <section className="panel payroll-config">
      <div className="section-head"><h3>Hoa hồng theo dịch vụ</h3><button className="primary" disabled={loading || !services.length} onClick={() => configureCommission()}>＋ Tạo hoa hồng</button></div>
      <label><strong>Tìm dịch vụ</strong><input type="search" placeholder="Nhập tên dịch vụ" value={serviceSearch} onChange={e => { setServiceSearch(e.target.value); setServicePage(1); }} /></label>
      {!loading && !services.length && <p>Chưa có dịch vụ. <a href="/workspace/services">Thêm dịch vụ</a> trước khi cài hoa hồng.</p>}
      {!loading && services.length > 0 && !filteredServices.length && <p>Không tìm thấy dịch vụ.</p>}
      <div className="payroll-people">{filteredServices.slice((configPage - 1) * 10, configPage * 10).map(s => <article key={s._id}><div><strong>{s.name}</strong><p>{money(s.commission)} / lần{s.active ? '' : ' · Đã ngừng'}</p></div><button disabled={loading} onClick={() => configureCommission(s)}>Sửa hoa hồng</button></article>)}</div>
      {filteredServices.length > 10 && <div className="customer-picker-pages"><button disabled={configPage <= 1} onClick={() => setServicePage(configPage - 1)}>Trước</button><span>Trang {configPage}/{Math.ceil(filteredServices.length / 10)}</span><button disabled={configPage * 10 >= filteredServices.length} onClick={() => setServicePage(configPage + 1)}>Sau</button></div>}
    </section>}
  </div>;
}
