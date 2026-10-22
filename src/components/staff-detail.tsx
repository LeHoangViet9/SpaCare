'use client';
import { useEffect, useState } from 'react';
type Row = Record<string, any>;
export default function StaffDetail({ id, onClose, onSchedule }: { id: string; onClose: () => void; onSchedule: (id: string) => void }) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/staff/' + id, { signal: controller.signal, cache: 'no-store' }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); return body; }).then(result => { if (!controller.signal.aborted) setData(result); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id]);
  return <div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Hồ sơ nhân viên" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}><div className="section-head"><h2>Hồ sơ nhân viên</h2><button autoFocus onClick={onClose}>Đóng</button></div>{error ? <p role="alert">{error}</p> : !data ? <p>Đang tải…</p> : <>
    <h3>{data.staff.name}</h3><p>{data.staff.email}</p><p>{data.staff.active ? 'Đang hoạt động' : 'Đã khóa'} · {data.staff.role === 'OWNER' ? 'Chủ spa' : data.staff.cashier ? 'Nhân viên / thu ngân' : 'Nhân viên'}</p>
    <div className="profile-summary"><div><small>Lịch được giao</small><strong>{data.summary.appointments}</strong></div><div><small>Đã hoàn thành</small><strong>{data.summary.completed}</strong></div><div><small>Buổi thực hiện</small><strong>{data.summary.sessions}</strong></div><div><small>Khách tư vấn</small><strong>{data.summary.customers}</strong></div></div>
    <button className="primary" onClick={() => onSchedule(id)}>Xem lịch nhân viên</button>
  </>}</section></div>;
}
