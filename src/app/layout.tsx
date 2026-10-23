import type { Metadata, Viewport } from 'next';
import './ui.css';
import './globals.css';
import './public.css';
export const metadata: Metadata = {
  icons: { apple: '/icons/spacare-192.png' },
  title: 'SpaCare · Chăm sóc sắc đẹp & Quản lý Spa',
  description: 'Không gian chăm sóc sắc đẹp, thư giãn chuyên sâu và quản lý dịch vụ spa chuyên nghiệp.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#356454' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
