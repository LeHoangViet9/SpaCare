'use client';
import { useEffect, useState } from 'react';
import MoneyInput from './money-input';
import { formatCurrency as money, parseMoney } from '@/lib/currency';
type Card = { _id: string; balance: number; origin: string };
export default function InvoiceCardPayment({ customerId, total, disabled, onAppliedChange }: { customerId: string; total: number; disabled: boolean; onAppliedChange?: (amount:number)=>void }) {
  const [enabled,setEnabled]=useState(false);
  const [cards,setCards]=useState<Card[]>([]), [page,setPage]=useState(1), [pages,setPages]=useState(1);
  const [loading,setLoading]=useState(true), [error,setError]=useState(''), [cardId,setCardId]=useState('');
  const [amount,setAmount]=useState(''), [additional,setAdditional]=useState('0'), [method,setMethod]=useState('CASH'), [confirmed,setConfirmed]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setCards([]);setCardId('');setEnabled(false);
    fetch('/api/cash-cards?'+new URLSearchParams({customerId,page:String(page)}),{signal:controller.signal,cache:'no-store'})
      .then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error || 'Chưa tải được thẻ.');return body;})
      .then(body=>{if(!controller.signal.aborted){setCards(body.cards);setPages(Math.max(1,Math.ceil(body.total/10)));setLoading(false);}})
      .catch(e=>{if(!controller.signal.aborted){setError(e.message);setLoading(false);}});
    return ()=>controller.abort();
  },[customerId,page]);
  const card=enabled ? cards.find(c=>c._id===cardId) : undefined;
  let used=0,extra=0;try{used=parseMoney(amount || '0');extra=parseMoney(additional);}catch{}
  useEffect(()=>{onAppliedChange?.(card ? used : 0);},[onAppliedChange,card?._id,used]);
  const payload=card ? {cardId:card._id,amount:used,additionalAmount:extra,...(extra>0?{method,receivedConfirmation:confirmed}:{})} : null;
  return <fieldset disabled={disabled} className="cash-card-panel"><legend>Áp dụng thẻ tiền mặt</legend>
    {loading && <p role="status">Đang tải thẻ của khách…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && cards.some(c=>c.balance>0) && <label className="card-payment-toggle"><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);setConfirmed(false);const first=cards.find(c=>c.balance>0);setCardId(e.target.checked&&first?first._id:'');setAmount(String(Math.min(first?.balance||0,total)));setAdditional(String(Math.max(0,total-(first?.balance||0))));}}/>Dùng thẻ tiền mặt</label>}
    {enabled && <label>Thẻ của khách<select required value={cardId} disabled={loading || !!error} onChange={e=>{const c=cards.find(v=>v._id===e.target.value);setCardId(e.target.value);setAmount(String(Math.min(c?.balance || 0,total)));setAdditional(String(Math.max(0,total-(c?.balance || 0))));setConfirmed(false);}}><option value="">Không dùng thẻ</option>{cards.map(c=><option key={c._id} value={c._id} disabled={c.balance<=0}>#{c._id.slice(-6)} · {c.origin==='OPENING'?'Số dư sổ cũ':c.origin==='GIFT'?'Thẻ tặng':'Thẻ mua'} · Còn {money(c.balance)}</option>)}</select></label>}
    {!loading && !error && !cards.length && <p>Khách chưa có thẻ tiền mặt.</p>}
    {pages>1 && <div className="actions"><button type="button" disabled={loading || page<=1} onClick={()=>setPage(p=>p-1)}>Trước</button><span>Trang {page}/{pages}</span><button type="button" disabled={loading || page>=pages} onClick={()=>setPage(p=>p+1)}>Sau</button></div>}
    {card && <><div className="card-payment-due" role="status"><span>Còn phải trả sau khi trừ thẻ</span><strong>{money(Math.max(0,total-used))}</strong></div><label>Trừ thẻ (VNĐ)<MoneyInput required min={1} max={Math.min(total,card.balance)} value={amount} onValueChange={value=>{setAmount(value);setConfirmed(false);try{setAdditional(String(Math.max(0,total-parseMoney(value))));}catch{setAdditional('0');}}}/></label>
      <label>Thu thêm ngay (VNĐ)<MoneyInput required min={0} max={Math.max(0,total-used)} value={additional} onValueChange={value=>{setAdditional(value);setConfirmed(false);}}/></label>
      {extra>0 && <><label>Phương thức thu thêm<select value={method} onChange={e=>{setMethod(e.target.value);setConfirmed(false);}}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></select></label><label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Đã kiểm tra và thực nhận phần tiền thu thêm</label></>}
      <p>Số dư thẻ sau thanh toán: {money(Math.max(0,card.balance-used))} · Còn nợ: {money(Math.max(0,total-used-extra))}</p><p>Lưu hóa đơn sẽ trừ thẻ và ghi nhận phần thu thêm cùng lúc.</p>
    </>}
    <input type="hidden" name="cashCard" value={payload?JSON.stringify(payload):''}/>
  </fieldset>;
}
