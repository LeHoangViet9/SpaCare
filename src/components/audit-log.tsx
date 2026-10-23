'use client';
import CompactDateInput from './compact-date-input';
import { auditActions, auditLines } from '@/lib/audit-view';
type Row = Record<string, any>;
type Filters = { search: string; actor: string; action: string; from: string; to: string };
export default function AuditLog({ data, filters, onFiltersChange, pagination }: { data: Row; filters: Filters; onFiltersChange: (changes: Partial<Filters>) => void; pagination?: { page: number; pageSize: number; total: number; loading?: boolean; onChange: (page: number, size: number) => void } }) {
  const { search, actor, action, from, to } = filters;
  const actors: string[] = data.staff.map((r: Row) => String(r._id));
  const name = (id: string) => data.staff.find((s: Row) => String(s._id) === String(id))?.name || 'Nhân sự #' + String(id).slice(-6);
  const rows = pagination?.loading ? [] : data.audit.map((r: Row) => ({ ...r, lines: auditLines(r.details, data), title: auditActions[r.action] || 'Thao tác khác', actorName: name(r.actorId) }));
  const currentPage = pagination?.page || 1;
  const pageCount = Math.max(1, Math.ceil((pagination?.total || 0) / (pagination?.pageSize || 10)));
  return <section className="panel audit-log"><h3>Nhật ký thao tác</h3><p className="muted">Giờ Việt Nam · Tra cứu toàn bộ lịch sử theo bộ lọc. Tên hiển thị theo danh mục hiện tại; giá trị thay đổi theo lịch sử đã lưu.</p>
    <div className="actions">
      <input aria-label="Tìm nhật ký" maxLength={100} placeholder="Tìm người, khách, nội dung…" value={search} onChange={e => onFiltersChange({ search: e.target.value })} />
      <select aria-label="Người thực hiện" value={actor} onChange={e => onFiltersChange({ actor: e.target.value })}><option value="">Tất cả người thực hiện</option>{actors.map(id => <option key={id} value={id}>{name(id)}</option>)}</select>
      <select aria-label="Loại thao tác" value={action} onChange={e => onFiltersChange({ action: e.target.value })}><option value="">Tất cả thao tác</option>{Object.entries(auditActions).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select>
      <label>Từ ngày <CompactDateInput value={from} onChange={e => onFiltersChange({ from: e.target.value })} /></label><label>Đến ngày <CompactDateInput value={to} min={from} onChange={e => onFiltersChange({ to: e.target.value })} /></label>
    </div><p className="muted">{pagination?.total || 0} thao tác phù hợp</p>
    {rows.map((r: Row) => <article key={r._id} style={{ borderTop: '1px solid var(--border, #ddd)', padding: '16px 0', overflowWrap: 'anywhere' }}>
      <small>{new Date(r.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {r.actorName}</small><h4>{r.title}</h4>
      <p>{r.lines.slice(0, 2).join(' · ')}</p>
      <details><summary>Xem chi tiết và thay đổi</summary><ul>{r.lines.map((line: string, i: number) => <li key={i}>{line}</li>)}</ul><small>Mã bản ghi liên quan: {r.targetId || 'Chưa ghi nhận'}</small></details>
    </article>)}
    {pagination?.loading ? <p role="status">Đang tải nhật ký…</p> : !rows.length && <p className="empty">Không có nhật ký phù hợp.</p>}
    {pageCount > 1 && <div className="actions"><button disabled={pagination?.loading || currentPage === 1} onClick={() => pagination?.onChange(currentPage - 1, pagination.pageSize)}>Trang trước</button><span>Trang {currentPage} / {pageCount}</span><button disabled={pagination?.loading || currentPage === pageCount} onClick={() => pagination?.onChange(currentPage + 1, pagination.pageSize)}>Trang sau</button></div>}
  </section>;
}
