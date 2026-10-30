import ValidatedForm from '@/components/validated-form';
import Link from 'next/link';
import PublicHeader from '@/components/public-header';
import PublicFooter from '@/components/public-footer';
import ServiceCard, { type PublicService } from '@/components/service-card';
import { connect } from '@/lib/db';
import { Service } from '@/lib/models';
import { maybeActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ServicesPage({ searchParams }: { searchParams?: Promise<{ category?: string; q?: string }> }) {
  const userPromise = maybeActor();
  const params = searchParams ? await searchParams : {};
  const category = params.category || '';
  const search = (params.q || '').trim();
  let services: PublicService[] = [], categories: string[] = [];
  let failed = false;
  try {
    await connect();
    const docs = await Service.find({ active: true }).select('_id name category price duration').sort({ price: 1 }).lean();
    categories = [...new Set(docs.map(s => s.category).filter(Boolean) as string[])];
    services = docs.filter(s => (!category || s.category === category) && (!search || s.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))))
      .map(s => ({ _id: String(s._id), name: s.name, category: s.category, price: s.price, duration: s.duration }));
  } catch { failed = true; }
  const user = await userPromise;
  return <div className="pub-page-wrapper services-catalog-wrapper"><PublicHeader user={user} />
    <main className="pub-main pub-container shared-public-page services-catalog-page">
      <div className="page-heading"><div><h1 id="pricing">Dịch vụ & bảng giá</h1><p>Chọn dịch vụ để xem chi tiết hoặc đặt lịch hẹn.</p></div></div>
      <section className="ui-card shared-catalog-filters services-catalog-filters" aria-label="Tìm dịch vụ">
        <ValidatedForm action="/services" className="shared-search-form"><label htmlFor="service-search">Tìm dịch vụ</label><div>{category && <input type="hidden" name="category" value={category} />}<input id="service-search" name="q" defaultValue={search} placeholder="Nhập tên dịch vụ" maxLength={100} /><button type="submit" className="primary">Tìm kiếm</button></div></ValidatedForm>
        <div className="shared-category-links"><Link href="/services" className={`pub-cat-pill ${!category ? 'active' : ''}`}>Tất cả</Link>{categories.map(c => <Link key={c} href={'/services?' + new URLSearchParams({ category: c, q: search })} className={`pub-cat-pill ${c === category ? 'active' : ''}`}>{c}</Link>)}</div>
      </section>
      {failed ? <p role="alert">Chưa tải được dịch vụ. Vui lòng thử lại sau.</p> : services.length ? <div className="pub-service-grid services-catalog-grid">{services.map(service => <ServiceCard key={service._id} service={service} />)}</div> : <section className="ui-card shared-about"><p>Không tìm thấy dịch vụ phù hợp.</p><Link className="pub-btn pub-btn-secondary" href="/services">Xem tất cả dịch vụ</Link></section>}
    </main><PublicFooter />
  </div>;
}
