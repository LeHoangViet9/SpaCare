import { Treatment, TreatmentUse } from './models';

export type InvoicePackageProgress = {
  treatmentId: string;
  totalSessions: number;
  sessionNumber?: number;
  remaining: number;
};

// Read-only print projection. Session invoices retain their own recorded use.
export async function readInvoicePackageProgress(spaId: string, invoice: Record<string, any>): Promise<InvoicePackageProgress[]> {
  const references = [invoice.treatmentId, ...(invoice.packageItems || []).map((item: any) => item.treatmentId),
    ...(invoice.treatmentSessions || []).map((item: any) => item.treatmentId)].filter(Boolean);
  const treatments = await Treatment.find({ spaId, customerId: invoice.customerId,
    $or: [{ invoiceId: invoice._id }, { _id: { $in: references } }],
  }).select('invoiceId packageType totalSessions remaining openingBalance').lean();
  const finite = treatments.filter(plan => plan.packageType !== 'TIME' && !plan.openingBalance
    && Number.isSafeInteger(plan.totalSessions) && plan.totalSessions! > 0);
  if (!finite.length) return [];
  const uses = await TreatmentUse.find({ spaId, treatmentId: { $in: finite.map(plan => plan._id) } })
    .select('treatmentId checkoutInvoiceId sessionNumber snapshot').lean();
  return finite.flatMap(plan => {
    const soldHere = String(plan.invoiceId) === String(invoice._id);
    const useIds = [invoice.treatmentUseId, ...(invoice.treatmentSessions || [])
      .filter((item: any) => String(item.treatmentId) === String(plan._id)).map((item: any) => item.treatmentUseId)]
      .filter(Boolean).map(String);
    const recorded = uses.filter(use => String(use.treatmentId) === String(plan._id));
    const relevant = recorded.filter(use => soldHere || useIds.includes(String(use._id))
      || String(use.checkoutInvoiceId) === String(invoice._id));
    const latest = relevant.filter(use => Number.isSafeInteger(use.sessionNumber) && use.sessionNumber! > 0)
      .sort((a, b) => b.sessionNumber! - a.sessionNumber!)[0];
    if (!soldHere && !latest) return [];
    const totalSessions = plan.totalSessions!;
    const progress: InvoicePackageProgress = { treatmentId: String(plan._id), totalSessions,
      remaining: recorded.length ? Math.max(0, plan.remaining ?? totalSessions) : totalSessions };
    if (latest) {
      progress.sessionNumber = latest.sessionNumber!;
      progress.remaining = Math.max(0, totalSessions - latest.sessionNumber!);
      // Stored rights before this use also handle quota corrections between visits.
      try {
        const snapshot = JSON.parse(latest.snapshot || '{}');
        if (Number.isSafeInteger(snapshot.remainingBefore) && snapshot.remainingBefore > 0)
          progress.remaining = snapshot.remainingBefore - 1;
      } catch { /* Legacy uses can lack a JSON snapshot; keep the saved session number. */ }
    }
    return [progress];
  });
}

export function packageProgressText(progress?: InvoicePackageProgress) {
  if (!progress) return '';
  return (progress.sessionNumber ? `\nBuổi đang thực hiện: ${progress.sessionNumber}/${progress.totalSessions}` : '')
    + `\nCòn lại: ${progress.remaining} buổi`;
}
