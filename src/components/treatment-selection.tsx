'use client';
import { useState } from 'react';
import { packageLabel, treatmentAvailable, useToken } from '@/lib/treatment-rules';
import { serviceGroupNames } from '@/lib/service-groups';
import { isValidSignature, type Signature } from '@/lib/signature';
import SignaturePad from './signature-pad';
type Row = Record<string, any>;

export function TreatmentConfirmations({ treatments, disabled = false }: { treatments: Row[]; disabled?: boolean }) {
  const [signature, setSignature] = useState<Signature>({version:1,strokes:[]});
  const values = treatments.map(t => ({ treatmentId: t._id, remainingBefore: useToken(t) }));
  return <section className="session-confirmations">
    <p>Mỗi gói theo buổi trừ 1 buổi khi lưu thành công.</p>
    <input type="hidden" name="treatments" value={JSON.stringify(values)} />
    {treatments.map(t => <p key={t._id}><strong>{t.name} · {packageLabel(t)} · 0đ</strong></p>)}
    <h3>Chữ ký chung cho hóa đơn (không bắt buộc)</h3>
    <p>Có thể bỏ qua chữ ký và lưu hóa đơn bình thường.</p>
    <SignaturePad value={signature} disabled={disabled} onChange={setSignature}/>
    <input type="hidden" name="signature" value={signature.strokes.length ? JSON.stringify(signature) : ''}/>
    {isValidSignature(signature) && <small>Đã ký chung cho các dịch vụ trên hóa đơn.</small>}
  </section>;
}

export function AppointmentSelection({ services, treatments, customerId, disabled = false }: { services: Row[]; treatments: Row[]; customerId: string; disabled?: boolean }) {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [serviceIds,setServiceIds]=useState<string[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const available = treatments.filter(t => t.customerId === customerId && t.serviceId && treatmentAvailable(t));
  const selected = ids.map(id => available.find(t => t._id === id)).filter(Boolean) as Row[];
  const shown = services.filter(s => s.active && (!category || s.category === category) && s.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  return <fieldset disabled={disabled}>
    <legend>Dịch vụ và liệu trình</legend>
    <input type="hidden" name="serviceId" value={selected[0]?.serviceId || serviceIds[0] || ''} />
    <input type="hidden" name="serviceIds" value={JSON.stringify(serviceIds)}/>
    <input type="hidden" name="treatmentIds" value={JSON.stringify(ids)} />
    <p>Đã chọn: {[...serviceIds.map(id=>services.find(s=>s._id===id)?.name),...selected.map(t=>t.name)].filter(Boolean).join(' + ') || 'Chưa chọn'}</p>
    <h3>Dịch vụ lẻ · chọn một hoặc nhiều</h3>
    <label>Nhóm dịch vụ<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Tất cả nhóm</option>{serviceGroupNames([], services).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    <label>Tìm dịch vụ lẻ<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nhập tên dịch vụ…" /></label>
    <div className="appointment-service-choices">{shown.map(s => <button type="button" key={s._id} aria-pressed={serviceIds.includes(s._id)} onClick={() => setServiceIds(old=>old.includes(s._id)?old.filter(id=>id!==s._id):old.length<30?[...old,s._id]:old)}>{s.name}{serviceIds.includes(s._id)?' ✓':''}</button>)}</div>
    <h3>Liệu trình khách đã mua · chọn một hoặc nhiều</h3>
    <p>Danh sách riêng của khách, không bị lọc theo nhóm hoặc tìm kiếm dịch vụ lẻ.</p>
    <div className="appointment-service-choices">{available.map(t => <button type="button" key={t._id} aria-pressed={ids.includes(t._id)} onClick={() => setIds(old => old.includes(t._id) ? old.filter(id => id !== t._id) : old.length < 30 ? [...old, t._id] : old)}>{t.name} · {packageLabel(t)}{ids.includes(t._id) ? ' ✓' : ''}</button>)}</div>
    {!available.length && <small>{customerId ? 'Khách chưa có liệu trình khả dụng.' : 'Chọn khách để xem liệu trình đã mua.'}</small>}
  </fieldset>;
}
