'use client';
import { formatCurrency } from '@/lib/currency';
import ValidatedForm from '@/components/validated-form';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import type { Actor } from '@/lib/auth';

type ServiceItem = {
  _id: string;
  name: string;
  price: number;
  duration?: number;
  category?: string;
};

function formatVnd(amount: number): string {
  return formatCurrency(amount);
}

export default function BookingForm({
  services,
  user,
  initialServiceId,
}: {
  services: ServiceItem[];
  user: Actor | null;
  initialServiceId?: string;
}) {
  // Categories
  const categories = useMemo(() => {
    return Array.from(new Set(services.map(s => s.category).filter(Boolean) as string[]));
  }, [services]);

  const [activeCategory, setActiveCategory] = useState<string>('');

  // Selected Service
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    initialServiceId && services.some(s => s._id === initialServiceId) ? [initialServiceId] : services[0] ? [services[0]._id] : []
  );
  function toggleService(id: string) {
    setSelectedServiceIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < 30 ? [...previous, id] : previous);
    setError('');
  }

  // Quick Days Generation (today + next 6 days)
  const quickDays = useMemo(() => {
    const list = [];
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() + i * 24 * 3600_000);
      const iso = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
      const calendar = new Date(iso + 'T00:00:00Z');
      const label = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `${dayNames[calendar.getUTCDay()]}, ${calendar.getUTCDate()}/${calendar.getUTCMonth() + 1}`;
      list.push({ iso, label, isToday: i === 0 });
    }
    return list;
  }, []);

  const [date, setDate] = useState<string>(quickDays[1]?.iso || quickDays[0]?.iso || '');
  const [time, setTime] = useState<string>('14:30');

  // Customer Contact
  const [name, setName] = useState<string>(user?.name || '');
  const [phone, setPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submission State
  const [busy, setBusy] = useState<boolean>(false);
  const bookingRequest = useRef<{ body: string; key: string } | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<{
    appointmentId: string;
    serviceName: string;
    startAt: string;
    duration?: number;
  } | null>(null);

  const filteredServices = useMemo(() => {
    if (!activeCategory) return services;
    return services.filter(s => s.category === activeCategory);
  }, [services, activeCategory]);

  const selectedServices = services.filter(s => selectedServiceIds.includes(s._id));
  const estimatedTotal = selectedServices.reduce((sum, service) => sum + service.price, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedServiceIds.length) {
      setError('Vui lòng chọn ít nhất một dịch vụ.');
      return;
    }
    if (!date || !time) {
      setError('Vui lòng chọn ngày và giờ hẹn.');
      return;
    }
    if (!name.trim()) {
      setError('Vui lòng nhập họ tên của bạn.');
      return;
    }
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại để spa liên hệ xác nhận.');
      return;
    }

    const startDateTime = new Date(`${date}T${time}:00+07:00`);
    if (isNaN(startDateTime.getTime()) || startDateTime.getTime() <= Date.now()) {
      setError('Thời gian hẹn phải ở tương lai. Vui lòng chọn lại.');
      return;
    }

    setBusy(true);
    try {
      const body = JSON.stringify({ serviceIds: selectedServiceIds, startAt: startDateTime.toISOString(),
        name: name.trim(), phone: phone.trim(), notes: notes.trim() });
      if (bookingRequest.current?.body !== body) bookingRequest.current = { body, key: crypto.randomUUID() };
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': bookingRequest.current.key },
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) throw new Error(data.error || 'Khung giờ này đã có lịch, vui lòng chọn giờ khác.');
        throw new Error(data.error || 'Đặt lịch không thành công. Vui lòng thử lại.');
      }

      setSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi đặt lịch.');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    const appointmentDate = new Date(success.startAt);
    return (
      <div className="pub-booking-success-card">
        <div className="pub-success-icon-wrap">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <span className="pub-section-eyebrow">XÁC NHẬN THÀNH CÔNG</span>
        <h2 className="pub-success-title">
          SpaCare đã tiếp nhận lịch hẹn của bạn
        </h2>
        <p className="pub-success-sub">
          Lịch hẹn đã được hệ thống lưu trữ an toàn. Spa sẽ chủ động chuẩn bị phòng trị liệu riêng biệt để đón tiếp bạn.
        </p>

        <div className="pub-success-summary-box">
          <div className="pub-success-item">
            <span className="pub-success-item-label">Dịch vụ:</span>
            <strong className="pub-success-item-val">{success.serviceName}</strong>
          </div>
          <div className="pub-success-grid-two">
            <div className="pub-success-item">
              <span className="pub-success-item-label">Khung giờ hẹn:</span>
              <strong className="pub-success-item-val">
                {appointmentDate.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}
              </strong>
            </div>
            <div className="pub-success-item">
              <span className="pub-success-item-label">Ngày:</span>
              <strong className="pub-success-item-val">
                {appointmentDate.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </strong>
            </div>
          </div>
          <div className="pub-success-item" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="pub-success-item-label">Khách hàng:</span>
            <strong className="pub-success-item-val">{name}</strong>
          </div>
        </div>

        <div className="pub-success-actions">
          {user ? (
            <Link href="/customer" className="pub-btn pub-btn-primary" style={{ flex: 1, minWidth: '200px' }}>
              Xem lịch trong tài khoản của tôi →
            </Link>
          ) : (
            <Link
              href="/login?returnTo=/customer"
              className="pub-btn pub-btn-primary"
              style={{ flex: 1, minWidth: '200px' }}
            >
              Đăng nhập để theo dõi lịch
            </Link>
          )}
          <Link href="/" className="pub-btn pub-btn-secondary" style={{ flex: 1, minWidth: '160px' }}>
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ValidatedForm onSubmit={handleSubmit} className="pub-booking-form-wrap">
      {/* Step Indicator Header */}
      <div className="pub-booking-steps-bar">
        <div className="pub-step-node active">
          <span className="pub-step-num">1</span>
          <span className="pub-step-txt">Chọn dịch vụ</span>
        </div>
        <div className="pub-step-line active" />
        <div className="pub-step-node active">
          <span className="pub-step-num">2</span>
          <span className="pub-step-txt">Chọn ngày giờ</span>
        </div>
        <div className="pub-step-line active" />
        <div className="pub-step-node active">
          <span className="pub-step-num">3</span>
          <span className="pub-step-txt">Thông tin</span>
        </div>
      </div>

      {/* Step 1: Chọn dịch vụ */}
      <section className="pub-booking-section">
        <div className="pub-booking-section-header">
          <h3 className="pub-booking-section-title">
            <span className="pub-section-circle-badge">1</span>
            Chọn liệu trình trị liệu
          </h3>
          <span className="pub-booking-section-sub">
            {selectedServices.length ? `Đã chọn ${selectedServices.length} dịch vụ: ${selectedServices.map(service => service.name).join(', ')}` : 'Chọn một hoặc nhiều dịch vụ'}
          </span>
        </div>

        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="pub-booking-cat-pills">
            <button
              type="button"
              className={`pub-cat-pill ${!activeCategory ? 'active' : ''}`}
              onClick={() => setActiveCategory('')}
            >
              Tất cả
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`pub-cat-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Services List */}
        <div className="pub-booking-service-list">
          {filteredServices.map(svc => {
            const isSelected = selectedServiceIds.includes(svc._id);
            return (
              <label key={svc._id} className={`pub-booking-service-item ${isSelected ? 'selected' : ''}`}>
                <input type="checkbox" className="pub-service-checkbox" name="serviceIds" value={svc._id} checked={isSelected} disabled={busy || (!isSelected && selectedServiceIds.length >= 30)} onChange={() => toggleService(svc._id)} />

                <div className="pub-booking-service-info">
                  <div className="pub-booking-service-row">
                    <strong className="pub-booking-service-title">{svc.name}</strong>
                    {svc.category && (
                      <span className="pub-service-micro-tag">{svc.category}</span>
                    )}
                  </div>
                </div>

                <div className="pub-booking-service-price">
                  {formatVnd(svc.price)}
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Step 2: Chọn ngày và giờ */}
      <section className="pub-booking-section">
        <div className="pub-booking-section-header">
          <h3 className="pub-booking-section-title">
            <span className="pub-section-circle-badge">2</span>
            Thời gian hẹn
          </h3>
          <span className="pub-booking-section-sub">
            {date ? `${date} lúc ${time}` : 'Chọn ngày và giờ phù hợp'}
          </span>
        </div>

        {/* Horizontal Quick Days Scroll (Super touch-friendly on phones) */}
        <div className="pub-days-scroll-container">
          <div className="pub-days-scroll-track">
            {quickDays.map(q => {
              const isSelected = date === q.iso;
              return (
                <button
                  key={q.iso}
                  type="button"
                  className={`pub-day-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => setDate(q.iso)}
                >
                  <span className="pub-day-chip-label">{q.label}</span>
                  <span className="pub-day-chip-date">{q.iso.slice(5).replace('-', '/')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Custom Date picker */}
        <div className="pub-custom-date-row">
          <label className="pub-custom-date-label">
            <span>Hoặc chọn ngày khác:</span>
            <input
              type="date"
              value={date}
              min={quickDays[0]?.iso}
              required
              onChange={e => setDate(e.target.value)}
              className="pub-date-input"
            />
          </label>
        </div>

        <div className="pub-slots-block">
          <label className="pub-custom-date-label"><span>Giờ khách đến (giờ Việt Nam)</span>
            <input type="time" name="arrivalTime" className="pub-date-input" min="09:00" max="22:00" step={60} required value={time} disabled={busy} onChange={event => setTime(event.target.value)} />
          </label>
          <p className="pub-input-hint">Chọn giờ và phút bất kỳ từ 09:00 đến 22:00, ví dụ 09:15 hoặc 14:40.</p>
        </div>
      </section>

      {/* Step 3: Thông tin người đặt */}
      <section className="pub-booking-section">
        <div className="pub-booking-section-header">
          <h3 className="pub-booking-section-title">
            <span className="pub-section-circle-badge">3</span>
            Thông tin liên hệ
          </h3>
          <span className="pub-booking-section-sub">
            {user ? `Tài khoản: ${user.name}` : 'Xác nhận để spa liên hệ đón tiếp'}
          </span>
        </div>

        {!user && (
          <div className="pub-booking-auth-prompt">
            <div className="pub-prompt-text">
              <strong>Đã từng sử dụng dịch vụ tại SpaCare?</strong>
              <p>Đăng nhập để tự động lưu buổi trị liệu vào hồ sơ khách hàng của bạn.</p>
            </div>
            <Link
              href={`/login?returnTo=/booking?serviceId=${selectedServiceIds[0] || ''}`}
              className="pub-btn pub-btn-secondary pub-btn-sm"
            >
              Đăng nhập ngay →
            </Link>
          </div>
        )}

        <div className="pub-form-grid">
          <div className="pub-input-group">
            <label className="pub-field-label">
              Họ và tên <span className="pub-req">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Thị Mai"
              required
              className="pub-text-input"
            />
          </div>

          <div className="pub-input-group">
            <label className="pub-field-label">
              Số điện thoại <span className="pub-req">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0901 234 567"
              required
              className="pub-text-input"
            />
            <small className="pub-input-hint">Dùng để nhận xác nhận và định vị phòng hẹn.</small>
          </div>

          <div className="pub-input-group pub-full-width">
            <label className="pub-field-label">
              Ghi chú riêng cho chuyên viên (tùy chọn)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ví dụ: Lực massage vừa phải, da nhạy cảm với hương liệu, cần làm kỹ vai gáy..."
              rows={3}
              className="pub-textarea"
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="alert error" role="alert" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Desktop & Mobile Sticky Bottom Summary & CTA */}
      <div className="pub-booking-footer-bar">
        <div className="pub-booking-footer-inner">
          <div className="pub-footer-price-info">
            <span className="pub-footer-price-label">Chi phí thanh toán ước tính:</span>
            <div className="pub-footer-price-val">
              {formatVnd(estimatedTotal)}

            </div>
          </div>

          <button
            type="submit"
            className="pub-btn pub-btn-primary pub-footer-submit-btn"
            disabled={busy}
          >
            {busy ? 'Đang xác nhận lịch…' : 'Xác nhận đặt lịch ngay →'}
          </button>
        </div>
      </div>
    </ValidatedForm>
  );
}
