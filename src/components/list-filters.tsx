'use client';
import { statusChoices } from '@/lib/workspace-query';
import { datePreset, type ListFilters } from '@/lib/workspace-filters';
type Row = Record<string, any>;
export default function ListFiltersBar({ section, values, today, staff, categories, onChange }: {
  section: string; values: ListFilters; today: string; staff: Row[]; categories: string[]; onChange: (values: Partial<ListFilters>) => void;
}) {
  const dated = ['appointments', 'invoices', 'cash', 'packages', 'deposits', 'days', 'treatment_uses'].includes(section);
  const people = ['appointments', 'cash', 'treatment_uses'].includes(section);
  const groups = ['services', 'package_catalog'].includes(section);
  const options = statusChoices[section] || [];
  if (!dated && !people && !groups && !options.length) return null;
  const changed = Object.values(values).some(Boolean);
  return <section className="list-filters" aria-label="Bộ lọc danh sách">
    <div className="filter-shortcuts">
      {dated && <><button type="button" aria-pressed={values.from === today && values.to === today} onClick={() => onChange(datePreset('today', today))}>Hôm nay</button>
        <button type="button" onClick={() => onChange(datePreset(section === 'appointments' ? 'week' : 'month', today))}>{section === 'appointments' ? '7 ngày tới' : 'Tháng này'}</button></>}
      <button type="button" aria-pressed={!changed} onClick={() => onChange({ status: '', from: '', to: '', employee: '', method: '', direction: '', category: '', customer: '' })}>Tất cả</button>
      {values.customer && <span className="filter-note">Đang lọc theo khách hàng</span>}
    </div>
    <div className="filter-controls">
      {!!options.length && <label>Trạng thái<select value={values.status} onChange={e => onChange({ status: e.target.value })}><option value="">Tất cả</option>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
      {dated && <div className="date-filter-pair"><label>Từ ngày<input type="date" value={values.from} max={values.to || undefined} onChange={e => onChange({ from: e.target.value })} /></label><label>Đến ngày<input type="date" value={values.to} min={values.from || undefined} onChange={e => onChange({ to: e.target.value })} /></label></div>}
      {people && <label>{section === 'cash' ? 'Người tạo' : 'Nhân viên'}<select value={values.employee} onChange={e => onChange({ employee: e.target.value })}><option value="">Tất cả</option>{staff.map(s => <option key={s._id} value={s._id}>{s.name}{s.active ? '' : ' (đã ngừng)'}</option>)}</select></label>}
      {groups && <label>Nhóm dịch vụ<select value={values.category} onChange={e => onChange({ category: e.target.value })}><option value="">Tất cả nhóm</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>}
      {section === 'cash' && <><label>Phương thức<select value={values.method} onChange={e => onChange({ method: e.target.value })}><option value="">Tất cả</option><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Ngân hàng</option></select></label><label>Thu / Chi<select value={values.direction} onChange={e => onChange({ direction: e.target.value })}><option value="">Tất cả</option><option value="IN">Thu</option><option value="OUT">Chi</option></select></label></>}
    </div>
  </section>;
}
