'use client';
import { useState } from 'react';
import { auditActions, auditLines } from '@/lib/audit-view';
type Row = Record<string, any>;
export default function AuditLog({ data }: { data: Row }) {
  const [search, setSearch] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const actors = [...new Set<string>(data.audit.map((r: Row) => String(r.actorId)))];
  const name = (id: string) => data.staff.find((s: Row) => String(s._id) === String(id))?.name || 'Nhân sự #' + String(id).slice(-6);
  const rows = data.audit.map((r: Row) => ({ ...r, lines: auditLines(r.details, data), title: auditActions[r.action] || 'Thao tác khác', actorName: name(r.actorId) })).filter((r: Row) => {
    const day = new Date(r.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    return (!actor || String(r.actorId) === actor) && (!action || r.action === action) && (!from || day >= from) && (!to || day <= to) && [r.title, r.actorName, ...r.lines, r.targetId].join(' ').toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'));
  });
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  return <section className="panel audit-log"><h3>Nhật ký thao tác</h3><p className="muted">Giờ Việt Nam · Lọc trong tối đa {data.tableLimit || 500} bản ghi gần nhất. Tên hiển thị theo danh mục hiện tại; giá trị thay đổi theo lịch sử đã lưu.</p>
    <div className="actions" onChange={() => setPage(0)}>
      <input aria-label="Tìm nhật ký" placeholder="Tìm người, khách, nội dung…" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Người thực hiện" value={actor} onChange={e => setActor(e.target.value)}><option value="">Tất cả người thực hiện</option>{actors.map(id => <option key={id} value={id}>{name(id)}</option>)}</select>
      <select aria-label="Loại thao tác" value={action} onChange={e => setAction(e.target.value)}><option value="">Tất cả thao tác</option>{Object.entries(auditActions).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select>
      <label>Từ ngày <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Đến ngày <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
    </div><p className="muted">{rows.length} thao tác phù hợp</p>
    {rows.slice(currentPage * 20, currentPage * 20 + 20).map((r: Row) => <article key={r._id} style={{ borderTop: '1px solid var(--border, #ddd)', padding: '16px 0', overflowWrap: 'anywhere' }}>
      <small>{new Date(r.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {r.actorName}</small><h4>{r.title}</h4>
      <p>{r.lines.slice(0, 2).join(' · ')}</p>
      <details><summary>Xem chi tiết và thay đổi</summary><ul>{r.lines.map((line: string, i: number) => <li key={i}>{line}</li>)}</ul><small>Mã bản ghi liên quan: {r.targetId || 'Chưa ghi nhận'}</small></details>
    </article>)}
    {!rows.length && <p className="empty">Không có nhật ký phù hợp.</p>}
    {rows.length > 20 && <div className="actions"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Trang trước</button><span>Trang {currentPage + 1} / {Math.ceil(rows.length / 20)}</span><button disabled={(currentPage + 1) * 20 >= rows.length} onClick={() => setPage(currentPage + 1)}>Trang sau</button></div>}
  </section>;
}
