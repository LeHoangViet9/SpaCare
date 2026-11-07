'use client';
import { useRef, useState } from 'react';
import { treatmentEditRights, treatmentUsed } from '@/lib/treatment-edit';

type Row = Record<string, any>;
const labels: Record<string, string> = { name: 'Tên gói', serviceId: 'Dịch vụ', totalSessions: 'Tổng số buổi', durationMonths: 'Thời hạn (tháng)', startsOn: 'Ngày bắt đầu', expiresOn: 'Ngày hết hạn', remaining: 'Buổi còn lại', notes: 'Ghi chú' };
export function TreatmentComparison({ before, after, services = [] }: { before: Row; after: Row; services?: Row[] }) {
  const value = (row: Row, key: string) => key === 'serviceId'
    ? row.serviceName || services.find(s => String(s._id) === String(row[key]))?.name || row[key] || '—'
    : (row[key] || row[key] === 0 ? row[key] : '—');
  return <div className="treatment-comparison"><table><thead><tr><th>Thông tin</th><th>Trước</th><th>Sau</th></tr></thead><tbody>{Object.entries(labels).filter(([key]) => before[key] !== undefined || after[key] !== undefined).map(([key, title]) => <tr key={key}><th>{title}</th><td>{value(before, key)}</td><td>{value(after, key)}</td></tr>)}</tbody></table></div>;
}
export default function TreatmentEdit({ plan, services, onChanged, initiallyOpen = false }: { plan: Row; services: Row[]; onChanged: () => void; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen), [preview, setPreview] = useState<Row | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmUsedFloor, setConfirmUsedFloor] = useState(false);
  const sending = useRef(false), keys = useRef(new Map<string, string>());
  const time = plan.packageType === 'TIME';
  const recordedUseCount: number | undefined = Number.isSafeInteger(plan.recordedUseCount) ? plan.recordedUseCount : undefined;
  const used = recordedUseCount === undefined ? undefined : treatmentUsed(plan, recordedUseCount);
  const [draft, setDraft] = useState<Row>({ name: plan.name || '', serviceId: plan.serviceId || '', totalSessions: plan.totalSessions ?? (plan.remaining || 0) + (used || 0), durationMonths: plan.durationMonths || 1, startsOn: plan.startsOn || '', expiresOn: plan.expiresOn || '', notes: plan.notes || '' });
  const update = (key: string, value: string | number) => { setDraft(d => ({ ...d, [key]: value })); setPreview(null); setError(''); };
  const submit = async () => {
    if (sending.current) return;
    setError('');
    if (recordedUseCount === undefined) { setError('Chưa tải đủ lịch sử sử dụng gói. Tải lại dữ liệu trước khi xem trước.'); return; }
    const data = { id: plan._id, expectedUpdatedAt: plan.updatedAt, name: draft.name.trim(), serviceId: draft.serviceId,
      expectedUseCount: recordedUseCount,
      ...(time ? { durationMonths: Number(draft.durationMonths) } : { totalSessions: Number(draft.totalSessions) }),
      ...(draft.startsOn ? { startsOn: draft.startsOn } : {}), ...(draft.expiresOn ? { expiresOn: draft.expiresOn } : {}), notes: draft.notes.trim(), reason: reason.trim(), ...(confirmUsedFloor ? {confirmUsedFloor:true} : {}) };
    try {
      if (!preview) { const rights = treatmentEditRights(plan, data, recordedUseCount); setPreview({ ...data, ...rights }); return; }
      sending.current = true; setBusy(true);
      const fingerprint = JSON.stringify(data), key = keys.current.get(fingerprint) || crypto.randomUUID(); keys.current.set(fingerprint, key);
      const response = await fetch('/api/operations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ action: 'updateCustomerTreatment', data }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error || 'Không thể sửa gói.');
      setOpen(false); onChanged();
    } catch (e) { setError((e as Error).message); } finally { sending.current = false; setBusy(false); }
  };
  return <section className="treatment-edit" aria-label="Sửa gói liệu trình">{!initiallyOpen && <button type="button" disabled={busy} onClick={() => { setOpen(!open); setPreview(null); }}>Sửa gói</button>}
    {open && <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      {used === undefined ? <p>Chưa tải đủ lịch sử sử dụng; chưa thể tính trước quyền lợi còn lại.</p> : <p>Đã dùng: {used} buổi{plan.openingBalance ? ' từ lúc chuyển sổ; tổng số buổi sửa tính từ lúc chuyển sổ' : ''}. Việc sửa áp dụng cho quyền lợi chưa dùng; giữ nguyên hóa đơn, khoản thu và buổi đã thực hiện.</p>}
      <fieldset disabled={busy || !!preview}>
        <label>Tên gói<input required maxLength={500} value={draft.name} onChange={e => update('name', e.target.value)} /></label>
        <label>Dịch vụ / quyền lợi<select required value={draft.serviceId} onChange={e => update('serviceId', e.target.value)}><option value="">Chọn dịch vụ</option>{services.filter(s => s.active || String(s._id) === String(plan.serviceId)).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
        {time ? <label>Thời hạn (tháng)<input required type="number" min={1} max={120} value={draft.durationMonths} onChange={e => update('durationMonths', e.target.value)} /></label> : <label>Tổng số buổi<input required type="number" min={1} max={10000} value={draft.totalSessions} onChange={e => { update('totalSessions', e.target.value); setConfirmUsedFloor(false); }} /></label>}
        {!time && used !== undefined && Number(draft.totalSessions)<used && <label><input type="checkbox" required checked={confirmUsedFloor} onChange={e=>{setConfirmUsedFloor(e.target.checked);setPreview(null);}} />Tôi xác nhận giữ {used} buổi đã thực hiện, tổng hiệu lực bằng {used}, còn lại 0; lưu tổng yêu cầu {draft.totalSessions} trong lịch sử, không hoàn tiền.</label>}
        <label>Ngày bắt đầu<input type="date" required={time} value={draft.startsOn} onChange={e => update('startsOn', e.target.value)} /></label>
        <label>Ngày hết hạn<input type="date" required={time} min={draft.startsOn || undefined} value={draft.expiresOn} onChange={e => update('expiresOn', e.target.value)} /></label>
        <label>Ghi chú<textarea maxLength={2000} value={draft.notes} onChange={e => update('notes', e.target.value)} /></label>
      </fieldset>
      {preview && <section aria-label="Đối chiếu sửa gói"><TreatmentComparison before={plan} after={preview} services={services} /><label>Lý do sửa<textarea required maxLength={500} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label><button type="button" disabled={busy} onClick={() => setPreview(null)}>Quay lại chỉnh sửa</button></section>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy || (!!preview && !reason.trim()) || (!preview && recordedUseCount === undefined)}>{busy ? 'Đang lưu…' : preview ? 'Xác nhận lưu gói' : 'Xem trước thay đổi'}</button>
    </form>}
  </section>;
}

export function TreatmentEditDialog({ plan, services, onChanged, onClose }: { plan: Row; services: Row[]; onChanged: () => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Sửa gói của khách" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
    <div className="section-head"><h2>Sửa gói · {plan.name}</h2><button type="button" autoFocus onClick={onClose}>Đóng</button></div>
    <TreatmentEdit plan={plan} services={services} initiallyOpen onChanged={onChanged} />
  </section></div>;
}
