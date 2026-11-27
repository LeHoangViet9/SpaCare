type Entry = Record<string, any>;

// Presentation only: retain the original note and identifiers in ledger data.
function displayText(value: string) {
  return value.replace(/#?\b(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{24})\b/gi, '').trim();
}

export default function CashEntryNote({ entry, fallback }: { entry: Entry; fallback: string }) {
  const code = entry.kind === 'PAYMENT' ? entry.paymentInvoiceCode : entry.kind === 'REVERSAL' ? entry.reversalInvoiceCode : undefined;
  const adjustment = entry.kind === 'REVERSAL' && entry.note?.match(/^Hủy\/đối soát hóa đơn\s*[·-]\s*Điều chỉnh\s*#[^:]+:\s*([\s\S]*)$/);
  const title = adjustment ? 'Hủy/đối soát hóa đơn' : fallback;
  const note = displayText(adjustment ? adjustment[1] : entry.note || '');
  const reference = displayText(entry.transferReference || '');
  return <div className="cell-stack cash-entry-note">
    <strong>{title}</strong>
    {note && note !== title && <span className="cash-entry-description">{adjustment || entry.kind === 'REVERSAL' || entry.kind === 'REFUND' ? 'Lý do: ' : ''}{note}</span>}
    {code && <small>Hóa đơn: {code}</small>}
    {reference && <small>Ảnh nhóm: {reference}</small>}
  </div>;
}
