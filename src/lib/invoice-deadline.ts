import {z} from 'zod';
import {dayBounds} from './rules.ts';

// Empty creation inputs mean no deadline; never infer one from the issue date.
export const optionalInvoiceDeadline=z.preprocess(value=>value===''?undefined:value,
  z.string().refine(value=>{try{dayBounds(value);return true;}catch{return false;}},'Ngày hạn thanh toán không hợp lệ.').optional());

export function visibleInvoiceDeadline(invoice:{total:number;paid:number;dueDate?:string|null}) {
  return invoice.total>invoice.paid && invoice.dueDate ? invoice.dueDate : undefined;
}
