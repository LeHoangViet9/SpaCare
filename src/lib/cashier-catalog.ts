import { treatmentAvailable } from './treatment-rules.ts';
export type CashierMode = 'service' | 'package' | 'session' | 'product';
type Row = Record<string, any>;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
export function cashierCatalog(data: { services: Row[]; packageTemplates: Row[]; treatments: Row[]; products?: Row[] }, mode: CashierMode, customerId: string, search: string) {
  const activeServices = data.services.filter(s => s.active);
  const rows = mode === 'product' ? (data.products || []).filter(p => p.active) : mode === 'service' ? activeServices : mode === 'package'
    ? data.packageTemplates.filter(p => p.active && activeServices.some(s => s._id === p.serviceId))
    : data.treatments.filter(t => t.customerId === customerId && treatmentAvailable(t) && t.serviceId);
  const term = normalize(search.trim());
  return rows.filter(r => normalize(r.name + ' ' + (r.sku || '') + ' ' + (r.category || '') + ' ' + (data.services.find(s => s._id === r.serviceId)?.name || '')).includes(term));
}
