import {z} from 'zod';

export const receiptDayInput=z.string().refine(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,'Ngày thực nhận không hợp lệ.');
