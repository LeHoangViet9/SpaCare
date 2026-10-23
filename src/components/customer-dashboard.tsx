'use client';
import { formatCurrency } from '@/lib/currency';

import Link from 'next/link';
import { useState } from 'react';
import type { Actor } from '@/lib/auth';

type AppointmentRow = {
  _id: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  status: string;
  notes?: string;
};

type TreatmentRow = {
  _id: string;
  name: string;
  totalSessions: number;
  remaining: number;
  status: string;
};

type InvoiceRow = {
  _id: string;
  description: string;
  total: number;
  paid: number;
  status: string;
  createdAt: string;
};

function formatVnd(amount: number): string {
  return formatCurrency(amount);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString('vi-VN')}`;
  } catch {
    return iso;
  }
}

function appointmentBadge(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return <span className="pub-status-badge pub-status-confirmed">Đã xác nhận</span>;
    case 'COMPLETED':
      return <span className="pub-status-badge pub-status-completed">Hoàn thành</span>;
    case 'CANCELLED':
      return <span className="pub-status-badge pub-status-cancelled">Đã hủy</span>;
    case 'POSTPONED':
      return <span className="pub-status-badge pub-status-partial">Dời lịch</span>;
    default:
      return <span className="pub-status-badge">{status}</span>;
  }
}

function invoiceBadge(status: string) {
  switch (status) {
    case 'PAID':
      return <span className="pub-status-badge pub-status-paid">Đã thanh toán</span>;
    case 'PARTIAL':
      return <span className="pub-status-badge pub-status-partial">Còn nợ</span>;
    case 'UNPAID':
      return <span className="pub-status-badge pub-status-cancelled">Chưa thanh toán</span>;
    default:
      return <span className="pub-status-badge">{status}</span>;
  }
}

export default function CustomerDashboardClient({
  user,
  customerName,
  appointments,
  treatments,
  invoices,
}: {
  user: Actor;
  customerName: string;
  appointments: AppointmentRow[];
  treatments: TreatmentRow[];
  invoices: InvoiceRow[];
}) {
  const [tab, setTab] = useState<'appointments' | 'treatments' | 'invoices'>('appointments');

  const totalRemainingSessions = treatments.reduce((acc, t) => acc + (t.remaining || 0), 0);

  return (
    <div>
      {/* Profile Header Card */}
      <div className="pub-dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--pub-sage)',
                color: 'var(--pub-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 800,
                border: '2px solid var(--pub-sage-border)',
                flexShrink: 0,
              }}
            >
              {customerName.charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--pub-ink)', margin: 0 }}>
                  {customerName}
                </h1>
                <span className="pub-service-tag" style={{ background: 'var(--pub-sage)', color: 'var(--pub-green)' }}>
                  Khách hàng SpaCare
                </span>
              </div>
              <p style={{ margin: 0, color: 'var(--pub-muted)', fontSize: '13px' }}>
                Cổng quản lý lịch hẹn & theo dõi tiến trình trị liệu cá nhân
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link href="/booking" className="pub-btn pub-btn-primary">
              + Đặt lịch mới
            </Link>
            {['OWNER', 'STAFF'].includes(user.role) && (
              <Link href="/workspace" className="pub-btn pub-btn-secondary">
                Vào trang quản lý spa →
              </Link>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--pub-line)',
          }}
        >
          <div style={{ background: 'var(--pub-paper)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--pub-line)' }}>
            <span style={{ fontSize: '12px', color: 'var(--pub-muted)', display: 'block', marginBottom: '4px' }}>
              Lịch hẹn đã đặt
            </span>
            <strong style={{ fontSize: '20px', color: 'var(--pub-ink)' }}>
              {appointments.length}
            </strong>
          </div>

          <div style={{ background: 'var(--pub-paper)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--pub-line)' }}>
            <span style={{ fontSize: '12px', color: 'var(--pub-muted)', display: 'block', marginBottom: '4px' }}>
              Số buổi liệu trình còn
            </span>
            <strong style={{ fontSize: '20px', color: 'var(--pub-green)' }}>
              {totalRemainingSessions} buổi
            </strong>
          </div>

          <div style={{ background: 'var(--pub-paper)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--pub-line)' }}>
            <span style={{ fontSize: '12px', color: 'var(--pub-muted)', display: 'block', marginBottom: '4px' }}>
              Gói đang kích hoạt
            </span>
            <strong style={{ fontSize: '20px', color: 'var(--pub-ink)' }}>
              {treatments.filter(t => t.status === 'ACTIVE').length} gói
            </strong>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="pub-tabs-nav">
        <button
          type="button"
          className={`pub-tab-btn ${tab === 'appointments' ? 'active' : ''}`}
          onClick={() => setTab('appointments')}
        >
          Lịch hẹn của tôi ({appointments.length})
        </button>
        <button
          type="button"
          className={`pub-tab-btn ${tab === 'treatments' ? 'active' : ''}`}
          onClick={() => setTab('treatments')}
        >
          Gói liệu trình ({treatments.length})
        </button>
        <button
          type="button"
          className={`pub-tab-btn ${tab === 'invoices' ? 'active' : ''}`}
          onClick={() => setTab('invoices')}
        >
          Hóa đơn dịch vụ ({invoices.length})
        </button>
      </div>

      {/* Tab 1: Appointments */}
      {tab === 'appointments' && (
        <div className="pub-card-list">
          {appointments.length > 0 ? (
            appointments.map(apt => (
              <div key={apt._id} className="pub-item-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '16px', color: 'var(--pub-ink)' }}>
                      {apt.serviceName}
                    </strong>
                    {appointmentBadge(apt.status)}
                  </div>
                  <div style={{ color: 'var(--pub-muted)', fontSize: '14px' }}>
                    🕒 Thời gian: <strong>{formatDate(apt.startAt)}</strong>
                  </div>
                  {apt.notes && (
                    <div style={{ color: 'var(--pub-muted)', fontSize: '13px', marginTop: '4px' }}>
                      Ghi chú: {apt.notes}
                    </div>
                  )}
                </div>
                <div>
                  <Link
                    href={`/booking?serviceId`}
                    className="pub-btn pub-btn-secondary pub-btn-sm"
                  >
                    Đặt lịch lại
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid var(--pub-line)',
              }}
            >
              <p style={{ color: 'var(--pub-muted)', fontSize: '15px', margin: '0 0 16px 0' }}>
                Bạn chưa có lịch hẹn nào sắp tới.
              </p>
              <Link href="/booking" className="pub-btn pub-btn-primary pub-btn-sm">
                Đặt lịch hẹn ngay
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Treatments */}
      {tab === 'treatments' && (
        <div className="pub-card-list">
          {treatments.length > 0 ? (
            treatments.map(trt => (
              <div key={trt._id} className="pub-item-card">
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '16px', color: 'var(--pub-ink)' }}>
                      {trt.name}
                    </strong>
                    <span
                      className={`pub-status-badge ${trt.status === 'ACTIVE' ? 'pub-status-active' : 'pub-status-partial'}`}
                    >
                      {trt.status === 'ACTIVE' ? 'Đang kích hoạt' : trt.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--pub-muted)', display: 'block' }}>Số buổi còn lại:</span>
                      <strong style={{ fontSize: '18px', color: 'var(--pub-green)' }}>
                        {trt.remaining} / {trt.totalSessions} buổi
                      </strong>
                    </div>

                    <div style={{ flex: 1, maxWidth: '180px' }}>
                      <div style={{ height: '8px', background: 'var(--pub-line)', borderRadius: '4px', overflow: 'hidden' }}>
                        <span
                          style={{
                            display: 'block',
                            height: '100%',
                            background: 'var(--pub-green)',
                            width: `${Math.round(((trt.totalSessions - trt.remaining) / trt.totalSessions) * 100)}%`,
                          }}
                        />
                      </div>
                      <small style={{ color: 'var(--pub-muted)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                        Đã sử dụng {trt.totalSessions - trt.remaining} buổi
                      </small>
                    </div>
                  </div>
                </div>

                <div>
                  <Link href="/booking" className="pub-btn pub-btn-primary pub-btn-sm">
                    Đặt lịch dùng buổi
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid var(--pub-line)',
              }}
            >
              <p style={{ color: 'var(--pub-muted)', fontSize: '15px', margin: '0 0 16px 0' }}>
                Bạn chưa sở hữu gói liệu trình nào.
              </p>
              <Link href="/services" className="pub-btn pub-btn-secondary pub-btn-sm">
                Khám phá dịch vụ & bảng giá
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Invoices */}
      {tab === 'invoices' && (
        <div className="pub-card-list">
          {invoices.length > 0 ? (
            invoices.map(inv => {
              const remainingDebt = Math.max(0, inv.total - inv.paid);
              return (
                <div key={inv._id} className="pub-item-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--pub-ink)' }}>
                        {inv.description}
                      </strong>
                      {invoiceBadge(inv.status)}
                    </div>
                    <div style={{ color: 'var(--pub-muted)', fontSize: '13px' }}>
                      Ngày phát hành: {formatDate(inv.createdAt)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: 'var(--pub-muted)' }}>Tổng thanh toán:</div>
                    <strong style={{ fontSize: '17px', color: 'var(--pub-ink)' }}>
                      {formatVnd(inv.total)}
                    </strong>
                    {remainingDebt > 0 && (
                      <div style={{ fontSize: '13px', color: '#b06000', fontWeight: 700 }}>
                        Còn nợ: {formatVnd(remainingDebt)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid var(--pub-line)',
              }}
            >
              <p style={{ color: 'var(--pub-muted)', fontSize: '15px', margin: 0 }}>
                Chưa có hóa đơn nào được phát hành.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
