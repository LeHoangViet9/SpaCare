'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Actor } from '@/lib/auth';

export default function MobileBottomNav({ user }: { user: Actor | null }) {
  const pathname = usePathname();

  // Hide on workspace pages if needed, but show on all public & customer pages
  if (pathname.startsWith('/workspace')) {
    return null;
  }

  const accountHref = user
    ? user.role === 'CUSTOMER'
      ? '/customer'
      : '/workspace'
    : '/login';

  const accountLabel = user
    ? user.role === 'CUSTOMER'
      ? 'Tài khoản'
      : 'Quản lý'
    : 'Đăng nhập';

  const isHome = pathname === '/';
  const isServices = pathname.startsWith('/services');
  const isBooking = pathname === '/booking';
  const isAccount = pathname === '/customer' || pathname === '/login' || pathname === '/register';

  return (
    <nav className="pub-mobile-bottom-bar" aria-label="Điều hướng nhanh trên điện thoại">
      <Link
        href="/"
        className={`pub-bottom-item ${isHome ? 'active' : ''}`}
      >
        <span className="pub-bottom-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </span>
        <span className="pub-bottom-label">Trang chủ</span>
      </Link>

      <Link
        href="/services"
        className={`pub-bottom-item ${isServices ? 'active' : ''}`}
      >
        <span className="pub-bottom-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12A10 10 0 0 1 12 2z"/>
            <path d="M12 6c-3 0-5 2-5 5 0 3 5 7 5 7s5-4 5-7c0-3-2-5-5-5z"/>
          </svg>
        </span>
        <span className="pub-bottom-label">Dịch vụ</span>
      </Link>

      <Link
        href="/booking"
        className="pub-bottom-item pub-bottom-cta-item"
        aria-label="Đặt lịch hẹn"
      >
        <div className={`pub-bottom-cta-circle ${isBooking ? 'active' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
            <line x1="16" x2="16" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
            <path d="M12 14v4"/>
            <path d="M10 16h4"/>
          </svg>
        </div>
        <span className="pub-bottom-label" style={{ fontWeight: 700, color: 'var(--green)' }}>Đặt lịch</span>
      </Link>

      <a
        href="tel:0329357116"
        className="pub-bottom-item"
        title="Gọi hotline"
      >
        <span className="pub-bottom-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </span>
        <span className="pub-bottom-label">Hotline</span>
      </a>

      <Link
        href={accountHref}
        className={`pub-bottom-item ${isAccount ? 'active' : ''}`}
      >
        <span className="pub-bottom-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <span className="pub-bottom-label">{accountLabel}</span>
      </Link>
    </nav>
  );
}
