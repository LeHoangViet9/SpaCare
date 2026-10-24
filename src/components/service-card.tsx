import { formatCurrency } from '@/lib/currency';
import Link from 'next/link';

export type PublicService = { _id: string; name: string; price: number; duration?: number; category?: string };
export default function ServiceCard({ service }: { service: PublicService }) {
  return <article className="ui-card shared-service-card">
    <div className="shared-service-meta"><span>{service.category || 'Dịch vụ'}</span></div>
    <h2>{service.name}</h2>
    <strong className="shared-service-price">{formatCurrency(service.price)}</strong>
    <div className="shared-card-actions"><Link href={`/services/${service._id}`} className="pub-btn pub-btn-secondary">Chi tiết</Link><Link href={`/booking?serviceId=${service._id}`} className="pub-btn pub-btn-primary">Đặt lịch</Link></div>
  </article>;
}
