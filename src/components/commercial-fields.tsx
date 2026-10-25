'use client';
import { TreatmentConfirmations } from './treatment-selection';
import { packageLabel, timedPackage, treatmentAvailable, treatmentDay } from '@/lib/treatment-rules';
import {serviceGroupNames} from '@/lib/service-groups';
import InvoiceCardPayment from './invoice-card-payment';
import SaleParticipants from './sale-participants';
import { FormFields } from './validated-form';
import { parseMoney } from '@/lib/currency';
import MoneyInput from './money-input';
import { useState } from 'react';
type Row = Record<string, any>;
export default function CommercialFields({ action, data, disabled, customerId }: { action: string; data: Row; disabled: boolean; customerId?: string }) {
  const packageSale = action === 'sellPackage';
  const [participantIds,setParticipantIds] = useState<string[]>([data.user?.id || '']);
  const [category,setCategory]=useState('');
  const [selection, setSelection] = useState('');
  const [total, setTotal] = useState('');
  const [description, setDescription] = useState('');
  const [gifts, setGifts] = useState<{id:string;serviceId:string}[]>([]);
  const [giftCashCardAmount,setGiftCashCardAmount] = useState('0');
  const [treatmentIds,setTreatmentIds]=useState<string[]>([]);
  const setTreatmentId=(_id:string)=>setTreatmentIds([]);
  const giftCardValue = (()=>{try{return parseMoney(giftCashCardAmount);}catch{return 0;}})();
  const treatments = data.treatments.filter((t: Row) => t.customerId === customerId && t.serviceId && treatmentAvailable(t));
  const selectedTreatments=treatmentIds.map(id=>treatments.find((t:Row)=>t._id===id)).filter(Boolean);
  const treatment=selectedTreatments[0];
  const templates = (data.packageTemplates || []).filter((t: Row) => t.active && data.services.some((s: Row) => s._id === t.serviceId && s.active));
  const options = (packageSale ? templates : data.services.filter((s: Row) => s.active)).filter((r:Row)=>!category || (packageSale ? data.services.find((service:Row)=>service._id===r.serviceId)?.category : r.category)===category);
  return <fieldset disabled={disabled} className="commercial-fields">
    <FormFields><legend>{packageSale ? 'Gói bán và quà tặng' : 'Nội dung hóa đơn'}</legend>
    <label>Nhóm dịch vụ<select value={category} onChange={e=>{setCategory(e.target.value);}}><option value="">Tất cả nhóm</option>{serviceGroupNames(data.serviceGroups||[],data.services).map(name=><option key={name} value={name}>{name}</option>)}</select></label>
    <label>{packageSale ? 'Gói liệu trình' : 'Dịch vụ'}<select name={packageSale ? 'templateId' : treatment ? undefined : 'serviceId'} required={!treatment} value={selection} onChange={e => {
      setSelection(e.target.value); setTreatmentId(''); const row = options.find((r: Row) => r._id === e.target.value);
      setTotal(row ? String(row.price) : ''); setDescription(row?.name || '');
    }}><option value="">Chọn…</option>{options.map((r: Row) => <option key={r._id} value={r._id}>{r.name}{packageSale ? ` · ${data.services.find((service:Row)=>service._id===r.serviceId)?.name || ''} · ${packageLabel(r)}` : ''}</option>)}</select></label>
    {!options.length && <p role="status">{packageSale ? 'Chưa có gói mẫu đang bán trong nhóm này. Chủ spa cần tạo dịch vụ, rồi thêm gói tại Danh mục liệu trình.' : 'Chưa có dịch vụ đang hoạt động trong nhóm này.'}</p>}
    {!packageSale && <label>Nội dung<input name="description" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></label>}
    {treatment && <input type="hidden" name="serviceId" value={treatment.serviceId}/>}
    {!packageSale && <section><strong>Dùng liệu trình đã mua · chọn một hoặc nhiều</strong>{treatments.map((t:Row)=><label key={t._id}><input type="checkbox" checked={treatmentIds.includes(t._id)} onChange={()=>{const next=treatmentIds.includes(t._id)?treatmentIds.filter(id=>id!==t._id):[...treatmentIds,t._id];setTreatmentIds(next);if(next.length){setSelection(treatments.find((row:Row)=>row._id===next[0]).serviceId);setDescription('');}}}/>{t.name} · {packageLabel(t)} · 0đ</label>)}</section>}
    <label>Giá bán (VNĐ)<MoneyInput name="total" required min={treatment ? 0 : 1} max={1_000_000_000_000} value={treatment ? '0' : total} readOnly={!!treatment} onValueChange={setTotal} /></label>
    {!packageSale && !treatment && customerId && selection && <InvoiceCardPayment key={customerId+selection+total} customerId={customerId} total={(()=>{try{return parseMoney(total);}catch{return 0;}})()} disabled={disabled}/>}
    {treatment && <TreatmentConfirmations key={treatmentIds.join(',')} treatments={selectedTreatments} disabled={disabled}/>}
    {packageSale && <><SaleParticipants people={data.staff || []} value={participantIds} onChange={setParticipantIds} total={Number(total)} disabled={disabled} />{(timedPackage(templates.find((t: Row) => t._id === selection) || {})) && <label>Ngày bắt đầu sử dụng<input name="startsOn" type="date" required defaultValue={treatmentDay()} /><small>Gói triệt lông 36 tháng tự tính từ ngày mua.</small></label>}<label>Đợt khuyến mãi<input name="promotion" maxLength={2000} required={gifts.length > 0 || giftCardValue>0} placeholder="Ví dụ: ưu đãi tháng 10" /></label>
      {gifts.map((gift, index) => <div className="gift-row" key={gift.id}><label>Dịch vụ lẻ tặng 1 lần · 0đ<select name={`gifts.${index}.serviceId`} required value={gift.serviceId} onChange={e => setGifts(old => old.map((v, i) => i === index ? {...v,serviceId:e.target.value} : v))}><option value="">Chọn dịch vụ tặng…</option>{data.services.filter((s:Row)=>s.active).map((s:Row)=><option key={s._id} value={s._id}>{s.name} · 1 lần</option>)}</select></label><button type="button" onClick={() => setGifts(old => old.filter((_, i) => i !== index))}>Bỏ</button></div>)}
      <label>Thẻ tiền tặng kèm (VNĐ, 0 nếu không tặng)<MoneyInput name="giftCashCardAmount" required min={0} max={1_000_000_000_000} value={giftCashCardAmount} onValueChange={setGiftCashCardAmount}/></label>
      <input type="hidden" name="gifts" value={JSON.stringify(gifts.map(g => ({serviceId:g.serviceId})))} />
      <button type="button" disabled={gifts.length >= 20} onClick={() => setGifts(old => [...old, {id:crypto.randomUUID(),serviceId:''}])}>+ Tặng dịch vụ lẻ 0đ</button>
      {!templates.length && <p>Chủ spa cần thêm gói tại Danh mục liệu trình trước khi bán.</p>}
    </>}
  </FormFields></fieldset>;
}
