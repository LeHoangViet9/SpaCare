'use client';
import { useFieldError } from './validated-form';
import { useEffect, useId, useState } from 'react';

type Customer = { _id: string; name: string; phone?: string; consultantId?: string };
export default function CustomerPicker({ label, value, onChange, required, disabled, onCustomerChange, searchOnly = false }: {
  label: string; value: string; onChange: (value: string) => void; required: boolean; disabled: boolean; searchOnly?: boolean; onCustomerChange?: (customer: Customer) => void;
}) {
  const id = useId();
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const fieldError = useFieldError('customerId');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ customers: Customer[]; total: number; query: string }>({ customers: [], total: 0, query: '' });
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const query = JSON.stringify([search, page]);
  useEffect(() => {
    const controller = new AbortController();
    if (searchOnly && !search.trim()) { setLoading(false); setResult({customers:[],total:0,query}); return () => controller.abort(); }
    setLoading(true); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search, page: String(page), pageSize: searchOnly ? '100' : '20' });
        const response = await fetch('/api/customers?' + params, { signal: controller.signal, cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Không tải được khách hàng.');
        if (searchOnly) {
          const customers = [...payload.customers];
          for (let next = 2; customers.length < payload.total; next++) {
            params.set('page', String(next));
            const more = await fetch('/api/customers?' + params, { signal: controller.signal, cache: 'no-store' });
            const part = await more.json();
            if (!more.ok) throw new Error(part.error || 'Không tải được khách hàng.');
            if (!part.customers.length) break;
            customers.push(...part.customers);
          }
          payload.customers = customers;
        }
        if (!controller.signal.aborted) { setResult({ ...payload, query }); setLoading(false); }
      } catch (e) { if (!controller.signal.aborted) { setError((e as Error).message); setLoading(false); } }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, page, searchOnly]);
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    const controller = new AbortController();
    fetch('/api/customers?' + new URLSearchParams({ id: value }), { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload; })
      .then(payload => { if (!controller.signal.aborted) { const customer = payload.customers[0] || null; setSelected(customer); if (searchOnly && customer) setSearch(current => current || customer.name); } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [value]);
  const pending = (!searchOnly || !!search.trim()) && (loading || result.query !== query);
  const rows = result.query === query ? result.customers : [];
  const chosen = selected?._id === value ? selected : null;
  const options = chosen && !rows.some(c => c._id === chosen._id) ? [chosen, ...rows] : rows;
  return <div className="customer-picker">
    <label htmlFor={id + '-search'}>{!searchOnly && <strong>Tìm {label.toLocaleLowerCase('vi-VN')}{required && <span className="required-mark"> *</span>}</strong>}<input id={id + '-search'} type="search" aria-label={searchOnly ? "Tìm tên khách hàng" : undefined} onFocus={() => setSuggestionsOpen(true)} value={search} maxLength={100} disabled={disabled} onChange={e => { setSearch(e.target.value); setPage(1); setSuggestionsOpen(true); if (searchOnly && value) { setSelected(null); onChange(''); } }} placeholder={searchOnly ? "Tìm tên khách hàng…" : "Nhập tên hoặc số điện thoại…"} /></label>
    {searchOnly && chosen && <input type="hidden" name="customerId" value={chosen._id}/> }
    {(!searchOnly || (suggestionsOpen && !!search.trim())) && <div className="customer-picker-results" role="group" aria-label={label} aria-busy={pending}>
      {options.map(c => <label key={c._id} className={'customer-picker-option' + (value === c._id ? ' is-selected' : '')}>
        <input type="radio" name="customerId" value={c._id} checked={value === c._id} required={required} disabled={disabled} onChange={() => { if (searchOnly) { setSearch(c.name); setPage(1); setSuggestionsOpen(false); } setSelected(c); onChange(c._id); onCustomerChange?.(c); }} />
        <span><strong>{c.name}</strong><small>{c.phone || 'Chưa có số điện thoại'}{value === c._id ? ' · Đã chọn' : ''}</small></span>
      </label>)}
      {!pending && !error && rows.length === 0 && <p>Không tìm thấy khách hàng.</p>}
    </div>}
    {!searchOnly && result.total > 20 && <div className="customer-picker-pages"><button type="button" disabled={disabled || pending || page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><small role="status">{error ? 'Không tải được kết quả' : pending ? 'Đang tìm…' : `${result.total} khách · Trang ${page}/${Math.max(1, Math.ceil(result.total / 20))}`}</small><button type="button" disabled={disabled || pending || page * 20 >= result.total} onClick={() => setPage(p => p + 1)}>Sau</button></div>}
    {pending && (!searchOnly || suggestionsOpen) && <small role="status">Đang tìm…</small>}
    {fieldError && <small className="field-error" role="alert">{fieldError}</small>}{error && <p className="negative" role="alert">{error}</p>}
  </div>;
}
