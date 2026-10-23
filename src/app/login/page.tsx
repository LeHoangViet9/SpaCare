'use client';
import ValidatedForm from '@/components/validated-form';

import Link from 'next/link';
import Brand from '@/components/brand';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Email hoặc mật khẩu không chính xác.');
      }

      // Role-based routing
      if (returnTo) {
        window.location.href = decodeURIComponent(returnTo);
      } else if (data.role === 'CUSTOMER') {
        window.location.href = '/customer';
      } else {
        window.location.href = '/workspace';
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công.');
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--paper)',
        padding: '24px 16px',
      }}
    >
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <Brand />
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#fff',
          borderRadius: '20px',
          padding: '36px 32px',
          border: '1px solid var(--line)',
          boxShadow: '0 12px 32px rgba(37, 61, 55, 0.06)',
        }}
      >
        <span className="pub-section-eyebrow" style={{ textAlign: 'center', display: 'block' }}>
          ĐĂNG NHẬP HỆ THỐNG
        </span>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: 'var(--ink)',
            textAlign: 'center',
            margin: '0 0 8px 0',
          }}
        >
          Chào mừng trở lại
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--muted)',
            textAlign: 'center',
            margin: '0 0 24px 0',
          }}
        >
          Đăng nhập dành cho khách hàng và nhân sự spa
        </p>

        {error && (
          <div className="alert error" role="alert" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <ValidatedForm onSubmit={handleLogin} style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Email</label>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              style={{ marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Mật khẩu</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ marginTop: '4px' }}
            />
          </div>

          <button
            type="submit"
            className="pub-btn pub-btn-primary"
            disabled={busy}
            style={{ width: '100%', padding: '13px', marginTop: '8px', fontSize: '15px' }}
          >
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập →'}
          </button>
        </ValidatedForm>

        <div
          style={{
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--line)',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--muted)',
          }}
        >
          Khách hàng mới chưa có tài khoản?{' '}
          <Link
            href={returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : '/register'}
            style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}
          >
            Đăng ký ngay
          </Link>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Link
            href="/"
            style={{ color: 'var(--muted)', fontSize: '13px', textDecoration: 'none' }}
          >
            ← Quay về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading">Đang tải…</div>}>
      <LoginForm />
    </Suspense>
  );
}
