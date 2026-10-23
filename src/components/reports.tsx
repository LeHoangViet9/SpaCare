'use client';
import { formatCurrency } from '@/lib/currency';
import Link from 'next/link';
import { useState } from 'react';
import { datePreset } from '@/lib/workspace-filters';

type Row = Record<string, any>;
const money = formatCurrency;
const kinds: Record<string, string> = { SERVICE: 'Dịch vụ lẻ', PACKAGE: 'Bán gói', PRODUCT: 'Sản phẩm', SESSION: 'Buổi liệu trình', GIFT: 'Quà tặng', LEGACY: 'Hóa đơn cũ' };
function Stat({ title, value }: { title: string; value: string | number }) { return <div className="report-stat"><small>{title}</small><strong>{value}</strong></div>; }
function Grid({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="table-scroll"><table className="responsive-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} data-label={headers[j]}>{v}</td>)}</tr>) : <tr><td colSpan={headers.length}><p className="empty">Không có dữ liệu trong khoảng ngày này.</p></td></tr>}</tbody></table></div>;
}
export default function Reports({ report, today, period, onPeriod, pending, owner, onPage, onInvoice, onStaff }: {
  report: Row; today: string; period: { from: string; to: string }; onPeriod: (p: { from: string; to: string }) => void;
  pending: boolean; owner: boolean; onPage: (page: number) => void; onInvoice: (id: string) => void; onStaff: (id: string) => void;
}) {
  const [tab, setTab] = useState('revenue');
  const [search, setSearch] = useState('');
  const [staffPaging, setStaffPaging] = useState({ search: '', page: 1 });
  const r = pending ? {} : report;
  const summary = r.summary || {};
  const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const employees: Row[] = (r.employees || []).filter((s: Row) => normalized(s.name + ' ' + s.email).includes(normalized(search)));
  const staffPage = Math.min(staffPaging.search === search ? staffPaging.page : 1, Math.max(1, Math.ceil(employees.length / 10)));
  const employeeRows = employees.slice((staffPage - 1) * 10, staffPage * 10);
  const activeTab = tab === 'staff' && !owner ? 'revenue' : tab;
  const display = (n: number, currency = true) => pending ? '…' : currency ? money(n) : n || 0;
  function exportSummary() {
    const rows = activeTab === 'staff'
      ? [['Nhân viên', 'Lịch được giao', 'Lịch hoàn thành', 'Buổi liệu trình', 'Hóa đơn tư vấn', 'Giá trị tư vấn', 'Hoa hồng dịch vụ', 'Hoa hồng bán gói'], ...employees.map(s => [s.name, s.appointments, s.completed, s.sessions, s.invoices, s.sales, s.commission, s.saleCommission || 0])]
      : activeTab === 'cash'
        ? [['Ngày', 'Thực thu', 'Thực chi', 'Chênh lệch'], ...(r.days || []).map((d: Row) => [d._id, d.incoming, d.outgoing, d.incoming - d.outgoing])]
        : [['Ngày tạo', 'Số hóa đơn', 'Giá trị hóa đơn'], ...(r.dailyInvoices || []).map((d: Row) => [d._id, d.count, d.total])];
    // Text prefix prevents spreadsheet formula execution from staff names.
    const cell = (v: unknown) => '"' + String(typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v ?? '').replace(/"/g, '""') + '"';
    const blob = new Blob(['\ufeff' + rows.map((row: unknown[]) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `SpaCare-${activeTab}-${period.from || 'tat-ca'}-${period.to || today}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="reports-workspace" aria-busy={pending}>
    <div className="panel panel-padded report-controls"><div className="filter-shortcuts"><button onClick={() => onPeriod(datePreset('today', today))}>Hôm nay</button><button onClick={() => onPeriod(datePreset('month', today))}>Tháng này</button><button onClick={() => onPeriod({ from: '', to: '' })}>Toàn bộ</button></div>
      <div className="report-filters"><label>Từ ngày<input type="date" value={period.from} max={period.to || undefined} onChange={e => onPeriod({ ...period, from: e.target.value })} /></label><label>Đến ngày<input type="date" value={period.to} min={period.from || undefined} onChange={e => onPeriod({ ...period, to: e.target.value })} /></label><button disabled={pending} onClick={exportSummary}>Xuất CSV tổng hợp</button></div>
      <div className="profile-tabs" role="group" aria-label="Loại báo cáo">{[['revenue', 'Hóa đơn & doanh số'], ...(owner ? [['staff', 'Nhân viên']] : []), ['cash', 'Thu chi']].map(([key, name]) => <button key={key} aria-pressed={activeTab === key} onClick={() => setTab(key)}>{name}</button>)}</div>
    </div>
    {pending && <p role="status">Đang tổng hợp báo cáo…</p>}
    {activeTab === 'revenue' && <>
      <div className="report-stats"><Stat title="Số hóa đơn" value={display(summary.count, false)} /><Stat title="Giá trị hóa đơn" value={display(summary.total)} /><Stat title="Đã thanh toán" value={display(summary.paid)} /><Stat title="Còn nợ" value={display(summary.debt)} /><Stat title="Đã hoàn tiền" value={display(summary.refunded)} /></div>
      <p className="inline-note">Lọc theo ngày tạo hóa đơn. Đã thanh toán gồm tiền trả trực tiếp và cọc đã phân bổ, tính đến hiện tại trước trừ hoàn tiền. Khoản hoàn hiển thị riêng và đã ghi vào thực chi. Giá trị hóa đơn chưa phải doanh thu kế toán.</p>
      <section className="panel"><div className="section-head"><h3>Theo loại hóa đơn</h3></div><Grid headers={['Loại', 'Số hóa đơn', 'Giá trị', 'Đã thanh toán']} rows={(r.kinds || []).map((k: Row) => [kinds[k._id] || k._id, k.count, money(k.total), money(k.paid)])} /></section>
      <section className="panel"><div className="section-head"><h3>Chi tiết hóa đơn</h3><span>{r.total || 0} hóa đơn</span></div><Grid headers={['Mã hóa đơn', 'Ngày tạo', 'Khách hàng', 'Nội dung', 'Tổng tiền', 'Đã thanh toán', 'Còn nợ']} rows={(r.invoices || []).map((i: Row) => [<button className="text-button" key="invoice" onClick={() => onInvoice(i._id)}>#{i._id.slice(-6)}</button>, new Date(i.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), i.customerName, i.description, money(i.total), money(i.paid), money(i.total - i.paid)])} />
        <div className="report-pagination"><button disabled={pending || (r.page || 1) <= 1} onClick={() => onPage(r.page - 1)}>Trước</button><span>Trang {r.page || 1} / {Math.max(1, Math.ceil((r.total || 0) / (r.pageSize || 10)))}</span><button disabled={pending || (r.page || 1) * (r.pageSize || 10) >= (r.total || 0)} onClick={() => onPage(r.page + 1)}>Sau</button></div></section>
    </>}
    {activeTab === 'staff' && <>
      <div className="report-stats"><Stat title="Nhân sự" value={display(employees.length, false)} /><Stat title="Lịch hoàn thành" value={display(employees.reduce((s, e) => s + e.completed, 0), false)} /><Stat title="Buổi liệu trình" value={display(employees.reduce((s, e) => s + e.sessions, 0), false)} /><Stat title="Hoa hồng phát sinh" value={display(employees.reduce((s, e) => s + e.commission, 0))} /></div>
      <section className="panel"><div className="section-head"><h3>Kết quả theo nhân viên</h3><input type="search" aria-label="Tìm nhân viên trong báo cáo" placeholder="Tìm tên hoặc email" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <p className="inline-note">Lịch tính theo ngày hẹn; buổi theo ngày thực hiện; tư vấn theo ngày tạo hóa đơn; hoa hồng theo ngày phát sinh. Lịch hoàn thành có thể đã gồm buổi liệu trình, không cộng hai cột thành tổng ca.</p>
        <Grid headers={['Nhân viên', 'Lịch được giao', 'Hoàn thành', 'Đã hủy', 'Buổi liệu trình', 'Hóa đơn tư vấn', 'Giá trị tư vấn', 'Hoa hồng dịch vụ', 'Hoa hồng bán gói']} rows={employeeRows.map(e => [<button key="staff" className="text-button" onClick={() => onStaff(e._id)}>{e.name}{!e.active && ' (đã khóa)'}</button>, e.appointments, e.completed, e.cancelled, e.sessions, e.invoices, money(e.sales), money(e.commission), money(e.saleCommission || 0)])} />
        <div className="report-pagination"><button disabled={staffPage <= 1} onClick={() => setStaffPaging({ search, page: staffPage - 1 })}>Trước</button><span>Trang {staffPage} / {Math.max(1, Math.ceil(employees.length / 10))}</span><button disabled={staffPage * 10 >= employees.length} onClick={() => setStaffPaging({ search, page: staffPage + 1 })}>Sau</button></div>
      </section><div className="shared-card-actions"><Link className="pub-btn" href="/workspace/staff">Danh sách nhân viên</Link><Link className="pub-btn" href="/workspace/salary">Bảng lương</Link><Link className="pub-btn" href="/workspace/commission">Chi tiết hoa hồng</Link></div>
    </>}
    {activeTab === 'cash' && <>
      <div className="report-stats"><Stat title="Thực thu" value={display(r.inflow)} /><Stat title="Thực chi" value={display(r.outflow)} /><Stat title="Dòng tiền ròng" value={display(r.inflow - r.outflow)} /></div>
      <p className="inline-note">Theo ngày ghi sổ, gồm cọc, thu hóa đơn, thu chi khác và bút toán đảo. Phân bổ cọc không tạo dòng tiền mới. Dòng tiền ròng chưa phải lợi nhuận.</p>
      <section className="panel"><div className="section-head"><h3>Phương thức thanh toán</h3></div><Grid headers={['Phương thức', 'Thực thu', 'Thực chi']} rows={(r.methods || []).map((m: Row) => [m._id === 'CASH' ? 'Tiền mặt' : m._id === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Chưa xác định', money(m.incoming), money(m.outgoing)])} /></section>
      <section className="panel"><div className="section-head"><h3>Dòng tiền theo ngày</h3></div><div className="flow-chart">{(r.days || []).slice(-14).map((d: Row) => <div className="flow-row" key={d._id}><span>{d._id.slice(5)}</span><div className="bars"><div className="bar incoming" style={{ width: `${d.incoming / Math.max(1, ...r.days.map((x: Row) => Math.max(x.incoming, x.outgoing))) * 100}%` }} /><div className="bar outgoing" style={{ width: `${d.outgoing / Math.max(1, ...r.days.map((x: Row) => Math.max(x.incoming, x.outgoing))) * 100}%` }} /></div><small>Thu {money(d.incoming)} · Chi {money(d.outgoing)}</small></div>)}</div><p className="inline-note">Biểu đồ hiển thị 14 ngày có giao dịch gần nhất. Tổng số và CSV bao gồm toàn bộ khoảng lọc.</p></section>
    </>}
  </section>;
}
