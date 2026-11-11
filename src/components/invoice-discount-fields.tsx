'use client';
import { discountLabel, invoiceDiscount, type InvoiceDiscountInput } from '@/lib/invoice-discount';
import { formatCurrency, parseMoney } from '@/lib/currency';
import MoneyInput from './money-input';
import {useState} from 'react';

export default function InvoiceDiscountFields({subtotal,value,onChange,disabled}:{subtotal:number;value?:InvoiceDiscountInput;onChange:(value?:InvoiceDiscountInput)=>void;disabled?:boolean}) {
  const [amountDraft,setAmountDraft]=useState(String(value?.value ?? 0));
  let result; let error='';
  try { result=invoiceDiscount(subtotal,value); } catch(e) { error=(e as Error).message; }
  return <fieldset disabled={disabled} className="invoice-discount-fields"><legend>Giảm giá hóa đơn mới</legend>
    <label>Loại giảm giá<select value={value?.type || ''} onChange={e=>{setAmountDraft('0');onChange(e.target.value ? {type:e.target.value as InvoiceDiscountInput['type'],value:0}:undefined);}}>
      <option value="">Không áp dụng</option><option value="AMOUNT">Số tiền (VNĐ)</option><option value="PERCENT">Phần trăm (%)</option>
    </select></label>
    {value && <label>{value.type==='PERCENT'?'Phần trăm giảm giá (0–100)':'Số tiền giảm (VNĐ)'}{value.type==='PERCENT' ?
      <input type="number" min={0} max={100} step={1} required value={Number.isFinite(value.value)?value.value:''} onChange={e=>onChange({...value,value:e.target.value===''?NaN:Number(e.target.value)})}/> :
      <MoneyInput required min={0} value={amountDraft} onValueChange={raw=>{setAmountDraft(raw);let amount=NaN;try{amount=parseMoney(raw);}catch{}onChange({...value,value:amount});}}/>}</label>}
    {value && <input type="hidden" name="discount" value={JSON.stringify(value)}/>}
    <p>Tạm tính: <strong>{formatCurrency(subtotal)}</strong></p>
    {result && <><p>Giảm giá ({discountLabel(result.discount)}): <strong>{formatCurrency(result.discount?.amount || 0)}</strong></p><p>Tổng thanh toán sau giảm: <strong>{formatCurrency(result.total)}</strong></p></>}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
