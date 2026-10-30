'use client';
import { useEffect, useState } from 'react';

export async function disablePush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unsubscribe', endpoint: subscription.endpoint }) });
  if (!response.ok) throw new Error('Chưa tắt được thông báo thiết bị. Vui lòng thử lại.');
  await subscription.unsubscribe();
}
type Item = { _id: string; title: string; body: string; url: string; readAt?: string };
export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [key, setKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function refresh() {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) throw new Error('Không tải được thông báo.');
      const body = await response.json(); setItems(body.items); setUnread(body.unread); setKey(body.publicKey);
    } catch (error) { setMessage((error as Error).message); }
  }
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30_000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration('/').then(async registration => {
      setEnabled(!!await registration?.pushManager.getSubscription());
    }).catch(() => {});
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  async function toggle() {
    setBusy(true); setMessage('');
    try {
      if (enabled) { await disablePush(); setEnabled(false); return; }
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
        throw new Error('Trình duyệt chưa hỗ trợ. Với iPhone, hãy thêm SpaCare vào màn hình chính và mở từ đó.');
      if (!key) throw new Error('Máy chủ chưa cấu hình thông báo đẩy.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Chưa được cấp quyền. Bạn có thể bật trong cài đặt thông báo của trình duyệt.');
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const registration = await navigator.serviceWorker.ready;
      const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscribe', subscription: subscription.toJSON() }) });
      if (!response.ok) { await subscription.unsubscribe(); throw new Error('Chưa lưu được thiết bị nhận thông báo.'); }
      setEnabled(true); setMessage('Đã bật nhận thông báo trên thiết bị này.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function visit(item: Item) {
    setBusy(true);
    try {
      const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', id: item._id }) });
      if (!response.ok) throw new Error('Chưa đánh dấu được thông báo.');
      window.location.assign(item.url);
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }
  async function readAll() {
    setBusy(true);
    try {
      const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readAll' }) });
      if (!response.ok) throw new Error('Chưa đánh dấu được thông báo.');
      await refresh();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="notification-center">
    <span className="notification-bar-label">Trung tâm thông báo</span>
    <button className="notification-trigger" type="button" aria-label={`Thông báo: ${unread} chưa đọc`} aria-expanded={open} aria-controls="workspace-notifications" onClick={() => { setOpen(!open); if (!open) void refresh(); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      <span>Thông báo</span>{unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <><div className="notification-backdrop" role="button" tabIndex={0} aria-label="Đóng thông báo"
      onClick={() => setOpen(false)}
      onKeyDown={event => {
        if (['Enter', ' ', 'Escape'].includes(event.key)) {
          event.preventDefault();
          setOpen(false);
        }
      }} /><section id="workspace-notifications" className="notification-panel" aria-label="Thông báo">
      <div className="section-head"><h2>Thông báo</h2><button onClick={() => setOpen(false)}>Đóng</button></div>
      <button disabled={busy} onClick={toggle}>{enabled ? 'Tắt thông báo thiết bị này' : 'Bật thông báo trên điện thoại'}</button>
      {unread > 0 && <button disabled={busy} onClick={readAll}>Đánh dấu tất cả đã đọc</button>}
      {!key && <p>Chưa cấu hình thông báo đẩy; bạn vẫn xem được lịch sử tại đây.</p>}
      <p className="filter-note">iPhone: Chia sẻ → Thêm vào màn hình chính → mở SpaCare để bật thông báo.</p>
      {message && <p role="status">{message}</p>}
      {!items.length && <p>Chưa có thông báo.</p>}
      {items.map(item => <button disabled={busy} className={'notification-item' + (!item.readAt ? ' unread' : '')} key={item._id} onClick={() => visit(item)}><strong>{item.title}</strong><span>{item.body}</span></button>)}
    </section></>}
  </div>;
}
