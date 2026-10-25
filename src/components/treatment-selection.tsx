'use client';
import { useState } from 'react';
import { packageLabel, treatmentAvailable, useToken } from '@/lib/treatment-rules';
import { serviceGroupNames } from '@/lib/service-groups';
import { isValidSignature, type Signature } from '@/lib/signature';
import SignaturePad from './signature-pad';
type Row = Record<string, any>;

export function TreatmentConfirmations({ treatments, disabled = false }: { treatments: Row[]; disabled?: boolean }) {
  const [signatures, setSignatures] = useState<Record<string, Signature>>({});
  const values = treatments.map(t => ({ treatmentId: t._id, remainingBefore: useToken(t), signature: signatures[t._id] }));
  return <section className="session-confirmations"><p>Kiểm tra và ký riêng từng liệu trình đã thực hiện. Mỗi gói theo buổi trừ 1 buổi khi lưu thành công.</p>
    <input type="hidden" name="treatments" value={JSON.stringify(values)} />
    {treatments.map(t => <section key={t._id} className="session-confirmation"><strong>{t.name} · {packageLabel(t)} · 0đ</strong>
      <SignaturePad value={signatures[t._id] || { version: 1, strokes: [] }} disabled={disabled} onChange={signature => setSignatures(old => ({ ...old, [t._id]: signature }))} />
      <small>{isValidSignature(signatures[t._id]) ? 'Đã ký xác nhận' : 'Khách ký xác nhận liệu trình này'}</small>
    </section>)}
  </section>;
}

export function AppointmentSelection({ services, treatments, customerId, disabled = false }: { services: Row[]; treatments: Row[]; customerId: string; disabled?: boolean }) {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const available = treatments.filter(t => t.customerId === customerId && t.serviceId && treatmentAvailable(t));
  const selected = ids.map(id => available.find(t => t._id === id)).filter(Boolean) as Row[];
  const shown = services.filter(s => s.active && (!category || s.category === category) && s.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  return <fieldset disabled={disabled}>
    <legend>Dịch vụ và liệu trình</legend>
    <input type="hidden" name="serviceId" value={selected[0]?.serviceId || serviceId} />
    <input type="hidden" name="treatmentIds" value={JSON.stringify(ids)} />
    <p>Đã chọn: {selected.length ? selected.map(t => t.name).join(' + ') : services.find(s => s._id === serviceId)?.name || 'Chưa chọn'}</p>
    <label>Nhóm dịch vụ<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Tất cả nhóm</option>{serviceGroupNames([], services).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    <label>Tìm dịch vụ<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nhập tên dịch vụ…" /></label>
    <strong>Liệu trình khách đã mua · chọn một hoặc nhiều</strong>
    <div className="appointment-service-choices">{available.filter(t => !category || services.find(s => s._id === t.serviceId)?.category === category).map(t => <button type="button" key={t._id} aria-pressed={ids.includes(t._id)} onClick={() => setIds(old => old.includes(t._id) ? old.filter(id => id !== t._id) : old.length < 30 ? [...old, t._id] : old)}>{t.name} · {packageLabel(t)}{ids.includes(t._id) ? ' ✓' : ''}</button>)}</div>
    {!available.length && <small>{customerId ? 'Khách chưa có liệu trình khả dụng.' : 'Chọn khách để xem liệu trình đã mua.'}</small>}
    <strong>Dịch vụ lẻ</strong>
    <div className="appointment-service-choices">{shown.map(s => <button type="button" key={s._id} aria-pressed={!ids.length && serviceId === s._id} onClick={() => { setIds([]); setServiceId(s._id); }}>{s.name}</button>)}</div>
  </fieldset>;
}
