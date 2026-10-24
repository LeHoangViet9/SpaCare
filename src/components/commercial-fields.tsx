'use client';
import { packageLabel, timedPackage, useToken, treatmentAvailable, treatmentDay } from '@/lib/treatment-rules';
import {serviceGroupNames} from '@/lib/service-groups';
import SaleParticipants from './sale-participants';
import { FormFields } from './validated-form';
import { parseMoney } from '@/lib/currency';
import MoneyInput from './money-input';
import { useState } from 'react';
import SignaturePad from './signature-pad';
import type { Signature } from '@/lib/signature';
type Row = Record<string, any>;
export default function CommercialFields({ action, data, disabled, customerId }: { action: string; data: Row; disabled: boolean; customerId?: string }) {
  const packageSale = action === 'sellPackage';
  const [participantIds,setParticipantIds] = useState<string[]>([data.user?.id || '']);
  const [category,setCategory]=useState('');
  const [selection, setSelection] = useState('');
  const [total, setTotal] = useState('');
  const [description, setDescription] = useState('');
  const [gifts, setGifts] = useState<{id:string;templateId:string}[]>([]);
  const [giftCashCardAmount,setGiftCashCardAmount] = useState('0');
  const [treatmentId, setTreatmentId] = useState('');
  const [signature, setSignature] = useState<Signature>({ version: 1, strokes: [] });
  const giftCardValue = (()=>{try{return parseMoney(giftCashCardAmount);}catch{return 0;}})();
  const treatments = data.treatments.filter((t: Row) => t.customerId === customerId && t.serviceId === selection && treatmentAvailable(t));
  const treatment = treatments.find((t: Row) => t._id === treatmentId);
  const templates = (data.packageTemplates || []).filter((t: Row) => t.active && data.services.some((s: Row) => s._id === t.serviceId && s.active));
  const options = (packageSale ? templates : data.services.filter((s: Row) => s.active)).filter((r:Row)=>!category || (packageSale ? data.services.find((service:Row)=>service._id===r.serviceId)?.category : r.category)===category);
  return <fieldset disabled={disabled} className="commercial-fields">
    <FormFields><legend>{packageSale ? 'Gói bán và quà tặng' : 'Nội dung hóa đơn'}</legend>
    <label>Nhóm dịch vụ<select value={category} onChange={e=>{setCategory(e.target.value);setSelection('');setTotal('');setDescription('');setTreatmentId('');setSignature({version:1,strokes:[]});}}><option value="">Tất cả nhóm</option>{serviceGroupNames(data.serviceGroups||[],data.services).map(name=><option key={name} value={name}>{name}</option>)}</select></label>
    <label>{packageSale ? 'Gói liệu trình' : 'Dịch vụ'}<select name={packageSale ? 'templateId' : 'serviceId'} required value={selection} onChange={e => {
      setSelection(e.target.value); setTreatmentId(''); setSignature({ version: 1, strokes: [] }); const row = options.find((r: Row) => r._id === e.target.value);
      setTotal(row ? String(row.price) : ''); setDescription(row?.name || '');
    }}><option value="">Chọn…</option>{options.map((r: Row) => <option key={r._id} value={r._id}>{r.name}{packageSale ? ` · ${data.services.find((service:Row)=>service._id===r.serviceId)?.name || ''} · ${packageLabel(r)}` : ''}</option>)}</select></label>
    {!options.length && <p role="status">{packageSale ? 'Chưa có gói mẫu đang bán trong nhóm này. Chủ spa cần tạo dịch vụ, rồi thêm gói tại Danh mục liệu trình.' : 'Chưa có dịch vụ đang hoạt động trong nhóm này.'}</p>}
    {!packageSale && <label>Nội dung<input name="description" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></label>}
    {!packageSale && <label>Thanh toán<select name="treatmentId" value={treatment?._id || ''} onChange={e => { setTreatmentId(e.target.value); setSignature({ version: 1, strokes: [] }); }}><option value="">Mua lẻ · thu theo giá nhập</option>{treatments.map((t: Row) => <option key={t._id} value={t._id}>{t.name} · {packageLabel(t)} · 0đ</option>)}</select></label>}
    <label>Giá bán (VNĐ)<MoneyInput name="total" required min={treatment ? 0 : 1} max={1_000_000_000_000} value={treatment ? '0' : total} readOnly={!!treatment} onValueChange={setTotal} /></label>
    {treatment && <><p>Dùng 1 buổi liệu trình · Không thu thêm tiền</p><SignaturePad value={signature} onChange={setSignature} disabled={disabled} /><input type="hidden" name="signature" value={JSON.stringify(signature)} /><input type="hidden" name="remainingBefore" value={useToken(treatment)} /></>}
    {packageSale && <><SaleParticipants people={data.staff || []} value={participantIds} onChange={setParticipantIds} total={Number(total)} disabled={disabled} />{(timedPackage(templates.find((t: Row) => t._id === selection) || {}) || gifts.some(g => timedPackage(templates.find((t: Row) => t._id === g.templateId) || {}))) && <label>Ngày bắt đầu sử dụng<input name="startsOn" type="date" required defaultValue={treatmentDay()} /><small>Gói triệt lông 36 tháng tự tính từ ngày mua.</small></label>}<label>Đợt khuyến mãi<input name="promotion" maxLength={2000} required={gifts.length > 0 || giftCardValue>0} placeholder="Ví dụ: ưu đãi tháng 10" /></label>
      {gifts.map((gift, index) => <div className="gift-row" key={gift.id}><label>Quà tặng · 0đ<select name={`gifts.${index}.templateId`} required value={gift.templateId} onChange={e => setGifts(old => old.map((v, i) => i === index ? {...v,templateId:e.target.value} : v))}><option value="">Chọn gói tặng…</option>{templates.map((r: Row) => <option key={r._id} value={r._id}>{r.name} · {packageLabel(r)}</option>)}</select></label><button type="button" onClick={() => setGifts(old => old.filter((_, i) => i !== index))}>Bỏ</button></div>)}
      <label>Thẻ tiền tặng kèm (VNĐ, 0 nếu không tặng)<MoneyInput name="giftCashCardAmount" required min={0} max={1_000_000_000_000} value={giftCashCardAmount} onValueChange={setGiftCashCardAmount}/></label>
      <input type="hidden" name="gifts" value={JSON.stringify(gifts.map(g => ({templateId:g.templateId})))} />
      <button type="button" disabled={gifts.length >= 20} onClick={() => setGifts(old => [...old, {id:crypto.randomUUID(),templateId:''}])}>+ Quà tặng 0đ</button>
      {!templates.length && <p>Chủ spa cần thêm gói tại Danh mục liệu trình trước khi bán.</p>}
    </>}
  </FormFields></fieldset>;
}
