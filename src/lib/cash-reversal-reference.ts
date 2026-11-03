import { CashEntry, Payment, Invoice } from './models';
import { invoiceCode } from './invoice-code';

type Row = Record<string, any>;

// Enrich only the visible ledger page. Reversed payments and cancelled invoices
// remain valid historical references; this lookup never changes ledger totals.
export async function cashReversalReferences(spaId: string, rows: Row[]): Promise<Row[]> {
  const receiptIds = rows.flatMap(row => row.kind === 'PAYMENT' ? [row._id] : row.kind === 'REVERSAL' && row.originalId ? [row.originalId] : []);
  if (!receiptIds.length) return rows;
  const originals = await CashEntry.find({ spaId, _id: { $in: receiptIds }, kind: 'PAYMENT' }).select('_id').lean();
  if (!originals.length) return rows;
  const payments = await Payment.find({ spaId, receiptId: { $in: originals.map(row => row._id) } }).select('receiptId invoiceId').lean();
  if (!payments.length) return rows;
  const invoices = await Invoice.find({ spaId, _id: { $in: payments.map(row => row.invoiceId) } }).select('_id code').lean();
  // Pass only the issued code to the helper: legacy ObjectId fallback is not an
  // invoice number for this reference, and effectiveCode could identify a replacement.
  const codes = new Map(invoices.map(row => [String(row._id), invoiceCode({ code: row.code })]));
  const receiptCodes = new Map(payments.map(row => [String(row.receiptId), codes.get(String(row.invoiceId))]));
  return rows.map(row => {
    const receiptId = row.kind === 'PAYMENT' ? row._id : row.kind === 'REVERSAL' ? row.originalId : undefined;
    const code = receiptId ? receiptCodes.get(String(receiptId)) : undefined;
    if (!code || code === 'HD') return row;
    return row.kind === 'PAYMENT' ? { ...row, paymentInvoiceCode: code } : { ...row, reversalInvoiceCode: code };
  });
}
