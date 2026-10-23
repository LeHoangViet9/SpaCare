 'use client';
import { formatCurrency } from '@/lib/currency';
import { sharedCommissionDeltas } from '@/lib/sale-commission';
type Person = { _id: string; name: string; role?: string; active?: boolean };
export default function SaleParticipants({ people, value, onChange, total, disabled = false }: {
  people: Person[]; value: string[]; onChange: (value: string[]) => void; total: number; disabled?: boolean;
}) {
  const options = people.filter(p => p.active && ['OWNER','STAFF'].includes(p.role || ''));
  const valid = value.length > 0 && value.every(id => options.some(p=>p._id === id)) && new Set(value).size === value.length;
  const pool = Number.isSafeInteger(total) && total > 0 ? Math.floor(total / 20) : 0;
  const preview = valid ? sharedCommissionDeltas(pool,0,value) : [];
  return <fieldset className="sale-participants" disabled={disabled}><legend>Người tư vấn · chia hoa hồng bán gói</legend>
    {value.map((id,index) => <div className="sale-participant-row" key={index}><label>{index === 0 ? 'Người tư vấn' : `Người cùng tư vấn ${index+1}`}<select name={`saleParticipant.${index}`} required value={id} onChange={e => onChange(value.map((old,i)=>i===index ? e.target.value : old))}><option value="">Chọn người tư vấn…</option>{options.filter(p=>p._id===id || !value.includes(p._id)).map(p=><option key={p._id} value={p._id}>{p.name}{p.role==='OWNER'?' (Chủ spa)':''}</option>)}</select></label>{value.length > 1 && <button type="button" aria-label={`Bỏ người tư vấn ${index+1}`} onClick={()=>onChange(value.filter((_,i)=>i!==index))}>Bỏ</button>}</div>)}
    <button type="button" disabled={value.length >= Math.min(20,options.length)} onClick={()=>onChange([...value,''])}>＋ Người cùng tư vấn</button>
    <input type="hidden" name="participantIds" value={JSON.stringify(value)} />
    <small>Tổng hoa hồng 5% tiền thực thu, chia đều {value.length} người. Chưa thu tiền thì chưa phát sinh hoa hồng.</small>
    {valid && <div className="sale-share-preview"><strong>Dự kiến khi thu đủ: {formatCurrency(pool)}</strong>{preview.map(share=><span key={share.staffId}>{options.find(p=>p._id===share.staffId)?.name}: <b>{formatCurrency(share.amount)}</b></span>)}<small>Số tiền nguyên đồng; phần lẻ được phân bổ cố định để tổng luôn đúng quỹ 5%.</small></div>}
  </fieldset>;
}
