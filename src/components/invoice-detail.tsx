'use client';
import {InvoiceAdjustmentRefund,InvoiceReceiptCorrectionHistory,InvoiceMistakenReceiptResolution,InvoiceReceiptReversalHistory} from './invoice-adjustment';
import {InvoiceContentComparison,InvoiceTechnicianChanges} from './invoice-content-fields';
import TreatmentEdit, { TreatmentComparison } from './treatment-edit';
import { InvoiceDocumentHistory } from './invoice-replacement';
import InvoiceHandlingMenu from './invoice-handling-menu';
import { invoiceSummary, discountLabel } from '@/lib/invoice-discount';
import {visibleInvoiceDeadline} from '@/lib/invoice-deadline';
import { invoiceCode } from '@/lib/invoice-code';
import CashCards from './cash-cards';
import { packageLabel } from '@/lib/treatment-rules';
import { formatCurrency } from '@/lib/currency';
import { useEffect, useState } from 'react';
import { SignatureImage } from './signature-pad';
import { auditActions } from '@/lib/audit-view';
import PdfExport from './pdf-export';
type Row = Record<string, any>;
const money = formatCurrency;
export default function InvoiceDetail({ replacementStaff, onTreatmentChanged, onReplacement, record, onClose, onInvoice, onPayment, onBook, onSell, onCompleteService, onRefund, onEdit, onCorrectDate, onCancel, onDelete, canManageCards }: { replacementStaff?:Row[]; onTreatmentChanged?:()=>void; onReplacement?:()=>void; canManageCards?: boolean; record: { kind: 'invoice' | 'customer'; id: string }; onClose: () => void; onInvoice: (id: string) => void; onPayment?: (invoice: Row) => void; onBook?: (id: string) => void; onSell?: (id: string) => void; onDelete?: (invoice:Row)=>void; onCorrectDate?: (invoice:Row)=>void; onCancel?: (invoice:Row)=>void; onEdit?: (invoice:Row, treatment:Row|null)=>void; onRefund?: (invoice:Row)=>void; onCompleteService?: (invoice: Row) => void }) {
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [historyKind, setHistoryKind] = useState('invoices');
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    const url = record.kind === 'invoice' ? `/api/invoices/${record.id}?signaturePage=${page}` : `/api/customers/${record.id}/history?page=${page}&kind=${historyKind === 'cards' ? 'invoices' : historyKind}`;
    fetch(url, { signal: controller.signal, cache: 'no-store' }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); return body; }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [record.id, record.kind, page, historyKind, revision]);
  const serviceLines: Row[] = data?.invoice ? [
    ...(data.invoice.serviceItems || []),
    ...(data.invoice.treatmentSessions || []).filter((session: Row) => !data.invoice.serviceItems?.some((item: Row) => item.lineId && item.lineId === session.lineId && item.total === 0 && session.total === 0)),
  ] : [];
  if (!serviceLines.length && data?.invoice?.serviceId && (!data.invoice.kind || ['SERVICE', 'SESSION'].includes(data.invoice.kind)))
    serviceLines.push({ name: data.invoice.description, total: data.invoice.total, performerName: data.invoice.performerName });
  const signedRecords: Row[] = (data?.signatures || []).filter((record: Row) => record.signature?.strokes?.some((stroke: number[][]) => stroke.length > 1));
  return <div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-label={record.kind === 'invoice' ? 'Chi tiết hóa đơn' : 'Hồ sơ khách hàng'} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
    <div className="section-head"><h2>{record.kind === 'invoice' ? 'Hóa đơn' : 'Hồ sơ khách hàng'}</h2><button autoFocus onClick={onClose}>Đóng</button></div>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Đang tải…</p> : <>
      {record.kind === 'customer' && <p><strong>{data.customer?.name}</strong> · {data.customer?.phone}</p>}
      {record.kind === 'customer' && <>
        <div className="profile-summary"><div><small>Lịch hẹn</small><strong>{data.summary.appointments}</strong></div><div><small>Gói đang dùng</small><strong>{data.summary.activePackages}</strong></div><div><small>Công nợ được xem</small><strong>{money(data.summary.debt)}</strong></div><div><small>Cọc được xem</small><strong>{data.summary.credit === null ? '—' : money(data.summary.credit)}</strong></div></div>
        {data.summary.lastVisit && <p>Lần đến gần nhất: {new Date(data.summary.lastVisit).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
        {data.customer.notes && <p>Ghi chú: {data.customer.notes}</p>}
        <div className="actions">{onBook && <button onClick={() => onBook(record.id)}>Đặt lịch cho khách</button>}{onSell && <button onClick={() => onSell(record.id)}>Mở thu ngân</button>}</div>
      </>}
      {record.kind === 'customer' && <>
        <div className="profile-tabs customer-history-tabs" role="group" aria-label="Nội dung hồ sơ khách hàng">{[['invoices', 'Hóa đơn'], ['appointments', 'Lịch hẹn'], ['treatments', 'Liệu trình'], ...(canManageCards ? [['cards', 'Thẻ tiền mặt']] : [])].map(([key, title]) => <button type="button" key={key} aria-pressed={historyKind === key} onClick={() => { setHistoryKind(key); setPage(1); }}>{title}</button>)}</div>
        <h3 className="customer-history-title">{({invoices:'Hóa đơn và chữ ký',appointments:'Lịch hẹn của khách',treatments:'Liệu trình đã mua',cards:'Thẻ tiền mặt của khách'} as Record<string,string>)[historyKind]}</h3>
      </>}
      {record.kind === 'customer' && historyKind === 'cards' && canManageCards && <CashCards customerId={record.id} onChanged={()=>setRevision(v=>v+1)} />}
      {record.kind === 'customer' ? historyKind === 'cards' ? null : <><div className="invoice-history">{data.rows.map((i: Row) => data.kind === 'invoices' ? <button key={i._id} onClick={() => onInvoice(i._id)}><strong className="invoice-code">{invoiceCode(i)}</strong><strong>{i.description}</strong><span>{new Date(i.createdAt).toLocaleString('vi-VN')} · {money(i.total)}</span></button> : <article key={i._id}><strong>{data.kind === 'treatments' ? i.name : new Date(i.startAt).toLocaleString('vi-VN')}</strong>{i.serviceName && <p>{i.serviceName}{i.staffName ? ' · ' + i.staffName : ''}</p>}<p>{({ ACTIVE: 'Đang dùng', PAUSED: 'Bảo lưu', COMPLETED: 'Hoàn thành', CONFIRMED: 'Đã đặt', POSTPONED: 'Đã hoãn', CANCELLED: 'Đã hủy' } as Record<string, string>)[i.status] || i.status}{data.kind === 'treatments' ? ` · ${packageLabel(i)}${i.giftOfInvoiceId ? ' · Quà tặng' : ''}` : i.notes ? ' · ' + i.notes : ''}</p>{data.kind === 'treatments' && <>{i.notes && <p>Ghi chú: {i.notes}</p>}{data.canEditTreatments && <TreatmentEdit key={i.updatedAt} plan={i} services={data.editableServices || []} packageTemplates={data.editablePackageTemplates || []} onChanged={() => {setRevision(v => v + 1);onTreatmentChanged?.();}} />}{i.adjustments?.map((change: Row) => <details key={change._id}><summary>Đã sửa gói · {new Date(change.createdAt).toLocaleString('vi-VN')} · {change.actorName}</summary><p>Lý do: {change.reason}</p>{change.rightsImpact?.requestedTotalSessions!==undefined && <p>Tổng yêu cầu: {change.rightsImpact.requestedTotalSessions} · Tổng hiệu lực: {change.rightsImpact.appliedTotalSessions} · Còn lại: {change.rightsImpact.remainingBefore} → {change.rightsImpact.remainingAfter} buổi. Giữ lịch sử đã làm, không thay đổi tiền.</p>}<TreatmentComparison before={change.before} after={change.after} services={data.editableServices || []} /></details>)}</>}</article>)}{!data.total && <p>{historyKind === 'appointments' ? 'Khách chưa có lịch hẹn trong phạm vi được xem.' : historyKind === 'treatments' ? 'Khách chưa có liệu trình trong phạm vi được xem.' : 'Khách chưa có hóa đơn trong phạm vi được xem.'}</p>}</div>
        {data.total > 10 && <div className="customer-picker-pages"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {data.page}/{Math.ceil(data.total / 10)}</span><button disabled={data.page * 10 >= data.total} onClick={() => setPage(p => p + 1)}>Sau</button></div>}</> : <>
        <section className="invoice-detail-summary" aria-label="Nội dung hóa đơn">
          <div className="invoice-detail-heading"><strong className="invoice-code">{invoiceCode(data.invoice)}</strong><time>{new Date(data.invoice.createdAt).toLocaleString('vi-VN')}</time></div>
          <p><strong>{data.customer?.name}</strong>{data.customer?.phone ? ` · ${data.customer.phone}` : ''}</p>
          <h3>{data.invoice.description}</h3>
          {data.invoice.discount?.programId&&<p>Chương trình giảm giá: {data.invoice.discount.programName} · {data.invoice.discount.programCode} · {data.invoice.discount.value}% · Giảm {money(data.invoice.discount.amount)}</p>}
          {visibleInvoiceDeadline(data.invoice) && <p>Hạn thanh toán: {visibleInvoiceDeadline(data.invoice)}</p>}
          {data.invoice.packageItems?.length>0 && <section className="invoice-service-lines"><h3>Gói liệu trình trong hóa đơn</h3>{data.invoice.packageItems.map((item:Row)=><p key={item.lineId || item.treatmentId}><span>{item.name}{item.promotion ? ' · '+item.promotion : ''}</span><strong>{money(item.total)}</strong></p>)}</section>}
          {serviceLines.length > 0 && <section className="invoice-service-lines"><h3>Dịch vụ trong hóa đơn</h3>{serviceLines.map((item: Row, index: number) => <p key={item.lineId || `${item.serviceId || item.treatmentUseId}:${index}`}><span className="invoice-service-info"><span>{index + 1}. {item.name}</span><small>Kỹ thuật viên: {item.performerName || 'Chưa có'}</small></span><strong>{money(item.total)}</strong></p>)}</section>}
          {data.invoice.productItems?.length>0 && <section className="invoice-service-lines"><h3>Sản phẩm mua thêm</h3>{data.invoice.productItems.map((item:Row)=><p key={item.lineId || item.productId}><span>{item.name} · {item.quantity} {item.unit} × {money(item.unitPrice)}</span><strong>{money(item.total)}</strong></p>)}</section>}
          <div className="invoice-detail-money"><span>Tạm tính<strong>{money(invoiceSummary(data.invoice).subtotal)}</strong></span><span>Giảm giá ({discountLabel(data.invoice.discount)})<strong>{money(invoiceSummary(data.invoice).discountAmount)}</strong></span>{invoiceSummary(data.invoice).adjustment!==0&&<span>Điều chỉnh sau lập<strong>{money(invoiceSummary(data.invoice).adjustment)}</strong></span>}<span>Tổng thanh toán sau giảm<strong>{money(data.invoice.total)}</strong></span><span>Đã thanh toán<strong>{money(data.invoice.paid)}</strong></span><span>Còn nợ<strong>{money(data.invoice.total - data.invoice.paid)}</strong></span></div>
        </section>
        {data.invoice.openingBalance && <p className="invoice-import-note"><span className="invoice-import-badge">Nhập ban đầu</span>{' '}Chuyển từ sổ cũ · Ngày nguồn {data.invoice.openingDate}. {data.invoice.kind==='PACKAGE'?'Đã thanh toán đủ trước chuyển đổi; chưa có giá mua gốc. Số 0 là không thu thêm, không phải gói tặng. Buổi mới được đánh số từ lúc chuyển đổi.':'Công nợ cũ; chưa ghi nhận bán hàng hoặc xuất kho mới.'}</p>}
        {!!data.invoice.cardPaid && <p>Trong số đã trả: dùng thẻ tiền {money(data.invoice.cardPaid)} (không phải khoản thu mới).</p>}
        {data.giftCards?.map((card:Row)=><p key={card._id}>Thẻ tiền tặng: {money(card.amount)} · Còn {money(card.balance)}</p>)}
        {data.invoice.status === 'CANCELLED' && <p role="status"><strong>Đã hủy · Không tính công nợ</strong> · Giá trị trước hủy: {money(data.invoice.cancelledTotal)} · Lý do: {data.invoice.cancelReason}</p>}
        {data.canAdjustInvoice&&<InvoiceMistakenReceiptResolution invoice={{...data.invoice,payments:data.payments,adjustmentContext:data.adjustmentContext,customerName:data.customer?.name}} onChanged={()=>{setRevision(v=>v+1);onReplacement?.();}}/>}

        {data.invoice.kind === 'PACKAGE' && <p>Người tư vấn bán gói: {data.invoice.saleParticipants?.length ? data.invoice.saleParticipants.map((p:Row)=>p.staffName).join(', ') : data.invoice.sellerName || 'Chưa ghi ở giao dịch cũ'}{data.invoice.saleParticipants?.length > 1 && ` · Chia đều quỹ 5% cho ${data.invoice.saleParticipants.length} người`} · Đã hoàn: {money(data.invoice.refunded || 0)}</p>}{onRefund && !data.invoice.financialRevision && data.invoice.kind === 'PACKAGE' && data.invoice.paid > (data.invoice.refunded || 0) && <button onClick={()=>onRefund(data.invoice)}>Ghi nhận hoàn tiền gói</button>}
        {data.invoice.kind === 'PRODUCT' && !data.invoice.openingBalance && <p>Sản phẩm: {data.invoice.productSku} · {data.invoice.quantity} {data.invoice.productUnit} × {money(data.invoice.unitPrice)} · Đã xuất kho</p>}
        {data.treatments?.length>1 && <section><h3>Quyền lợi từng liệu trình</h3>{data.treatments.map((plan:Row)=><p key={plan._id}>{plan.name} · {packageLabel(plan)}</p>)}</section>}
        <section className="invoice-payment-methods" aria-label="Phương thức thanh toán"><h3>Phương thức thanh toán</h3>
          {data.payments?.length ? <ul>{data.payments.map((payment: Row) => <li key={payment._id}><span>{payment.method === 'BANK_TRANSFER' ? 'Chuyển khoản' : payment.method === 'CASH' ? 'Tiền mặt' : 'Chưa có phương thức'}:</span><strong>{money(payment.amount)}</strong></li>)}</ul> : <p>Chưa có khoản thu trực tiếp được ghi nhận.</p>}
          {data.payments?.some((payment: Row) => !['CASH', 'BANK_TRANSFER'].includes(payment.method)) && <p>Thiếu phương thức trên phiếu thu liên kết; cần đối chiếu giao dịch gốc.</p>}
        </section>
        {onCompleteService && data.invoice.status !== 'CANCELLED' && data.canCompleteService && <button onClick={() => onCompleteService(data.invoice)}>Hoàn thành dịch vụ / ghi hoa hồng</button>}
        {onPayment && data.invoice.total > data.invoice.paid && <div className="actions"><button onClick={() => onPayment(data.invoice)}>Thanh toán</button></div>}
        {data.invoice.kind === 'SESSION' && <p>Buổi thuộc liệu trình: 0đ{data.invoice.total>0 ? ' · Có dịch vụ lẻ thu thêm trong hóa đơn' : ' · Không thu thêm tiền'}</p>}
        {data.invoice.kind === 'GIFT' && <p>Quà tặng 0đ · Hóa đơn mua #{data.invoice.giftOfInvoiceId?.slice(-6)}</p>}
        {data.invoice.promotion && <p>Khuyến mãi: {data.invoice.promotion}</p>}
        {data.gifts?.length > 0 && <section><h3>Quà tặng kèm</h3>{data.gifts.map((gift: Row) => <p key={gift._id}>{gift.description} · <strong>0đ</strong></p>)}</section>}
        <p>Người tạo: <strong>{data.invoice.creatorName || 'Chưa ghi nhận ở hóa đơn cũ'}</strong></p>
        <InvoiceHandlingMenu invoice={data.invoice} treatment={data.treatment} reasons={data.handling} staff={replacementStaff} onEdit={onEdit} onDate={onCorrectDate} onCancel={onCancel} onVoid={onDelete} onReplaced={()=>{setRevision(v=>v+1);onReplacement?.();}}/>
        <PdfExport key={`pdf:${record.id}`} endpoint={`/api/invoices/${record.id}/export`} />
        <InvoiceDocumentHistory invoice={data.invoice}/>
        {(!!data.invoice.financialRevision || !!data.invoice.lastAdjustmentId) && <section aria-label="Chứng từ điều chỉnh"><h3>Lịch sử điều chỉnh hóa đơn</h3>{data.adjustments?.map((a:Row)=><details key={a._id}><summary>{a.mode==='VOID'?'Vô hiệu hóa':a.mode==='REFUND'?'Hoàn tiền thực tế':'Sửa sai'} · {new Date(a.createdAt).toLocaleString('vi-VN')} · {a.actorName}</summary><p>Lý do: {a.reason} · Chứng từ điều chỉnh #{a._id}</p><p>{a.before?.description} → {a.after?.description}</p>{a.reconciliation?.content&&<InvoiceContentComparison before={a.reconciliation.content.displayBefore||a.before} after={a.reconciliation.content.displayAfter||a.after}/>}{a.reconciliation?.content?.serviceCorrections&&<InvoiceTechnicianChanges corrections={a.reconciliation.content.serviceCorrections}/>}{a.before?.createdAt&&a.after?.createdAt&&new Date(a.before.createdAt).getTime()!==new Date(a.after.createdAt).getTime()&&<p>Ngày hóa đơn: {new Date(a.before.createdAt).toLocaleDateString('vi-VN')} → {new Date(a.after.createdAt).toLocaleDateString('vi-VN')}</p>}<p>Tổng: {money(a.before?.total||0)} → {money(a.after?.total||0)} · Chênh lệch chứng từ: {money(a.delta||0)}</p><p>Tiền áp dụng vào hóa đơn: {money(a.before?.paid||0)} → {money(a.after?.paid||0)} · Tiền chờ xử lý: {money(a.after?.adjustmentCredit||0)}</p>{a.reconciliation?.receiptChanges?.length>0&&<InvoiceReceiptCorrectionHistory changes={a.reconciliation.receiptChanges} />}{a.reconciliation?.createdReceiptReversals?.length>0&&<InvoiceReceiptReversalHistory rows={a.reconciliation.createdReceiptReversals}/>}{a.receiptId&&<p>Phiếu chi hoàn thực tế #{a.receiptId}</p>}</details>)}{!!data.invoice.adjustmentCredit&&<p>Tiền trực tiếp giữ chờ xử lý: {money(data.invoice.adjustmentCredit)}. Chưa hoàn tiền.</p>}{data.canAdjustInvoice&&<InvoiceAdjustmentRefund invoice={data.invoice} onChanged={()=>{setRevision(v=>v+1);onReplacement?.();}} />}</section>}
        <h3>Lịch sử hóa đơn</h3>{data.events.map((event: Row) => <p key={event._id}>{new Date(event.createdAt).toLocaleString('vi-VN')} · {auditActions[event.action] || event.action}{event.details?.amount ? ' · ' + money(event.details.amount) : ''}{event.details?.reason ? ' · ' + event.details.reason : ''}</p>)}
        <section className="invoice-detail-signatures" aria-label="Chữ ký hóa đơn"><h3>Chữ ký hóa đơn</h3>
          {signedRecords.length ? signedRecords.map((record: Row) => <article key={record.id} className="invoice-signature"><SignatureImage signature={record.signature} /></article>) : <p>Không có chữ ký khách hàng.</p>}
          {data.signatureTotal > 5 && <div className="customer-picker-pages"><button disabled={data.signaturePage <= 1} onClick={() => setPage(data.signaturePage - 1)}>Trước</button><span>Trang {data.signaturePage}/{Math.ceil(data.signatureTotal / 5)}</span><button disabled={data.signaturePage * 5 >= data.signatureTotal} onClick={() => setPage(data.signaturePage + 1)}>Sau</button></div>}
        </section>
      </>}
    </>}
  </section></div>;
}
