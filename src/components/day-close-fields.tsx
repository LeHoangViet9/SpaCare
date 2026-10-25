 'use client';
import {useState} from 'react';
import MoneyInput from './money-input';
import {formatCurrency,parseMoney} from '@/lib/currency';
export default function DayCloseFields({preview}:{preview:Record<string,any>}) {
 const [draft,setDraft]=useState('');
 let counted:number|null=null;
 try { if(draft.trim()) counted=parseMoney(draft); } catch { /* Invalid draft is validated before submit. */ }
 const expected=preview.expectedPreview;
 return <section className="day-close-preview">
   <h3>Đối chiếu tiền mặt · {preview.day}</h3>
   <dl><dt>Tiền mặt đầu ngày</dt><dd>{formatCurrency(preview.opening || 0)}</dd><dt>Thực thu tiền mặt</dt><dd>{formatCurrency(preview.cashIn || 0)}</dd><dt>Thực chi tiền mặt</dt><dd>{formatCurrency(preview.cashOut || 0)}</dd><dt>Tiền mặt kỳ vọng</dt><dd><strong>{formatCurrency(expected)}</strong></dd></dl>
   <label>Tiền mặt đếm thực tế (VNĐ)<MoneyInput name="counted" required onValueChange={setDraft}/></label>
   <p className="day-close-difference" role="status" aria-live="polite">{counted===null ? 'Nhập số tiền đã đếm để xem chênh lệch.' : <>Chênh lệch: <strong className={counted===expected ? 'positive':'negative'}>{formatCurrency(counted-expected)}</strong> · {counted===expected ? 'Khớp sổ' : counted>expected ? 'Thừa tiền' : 'Thiếu tiền'}</>}</p>
   <small>Đây là số liệu xem trước. Chỉ xác nhận chốt sau khi đã kiểm đếm; hệ thống không tự cân sổ.</small>
 </section>;
}
