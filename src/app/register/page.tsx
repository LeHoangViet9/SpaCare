import Link from 'next/link';
import { CUSTOMER_ACCESS_NOTICE } from '@/lib/customer-access';

export default function RegisterPage() {
  return <main className="pub-container" style={{ padding: '48px 16px' }}>
    <h1>Đăng ký tài khoản khách hàng</h1>
    <p role="status">{CUSTOMER_ACCESS_NOTICE}</p>
    <Link href="/">Quay về trang chủ</Link>
  </main>;
}
