import { formatCurrency } from '@/lib/currency';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicHeader from '@/components/public-header';
import PublicFooter from '@/components/public-footer';
import { connect } from '@/lib/db';
import { Service } from '@/lib/models';
import { maybeActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatVnd(amount: number): string {
  return formatCurrency(amount);
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) {
    notFound();
  }

  const user = await maybeActor();

  await connect();
  const service = await Service.findOne({ _id: id, active: true })
    .select('_id name category price duration')
    .lean();

  if (!service) {
    notFound();
  }

  return (
    <div className="pub-page-wrapper">
      <PublicHeader user={user} />

      <main className="pub-main" style={{ padding: '40px 0 80px 0' }}>
        <div className="pub-container" style={{ maxWidth: '880px' }}>
          <div style={{ marginBottom: '24px' }}>
            <Link
              href="/services"
              className="pub-btn pub-btn-secondary pub-btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              ← Quay lại danh sách dịch vụ
            </Link>
          </div>

          <article
            style={{
              background: '#fff',
              borderRadius: '20px',
              border: '1px solid var(--line)',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(37, 61, 55, 0.04)',
            }}
          >
            {/* Header banner */}
            <div
              style={{
                padding: '40px 36px',
                background: 'linear-gradient(135deg, #e8eee5 0%, #f6f7f2 100%)',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                <span className="pub-service-tag">{service.category || 'Dịch vụ'}</span>

              </div>
              <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 16px 0' }}>
                {service.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>GIÁ DỊCH VỤ:</span>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--green)' }}>
                  {formatVnd(service.price)}
                </span>
              </div>
            </div>

            {/* Content body */}
            <div style={{ padding: '36px' }}>
              <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>
                  Giới thiệu liệu trình
                </h2>
                <p style={{ fontSize: '15px', lineHeight: '1.7', color: 'var(--ink)' }}>
                  Liệu trình {service.name} được nghiên cứu chuyên biệt nhằm đáp ứng nhu cầu chăm sóc sức khỏe và làm đẹp toàn diện. Không chỉ tập trung vào hiệu quả tức thì, liệu trình còn nuôi dưỡng và tái sinh năng lượng sâu bên trong cơ thể.
                </p>
              </section>

              <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>
                  Điểm nổi bật của liệu trình
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px', fontSize: '14px', lineHeight: '1.6' }}>
                  <li style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>✦</span>
                    <span><strong>Sản phẩm thiên nhiên lành tính:</strong> Sử dụng tinh chất thảo mộc tự nhiên dịu nhẹ, an toàn tuyệt đối cho mọi loại da.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>✦</span>
                    <span><strong>Kỹ thuật viên lành nghề:</strong> Đội ngũ được đào tạo bài bản với thao tác nhẹ nhàng, chuẩn xác từng điểm huyệt.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>✦</span>
                    <span><strong>Không gian thư thái:</strong> Âm nhạc êm dịu, hương thơm thảo mộc giúp kích hoạt trạng thái thư giãn tối đa.</span>
                  </li>
                </ul>
              </section>

              <section style={{ marginBottom: '36px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>
                  Quy trình thực hiện
                </h2>
                <div style={{ display: 'grid', gap: '12px', fontSize: '14px', color: 'var(--ink)' }}>
                  <div style={{ padding: '14px 16px', background: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                    <strong>Bước 1: Tiếp đón & Thưởng trà ấm</strong> — Lắng nghe tư vấn và kiểm tra tình trạng hiện tại.
                  </div>
                  <div style={{ padding: '14px 16px', background: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                    <strong>Bước 2: Khởi động thư giãn</strong> — Massage nhẹ nhàng vùng vai cổ gáy và làm quen với hương thảo mộc.
                  </div>
                  <div style={{ padding: '14px 16px', background: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                    <strong>Bước 3: Thực hiện kỹ thuật chuyên sâu</strong> — Trực tiếp thực hiện liệu trình {service.name} với đầy đủ các bước chuẩn mực.
                  </div>
                  <div style={{ padding: '14px 16px', background: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                    <strong>Bước 4: Thư giãn kết thúc & Dặn dò</strong> — Dùng trà dưỡng nhan và hướng dẫn cách tự chăm sóc tại nhà.
                  </div>
                </div>
              </section>

              {/* Action */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div>

                  <span style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: 'var(--green)' }}>
                    {formatVnd(service.price)}
                  </span>
                </div>
                <Link
                  href={`/booking?serviceId=${service._id}`}
                  className="pub-btn pub-btn-primary"
                  style={{ padding: '14px 32px', fontSize: '16px' }}
                >
                  Đặt lịch dịch vụ này ngay →
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
