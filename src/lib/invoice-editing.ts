type InvoiceEditView = {
  packageItems?: unknown[];
  kind?: string;
  treatmentUseId?: unknown;
  treatmentId?: unknown;
  paid?: number;
  productItems?: unknown[];
};

export function invoiceEditorAction(invoice: InvoiceEditView): 'correctInvoiceDate' | 'updateInvoice' {
  return invoice.packageItems?.length || invoice.kind === 'SESSION' || invoice.treatmentUseId ||
    invoice.treatmentId || (invoice.paid || 0) > 0 || invoice.productItems?.length
    ? 'correctInvoiceDate'
    : 'updateInvoice';
}

export function invoiceDueDateVisible(total: number, paid: number): boolean {
  return total - paid > 0;
}
