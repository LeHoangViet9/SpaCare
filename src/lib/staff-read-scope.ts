import { Appointment, TreatmentUse } from './models';
import type { Actor } from './auth';

// Ordinary STAFF derive access from existing appointment/use assignments, never client filters.
export async function staffReadScope(user: Actor) {
  const scope = { spaId: user.spaId };
  if (user.role === 'OWNER' || user.cashier) return { customers: scope, treatments: scope, uses: scope };
  const visits = await Appointment.find({ ...scope, staffId: user.id }).select('customerId treatmentId treatmentIds').lean();
  const uses = { ...scope, $or: [{ actorId: user.id }, { staffId: user.id }] };
  const performed = await TreatmentUse.find(uses).select('customerId treatmentId').lean();
  return {
    customers: { ...scope, _id: { $in: [...visits, ...performed].map(r => r.customerId).filter(Boolean) } },
    treatments: { ...scope, _id: { $in: [...visits.flatMap(v => v.treatmentIds?.length ? v.treatmentIds : [v.treatmentId]), ...performed.map(u => u.treatmentId)].filter(Boolean) } },
    uses,
  };
}
