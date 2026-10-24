import { redirect } from 'next/navigation';
import PublicHeader from '@/components/public-header';
import PublicFooter from '@/components/public-footer';
import { actor } from '@/lib/auth';
import { CUSTOMER_ACCESS_NOTICE } from '@/lib/customer-access';

export const dynamic = 'force-dynamic';

export default async function CustomerDashboardPage() {
  let user;
  try { user = await actor(); }
  catch { redirect('/login?returnTo=/customer'); }
  if (user.role !== 'CUSTOMER') redirect('/workspace');

  // Existing links cannot be trusted either. Do not query or serialize customer history.
  return <div className="pub-page-wrapper">
    <PublicHeader user={{ id: user.id, spaId: user.spaId, name: user.name, role: user.role, cashier: user.cashier }} />
    <main className="pub-main" style={{ padding: '36px 0 80px' }}>
      <section className="pub-container">
        <h1>Tài khoản khách hàng</h1>
        <p role="status">{CUSTOMER_ACCESS_NOTICE}</p>
      </section>
    </main>
    <PublicFooter />
  </div>;
}
