import PublicHeader from '@/components/public-header';
import PublicFooter from '@/components/public-footer';
import BookingForm from '@/components/booking-form';
import { connect } from '@/lib/db';
import { Service } from '@/lib/models';
import { maybeActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BookingPage({
  searchParams,
}: {
  searchParams?: Promise<{ serviceId?: string }>;
}) {
  const userPromise = maybeActor();
  const params = searchParams ? await searchParams : {};
  const initialServiceId = params.serviceId || '';

  let services: Array<{
    _id: string;
    name: string;
    price: number;
    duration: number;
    category?: string;
  }> = [];

  try {
    await connect();
    const docs = await Service.find({ active: true })
      .select('_id name category price duration')
      .sort({ price: 1 })
      .lean();

    services = docs.map(doc => ({
      _id: String(doc._id),
      name: doc.name || 'Dịch vụ Spa',
      price: doc.price || 0,
      duration: doc.duration || 60,
      category: doc.category || undefined,
    }));
  } catch {
    services = [];
  }

  const user = await userPromise;

  return (
    <div className="pub-page-wrapper">
      <PublicHeader user={user} />

      <main className="pub-main" style={{ padding: '40px 0 80px 0' }}>
        <div className="pub-container" style={{ maxWidth: '820px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <span className="pub-section-eyebrow">ĐẶT LỊCH TRỰC TUYẾN</span>
            <h1 className="pub-section-title">Đặt lịch hẹn tại SpaCare</h1>
            <p className="pub-section-desc">
              Chọn dịch vụ yêu thích và khung giờ thuận tiện nhất. SpaCare sẽ chuẩn bị chu đáo để đón tiếp bạn.
            </p>
          </div>

          <BookingForm
            services={services}
            user={user}
            initialServiceId={initialServiceId}
          />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
