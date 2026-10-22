'use client';
import { useEffect, useState } from 'react';
import CustomerPicker from './customer-picker';
import SignaturePad from './signature-pad';
import { isValidSignature, type Signature } from '@/lib/signature';
import { cashierCatalog, type CashierMode } from '@/lib/cashier-catalog';
type Row = Record<string, any>;
const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';
export default function Cashier({ data, busy, initialMode, initialCustomer, onSubmit, onInvoices, onNewCustomer }: {
  data: Row; busy: boolean; initialMode: CashierMode; initialCustomer?: Row | null; onSubmit: (action: string, values: Row) => void; onInvoices: () => void; onNewCustomer: () => void;
}) {
  const [mode, setMode] = useState<CashierMode>(initialMode);
  const [customer, setCustomer] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [consultantId, setConsultantId] = useState('');
  const [performerId, setPerformerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [promotion, setPromotion] = useState('');
  const [gifts, setGifts] = useState<string[]>([]);
  const [signature, setSignature] = useState<Signature>({ version: 1, strokes: [] });
  const [error, setError] = useState('');
  const allCatalog = cashierCatalog({ services: data.services, products: data.products || [], packageTemplates: data.packageTemplates || [], treatments: data.treatments }, mode, customer?._id || '', search);
  const categoryOf = (r: Row) => mode === 'product' ? data.productGroups?.find((g: Row) => g._id === r.groupId)?.name : mode === 'service' ? r.category : data.services.find((s: Row) => s._id === r.serviceId)?.category;
  const categories = [...new Set<string>(allCatalog.map(categoryOf).filter(Boolean))].sort();
  const catalog = allCatalog.filter(r => !category || categoryOf(r) === category);
  const templates = cashierCatalog({ services: data.services, packageTemplates: data.packageTemplates || [], treatments: data.treatments }, 'package', '', '');
  const pageCount = Math.max(1, Math.ceil(catalog.length / 8));
  const page = Math.min(catalogPage, pageCount);
  const amount = mode === 'session' ? 0 : Number(price) * (mode === 'product' ? Number(quantity) : 1);
  function resetSelection() { setSelected(null); setDescription(''); setPrice(''); setQuantity('1'); setGifts([]); setPromotion(''); setPerformerId(''); setSignature({ version: 1, strokes: [] }); setError(''); }
  useEffect(() => {
    if (!initialCustomer) return;
    setCustomer(initialCustomer); setConsultantId(initialCustomer.consultantId || ''); resetSelection(); setCatalogPage(1);
  }, [initialCustomer]);
  function choose(row: Row) { setSelected(row); setDescription(row.name); setQuantity('1'); setPrice(String(mode === 'session' ? 0 : row.price)); setSignature({ version: 1, strokes: [] }); setError(''); }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    if (!customer || !selected) { setError('Chọn khách hàng và dịch vụ hoặc gói trước khi lưu.'); return; }
    if (mode === 'session' && !isValidSignature(signature)) { setError('Khách cần ký xác nhận buổi thực hiện.'); return; }
    if (mode === 'package' && gifts.length && (!promotion.trim() || gifts.some(g => !g))) { setError('Nhập đợt khuyến mãi và chọn đủ gói quà tặng.'); return; }
    const common = { customerId: customer._id, ...(consultantId ? { consultantId } : {}) };
    if (mode === 'product') onSubmit('sellProduct', { ...common, productId: selected._id, quantity: Number(quantity), unitPrice: Number(price), ...(dueDate ? { dueDate } : {}) });
    else if (mode === 'package') onSubmit('sellPackage', { ...common, templateId: selected._id, total: amount, dueDate, promotion, gifts: gifts.map(templateId => ({ templateId })) });
    else onSubmit('invoice', { ...common, serviceId: mode === 'session' ? selected.serviceId : selected._id, description, total: amount,
      ...(mode === 'session' ? { treatmentId: selected._id, remainingBefore: selected.remaining, signature, staffId: performerId } : dueDate ? { dueDate } : {}) });
  }
  return <form onSubmit={submit} className="cashier">
    <section className="panel cashier-customer"><div className="section-head"><h3>1. Khách hàng</h3><div className="actions"><button type="button" onClick={onNewCustomer} disabled={busy}>+ Khách mới</button><button type="button" onClick={onInvoices} disabled={busy}>Danh sách hóa đơn</button></div></div>
      <CustomerPicker label="Khách hàng" value={customer?._id || ''} onChange={() => {}} onCustomerChange={c => { setCustomer(c); setConsultantId(c.consultantId || ''); resetSelection(); setCatalogPage(1); }} required disabled={busy} />
    </section>
    <section className="panel cashier-catalog"><h3>2. Chọn dịch vụ / sản phẩm</h3>
      <div className="cashier-modes" role="group" aria-label="Loại hóa đơn">{([['service', 'Dịch vụ lẻ'], ['package', 'Bán gói'], ['session', 'Dùng liệu trình'], ['product', 'Sản phẩm']] as const).map(([key, title]) => <button type="button" key={key} aria-pressed={mode === key} disabled={busy} onClick={() => { setMode(key); setSearch(''); setCategory(''); setCatalogPage(1); resetSelection(); }}>{title}</button>)}</div>
      <label><strong>{mode === 'product' ? 'Tìm sản phẩm' : 'Tìm dịch vụ hoặc gói'}</strong><input type="search" value={search} disabled={busy} maxLength={100} placeholder="Nhập tên hoặc mã để tìm…" onChange={e => { setSearch(e.target.value); setCatalogPage(1); }} /></label>
      {(categories.length > 0 || category) && <label>Nhóm dịch vụ<select value={category} disabled={busy} onChange={e => { setCategory(e.target.value); setCatalogPage(1); }}><option value="">Tất cả nhóm</option>{[...new Set([...categories, ...(category ? [category] : [])])].map(c => <option key={c} value={c}>{c}</option>)}</select></label>}
      <div className="cashier-cards">{catalog.slice((page - 1) * 8, page * 8).map(row => <button type="button" key={row._id} className={'cashier-card' + (selected?._id === row._id ? ' is-selected' : '')} aria-pressed={selected?._id === row._id} disabled={busy || !customer || (mode === 'product' && row.stock < 1)} onClick={() => choose(row)}><strong>{row.name}</strong><span>{mode === 'product' ? `${row.sku} · Tồn ${row.stock} ${row.unit}` : mode === 'session' ? `Còn ${row.remaining}/${row.totalSessions} buổi` : mode === 'package' ? `${row.totalSessions} buổi` : `${row.duration} phút`}</span><b>{money(mode === 'session' ? 0 : row.price)}</b>{selected?._id === row._id && <small>Đã chọn</small>}</button>)}</div>
      {!catalog.length && <p>{mode === 'session' ? customer ? 'Khách chưa có gói khả dụng.' : 'Chọn khách để xem liệu trình của khách.' : 'Không có dịch vụ hoặc gói phù hợp.'}</p>}
      {!customer && mode !== 'session' && <p>Chọn khách hàng trước khi chọn dịch vụ.</p>}
      {pageCount > 1 && <div className="customer-picker-pages"><button type="button" disabled={busy || page <= 1} onClick={() => setCatalogPage(page - 1)}>Trước</button><span>{page}/{pageCount}</span><button type="button" disabled={busy || page >= pageCount} onClick={() => setCatalogPage(page + 1)}>Sau</button></div>}
    </section>
    <section className="panel cashier-receipt"><h3>3. Hóa đơn</h3>
      <div className="cashier-receipt-heading"><strong>{customer?.name || 'Chưa chọn khách'}</strong><small>{customer?.phone}</small></div>
      {!selected ? <p>Chọn dịch vụ hoặc gói để xem hóa đơn.</p> : <fieldset disabled={busy} className="cashier-fields">
        <div className="section-head"><strong>{selected.name}</strong><button type="button" onClick={resetSelection}>Bỏ chọn</button></div>
        {mode !== 'package' && mode !== 'product' && <label>Nội dung<input value={description} required maxLength={500} onChange={e => setDescription(e.target.value)} /></label>}
        <label>{mode === 'product' ? 'Đơn giá (VNĐ)' : 'Giá bán (VNĐ)'}<input type="number" value={mode === 'session' ? '0' : price} min={mode === 'session' ? 0 : 1} max={1_000_000_000_000} step={1} required readOnly={mode === 'session'} onChange={e => setPrice(e.target.value)} /></label>
        {mode === 'product' && <label>Số lượng ({selected.unit})<input type="number" value={quantity} min={1} max={selected.stock} step={1} required onChange={e => setQuantity(e.target.value)} /><small>Tồn kho: {selected.stock}. Lưu hóa đơn sẽ xuất kho.</small></label>}
        {mode === 'package' && <><label>Đợt khuyến mãi<input value={promotion} maxLength={2000} required={!!gifts.length} onChange={e => setPromotion(e.target.value)} placeholder="Tên chương trình / đợt" /></label>
          {gifts.map((gift, index) => <div key={index} className="gift-row"><label>Quà tặng · 0đ<select required value={gift} onChange={e => setGifts(old => old.map((v, i) => i === index ? e.target.value : v))}><option value="">Chọn gói…</option>{templates.map(t => <option key={t._id} value={t._id}>{t.name} · {t.totalSessions} buổi</option>)}</select></label><button type="button" onClick={() => setGifts(old => old.filter((_, i) => i !== index))}>Bỏ</button></div>)}
          <button type="button" disabled={gifts.length >= 20 || !templates.length} onClick={() => setGifts(old => [...old, ''])}>+ Quà tặng 0đ</button>
        </>}
        <label>Nhân viên tư vấn<select value={consultantId} onChange={e => setConsultantId(e.target.value)}><option value="">Theo khách / lần bán gói</option>{data.staff.filter((s: Row) => s.active).map((s: Row) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
        {mode !== 'session' && <label>Hạn thanh toán{mode === 'service' ? ' (nếu có)' : ''}<input type="date" min={mode === 'package' ? data.today : undefined} required={mode === 'package'} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>}
        {mode === 'session' && <section><label>Nhân viên trực tiếp thực hiện<select required value={performerId} onChange={e => { setPerformerId(e.target.value); setSignature({ version: 1, strokes: [] }); }}><option value="">Chọn nhân viên…</option>{data.staff.filter((s: Row) => s.active).map((s: Row) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label><strong>Khách ký xác nhận dùng 1 buổi</strong><SignaturePad value={signature} onChange={setSignature} disabled={busy || !performerId} /></section>}
      </fieldset>}
      <div className="cashier-total"><span>{mode === 'session' ? 'Thu thêm' : 'Tổng hóa đơn'}</span><strong>{money(Number.isFinite(amount) ? amount : 0)}</strong></div>
      {mode === 'session' && selected && <p>Ghi 1 buổi · Không thu thêm tiền</p>}
      {error && <p className="negative" role="alert">{error}</p>}
      <button type="submit" className="primary cashier-save" disabled={busy || !selected || !customer || (mode === 'session' && !isValidSignature(signature))}>{busy ? 'Đang lưu…' : mode === 'session' ? 'Lưu buổi & hóa đơn 0đ' : 'Lưu hóa đơn'}</button>
      {mode !== 'session' && <small className="cashier-save-note">Sau khi lưu, chọn thu tiền khi thực nhận tiền.</small>}
    </section>
  </form>;
}
