import Link from 'next/link';
import Brand from '@/components/brand';
const links = [
  ['/services', 'Dịch vụ & bảng giá'], ['/products', 'Sản phẩm'],
  ['/booking', 'Đặt lịch hẹn'], ['/customer', 'Tài khoản khách hàng'],
];
export default function PublicFooter() {
  return <footer id="contact" className="shared-public-footer">
    <div className="pub-container shared-footer-grid">
      <div className="shared-footer-brand"><Brand /><p>Chăm sóc sắc đẹp và đặt lịch tại SpaCare.</p><Link href="/booking" className="shared-footer-booking">Đặt lịch chăm sóc →</Link></div>
      <nav aria-label="Liên kết cuối trang"><h2>Khám phá SpaCare</h2>{links.map(([href, title]) => <Link href={href} key={href}>{title}</Link>)}</nav>
      <div className="shared-footer-contact"><h2>Liên hệ & giờ phục vụ</h2><p>Hằng ngày · <strong>09:00 – 22:00</strong></p><a className="shared-footer-phone" href="tel:0329357116"><small>Hotline tư vấn</small><strong>0329 357 116</strong></a></div>
    </div>
    <div className="pub-container shared-footer-bottom"><span>© SpaCare · Chăm sóc mỗi ngày</span><Link href="/workspace">Không gian quản lý →</Link></div>
  </footer>;
}
