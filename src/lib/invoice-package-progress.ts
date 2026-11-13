import { Treatment, TreatmentUse } from './models';

export type InvoicePackageProgress = {
  treatmentId: string;
  treatmentUseId?: string;
  packageName?: string;
  recipientName?: string;
  totalSessions?: number;
  sessionNumber?: number;
  remaining?: number;
};

// Read-only print projection. Session invoices retain their own recorded use.
export async function readInvoicePackageProgress(spaId: string, invoice: Record<string, any>): Promise<InvoicePackageProgress[]> {
  const references = [invoice.treatmentId, ...(invoice.packageItems || []).map((item: any) => item.treatmentId),
    ...(invoice.treatmentSessions || []).map((item: any) => item.treatmentId)].filter(Boolean);
  const treatments = await Treatment.find({ spaId, customerId: invoice.customerId,
    $or: [{ invoiceId: invoice._id }, { _id: { $in: references } }],
  }).select('name invoiceId packageType totalSessions remaining openingBalance').lean();
  const printable = treatments.filter(plan => plan.packageType === 'TIME' || (!plan.openingBalance
    && Number.isSafeInteger(plan.totalSessions) && plan.totalSessions! > 0));
  if (!printable.length) return [];
  const uses = await TreatmentUse.find({ spaId, treatmentId: { $in: printable.map(plan => plan._id) } })
    .select('treatmentId checkoutInvoiceId sessionNumber snapshot').lean();
  return printable.flatMap(plan => {
    const soldHere = String(plan.invoiceId) === String(invoice._id);
    const useIds = [invoice.treatmentUseId, ...(invoice.treatmentSessions || [])
      .filter((item: any) => String(item.treatmentId) === String(plan._id)).map((item: any) => item.treatmentUseId)]
      .filter(Boolean).map(String);
    const recorded = uses.filter(use => String(use.treatmentId) === String(plan._id));
    const relevant = recorded.filter(use => soldHere || useIds.includes(String(use._id))
      || String(use.checkoutInvoiceId) === String(invoice._id));
    const validUses = relevant.filter(use => Number.isSafeInteger(use.sessionNumber) && use.sessionNumber! > 0)
      .sort((a, b) => b.sessionNumber! - a.sessionNumber!);
    if (!soldHere && !validUses.length) return [];
    // Session rows can reference separate visits of the same package.
    const selectedUses = !soldHere ? validUses : [validUses[0]];
    return selectedUses.map(latest => {
      const progress: InvoicePackageProgress = { treatmentId: String(plan._id) };
      let snapshot: Record<string, unknown> = {};
      if (latest) {
        progress.sessionNumber = latest.sessionNumber!;
        if (!soldHere) progress.treatmentUseId = String(latest._id);
        try {
          const parsed = JSON.parse(latest.snapshot || '{}');
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) snapshot = parsed;
        } catch { /* Legacy snapshots can be absent or non-JSON. */ }
        // Use the separate stored name, never strip session-like words from invoice text.
        const name = typeof snapshot.name === 'string' && snapshot.name.trim() ? snapshot.name : plan.name;
        if (typeof name === 'string' && name.trim()) progress.packageName = name;
        if (snapshot.isShared === true && typeof snapshot.recipientName === 'string' && snapshot.recipientName.trim())
          progress.recipientName = snapshot.recipientName;
      }
      if (Number.isSafeInteger(plan.totalSessions) && plan.totalSessions! > 0) {
        progress.totalSessions = plan.totalSessions!;
        progress.remaining = latest ? Math.max(0, plan.totalSessions! - latest.sessionNumber!)
          : recorded.length ? Math.max(0, plan.remaining ?? plan.totalSessions!) : plan.totalSessions!;
        // TIME remainingBefore is a usage counter, not a remaining entitlement.
        if (latest && plan.packageType !== 'TIME') {
          if (typeof snapshot.remainingBefore === 'number' && Number.isSafeInteger(snapshot.remainingBefore) && snapshot.remainingBefore > 0)
            progress.remaining = snapshot.remainingBefore - 1;
        }
      }
      return progress;
    });
  });
}

export function packageProgressText(progress?: InvoicePackageProgress) {
  if (!progress) return '';
  if (progress.totalSessions === undefined) return progress.sessionNumber ? `\nBuổi ${progress.sessionNumber}` : '';
  return progress.sessionNumber
    ? `\nBuổi ${progress.sessionNumber}/${progress.totalSessions} · Còn lại: ${progress.remaining} buổi`
    : `\nCòn lại: ${progress.remaining} buổi`;
}
