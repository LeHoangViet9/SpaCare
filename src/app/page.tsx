import Link from 'next/link';
import PublicHeader from '@/components/public-header';
import PublicFooter from '@/components/public-footer';
import ServiceCard, { type PublicService } from '@/components/service-card';
import { connect } from '@/lib/db';
import { Service } from '@/lib/models';
import { maybeActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const userPromise = maybeActor();
  let services: PublicService[] = [];
  let failed = false;
  try {
    await connect();
    const docs = await Service.find({ active: true }).select('_id name category price duration').limit(6).lean();
    services = docs.map(s => ({ _id: String(s._id), name: s.name, category: s.category, price: s.price, duration: s.duration }));
  } catch { failed = true; }
  const user = await userPromise;
  return <div className="pub-page-wrapper">
    <PublicHeader user={user} />
    <main className="pub-main shared-public-page pub-container">
      <section className="ui-card shared-home-intro">
        <div><h1>Chào mừng đến SpaCare</h1><p>Xem dịch vụ, tham khảo sản phẩm và chọn giờ hẹn phù hợp.</p>
        </div>
        <div className="shared-opening-hours"><span>Giờ phục vụ hàng ngày</span><strong>09:00–22:00</strong></div>
      </section>
      <section id="services"><div className="shared-section-heading"><h2>Dịch vụ tại spa</h2><Link href="/services">Xem tất cả</Link></div>
        {failed ? <p role="alert">Chưa tải được dịch vụ. Vui lòng thử lại sau.</p> : services.length ? <div className="pub-service-grid">{services.map(service => <ServiceCard key={service._id} service={service} />)}</div> : <p>Spa đang cập nhật danh sách dịch vụ.</p>}
      </section>
      <section id="about" className="ui-card shared-about"><h2>Về SpaCare</h2><p>Không gian chăm sóc sắc đẹp với dịch vụ và sản phẩm được cập nhật trực tiếp từ spa.</p><p>Bạn có thể đặt lịch trên web hoặc liên hệ để được tư vấn. Nếu đã có tài khoản, đăng nhập để xem lịch hẹn và liệu trình của mình.</p></section>
    </main>
    <PublicFooter />
  </div>;
}
