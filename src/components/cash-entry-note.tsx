type Entry = Record<string, any>;

export default function CashEntryNote({ entry, fallback }: { entry: Entry; fallback: string }) {
  return <div className="cell-stack">
    <span>{entry.note || fallback}</span>
    <small>#{entry._id.slice(-6)}</small>
    {entry.kind === 'REVERSAL' && entry.reversalInvoiceCode && entry.originalId && <small>Giao dịch gốc: #{entry.originalId.slice(-6)}</small>}
    {entry.kind === 'REVERSAL' && entry.reversalInvoiceCode && <small>Hóa đơn: {entry.reversalInvoiceCode}</small>}
    {entry.transferReference && <small>Ảnh nhóm: {entry.transferReference}</small>}
  </div>;
}
