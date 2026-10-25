type Visit = { serviceId?: unknown; requestedServices?: { serviceId: unknown; name: string }[] };
export function appointmentServiceIds(visit: Visit): string[] {
  return visit.requestedServices?.length ? visit.requestedServices.map(item => String(item.serviceId)) : visit.serviceId ? [String(visit.serviceId)] : [];
}
export function appointmentServiceName(visit: Visit, fallback: string): string {
  return visit.requestedServices?.length ? visit.requestedServices.map(item => item.name).join(' + ') : fallback;
}
