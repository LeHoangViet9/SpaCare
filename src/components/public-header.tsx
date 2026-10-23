'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Actor } from '@/lib/auth';
import Brand from './brand';
import MobileBottomNav from './mobile-bottom-nav';

const links = [
  { href: '/', label: 'Trang chủ' },
  { href: '/services', label: 'Dịch vụ & bảng giá' },
  { href: '/products', label: 'Sản phẩm' },
  { href: '/#about', label: 'Về SpaCare' },
  { href: '/#contact', label: 'Liên hệ' },
];

export default function PublicHeader({ user }: { user: Actor | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', close); };
  }, [open]);
  async function logout() {
    setLoggingOut(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Không đăng xuất được. Vui lòng thử lại.');
      window.location.href = '/';
    } catch (e) { setError((e as Error).message); setLoggingOut(false); }
  }
  const accountHref = user?.role === 'CUSTOMER' ? '/customer' : '/workspace';
  const accountLabel = user?.role === 'CUSTOMER' ? 'Tài khoản của tôi' : 'Vào trang quản lý';
  const navigation = (mobile = false) => links.map(link => <Link key={link.href} href={link.href}
    className={`${mobile ? 'pub-mobile-link' : 'pub-nav-link'} ${pathname === link.href || (link.href === '/services' && pathname.startsWith('/services/')) ? 'active' : ''}`}
    onClick={() => setOpen(false)}>{link.label}</Link>);
  const account = <>{user ? <>
    <Link href={accountHref} className="pub-btn pub-btn-secondary" onClick={() => setOpen(false)} title={user.name}>{accountLabel}</Link>
    <button type="button" className="pub-btn pub-btn-text" disabled={loggingOut} onClick={logout}>{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
  </> : <Link href="/login" className="pub-btn pub-btn-secondary" onClick={() => setOpen(false)}>Đăng nhập</Link>}
    <Link href="/booking" className="pub-btn pub-btn-primary" onClick={() => setOpen(false)}>Đặt lịch</Link>
  </>;
  return <>
    <header className="pub-header">
      <div className="pub-container pub-header-inner">
        <Brand onClick={() => setOpen(false)} />
        <nav className="pub-nav-desktop" aria-label="Menu chính">{navigation()}</nav>
        <div className="pub-header-actions pub-desktop-actions">{account}</div>
        <div className="pub-mobile-header-controls"><button type="button" className="pub-hamburger" aria-label="Mở menu" aria-expanded={open} aria-controls="public-menu" onClick={() => setOpen(true)}><span className="pub-hamburger-bar" /></button></div>
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
      {open && <><div className="pub-mobile-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
        <div id="public-menu" className="pub-mobile-drawer open" role="dialog" aria-modal="true" aria-label="Menu SpaCare">
          <div className="pub-mobile-drawer-header"><Brand onClick={() => setOpen(false)} /><button type="button" className="pub-drawer-close-btn" aria-label="Đóng menu" onClick={() => setOpen(false)}>×</button></div>
          <nav className="pub-mobile-nav" aria-label="Menu điện thoại">{navigation(true)}<div className="pub-mobile-divider" /><div className="pub-mobile-auth-block">{account}</div><small>Giờ phục vụ: 09:00–22:00 hàng ngày</small></nav>
        </div>
      </>}
    </header>
    <MobileBottomNav user={user} />
  </>;
}
