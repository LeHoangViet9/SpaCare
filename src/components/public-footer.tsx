import Link from 'next/link';
import Brand from '@/components/brand';
import { publicSpaPath } from '@/lib/public-spa-path';
const links = [
  ['/services', 'Dịch vụ & bảng giá'], ['/products', 'Sản phẩm'],
  ['/booking', 'Đặt lịch hẹn'], ['/customer', 'Tài khoản khách hàng'],
];
export default function PublicFooter({ spaSlug }: { spaSlug?: string }) {
  const path = (value = '') => spaSlug ? publicSpaPath(spaSlug, value) : value || '/';
  return <footer id="contact" className="shared-public-footer">
    <div className="pub-container shared-footer-grid">
      <div className="shared-footer-brand"><Brand href={path()} /><p>Chăm sóc sắc đẹp và đặt lịch tại SpaCare.</p>{spaSlug && <Link href={path('/booking')} className="shared-footer-booking">Đặt lịch chăm sóc →</Link>}</div>
      <nav aria-label="Liên kết cuối trang"><h2>Khám phá SpaCare</h2>{links.filter(([href]) => spaSlug || href === '/customer').map(([href, title]) => <Link href={href === '/customer' ? href : path(href)} key={href}>{title}</Link>)}</nav>
      <div className="shared-footer-contact"><h2>Liên hệ & giờ phục vụ</h2><p>Hằng ngày · <strong>09:00 – 22:00</strong></p><p>Liên hệ trực tiếp spa để được tư vấn.</p></div>
    </div>
    <div className="pub-container shared-footer-bottom"><span>© SpaCare · Chăm sóc mỗi ngày</span><Link href="/workspace">Không gian quản lý →</Link></div>
  </footer>;
}
