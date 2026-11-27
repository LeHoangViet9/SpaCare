import { publicSpaPage } from '@/lib/public-page';
import { publicSpaPath } from '@/lib/public-spa-path';
import { publicProductImageUrl } from '@/lib/product-image';
import { formatCurrency } from '@/lib/currency';
import ValidatedForm from '@/components/validated-form';
import Link from 'next/link';
import PublicHeader from '@/components/public-header';
import PublicFooter from '@/components/public-footer';
import { maybeActor } from '@/lib/auth';
import { connect } from '@/lib/db';
import { Product } from '@/lib/models';

export const dynamic = 'force-dynamic';
export default async function ProductsPage({ params: routeParams, searchParams }: { params: Promise<{slug: string}>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const spa = await publicSpaPage((await routeParams).slug);
  const userPromise = maybeActor();
  const params = await searchParams;
  const search = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const page = /^\d{1,6}$/.test(params.page || '') ? Math.max(1, Number(params.page)) : 1;
  const pageSize = 12;
  let products: any[] = [], total = 0, failed = false;
  try {
    await connect();
    const filter = { spaId: spa._id, active: true, ...(search ? { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {}) };
    [products, total] = await Promise.all([
      Product.find(filter).select('name price sizeMl description imageUrl stock').sort({ name: 1, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Product.countDocuments(filter),
    ]);
  } catch { failed = true; }
  const user = await userPromise;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (n: number) => publicSpaPath(spa.slug, '/products') + '?' + new URLSearchParams({ q: search, page: String(n) });
  return <div className="pub-page-wrapper">
    <PublicHeader user={user} spaSlug={spa.slug} />
    <main className="pub-main pub-section"><div className="pub-container">
      <div className="pub-section-header"><h1 className="pub-section-title">Sản phẩm tại {spa.name}</h1><p className="pub-section-desc">Khám phá các sản phẩm chăm sóc đang được spa cung cấp.</p></div>
      <ValidatedForm className="public-product-search" action={publicSpaPath(spa.slug, '/products')}><label htmlFor="product-search">Tìm sản phẩm</label><div><input id="product-search" name="q" className="pub-text-input" defaultValue={search} placeholder="Nhập tên sản phẩm" maxLength={100} /><button className="pub-btn pub-btn-primary">Tìm kiếm</button></div></ValidatedForm>
      {failed ? <p role="alert">Chưa tải được sản phẩm. Vui lòng thử lại sau.</p> : <>
        <div className="public-products-grid">{products.map(p => <article key={String(p._id)} className="public-product-card">
          {publicProductImageUrl(spa.slug, String(p._id), p.imageUrl) ? <img src={publicProductImageUrl(spa.slug, String(p._id), p.imageUrl)!} alt={p.name} loading="lazy" width={360} height={300} /> : <div className="public-product-no-image">Chưa có ảnh</div>}
          <div className="public-product-content"><span className={`pub-status-badge ${p.stock > 0 ? 'pub-status-active' : ''}`}>{p.stock > 0 ? 'Còn hàng' : 'Tạm hết hàng'}</span><h2>{p.name}</h2>{p.sizeMl && <p>{p.sizeMl} ml</p>}<strong className="public-product-price">{formatCurrency(p.price)}</strong>{p.description && <p className="public-product-description">{p.description}</p>}<Link href={publicSpaPath(spa.slug, '/#contact')} className="pub-btn pub-btn-secondary">Liên hệ tư vấn</Link></div>
        </article>)}</div>
        {!products.length && <p role="status">{search ? 'Không tìm thấy sản phẩm phù hợp.' : 'Spa đang cập nhật danh sách sản phẩm.'}</p>}
        {pages > 1 && <nav className="public-product-pages" aria-label="Trang sản phẩm">{page > 1 && <Link className="pub-btn pub-btn-secondary" href={href(page - 1)}>Trước</Link>}<span>Trang {page} / {pages}</span>{page < pages && <Link className="pub-btn pub-btn-secondary" href={href(page + 1)}>Sau</Link>}</nav>}
      </>}
    </div></main><PublicFooter spaSlug={spa.slug} />
  </div>;
}
