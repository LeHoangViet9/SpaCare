import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SpaCare · Quản lý spa', description: 'Lịch hẹn, cọc, công nợ và sổ thu chi spa.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#356454' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
