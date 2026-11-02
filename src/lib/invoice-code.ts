export function sequenceInvoiceCode(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Invalid invoice sequence');
  return 'HD' + String(sequence).padStart(6, '0');
}
export function invoiceCode(invoice: { code?: string; effectiveCode?: string; _id?: unknown }): string {
  if (invoice.effectiveCode && /^HD[0-9]+$/.test(invoice.effectiveCode)) return invoice.effectiveCode;
  if (invoice.code && /^HD[0-9]+$/.test(invoice.code)) return invoice.code;
  const id = String(invoice._id || '');
  // Stable numeric fallback until legacy invoices have been backfilled; never truncate IDs.
  return /^[a-f0-9]{24}$/i.test(id) ? 'HD' + BigInt('0x' + id).toString() : 'HD';
}

// A legacy identity is displayed, never promoted to an issued sequence number.
export function historicalInvoiceCode(document: {code?:string;legacyInvoiceId?:unknown;documentId?:unknown}): string {
  return invoiceCode({code:document.code,_id:document.legacyInvoiceId || document.documentId});
}
