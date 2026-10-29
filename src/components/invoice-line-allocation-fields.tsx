'use client';
import MoneyInput from './money-input';
import { formatCurrency, parseMoney } from '@/lib/currency';

type Invoice = Record<string, any>;
export function readLineAllocationFields(data: FormData, name = 'lineAllocations') {
  const allocations = [...data.entries()].filter(([key])=>key.startsWith(name+':')).map(([key,value])=>({lineId:key.slice(name.length+1),amount:parseMoney(String(value || '0'))})).filter(line=>line.amount>0);
  return allocations.length ? allocations : undefined;
}

export default function InvoiceLineAllocationFields({invoice,name='lineAllocations',title='Phân bổ tiền theo dòng'}:{invoice?:Invoice;name?:string;title?:string}) {
  if (!invoice) return null;
  const lines = ['serviceItems','packageItems','productItems'].flatMap(group=>invoice[group] || []);
  if (!lines.length || lines.every(line=>!line.lineId)) return <p>Hóa đơn cũ: ghi nhận tiền theo tổng hóa đơn.</p>;
  if (lines.some(line=>!line.lineId) || lines.reduce((sum,line)=>sum+(line.paid || 0),0)!==invoice.paid)
    return <p role="alert">Số tiền theo dòng cần được đối soát trước khi thu thêm. Liên hệ chủ spa.</p>;
  const outstanding = lines.filter(line=>line.total>(line.paid || 0));
  return <fieldset><legend>{title}</legend><p>Nhập số tiền cho từng dòng nếu thu một phần. Tổng phân bổ phải bằng số tiền của nguồn này. Để trống chỉ khi trả hết nợ hoặc chỉ còn một dòng nợ.</p>{outstanding.map(line=><label key={String(line.lineId)}>{line.name} · Còn {formatCurrency(line.total-(line.paid || 0))}<MoneyInput name={name+':'+line.lineId} min={0} max={line.total-(line.paid || 0)} defaultValue={0}/></label>)}</fieldset>;
}
