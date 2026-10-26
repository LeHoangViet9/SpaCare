// A scheduled visit can contain standalone services and already-purchased treatments.
export function scheduledItems(visit: Record<string, any>) {
  const treatments: string[] = (visit.treatmentIds?.length ? visit.treatmentIds : visit.treatmentId ? [visit.treatmentId] : []).map(String);
  const services: string[] = (visit.serviceIds?.length ? visit.serviceIds : treatments.length ? [] : visit.requestedServices?.length ? visit.requestedServices.map((row:any)=>row.serviceId) : visit.serviceId ? [visit.serviceId] : []).map(String);
  return {services, treatments};
}
export function coversVisit(visit:Record<string,any>,services:string[],treatments:string[]) {
  const required=scheduledItems(visit);
  return required.services.every(id=>services.includes(id)) && required.treatments.every(id=>treatments.includes(id)) && !!(required.services.length || required.treatments.length);
}
