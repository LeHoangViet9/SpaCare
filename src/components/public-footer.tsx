import Link from 'next/link';
import Brand from '@/components/brand';

const links = [
  ['/services', 'Dịch vụ & bảng giá'], ['/products', 'Sản phẩm'],
  ['/booking', 'Đặt lịch hẹn'], ['/customer', 'Tài khoản khách hàng'],
];
export default function PublicFooter() {
  return <footer id="contact" className="shared-public-footer">
    <div className="pub-container shared-footer-grid">
      <div><Brand /><p>Chăm sóc sắc đẹp và đặt lịch tại SpaCare.</p></div>
      <nav aria-label="Liên kết cuối trang">{links.map(([href, title]) => <Link href={href} key={href}>{title}</Link>)}</nav>
      <div><h2>Liên hệ SpaCare</h2><p>Giờ phục vụ: <strong>09:00–22:00</strong> hàng ngày</p><a href="tel:0329357116">Hotline: 0329 357 116</a></div>
    </div>
    <div className="pub-container shared-footer-bottom"><span>SpaCare</span><Link href="/workspace">Không gian quản lý</Link></div>
  </footer>;
}
