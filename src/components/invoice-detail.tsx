'use client';
import CashCards from './cash-cards';
import { packageLabel } from '@/lib/treatment-rules';
import { formatCurrency } from '@/lib/currency';
import { useEffect, useState } from 'react';
import { SignatureImage } from './signature-pad';
import { auditActions } from '@/lib/audit-view';
import PdfExport from './pdf-export';
type Row = Record<string, any>;
const money = formatCurrency;
export default function InvoiceDetail({ record, onClose, onInvoice, onPayment, onBook, onSell, onCompleteService, onRefund, onEdit, canManageCards }: { canManageCards?: boolean; record: { kind: 'invoice' | 'customer'; id: string }; onClose: () => void; onInvoice: (id: string) => void; onPayment?: (invoice: Row, method: string) => void; onBook?: (id: string) => void; onSell?: (id: string) => void; onEdit?: (invoice:Row, treatment:Row|null)=>void; onRefund?: (invoice:Row)=>void; onCompleteService?: (invoice: Row) => void }) {
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [historyKind, setHistoryKind] = useState('invoices');
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    const url = record.kind === 'invoice' ? `/api/invoices/${record.id}?signaturePage=${page}` : `/api/customers/${record.id}/history?page=${page}&kind=${historyKind}`;
    fetch(url, { signal: controller.signal, cache: 'no-store' }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); return body; }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [record.id, record.kind, page, historyKind, revision]);
  return <div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-label={record.kind === 'invoice' ? 'Chi tiết hóa đơn' : 'Hồ sơ khách hàng'} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
    <div className="section-head"><h2>{record.kind === 'invoice' ? 'Hóa đơn' : 'Hồ sơ khách hàng'}</h2><button autoFocus onClick={onClose}>Đóng</button></div>
    {record.kind === 'invoice' && data && !error && <PdfExport key={record.id} endpoint={`/api/invoices/${record.id}/export`} />}
    {record.kind === 'customer' && <div className="profile-tabs" role="group" aria-label="Lịch sử khách hàng">{[['invoices', 'Hóa đơn / chữ ký'], ['appointments', 'Lịch hẹn'], ['treatments', 'Liệu trình']].map(([key, title]) => <button key={key} aria-pressed={historyKind === key} onClick={() => { setHistoryKind(key); setPage(1); }}>{title}</button>)}</div>}
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Đang tải…</p> : <>
      <p><strong>{data.customer?.name}</strong> · {data.customer?.phone}</p>
      {record.kind === 'customer' && <>
        <div className="profile-summary"><div><small>Lịch hẹn</small><strong>{data.summary.appointments}</strong></div><div><small>Gói đang dùng</small><strong>{data.summary.activePackages}</strong></div><div><small>Công nợ được xem</small><strong>{money(data.summary.debt)}</strong></div><div><small>Cọc được xem</small><strong>{data.summary.credit === null ? '—' : money(data.summary.credit)}</strong></div></div>
        {data.summary.lastVisit && <p>Lần đến gần nhất: {new Date(data.summary.lastVisit).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
        {data.customer.notes && <p>Ghi chú: {data.customer.notes}</p>}
        <div className="actions">{onBook && <button onClick={() => onBook(record.id)}>Đặt lịch cho khách</button>}{onSell && <button onClick={() => onSell(record.id)}>Mở thu ngân</button>}</div>
      </>}
      {record.kind === 'customer' && canManageCards && <CashCards customerId={record.id} onChanged={()=>setRevision(v=>v+1)} />}
      {record.kind === 'invoice' && (!data.invoice.kind || data.invoice.kind === 'SERVICE') && data.invoice.serviceId && !data.invoice.treatmentId && !data.invoice.treatmentUseId && <CashCards customerId={String(data.invoice.customerId)} invoice={data.invoice} onChanged={()=>setRevision(v=>v+1)} />}
      {record.kind === 'customer' ? <><div className="invoice-history">{data.rows.map((i: Row) => data.kind === 'invoices' ? <button key={i._id} onClick={() => onInvoice(i._id)}><strong>{i.description}</strong><span>{new Date(i.createdAt).toLocaleString('vi-VN')} · {money(i.total)}</span></button> : <article key={i._id}><strong>{data.kind === 'treatments' ? i.name : new Date(i.startAt).toLocaleString('vi-VN')}</strong>{i.serviceName && <p>{i.serviceName}{i.staffName ? ' · ' + i.staffName : ''}</p>}<p>{({ ACTIVE: 'Đang dùng', PAUSED: 'Bảo lưu', COMPLETED: 'Hoàn thành', CONFIRMED: 'Đã đặt', POSTPONED: 'Đã hoãn', CANCELLED: 'Đã hủy' } as Record<string, string>)[i.status] || i.status}{data.kind === 'treatments' ? ` · ${packageLabel(i)}${i.giftOfInvoiceId ? ' · Quà tặng' : ''}` : i.notes ? ' · ' + i.notes : ''}</p></article>)}{!data.total && <p>Chưa có bản ghi trong phạm vi được phép xem.</p>}</div>
        {data.total > 10 && <div className="customer-picker-pages"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {data.page}/{Math.ceil(data.total / 10)}</span><button disabled={data.page * 10 >= data.total} onClick={() => setPage(p => p + 1)}>Sau</button></div>}</> : <>
        <p>#{data.invoice._id.slice(-6)} · {new Date(data.invoice.createdAt).toLocaleString('vi-VN')}</p>
        <h3>{data.invoice.description}</h3><p>Tổng: <strong>{money(data.invoice.total)}</strong> · Đã trả: {money(data.invoice.paid)} · Còn nợ: {money(data.invoice.total - data.invoice.paid)}</p>
        {data.invoice.openingBalance && <p>Chuyển từ sổ cũ · Ngày nguồn {data.invoice.openingDate}. {data.invoice.kind==='PACKAGE'?'Đã thanh toán đủ trước chuyển đổi; chưa có giá mua gốc. Số 0 là không thu thêm, không phải gói tặng. Buổi mới được đánh số từ lúc chuyển đổi.':'Công nợ cũ; chưa ghi nhận bán hàng hoặc xuất kho mới.'}</p>}
        {!!data.invoice.cardPaid && <p>Trong số đã trả: dùng thẻ tiền {money(data.invoice.cardPaid)} (không phải khoản thu mới).</p>}
        {data.giftCards?.map((card:Row)=><p key={card._id}>Thẻ tiền tặng: {money(card.amount)} · Còn {money(card.balance)}</p>)}
        {onEdit && !data.invoice.openingBalance && (!data.invoice.kind || ['SERVICE','PACKAGE'].includes(data.invoice.kind)) && !data.invoice.paid && !data.invoice.performedAt && !data.invoice.appointmentId && <button onClick={()=>onEdit(data.invoice,data.treatment)}>Sửa hóa đơn</button>}
        {data.invoice.kind === 'PACKAGE' && <p>Người tư vấn bán gói: {data.invoice.saleParticipants?.length ? data.invoice.saleParticipants.map((p:Row)=>p.staffName).join(', ') : data.invoice.sellerName || 'Chưa ghi ở giao dịch cũ'}{data.invoice.saleParticipants?.length > 1 && ` · Chia đều quỹ 5% cho ${data.invoice.saleParticipants.length} người`} · Đã hoàn: {money(data.invoice.refunded || 0)}</p>}{onRefund && data.invoice.kind === 'PACKAGE' && data.invoice.paid > (data.invoice.refunded || 0) && <button onClick={()=>onRefund(data.invoice)}>Ghi nhận hoàn tiền gói</button>}
        {data.invoice.kind === 'PRODUCT' && !data.invoice.openingBalance && <p>Sản phẩm: {data.invoice.productSku} · {data.invoice.quantity} {data.invoice.productUnit} × {money(data.invoice.unitPrice)} · Đã xuất kho</p>}
        {data.invoice.performedAt && <p>Đã thực hiện: <strong>{data.invoice.performerName || 'Nhân viên đã ghi nhận'}</strong> · {new Date(data.invoice.performedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
        {onCompleteService && data.canCompleteService && <button onClick={() => onCompleteService(data.invoice)}>Hoàn thành dịch vụ / ghi hoa hồng</button>}
        {onPayment && data.invoice.total > data.invoice.paid && <div className="actions"><button onClick={() => onPayment(data.invoice, 'CASH')}>Thu tiền mặt</button><button onClick={() => onPayment(data.invoice, 'BANK_TRANSFER')}>Chuyển khoản / QR</button></div>}
        {data.invoice.kind === 'SESSION' && <p>Buổi thuộc liệu trình · Không thu thêm tiền</p>}
        {data.invoice.kind === 'GIFT' && <p>Quà tặng 0đ · Hóa đơn mua #{data.invoice.giftOfInvoiceId?.slice(-6)}</p>}
        {data.invoice.promotion && <p>Khuyến mãi: {data.invoice.promotion}</p>}
        {data.gifts?.length > 0 && <section><h3>Quà tặng kèm</h3>{data.gifts.map((gift: Row) => <p key={gift._id}>{gift.description} · <strong>0đ</strong></p>)}</section>}
        <p>Người tạo: <strong>{data.invoice.creatorName || 'Chưa ghi nhận ở hóa đơn cũ'}</strong><br />Tư vấn: {data.invoice.consultantName || 'Chưa gán'}</p>
        <section><h3>Chữ ký khách hàng</h3>
          {data.signatures?.length ? data.signatures.map((s: Row) => <article key={s.id} className="invoice-signature"><p><strong>{s.packageName || data.invoice.description}{s.sessionNumber ? ` · Buổi ${s.sessionNumber}` : ''}</strong><br />{new Date(s.performedAt).toLocaleString('vi-VN')}</p>{s.signature ? <SignatureImage signature={s.signature} /> : <p>Buổi cũ chưa có chữ ký trên màn hình.</p>}</article>) : <p>Chưa có chữ ký đã lưu trong phạm vi bạn được phép xem.</p>}
          {data.signatureTotal > 5 && <div className="customer-picker-pages"><button disabled={data.signaturePage <= 1} onClick={() => setPage(data.signaturePage - 1)}>Trước</button><span>Trang {data.signaturePage}/{Math.ceil(data.signatureTotal / 5)}</span><button disabled={data.signaturePage * 5 >= data.signatureTotal} onClick={() => setPage(data.signaturePage + 1)}>Sau</button></div>}
        </section>
        <h3>Lịch sử hóa đơn</h3>{data.events.map((event: Row) => <p key={event._id}>{new Date(event.createdAt).toLocaleString('vi-VN')} · {auditActions[event.action] || event.action}{event.details?.amount ? ' · ' + money(event.details.amount) : ''}{event.details?.reason ? ' · ' + event.details.reason : ''}</p>)}
      </>}
    </>}
  </section></div>;
}
