import Link from 'next/link';
import PublicHeader from '@/components/public-header';
import { maybeActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await maybeActor();
  return <div className="pub-page-wrapper">
    <PublicHeader user={user} />
    <main className="pub-main shared-public-page pub-container">
      <section className="ui-card shared-home-intro">
        <div><h1>SpaCare</h1><p>Truy cập đường dẫn riêng của spa để xem dịch vụ, sản phẩm và đặt lịch hẹn.</p>
          <Link href="/workspace" className="pub-btn pub-btn-primary">Vào trang quản lý</Link>
        </div>
        <div className="shared-opening-hours"><span>Giờ phục vụ hàng ngày</span><strong>09:00–22:00</strong></div>
      </section>
      <section id="about" className="ui-card shared-about"><h2>Về SpaCare</h2><p>Không gian chăm sóc sắc đẹp với dịch vụ và sản phẩm được cập nhật trực tiếp từ spa.</p><p>Bạn có thể đặt lịch trên web hoặc liên hệ để được tư vấn. Nếu đã có tài khoản, đăng nhập để xem lịch hẹn và liệu trình của mình.</p></section>
    </main>
  </div>;
}
