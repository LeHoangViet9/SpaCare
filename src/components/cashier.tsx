'use client';
import { packageLabel, timedPackage, useToken, packageExpiry, treatmentDay } from '@/lib/treatment-rules';
import InvoiceCardPayment from './invoice-card-payment';
import SaleParticipants from './sale-participants';
import ValidatedForm from '@/components/validated-form';
import { formatCurrency } from '@/lib/currency';
import MoneyInput from './money-input';
import { parseMoney } from '@/lib/currency';
import { useCallback, useEffect, useState } from 'react';
import CustomerPicker from './customer-picker';
import SignaturePad from './signature-pad';
import { isValidSignature, type Signature } from '@/lib/signature';
import { cashierCatalog, type CashierMode } from '@/lib/cashier-catalog';
type Row = Record<string, any>;
const money = formatCurrency;
export default function Cashier({ data, busy, initialMode, initialCustomer, onSubmit, onInvoices, onNewCustomer }: {
  data: Row; busy: boolean; initialMode: CashierMode; initialCustomer?: Row | null; onSubmit: (action: string, values: Row) => void; onInvoices: () => void; onNewCustomer: () => void;
}) {
  const [cardPreview,setCardPreview]=useState({context:'',amount:0});
  const [mode, setMode] = useState<CashierMode>(initialMode);
  const [browseMode,setBrowseMode]=useState<CashierMode>(initialMode);
  const [productItems,setProductItems]=useState<Row[]>([]);
  const [customer, setCustomer] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [serviceItems, setServiceItems] = useState<Row[]>([]);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [performerId, setPerformerId] = useState('');
  const [issuedOn,setIssuedOn]=useState('');
  const [dueDate, setDueDate] = useState('');
  const [startsOn, setStartsOn] = useState(treatmentDay());
  const [participantIds,setParticipantIds] = useState<string[]>([data.user.id]);
  const [giftCashCardAmount, setGiftCashCardAmount] = useState('0');
  const [promotion, setPromotion] = useState('');
  const [gifts, setGifts] = useState<{id:string;templateId:string}[]>([]);
  const [signature, setSignature] = useState<Signature>({ version: 1, strokes: [] });
  const [error, setError] = useState('');
  const giftCardValue = (()=>{try{return parseMoney(giftCashCardAmount);}catch{return 0;}})();
  const allCatalog = cashierCatalog({ services: data.services, products: data.products || [], packageTemplates: data.packageTemplates || [], treatments: data.treatments }, browseMode, customer?._id || '', search);
  const categoryOf = (r: Row) => browseMode === 'product' ? data.productGroups?.find((g: Row) => g._id === r.groupId)?.name : browseMode === 'service' ? r.category : data.services.find((s: Row) => s._id === r.serviceId)?.category;
  const categories = [...new Set<string>(allCatalog.map(categoryOf).filter(Boolean))].sort();
  const catalog = allCatalog.filter(r => !category || categoryOf(r) === category);
  const templates = cashierCatalog({ services: data.services, packageTemplates: data.packageTemplates || [], treatments: data.treatments }, 'package', '', '');
  const showWholeGroup = browseMode !== 'product' && !!category;
  const pageCount = showWholeGroup ? 1 : Math.max(1, Math.ceil(catalog.length / 8));
  const page = Math.min(catalogPage, pageCount);
  const visibleCatalog = showWholeGroup ? catalog : catalog.slice((page - 1) * 8, page * 8);
  const productAmount=productItems.reduce((sum,item)=>{try{return sum+parseMoney(item.unitPrice)*Number(item.quantity);}catch{return sum;}},0);
  const amount = productAmount + ( mode === 'service' ? serviceItems.reduce((sum, item) => { try { return sum + parseMoney(item.total); } catch { return sum; } }, 0) : mode === 'session' ? serviceItems.reduce((sum,item)=>{try{return sum+parseMoney(item.total);}catch{return sum;}},0) : (price ? (()=>{try{return parseMoney(price);}catch{return 0;}})() : 0) * (mode === 'product' ? Number(quantity) : 1));
  const cardContext=JSON.stringify([customer?._id, mode === 'service' ? serviceItems.map(item => [item._id, item.total]) : selected?._id, amount]);
  const appliedCard=mode==='service'&&cardPreview.context===cardContext?cardPreview.amount:0;
  const previewCard=useCallback((value:number)=>setCardPreview({context:cardContext,amount:value}),[cardContext]);
  function resetSelection() { setProductItems([]); setServiceItems([]); setSelected(null); setParticipantIds([data.user.id]); setDescription(''); setPrice(''); setQuantity('1'); setGifts([]); setGiftCashCardAmount('0'); setPromotion(''); setPerformerId(''); setSignature({ version: 1, strokes: [] }); setError(''); }
  useEffect(() => {
    if (!initialCustomer) return;
    setCustomer(initialCustomer); resetSelection(); setCatalogPage(1);
  }, [initialCustomer?._id]);
  function choose(row: Row) {
    if(browseMode==='product' && mode==='session' && selected) {
      setProductItems(old=>old.some(item=>item._id===row._id)?old.filter(item=>item._id!==row._id):old.length<30?[...old,{...row,unitPrice:String(row.price),quantity:'1'}]:old);return;
    }
    if (browseMode === 'service') {
      const next = serviceItems.some(item => item._id === row._id) ? serviceItems.filter(item => item._id !== row._id) : [...serviceItems, { ...row, total: String(row.price) }];
      if (next.length > 30) { setError('Tối đa 30 dịch vụ trong một hóa đơn.'); return; }
      setServiceItems(next); if(mode!=='session' || !selected){setMode('service');setSelected(next[0] || null);} setError(''); return;
    }
    setMode(browseMode);setSelected(row); setDescription(row.name); setQuantity('1'); setPrice(String(browseMode === 'session' ? 0 : row.price)); setSignature({ version: 1, strokes: [] }); setError(''); }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    if (!customer || !selected) { setError('Chọn khách hàng và dịch vụ hoặc gói trước khi lưu.'); return; }
    if ((mode === 'service' || mode === 'session') && !performerId) { setError('Chọn nhân viên trực tiếp thực hiện dịch vụ.'); return; }
    if (mode === 'session' && !isValidSignature(signature)) { setError('Khách cần ký xác nhận buổi thực hiện.'); return; }
    if (mode === 'package' && (gifts.length || giftCardValue>0) && (!promotion.trim() || gifts.some(g => !g.templateId))) { setError('Nhập đợt khuyến mãi và chọn đủ gói quà tặng.'); return; }
    if (mode !== 'session' && mode !== 'service') { try { const value = parseMoney(price); if (value < 1) throw new Error('Giá bán phải lớn hơn 0.'); } catch(e) {setError((e as Error).message);return;} }
    if(mode==='session') {try {for(const product of productItems) {if(parseMoney(product.unitPrice)<=0 || !Number.isInteger(Number(product.quantity)) || Number(product.quantity)<1) throw new Error('Kiểm tra giá và số lượng sản phẩm.');}for(const item of serviceItems) if(parseMoney(item.total)<=0) throw new Error('Giá dịch vụ lẻ phải lớn hơn 0.');}catch(error){setError((error as Error).message);return;}}
    const cardValue = new FormData(e.currentTarget).get('cashCard');
    const common = { customerId: customer._id, ...(issuedOn ? {issuedOn} : {}) };
    if (mode === 'service') {
      try {
        const items = serviceItems.map(item => ({ serviceId: item._id, total: parseMoney(item.total) }));
        if (items.some(item => item.total <= 0) || amount > 1_000_000_000_000) throw new Error('Giá dịch vụ không hợp lệ.');
        onSubmit('serviceInvoice', { ...common, staffId: performerId, items, ...(dueDate ? { dueDate } : {}), ...(cardValue ? { cashCard: JSON.parse(String(cardValue)) } : {}) });
      } catch (error) { setError((error as Error).message); }
    }
    else if (mode === 'product') onSubmit('sellProduct', { ...common, productId: selected._id, quantity: Number(quantity), unitPrice: parseMoney(price), ...(dueDate ? { dueDate } : {}) });
    else if (mode === 'package') onSubmit('sellPackage', { ...common, templateId: selected._id, total: amount, dueDate, ...(startsOn ? { startsOn } : {}), participantIds, promotion, giftCashCardAmount: parseMoney(giftCashCardAmount), gifts: gifts.map(g => ({templateId:g.templateId})) });
    else onSubmit('invoice', { ...common, staffId: performerId, serviceId: mode === 'session' ? selected.serviceId : selected._id, ...(description.trim()?{description:description.trim()}:{}), total: amount,
      ...(mode === 'session' ? { additionalProducts:productItems.map(item=>({productId:item._id,quantity:Number(item.quantity),unitPrice:parseMoney(item.unitPrice)})), treatmentId: selected._id, additionalServices:serviceItems.map(item=>({serviceId:item._id,total:parseMoney(item.total)})), remainingBefore: useToken(selected), signature } : dueDate ? { dueDate } : {}) });
  }
  return <ValidatedForm onSubmit={submit} className="cashier">
    <section className="panel panel-padded cashier-customer"><div className="section-head"><h3>1. Khách hàng</h3><div className="actions"><button type="button" onClick={onNewCustomer} disabled={busy}>+ Khách mới</button><button type="button" onClick={onInvoices} disabled={busy}>Danh sách hóa đơn</button></div></div>
      <CustomerPicker label="Khách hàng" value={customer?._id || ''} onChange={() => {}} onCustomerChange={c => { setCustomer(c); resetSelection(); setCatalogPage(1); }} required disabled={busy} />
    </section>
    <section className="panel panel-padded cashier-catalog"><h3>2. Thêm vào hóa đơn</h3><p>Chọn gói đã mua, rồi chuyển sang Dịch vụ lẻ hoặc Sản phẩm để thêm. Gói và dịch vụ đã chọn vẫn được giữ.</p>
      <div className="cashier-modes" role="group" aria-label="Loại hóa đơn">{([['service', 'Dịch vụ lẻ'], ['package', 'Bán gói mới'], ['session', 'Dùng gói đã mua'], ['product', 'Sản phẩm']] as const).map(([key, title]) => <button type="button" key={key} aria-pressed={browseMode === key} disabled={busy} onClick={() => { setBrowseMode(key);setSearch('');setCategory('');setCatalogPage(1);if(key==='package' || mode==='package'){resetSelection();setMode(key);}else if(mode!=='session' && !selected){setMode(key);} }}>{title}</button>)}</div>
      <p className="cashier-mode-help">{browseMode === 'package' ? 'Bán một gói mới cho khách: tạo gói và hóa đơn thanh toán.' : browseMode === 'session' ? 'Chọn gói khách đã mua để ghi nhận 1 buổi thực hiện. Không bán gói mới, không thu lại tiền buổi.' : browseMode === 'product' ? 'Chọn sản phẩm bán cho khách.' : 'Tích một hoặc nhiều dịch vụ khách đã làm để gộp chung một hóa đơn.'}</p>
      <label><strong>{browseMode === 'product' ? 'Tìm sản phẩm' : browseMode === 'package' ? 'Tìm gói để bán mới' : browseMode === 'session' ? 'Tìm trong gói khách đã mua' : 'Tìm dịch vụ lẻ'}</strong><input type="search" value={search} disabled={busy} maxLength={100} placeholder="Nhập tên hoặc mã để tìm…" onChange={e => { setSearch(e.target.value); setCatalogPage(1); }} /></label>
      {(categories.length > 0 || category) && <label>Nhóm dịch vụ<select value={category} disabled={busy} onChange={e => { setCategory(e.target.value); setCatalogPage(1); }}><option value="">Tất cả nhóm</option>{[...new Set([...categories, ...(category ? [category] : [])])].map(c => <option key={c} value={c}>{c}</option>)}</select></label>}
      <div className="cashier-cards">{visibleCatalog.map(row => <button type="button" key={row._id} className={'cashier-card' + ((browseMode === 'service' ? serviceItems.some(item => item._id === row._id) : (browseMode==='product' && mode==='session' ? productItems.some(item=>item._id===row._id) : selected?._id===row._id)) ? ' is-selected' : '')} aria-pressed={(browseMode === 'service' ? serviceItems.some(item => item._id === row._id) : (browseMode==='product' && mode==='session' ? productItems.some(item=>item._id===row._id) : selected?._id===row._id))} disabled={busy || !customer || (browseMode === 'product' && row.stock < 1)} onClick={() => choose(row)}><strong>{row.name}</strong><span>{browseMode === 'product' ? `${row.sku} · Tồn ${row.stock} ${row.unit}` : browseMode === 'session' || browseMode === 'package' ? packageLabel(row) : row.category || 'Dịch vụ'}</span><b>{money(browseMode === 'session' ? 0 : row.price)}</b>{(browseMode === 'service' ? serviceItems.some(item => item._id === row._id) : (browseMode==='product' && mode==='session' ? productItems.some(item=>item._id===row._id) : selected?._id===row._id)) && <small>Đã chọn</small>}</button>)}</div>
      {!catalog.length && <p>{browseMode === 'session' ? customer ? 'Khách chưa có gói có thể sử dụng. Nếu khách mua mới, chọn Bán gói mới.' : 'Chọn khách để xem liệu trình của khách.' : browseMode === 'package' ? 'Không có gói đang bán phù hợp.' : browseMode === 'product' ? 'Không có sản phẩm phù hợp.' : 'Không có dịch vụ lẻ phù hợp.'}</p>}
      {!customer && mode !== 'session' && <p>Chọn khách hàng trước khi chọn dịch vụ.</p>}
      {pageCount > 1 && <div className="customer-picker-pages"><button type="button" disabled={busy || page <= 1} onClick={() => setCatalogPage(page - 1)}>Trước</button><span>{page}/{pageCount}</span><button type="button" disabled={busy || page >= pageCount} onClick={() => setCatalogPage(page + 1)}>Sau</button></div>}
    </section>
    <section className="panel panel-padded cashier-receipt"><h3>{mode === 'session' ? '3. Xác nhận sử dụng 1 buổi' : '3. Hóa đơn'}</h3>
      <div className="cashier-receipt-heading"><strong>{customer?.name || 'Chưa chọn khách'}</strong><small>{customer?.phone}</small></div>
      {!selected ? <p>{mode === 'session' ? 'Chọn gói đã mua ở bên cạnh để xác nhận buổi thực hiện.' : mode === 'package' ? 'Chọn gói mới để lập hóa đơn bán gói.' : 'Chọn dịch vụ hoặc sản phẩm để lập hóa đơn.'}</p> : <fieldset disabled={busy} className="cashier-fields">
        {mode === 'service' ? <div className="cashier-service-items">
          <p>Tích thêm dịch vụ ở danh mục để gộp vào hóa đơn ({serviceItems.length}/30).</p>
          {serviceItems.map((item, index) => <div className="cashier-service-line" key={item._id}>
            <div className="section-head"><strong>{index + 1}. {item.name}</strong><button type="button" aria-label={'Bỏ ' + item.name} onClick={() => choose(item)}>Bỏ</button></div>
            <label>Giá {item.name} (VND)<MoneyInput name={`items.${index}.total`} value={item.total} min={1} max={1_000_000_000_000} required onValueChange={value => setServiceItems(items => items.map(row => row._id === item._id ? { ...row, total: value } : row))} /></label>
          </div>)}
        </div> : <>        <div className="section-head"><strong>{selected.name}</strong><button type="button" onClick={resetSelection}>Bỏ chọn</button></div>
        {mode !== 'package' && mode !== 'product' && <label>Nội dung<input name="description" value={description} maxLength={500} onChange={e => setDescription(e.target.value)} /></label>}
        <label>{mode === 'product' ? 'Đơn giá (VNĐ)' : 'Giá bán (VNĐ)'}<MoneyInput name={mode === "product" ? "unitPrice" : "total"} value={mode === 'session' ? '0' : price} min={mode === 'session' ? 0 : 1} max={1_000_000_000_000} required readOnly={mode === 'session'} onValueChange={setPrice} /></label>
        </>}
        {mode === 'service' && customer && <InvoiceCardPayment key={customer._id+selected._id+amount} customerId={customer._id} total={amount} disabled={busy} onAppliedChange={previewCard}/>}
        {mode === 'product' && <label>Số lượng ({selected.unit})<input name="quantity" type="number" value={quantity} min={1} max={selected.stock} step={1} required onChange={e => setQuantity(e.target.value)} /><small>Tồn kho: {selected.stock}. Lưu hóa đơn sẽ xuất kho.</small></label>}
        {mode === 'package' && <><label>Đợt khuyến mãi<input name="promotion" value={promotion} maxLength={2000} required={!!gifts.length || giftCardValue>0} onChange={e => setPromotion(e.target.value)} placeholder="Tên chương trình / đợt" /></label>
          {gifts.map((gift, index) => <div key={gift.id} className="gift-row"><label>Quà tặng · 0đ<select name={`gifts.${index}.templateId`} required value={gift.templateId} onChange={e => setGifts(old => old.map((v, i) => i === index ? {...v,templateId:e.target.value} : v))}><option value="">Chọn gói…</option>{templates.map(t => <option key={t._id} value={t._id}>{t.name} · {packageLabel(t)}</option>)}</select></label><button type="button" onClick={() => setGifts(old => old.filter((_, i) => i !== index))}>Bỏ</button></div>)}
          <button type="button" disabled={gifts.length >= 20 || !templates.length} onClick={() => setGifts(old => [...old, {id:crypto.randomUUID(),templateId:''}])}>+ Quà tặng 0đ</button>
        </>}
        {mode === 'package' && (timedPackage(selected) || gifts.some(g => timedPackage(templates.find(t => t._id === g.templateId) || {}))) && <label>Ngày bắt đầu sử dụng gói theo thời gian<input name="startsOn" type="date" required value={startsOn} onChange={e => setStartsOn(e.target.value)} /><small>Gói triệt lông 36 tháng tính từ ngày mua; gói khác theo thỏa thuận. {timedPackage(selected) && startsOn && `Hết hạn: ${packageExpiry(startsOn, selected.durationMonths)}`}</small></label>}
        {mode === 'package' && <label>Thẻ tiền tặng kèm (VNĐ, 0 nếu không tặng)<MoneyInput min={0} max={1_000_000_000_000} required value={giftCashCardAmount} onValueChange={setGiftCashCardAmount}/><small>Chỉ dùng dịch vụ lẻ, không hết hạn, không đổi tiền mặt.</small></label>}
        {mode === 'package' && <SaleParticipants people={data.staff} value={participantIds} onChange={setParticipantIds} total={amount} disabled={busy} />}
        {mode !== 'session' && <label>Hạn thanh toán{mode === 'service' ? ' (nếu có)' : ''}<input name="dueDate" type="date" min={mode === 'package' ? data.today : undefined} required={mode === 'package'} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>}
        {(mode === 'service' || mode === 'session') && <label>Nhân viên trực tiếp thực hiện<select name="staffId" required value={performerId} onChange={e => { setPerformerId(e.target.value); setSignature({ version: 1, strokes: [] }); }}><option value="">Chọn người đã thực hiện.</option>{data.staff.filter((s: Row) => s.active && ['OWNER','STAFF'].includes(s.role)).map((s: Row) => <option key={s._id} value={s._id}>{s.name}</option>)}</select><small>Hoa hồng dịch vụ được ghi cho người thực hiện.</small></label>}
        {mode === 'service' && <p>Lưu hóa đơn xác nhận dịch vụ đã làm xong và ghi hoa hồng một lần cho nhân viên đã chọn.</p>}
        {mode === 'session' && <section className="session-extra-services"><h3>Dịch vụ lẻ đã thêm ({serviceItems.length})</h3><p>Chuyển sang tab Dịch vụ lẻ để thêm; liệu trình vẫn được giữ trong hóa đơn.</p>{serviceItems.map(item=><div key={item._id} className="cashier-service-line"><label>{item.name} · Giá dịch vụ lẻ<MoneyInput value={item.total} required onValueChange={total=>setServiceItems(old=>old.map(row=>row._id===item._id?{...row,total}:row))}/></label><button type="button" onClick={()=>setServiceItems(old=>old.filter(row=>row._id!==item._id))}>Bỏ dịch vụ</button></div>)}</section>}
        {mode==='session' && <section><h3>Sản phẩm mua thêm ({productItems.length})</h3><p>Chuyển sang tab Sản phẩm để thêm vào hóa đơn này.</p>{productItems.map(item=><div key={item._id} className="cashier-service-line"><strong>{item.name}</strong><label>Số lượng<input type="number" min={1} max={item.stock} step={1} required value={item.quantity} onChange={e=>setProductItems(old=>old.map(row=>row._id===item._id?{...row,quantity:e.target.value}:row))}/></label><label>Đơn giá<MoneyInput required value={item.unitPrice} onValueChange={unitPrice=>setProductItems(old=>old.map(row=>row._id===item._id?{...row,unitPrice}:row))}/></label><button type="button" onClick={()=>setProductItems(old=>old.filter(row=>row._id!==item._id))}>Bỏ sản phẩm</button></div>)}</section>}
        {mode === 'session' && <section><strong>Khách ký xác nhận dùng 1 buổi</strong><SignaturePad value={signature} onChange={setSignature} disabled={busy || !performerId} /></section>}
      </fieldset>}
      <div className="cashier-total"><span>{mode === 'session' ? 'Thu thêm' : 'Tổng hóa đơn'}</span><strong>{money(Number.isFinite(amount) ? amount : 0)}</strong></div>
      {mode==='service' && appliedCard>0 && <div className="cashier-total card-payment-due" role="status"><span>Còn phải trả sau khi trừ thẻ</span><strong>{money(Math.max(0,amount-appliedCard))}</strong></div>}
      {mode === 'session' && selected && <p>Buổi liệu trình: 0đ · Chỉ thu phần dịch vụ lẻ và sản phẩm mua thêm.</p>}
      <label>Ngày hóa đơn (để trống: hôm nay)<input type="date" max={data.today} value={issuedOn} onChange={e=>setIssuedOn(e.target.value)} disabled={busy}/><small>Ngày ghi hóa đơn; khoản tiền nhận sau vẫn ghi vào ngày thực nhận.</small></label>
      {error && <p className="negative" role="alert">{error}</p>}
      <button type="submit" className="primary cashier-save" disabled={busy || !selected || !customer || ((mode === 'service' || mode === 'session') && !performerId) || (mode === 'session' && !isValidSignature(signature))}>{busy ? 'Đang lưu…' : mode === 'session' ? 'Ghi buổi & lập hóa đơn dịch vụ thêm' : mode === 'package' ? 'Tạo gói & hóa đơn' : mode === 'service' ? 'Hoàn thành & lập hóa đơn' : 'Lưu hóa đơn'}</button>
      {mode !== 'session' && <small className="cashier-save-note">Nếu áp dụng thẻ, lưu hóa đơn sẽ trừ thẻ và thu thêm theo xác nhận. Phần còn nợ có thể thu sau.</small>}
    </section>
  </ValidatedForm>;
}
