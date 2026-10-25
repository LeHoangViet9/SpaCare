'use client';
import { formatCurrency } from '@/lib/currency';
import { useEffect, useState } from 'react';
type Row = Record<string, any>;
type Field = { key: string; label: string; type?: string; min?: number; max?: number; optional?: boolean; options?: [string, string][]; hint?: string };
const money = formatCurrency;

function stockBadge(r: Row) {
  if (!r.active) return <span className="badge badge-inactive">Ngừng bán</span>;
  if (r.stock === 0) return <span className="badge badge-danger">Hết hàng</span>;
  if (r.minStock > 0 && r.stock <= r.minStock) return <span className="badge badge-warning">Tồn thấp</span>;
  return <span className="badge badge-ok">Còn hàng</span>;
}

export default function Products({ section, refreshKey, onOpen, onInvoice, canManage }: { section: 'products' | 'product_groups' | 'inventory'; refreshKey: unknown; onOpen: (title: string, action: string, fields: Field[], defaults?: Row, description?: string) => void; onInvoice: (id: string) => void; canManage?: boolean }) {
  const [search, setSearch] = useState(''), [group, setGroup] = useState(''), [status, setStatus] = useState(''), [history, setHistory] = useState(false);
  const [page, setPage] = useState(1), [data, setData] = useState<Row | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [productId, setProductId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const query = new URLSearchParams({ view: section, search, group, status, history: history ? 'yes' : '', page: String(page), productId }).toString();
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const timer = setTimeout(() => { fetch('/api/products?' + query, { signal: controller.signal, cache: 'no-store' }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Không tải được sản phẩm.'); return body; }).then(body => { if (!controller.signal.aborted) { setData(body); setLoading(false); } }).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false); } }); }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, refreshKey, retry]);
  const groups: Row[] = data?.groups || [];
  const canEdit = canManage ?? data?.canManage;
  const fields: Field[] = [
    { key: 'name', label: 'Tên sản phẩm' },
    { key: 'groupId', label: 'Nhóm sản phẩm', optional: true, options: [['', 'Chưa phân nhóm'], ...groups.map(g => [g._id, g.name] as [string, string])] },
    { key: 'sizeMl', label: 'Dung tích (ml)', type: 'number', min: 1, max: 100000, hint: 'Nhập dung tích của một sản phẩm, ví dụ 250 ml.' },
    { key: 'price', label: 'Giá bán (VNĐ)', type: 'number', min: 1, max: 1_000_000_000_000 },
    { key: 'minStock', optional:true, label: 'Mức tồn tối thiểu (cảnh báo)', type: 'number', min: 0, max: 1_000_000_000, hint: 'Khi tồn kho ≤ mức này, sản phẩm hiển thị cảnh báo "Tồn thấp". Để 0 nếu không cần cảnh báo.' },
    { key: 'origin', label: 'Xuất xứ', optional: true, hint: 'Quốc gia hoặc nơi sản xuất ghi trên sản phẩm.' },
    { key: 'manufacturedOn', label: 'Ngày sản xuất', type: 'date', optional: true },
    { key: 'expiresOn', label: 'Hạn sử dụng', type: 'date', optional: true },
    { key: 'description', label: 'Mô tả sản phẩm', optional: true, hint: 'Thành phần, công dụng, hướng dẫn sử dụng…' },
    { key: 'imageUrl', label: 'Ảnh sản phẩm', type: 'product-image', optional: true },
  ];
  const edit = (r?: Row) => onOpen(r ? 'Sửa sản phẩm' : 'Thêm sản phẩm', r ? 'updateProduct' : 'product', fields, r ? { ...r, id: r._id, groupId: r.groupId || '', description: r.description || '', imageUrl: r.imageUrl || '', minStock: r.minStock ?? 0, sizeMl: r.sizeMl ?? '', origin: r.origin || '', manufacturedOn: r.manufacturedOn || '', expiresOn: r.expiresOn || '' } : { groupId: '', minStock: 0 }, 'Số lượng tồn được ghi qua Nhập kho / Xuất kho, không sửa trực tiếp trong danh mục.');
  const editGroup = (r?: Row) => onOpen(r ? 'Sửa nhóm sản phẩm' : 'Thêm nhóm sản phẩm', r ? 'updateProductGroup' : 'productGroup', [{ key: 'name', label: 'Tên nhóm sản phẩm' }], r ? { id: r._id, name: r.name } : {});
  function movement(direction: 'IN' | 'OUT', r?: Row) {
    const title = direction === 'IN' ? 'Nhập kho' : 'Xuất kho';
    const movementFields: Field[] = r ? [] : [{ key: 'productId', label: 'Sản phẩm', options: (data?.products || []).map((p: Row) => [p._id, `${p.name} · ${p.sku} · Tồn ${p.stock} ${p.unit}`]) }];
    movementFields.push({ key: 'quantity', label: 'Số lượng', type: 'number', min: 1, max: 1_000_000_000 });
    onOpen(r ? `${title} — ${r.name}` : title, 'stockMovement', movementFields,
      { productId: r?._id || '', direction, quantity: 1 },
      `${r ? `Tồn hiện tại: ${r.stock} ${r.unit}. ` : ''}Phiếu kho chỉ cập nhật số lượng. Khoản chi mua hàng cần ghi riêng trong Sổ thu chi; bán hàng hãy dùng Thu ngân.`);
  }

  const lowStockCount = section === 'products' && data?.rows ? data.rows.filter((r: Row) => r.active && r.stock === 0).length : 0;
  const warnStockCount = section === 'products' && data?.rows ? data.rows.filter((r: Row) => r.active && r.stock > 0 && r.minStock > 0 && r.stock <= r.minStock).length : 0;

  return <div className="payroll-workspace"><section className="panel panel-padded">
    <div className="section-head"><h3>{section === 'products' ? 'Danh sách sản phẩm' : section === 'product_groups' ? 'Nhóm sản phẩm' : 'Kho hàng'}</h3>
      <div className="actions">
        {canEdit && (section === 'products' ? <button className="primary" disabled={loading} onClick={() => edit()}>＋ Thêm sản phẩm</button>
          : section === 'product_groups' ? <button className="primary" disabled={loading} onClick={() => editGroup()}>＋ Thêm nhóm</button>
          : <><button className="primary" disabled={loading} onClick={() => movement('IN')}>＋ Nhập kho</button><button disabled={loading} onClick={() => movement('OUT')}>Xuất kho</button></>)}
      </div>
    </div>

    {/* Cảnh báo tồn kho */}
    {section === 'products' && !loading && (lowStockCount > 0 || warnStockCount > 0) && (
      <div className="product-stock-alerts">
        {lowStockCount > 0 && <span className="badge badge-danger">⚠ {lowStockCount} sản phẩm hết hàng</span>}
        {warnStockCount > 0 && <span className="badge badge-warning">⚠ {warnStockCount} sản phẩm tồn thấp</span>}
      </div>
    )}

    <div className="filter-controls">
      <label><strong>Tìm {section === 'product_groups' ? 'nhóm' : 'sản phẩm'}</strong><input type="search" value={search} maxLength={100} placeholder="Tên sản phẩm" onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
      {section !== 'product_groups' && <>
        <label>Nhóm<select value={group} onChange={e => { setGroup(e.target.value); setPage(1); }}><option value="">Tất cả nhóm</option>{groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}</select></label>
        <label>Trạng thái<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tất cả</option><option value="ACTIVE">Đang bán</option><option value="INACTIVE">Ngừng bán</option>
          <option value="EMPTY">Hết hàng</option><option value="LOW_STOCK">Tồn thấp</option>
        </select></label>
      </>}
    </div>

    {section === 'inventory' && <div className="profile-tabs inventory-tabs" role="group" aria-label="Tra cứu kho">
      <button aria-pressed={!history} onClick={() => { setHistory(false); setPage(1); setProductId(''); }}>Tồn kho</button>
      <button aria-pressed={history} onClick={() => { setHistory(true); setPage(1); }}>Lịch sử nhập / xuất</button>
    </div>}

    {/* Lọc theo sản phẩm trong lịch sử kho */}
    {section === 'inventory' && history && <div className="filter-controls">
      <label>Lọc theo sản phẩm<select value={productId} onChange={e => { setProductId(e.target.value); setPage(1); }}>
        <option value="">Tất cả sản phẩm</option>
        {(data?.products || []).map((p: Row) => <option key={p._id} value={p._id}>{p.name} · {p.sku}</option>)}
      </select></label>
    </div>}

    {error && <p className="negative" role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Thử lại</button></p>}
    {loading ? <p role="status">Đang tải…</p> : <div className="payroll-people">
      {data?.rows.map((r: Row) => section === 'product_groups'
        ? <article key={r._id}><strong>{r.name}</strong>{canEdit && <button onClick={() => editGroup(r)}>Sửa nhóm</button>}</article>
        : section === 'inventory' && history
          ? <article key={r._id}>
              <div><strong>{r.productName} · {r.sku}</strong><p>{r.direction === 'IN' ? 'Nhập' : 'Xuất'} {r.quantity} {r.unit} · {r.before} → {r.after}</p><small>{new Date(r.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {r.actorName} · {r.kind === 'SALE' ? 'Bán hàng' : 'Thủ công'}</small><p>{r.reason}</p></div>
              {r.invoiceId && <button onClick={() => onInvoice(r.invoiceId)}>Hóa đơn #{r.invoiceId.slice(-6)}</button>}
            </article>
          : <article key={r._id} className="product-card">
              {/* Hình ảnh sản phẩm */}
              {r.imageUrl && <div className="product-image-wrap"><img src={r.imageUrl} alt={r.name} className="product-thumb" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div>}
              <div className="product-card-body">
                <div className="product-card-top">
                  <div>
                    <strong>{r.name}</strong>
                    <p className="product-meta">{r.sku} · {groups.find(g => g._id === r.groupId)?.name || 'Chưa phân nhóm'}</p>
                    <p><b>{money(r.price)}</b> / sản phẩm{r.sizeMl ? ` · ${r.sizeMl} ml` : ''} · Tồn: <b>{r.stock}</b>{r.minStock > 0 && <span className="product-min-stock"> · Tối thiểu: {r.minStock}</span>}</p>
                  </div>
                  <div className="product-card-badges">
                    {stockBadge(r)}
                  </div>
                </div>
                {/* Mô tả sản phẩm (có thể thu gọn) */}
                {(r.origin || r.manufacturedOn || r.expiresOn) && <dl className="product-origin-dates">
                  {r.origin && <div><dt>Xuất xứ</dt><dd>{r.origin}</dd></div>}
                  {r.manufacturedOn && <div><dt>Ngày sản xuất</dt><dd><time dateTime={r.manufacturedOn}>{r.manufacturedOn.split('-').reverse().join('/')}</time></dd></div>}
                  {r.expiresOn && <div><dt>Hạn sử dụng</dt><dd><time dateTime={r.expiresOn}>{r.expiresOn.split('-').reverse().join('/')}</time></dd></div>}
                </dl>}
                {r.description && <div className="product-description">
                  <p className={expandedId === r._id ? '' : 'product-desc-clamp'}>{r.description}</p>
                  {r.description.length > 120 && <button className="link-btn" onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}>{expandedId === r._id ? 'Thu gọn' : 'Xem thêm'}</button>}
                </div>}
                <div className="actions">
                  {canEdit ? <>
                    <button onClick={() => edit(r)}>Sửa</button>
                    <button onClick={() => movement('IN', r)}>Nhập kho</button>
                    <button onClick={() => onOpen(r.active ? 'Ngừng bán sản phẩm' : 'Bán lại sản phẩm', 'productStatus', [], { id: r._id, active: !r.active }, r.name + '. Giữ lịch sử hóa đơn và kho.')}>{r.active ? 'Ngừng bán' : 'Bán lại'}</button>
                  </> : null}
                </div>
              </div>
            </article>
      )}
    </div>}
    {!loading && !data?.total && !error && <p>Chưa có bản ghi phù hợp.</p>}
    {!loading && data && data.total > 10 && <div className="customer-picker-pages"><button disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Trước</button><span>Trang {data.page}/{Math.ceil(data.total / 10)} · {data.total} bản ghi</span><button disabled={data.page * 10 >= data.total} onClick={() => setPage(data.page + 1)}>Sau</button></div>}
  </section></div>;
}
