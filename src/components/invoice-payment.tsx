'use client';
import { useRef, useState } from 'react';
import MoneyInput from './money-input';
import ValidatedForm from './validated-form';
import InvoiceLineAllocationFields, { readLineAllocationFields } from './invoice-line-allocation-fields';
import { formatCurrency as money, parseMoney } from '@/lib/currency';
import { invoiceCode } from '@/lib/invoice-code';
import { allocateInvoicePayments, invoicePaymentAllocation } from '@/lib/invoice-payment-allocation';

type Row = Record<string, any>;
const methods = [['CASH', 'Tiền mặt'], ['BANK_TRANSFER', 'Chuyển khoản / QR']] as const;
export default function InvoicePayment({ invoice, paymentInfo = {}, busy, error, onClose, onSubmit }: {
  invoice: Row; paymentInfo?: Row; busy: boolean; error: string; onClose: () => void; onSubmit: (values: Row) => void;
}) {
  const [amounts, setAmounts] = useState({ CASH: '0', BANK_TRANSFER: '0' });
  const [confirmed, setConfirmed] = useState({ CASH: false, BANK_TRANSFER: false });
  const [localError, setLocalError] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAllocations, setShowAllocations] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const due = invoice.total - invoice.paid;
  let total = 0, valid = true;
  try { total = parseMoney(amounts.CASH || '0') + parseMoney(amounts.BANK_TRANSFER || '0'); } catch { valid = false; }
  const positive = methods.filter(([method]) => { try { return parseMoney(amounts[method] || '0') > 0; } catch { return false; } });
  const allocation = invoicePaymentAllocation(invoice, total);
  const needsAllocation = valid && total > 0 && total < due && allocation.mode === 'manual';
  const canSubmit = valid && total > 0 && total <= due && allocation.mode !== 'reconcile' && positive.every(([method]) => confirmed[method]);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLocalError('');
    if (!canSubmit || busy) return;
    try {
      const data = new FormData(event.currentTarget);
      const payments = positive.map(([method]) => ({ method, amount: parseMoney(amounts[method]), receivedConfirmation: confirmed[method],
        note: String(data.get('note') || ''), lineAllocations: needsAllocation ? readLineAllocationFields(data, method + 'Allocations') : undefined }));
      for (const payment of payments) if (payment.lineAllocations && payment.lineAllocations.reduce((sum, line) => sum + line.amount, 0) !== payment.amount)
        throw new Error('Tổng phân bổ phải khớp số tiền của từng phương thức.');
      onSubmit({ invoiceId: invoice._id, payments: allocateInvoicePayments(invoice, payments) });
    } catch (error) {
      if (needsAllocation) { setShowAllocations(true); setLocalError('Kiểm tra phân bổ: mỗi phương thức phải đủ số tiền và không vượt nợ từng dịch vụ.'); }
      else setLocalError((error as Error).message);
    }
  }
  return <div className="modal-backdrop"><section ref={dialog} className="modal invoice-payment-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-payment-title" onKeyDown={event => {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key === 'Tab') {
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <div className="section-head"><h2 id="invoice-payment-title">Thanh toán · {invoiceCode(invoice)}</h2><button type="button" autoFocus disabled={busy} onClick={onClose}>Đóng</button></div>
    <ValidatedForm onSubmit={submit}>
      <dl className="payment-summary"><div><dt>Tổng hóa đơn</dt><dd>{money(invoice.total)}</dd></div><div><dt>Đã thanh toán</dt><dd>{money(invoice.paid)}</dd></div><div><dt>Còn phải thanh toán</dt><dd>{money(due)}</dd></div></dl>
      <p>Chỉ xác nhận sau khi đã thực nhận tiền. Phương thức không dùng có thể để 0.</p>
      <fieldset disabled={busy} className="payment-method-fields"><legend>Số tiền thực nhận</legend>
        {methods.map(([method, title]) => <section key={method} className="payment-method-entry">
          <label>{title}<MoneyInput name={method} value={amounts[method]} min={0} max={due} onValueChange={value => { setAmounts(previous => ({ ...previous, [method]: value })); setConfirmed(previous => ({ ...previous, [method]: false })); setShowAllocations(false); setLocalError(''); }}/></label>
          {positive.some(([key]) => key === method) && <>
            <label><input type="checkbox" checked={confirmed[method]} onChange={event => setConfirmed(previous => ({ ...previous, [method]: event.target.checked }))}/>{method === 'CASH' ? 'Đã đếm và thực nhận tiền mặt' : 'Đã kiểm tra tài khoản và thực nhận chuyển khoản'}</label>
          </>}
        </section>)}
      </fieldset>
      {allocation.mode === 'reconcile' && <p role="alert">Số tiền theo dòng cần được đối soát trước khi thu thêm. Liên hệ chủ spa.</p>}
      {needsAllocation && <details className="payment-service-allocation" open={showAllocations} onToggle={event => setShowAllocations(event.currentTarget.open)} onInvalidCapture={() => setShowAllocations(true)}>
        <summary>Phân bổ theo dịch vụ</summary>
        <p>Chọn dịch vụ được trả. Tổng mỗi phương thức phải khớp số tiền thu.</p>
        <fieldset disabled={busy}>{positive.map(([method, title]) => <InvoiceLineAllocationFields key={method} compact invoice={invoice} name={method + 'Allocations'} title={'Phân bổ ' + title.toLowerCase()}/>)}</fieldset>
      </details>}
      <p className="payment-collection-total" aria-live="polite">Tổng thu lần này: <strong>{valid ? money(total) : 'Số tiền chưa hợp lệ'}</strong></p>
      {valid && total > due && <p role="alert">Tổng thu vượt số còn phải thanh toán.</p>}
      <details open={showTransfer} onToggle={event => setShowTransfer(event.currentTarget.open)} className="payment-instructions"><summary>Thông tin chuyển khoản / QR</summary>
        {paymentInfo.bankName && paymentInfo.accountNumber && paymentInfo.accountName ? <><p>{paymentInfo.bankName}<br/>Số tài khoản: {paymentInfo.accountNumber}<br/>Chủ tài khoản: {paymentInfo.accountName}</p>{paymentInfo.qrImagePath && <img src={paymentInfo.qrImagePath} alt="Mã QR tài khoản nhận tiền của spa" width={240} height={240}/>}</> : <p>Chưa cấu hình tài khoản nhận tiền/QR. Liên hệ chủ spa để lấy thông tin chính xác.</p>}
        <p>Nội dung: <strong>SPACARE {invoiceCode(invoice)}</strong></p><small>QR tài khoản không tự điền số tiền. Quét mã chưa có nghĩa là đã thanh toán.</small>
      </details>
      <label>Nội dung / ghi chú<input name="note" maxLength={2000} defaultValue={'SPACARE ' + invoiceCode(invoice)} disabled={busy}/></label>
      {(error || localError) && <p className="alert error" role="alert">{error || localError}</p>}
      <div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="primary" disabled={busy || !canSubmit}>{busy ? 'Đang lưu…' : 'Xác nhận đã nhận tiền'}</button></div>
    </ValidatedForm>
  </section></div>;
}
