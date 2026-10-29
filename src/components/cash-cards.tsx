'use client';
import { useEffect, useRef, useState } from 'react';
import MoneyInput from './money-input';
import InvoiceLineAllocationFields, { readLineAllocationFields } from './invoice-line-allocation-fields';
import ValidatedForm from './validated-form';
import { formatCurrency as money, parseMoney } from '@/lib/currency';
type Row = Record<string, any>;
export default function CashCards({ customerId, invoice, onChanged, cardId, hideSell }: { cardId?: string; hideSell?: boolean; customerId: string; invoice?: Row; onChanged: () => void }) {
  const [data, setData] = useState<Row | null>(null);
  const [page, setPage] = useState(1), [usePage, setUsePage] = useState(1), [revision, setRevision] = useState(0);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [selling, setSelling] = useState(false);
  const [amount, setAmount] = useState('800000'), [selected, setSelected] = useState<Row | null>(null), [used, setUsed] = useState(''), [additional, setAdditional] = useState('0');
  const [method, setMethod] = useState('CASH'), [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false), keys = useRef(new Map<string,string>());
  const additionalValue = (()=>{try{return parseMoney(additional);}catch{return 0;}})();
  const due = invoice ? Math.max(0, invoice.total - invoice.paid) : 0;
  useEffect(() => {
    const controller = new AbortController(); setError(''); setData(null);
    const query = new URLSearchParams({ customerId, ...(cardId ? {cardId}:{}), page: String(page), usePage: String(usePage), ...(invoice ? { invoiceId: invoice._id } : {}) });
    fetch('/api/cash-cards?' + query, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error); return body;
    }).then(body => { if (!controller.signal.aborted) setData(body); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [customerId, cardId, invoice?._id, page, usePage, revision]);
  async function run(action: string, values: Row) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const body = JSON.stringify({action,data:values});
    let key = keys.current.get(body); if (!key) { key = crypto.randomUUID(); keys.current.set(body,key); }
    try {
      const response = await fetch('/api/operations', {method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Chưa lưu được giao dịch thẻ.');
      keys.current.delete(body); setSelected(null); setSelling(false); setConfirmed(false); setNotice('Đã lưu giao dịch thẻ.'); setRevision(v=>v+1); onChanged();
    } catch (e) { setError((e as Error).message); } finally { lock.current=false;setBusy(false); }
  }
  function sell(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); try { const value=parseMoney(amount); if(value<=0) throw new Error('Mệnh giá phải lớn hơn 0.'); void run('sellCashCard',{customerId,amount:value,method,receivedConfirmation:confirmed}); } catch(e) {setError((e as Error).message);}
  }
  function redeem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!selected || !invoice)return;
    try { const fields=new FormData(e.currentTarget); void run('redeemCashCard',{cardId:selected._id,invoiceId:invoice._id,amount:parseMoney(used),additionalAmount:parseMoney(additional),method,receivedConfirmation:confirmed,lineAllocations:readLineAllocationFields(fields),additionalLineAllocations:readLineAllocationFields(fields,'additionalLineAllocations')}); }catch(e){setError((e as Error).message);}
  }
  return <section className="cash-card-panel">
    <h3>Thẻ tiền mặt</h3><p>Chỉ dùng cho dịch vụ lẻ · Không hết hạn · Không hoàn hoặc đổi tiền mặt.</p>
    {error && <p role="alert" className="negative">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!data ? !error && <p>Đang tải thẻ…</p> : <>
      {data.canSell && !hideSell && <button type="button" disabled={busy} onClick={()=>{setSelling(!selling);setSelected(null);setConfirmed(false);}}>Mua thẻ tiền mặt</button>}
      {selling && <ValidatedForm onSubmit={sell}><fieldset disabled={busy}><legend>Thu đủ tiền rồi phát hành thẻ</legend>
        <label>Mệnh giá (VNĐ)<MoneyInput required min={1} max={1_000_000_000_000} value={amount} onValueChange={setAmount}/></label>
        <label>Nhận tiền bằng<select value={method} onChange={e=>{setMethod(e.target.value);setConfirmed(false);}}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></select></label>
        <label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Đã kiểm tra và thực nhận đủ tiền mua thẻ</label>
        <button type="submit" disabled={busy || !confirmed}>Xác nhận mua thẻ</button>
      </fieldset></ValidatedForm>}
      {data.cards.map((card:Row)=><article key={card._id} className="cash-card-item">
        <strong>Thẻ #{card._id.slice(-6)} · {card.origin==='OPENING'?'Số dư chuyển từ sổ cũ':card.origin==='GIFT'?'Được tặng':'Khách mua'}</strong>
        <p>{card.origin==='OPENING'?'Số dư lúc chuyển':'Mệnh giá'} {money(card.amount)} · Còn <strong>{money(card.balance)}</strong></p>
        {card.sourceInvoiceId && <p>Hóa đơn gói #{card.sourceInvoiceId.slice(-6)}{card.promotion?' · '+card.promotion:''}</p>}
        {invoice && due>0 && card.balance>0 && <button type="button" disabled={busy} onClick={()=>{setSelected(card);setSelling(false);setUsed(String(Math.min(card.balance,due)));setAdditional(String(due-Math.min(card.balance,due)));setConfirmed(false);}}>Dùng thẻ này</button>}
      </article>)}
      {!data.total && <p>Khách chưa có thẻ tiền.</p>}
      {data.total>10 && <div className="actions"><button type="button" disabled={busy||page<=1} onClick={()=>setPage(data.page-1)}>Trước</button><span>Thẻ · Trang {data.page}/{Math.ceil(data.total/10)}</span><button type="button" disabled={busy||data.page*10>=data.total} onClick={()=>setPage(data.page+1)}>Sau</button></div>}
      {selected && invoice && <ValidatedForm onSubmit={redeem}><fieldset disabled={busy}><legend>Thanh toán bằng thẻ #{selected._id.slice(-6)}</legend>
        <p>Còn nợ {money(due)} · Số dư thẻ {money(selected.balance)}</p>
        <label>Trừ thẻ (VNĐ)<MoneyInput required min={1} max={Math.min(due,selected.balance)} value={used} onValueChange={value=>{setUsed(value);setConfirmed(false);try{setAdditional(String(Math.max(0,due-parseMoney(value))));}catch{setAdditional('0');}}}/></label>
        <label>Thu thêm (VNĐ)<MoneyInput required min={0} max={due} value={additional} onValueChange={value=>{setAdditional(value);setConfirmed(false);}}/></label>
        {additionalValue>0 && <><label>Phương thức thu thêm<select value={method} onChange={e=>{setMethod(e.target.value);setConfirmed(false);}}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></select></label><label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Đã kiểm tra và thực nhận phần tiền thu thêm</label></>}
        <p>Chỉ trừ thẻ sau khi bấm xác nhận. Số dư và công nợ được kiểm tra lại khi lưu.</p>
        <InvoiceLineAllocationFields key={invoice._id+':card:'+selected._id} invoice={invoice} title="Phân bổ phần trừ thẻ"/>
        {additionalValue>0 && <InvoiceLineAllocationFields key={invoice._id+':extra:'+selected._id} invoice={invoice} name="additionalLineAllocations" title="Phân bổ phần thu thêm"/>}
        <button type="submit" disabled={busy || additionalValue>0&&!confirmed}>Xác nhận thanh toán</button><button type="button" onClick={()=>setSelected(null)}>Hủy</button>
      </fieldset></ValidatedForm>}
      <h4>Lịch sử sử dụng thẻ</h4>{data.uses.map((use:Row)=><p key={use._id}>{new Date(use.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · Thẻ #{use.cardId.slice(-6)} · HĐ #{use.invoiceId.slice(-6)} · Trừ {money(use.amount)} · Còn {money(use.balanceAfter)}</p>)}
      {!data.useTotal && <p>Chưa dùng thẻ.</p>}
      {data.useTotal>10 && <div className="actions"><button type="button" disabled={busy||usePage<=1} onClick={()=>setUsePage(data.usePage-1)}>Trước</button><span>Lịch sử · Trang {data.usePage}/{Math.ceil(data.useTotal/10)}</span><button type="button" disabled={busy||data.usePage*10>=data.useTotal} onClick={()=>setUsePage(data.usePage+1)}>Sau</button></div>}
    </>}
  </section>;
}
