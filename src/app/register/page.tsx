'use client';
import ValidatedForm from '@/components/validated-form';

import Link from 'next/link';
import Brand from '@/components/brand';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.');
      }

      // Registration sets session cookie immediately
      if (returnTo) {
        window.location.href = decodeURIComponent(returnTo);
      } else {
        window.location.href = '/customer';
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi.');
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
          maxWidth: '440px',
          background: '#fff',
          borderRadius: '20px',
          padding: '36px 32px',
          border: '1px solid var(--line)',
          boxShadow: '0 12px 32px rgba(37, 61, 55, 0.06)',
        }}
      >
        <span className="pub-section-eyebrow" style={{ textAlign: 'center', display: 'block' }}>
          TÀI KHOẢN KHÁCH HÀNG
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
          Đăng ký tài khoản SpaCare
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--muted)',
            textAlign: 'center',
            margin: '0 0 24px 0',
          }}
        >
          Theo dõi lịch hẹn, liệu trình và hóa đơn dịch vụ của bạn
        </p>

        {error && (
          <div className="alert error" role="alert" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <ValidatedForm onSubmit={handleRegister} style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Họ và tên</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nguyễn Thị Mai"
              style={{ marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Số điện thoại</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0901234567"
              style={{ marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              style={{ marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Mật khẩu (tối thiểu 6 ký tự)</label>
            <input
              type="password"
              required
              minLength={6}
              maxLength={128}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Xác nhận mật khẩu</label>
            <input
              type="password"
              required
              minLength={6}
              maxLength={128}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={{ marginTop: '4px' }}
            />
          </div>

          <button
            type="submit"
            className="pub-btn pub-btn-primary"
            disabled={busy}
            style={{ width: '100%', padding: '13px', marginTop: '10px', fontSize: '15px' }}
          >
            {busy ? 'Đang tạo tài khoản…' : 'Đăng ký & Đăng nhập ngay →'}
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
          Đã có tài khoản SpaCare?{' '}
          <Link
            href={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}
            style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}
          >
            Đăng nhập
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="loading">Đang tải…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
