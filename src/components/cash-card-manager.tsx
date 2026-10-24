'use client';
import {useEffect,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import CashCards from './cash-cards';
import {formatCurrency as money} from '@/lib/currency';
type Row=Record<string,any>;
export default function CashCardManager({busy,refreshKey,onCreate,onCustomer,onInvoice}:{busy:boolean;refreshKey:unknown;onCreate:()=>void;onCustomer:(id:string)=>void;onInvoice:(id:string)=>void}) {
 const router=useRouter(),pathname=usePathname(),params=useSearchParams();
 const [result,setResult]=useState<Row|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<Row|null>(null),[revision,setRevision]=useState(0);
 const search=params.get('cardSearch')||'',status=params.get('cardStatus')||'',origin=params.get('cardOrigin')||'',page=params.get('cardPage')||'1';
 const query=new URLSearchParams({view:'list',search,status,origin,page}).toString();
 function change(values:Record<string,string>){const next=new URLSearchParams(params.toString());if(!values.cardPage)next.delete('cardPage');for(const [key,value] of Object.entries(values)){if(value)next.set(key,value);else next.delete(key);}setSelected(null);router.replace(pathname+(next.size?'?'+next.toString():''),{scroll:false});}
 useEffect(()=>{const controller=new AbortController();setResult(null);setError('');fetch('/api/cash-cards?'+query,{cache:'no-store',signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);return body;}).then(body=>{if(!controller.signal.aborted)setResult(body);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[query,refreshKey,revision]);
 return <section className="panel cash-card-manager">
  <div className="section-head"><div><h3>Danh sách thẻ tiền mặt</h3><p>Quản lý thẻ khách mua và thẻ tặng kèm gói.</p></div><button className="primary" type="button" disabled={busy} onClick={onCreate}>+ Tạo thẻ mới</button></div>
  <div className="card-manager-toolbar">
   <form key={search} onSubmit={e=>{e.preventDefault();change({cardSearch:String(new FormData(e.currentTarget).get('search')||'').trim()});}}><label>Tìm thẻ hoặc khách hàng<input name="search" maxLength={100} defaultValue={search} placeholder="Mã thẻ, tên hoặc số điện thoại…"/></label><button type="submit">Tìm kiếm</button></form>
   <label>Trạng thái<select value={status} onChange={e=>change({cardStatus:e.target.value})}><option value="">Tất cả</option><option value="AVAILABLE">Còn số dư</option><option value="EXHAUSTED">Hết số dư</option></select></label>
   <label>Loại thẻ<select value={origin} onChange={e=>change({cardOrigin:e.target.value})}><option value="">Tất cả</option><option value="PURCHASE">Khách mua</option><option value="GIFT">Được tặng</option><option value="OPENING">Số dư sổ cũ</option></select></label>
   {(search||status||origin) && <button type="button" onClick={()=>change({cardSearch:'',cardStatus:'',cardOrigin:''})}>Xóa bộ lọc</button>}
  </div>
  {error ? <div role="alert" className="alert error">{error}<button type="button" onClick={()=>setRevision(v=>v+1)}>Thử lại</button></div> : !result ? <p role="status" className="card-manager-note">Đang tải thẻ…</p> : <>
   <div className="card-manager-table" role="region" aria-label="Danh sách thẻ tiền mặt" tabIndex={0}><table><thead><tr>{['Mã thẻ','Trạng thái','Khách hàng','Mệnh giá','Số tiền hiện tại','Loại thẻ','Hạn sử dụng','Thời gian tạo','Thao tác'].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>
   {result.cards.map((card:Row)=><tr key={card._id}>
    <td data-label="Mã thẻ"><button type="button" className="card-code" title={'TM-'+card._id} onClick={()=>setSelected(card)}>TM-{card._id.slice(-6).toUpperCase()}</button></td>
    <td data-label="Trạng thái"><span className={'badge '+(card.balance>0?'active':'closed')}>{card.balance>0?'Còn số dư':'Hết số dư'}</span></td>
    <td data-label="Khách hàng"><button type="button" onClick={()=>onCustomer(card.customerId)}>{card.customerName}</button><small className="card-customer-phone">{card.customerPhone||'Chưa có SĐT'}</small></td>
    <td className="card-money" data-label="Giá trị ban đầu">{money(card.amount)}</td><td className="card-money" data-label="Số dư hiện tại"><strong>{money(card.balance)}</strong></td>
    <td data-label="Nguồn thẻ">{card.origin==='OPENING'?'Số dư chuyển từ sổ cũ':card.origin==='GIFT'?'Được tặng':'Khách mua'}{card.sourceInvoiceId&&<button type="button" onClick={()=>onInvoice(card.sourceInvoiceId)}>Xem hóa đơn gói</button>}</td><td data-label="Hạn sử dụng">Không thời hạn</td>
    <td data-label="Ngày tạo">{new Date(card.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td data-label="Thao tác"><button type="button" onClick={()=>setSelected(card)}>Chi tiết</button></td>
   </tr>)}
   {!result.total&&<tr><td colSpan={9}><div className="card-manager-empty"><strong>Chưa có thẻ phù hợp</strong><p>{search||status||origin?'Thử đổi từ khóa hoặc bỏ bộ lọc.':'Tạo thẻ mới hoặc tặng thẻ khi bán gói liệu trình.'}</p></div></td></tr>}
   </tbody></table></div>
   <div className="card-manager-footer"><span>Hiển thị {result.total?(result.page-1)*10+1:0}–{Math.min(result.page*10,result.total)} trên tổng {result.total} thẻ</span><div className="actions"><button type="button" disabled={result.page<=1} onClick={()=>change({cardPage:String(result.page-1)})}>Trước</button><span>{result.page}/{Math.max(1,Math.ceil(result.total/10))}</span><button type="button" disabled={result.page*10>=result.total} onClick={()=>change({cardPage:String(result.page+1)})}>Sau</button></div></div>
  </>}
  <p className="card-manager-note">Thẻ chỉ thanh toán dịch vụ lẻ. Không hoàn tiền hoặc đổi tiền mặt. Chọn Chi tiết để xem thông tin và lịch sử sử dụng thẻ.</p>
  {selected&&<div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Chi tiết thẻ tiền mặt" onKeyDown={e=>{if(e.key==='Escape')setSelected(null);}}><div className="section-head"><h2>Chi tiết thẻ tiền mặt</h2><button type="button" autoFocus onClick={()=>setSelected(null)}>Đóng</button></div><p><strong>{selected.customerName}</strong> · {selected.customerPhone}</p><p className="card-full-code">TM-{selected._id}</p><CashCards key={selected._id} customerId={selected.customerId} cardId={selected._id} hideSell onChanged={()=>setRevision(v=>v+1)}/></section></div>}
 </section>;
}
