'use client';
import AppointmentCheckoutPicker from './appointment-checkout-picker';
import {useCallback,useEffect,useState} from 'react';
import {packageLabel,timedPackage,treatmentDay,packageExpiry} from '@/lib/treatment-rules';
import {formatCurrency,parseMoney} from '@/lib/currency';
import {cashierCatalog,type CashierMode} from '@/lib/cashier-catalog';
import {cashierActions,toggleCartItem} from '@/lib/cashier-cart';
import {isValidSignature} from '@/lib/signature';
import CustomerPicker from './customer-picker';
import MoneyInput from './money-input';
import ValidatedForm from './validated-form';
import SaleParticipants from './sale-participants';
import InvoiceCardPayment from './invoice-card-payment';
import {TreatmentConfirmations} from './treatment-selection';
type Row=Record<string,any>;
const money=formatCurrency;
const amountOf=(value:string)=>{try{return parseMoney(value);}catch{return 0;}};
export default function Cashier({data,busy,initialMode,initialCustomer,initialAppointmentId,onInvoice,onSubmit,onInvoices,onNewCustomer}:{
 data:Row;busy:boolean;initialMode:CashierMode;initialCustomer?:Row|null;initialAppointmentId?:string;onInvoice?:(id:string)=>void;onSubmit:(action:string,values:Row)=>void;onInvoices:()=>void;onNewCustomer:()=>void;
}){
 const [appointment,setAppointment]=useState<Row|null>(null);
 const [browseMode,setBrowseMode]=useState<CashierMode>(initialMode);
 const [customer,setCustomer]=useState<Row|null>(null);
 const [serviceItems,setServiceItems]=useState<Row[]>([]);
 const [sessionItems,setSessionItems]=useState<Row[]>([]);
 const [productItems,setProductItems]=useState<Row[]>([]);
 const [packageItems,setPackageItems]=useState<Row[]>([]);
 const [search,setSearch]=useState(''),[category,setCategory]=useState(''),[catalogPage,setCatalogPage]=useState(1);
 const [performerId,setPerformerId]=useState(''),[issuedOn,setIssuedOn]=useState(''),[dueDate,setDueDate]=useState('');
 const [participantIds,setParticipantIds]=useState<string[]>([data.user.id || data.user._id]);
 const [error,setError]=useState('');
 const staffOptions=data.staff.filter((row:Row)=>row.active && ['OWNER','STAFF'].includes(row.role));
 const [cardPreview,setCardPreview]=useState({context:'',amount:0});
 const serviceAmount=serviceItems.reduce((n,item)=>n+amountOf(item.total),0);
 const productAmount=productItems.reduce((n,item)=>n+amountOf(item.unitPrice)*Number(item.quantity),0);
 const packageAmount=packageItems.reduce((n,item)=>n+amountOf(item.total),0);
 const amount=serviceAmount+productAmount+packageAmount;
 const cardContext=JSON.stringify([customer?._id,serviceItems.map(item=>[item._id,item.total])]);
 const cardEligible=serviceItems.length===1 && !sessionItems.length && !productItems.length;
 const previewCard=useCallback((value:number)=>setCardPreview({context:cardContext,amount:value}),[cardContext]);
 const appliedCard=cardEligible && cardPreview.context===cardContext ? cardPreview.amount:0;
 const basketCount=serviceItems.length+sessionItems.length+productItems.length+packageItems.length;
 function resetSelection(){setAppointment(null);setServiceItems([]);setSessionItems([]);setProductItems([]);setPackageItems([]);setPerformerId('');setParticipantIds([data.user.id || data.user._id]);setError('');}
 useEffect(()=>{if(initialCustomer){setCustomer(initialCustomer);resetSelection();setCatalogPage(1);}},[initialCustomer?._id]);
 const allCatalog=cashierCatalog({services:data.services,products:data.products || [],packageTemplates:data.packageTemplates || [],treatments:data.treatments},browseMode,customer?._id || '',search);
 const categoryOf=(row:Row)=>browseMode==='product' ? data.productGroups?.find((group:Row)=>group._id===row.groupId)?.name : browseMode==='service' ? row.category : data.services.find((service:Row)=>service._id===row.serviceId)?.category;
 const categories=[...new Set<string>(allCatalog.map(categoryOf).filter(Boolean))].sort();
 const catalog=allCatalog.filter(row=>!category || categoryOf(row)===category);
 const templates=cashierCatalog({services:data.services,packageTemplates:data.packageTemplates || [],treatments:data.treatments},'package','','');
 const pageCount=Math.max(1,Math.ceil(catalog.length/8)),page=Math.min(catalogPage,pageCount);
 const visibleCatalog=category && browseMode!=='product'?catalog:catalog.slice((page-1)*8,page*8);
 const actualPages=category && browseMode!=='product'?1:pageCount;
 const selectedItems=browseMode==='service'?serviceItems:browseMode==='session'?sessionItems:browseMode==='package'?packageItems:productItems;
 function choose(row:Row){
   setError('');
   try{
     if(browseMode==='service')setServiceItems(old=>toggleCartItem(old,row,{total:String(row.price)}));
     else if(browseMode==='session')setSessionItems(old=>toggleCartItem(old,row));
     else if(browseMode==='product')setProductItems(old=>toggleCartItem(old,row,{unitPrice:String(row.price),quantity:'1'}));
     else setPackageItems(old=>toggleCartItem(old,row,{total:String(row.price),startsOn:treatmentDay(),promotion:'',giftCashCardAmount:'0',gifts:[]}));
   }catch(e){setError((e as Error).message);}
 }
 const updatePackage=(id:string,patch:Row)=>setPackageItems(old=>old.map(row=>row._id===id?{...row,...patch}:row));
 function submit(event:React.FormEvent<HTMLFormElement>){
   event.preventDefault();setError('');
   try{
     if(!customer)throw new Error('Chọn khách hàng trước khi lưu.');
     const fd=new FormData(event.currentTarget);
     const rawSignature=fd.get('signature');
     const signature=rawSignature ? JSON.parse(String(rawSignature)):undefined;
     if(signature && !isValidSignature(signature))throw new Error('Chữ ký chưa hợp lệ. Ký lại hoặc xóa nét ký để bỏ qua.');
     const cardValue=fd.get('cashCard');
     const actions=cashierActions({customerId:customer._id,services:serviceItems,sessions:sessionItems,products:productItems,packages:packageItems,staffId:performerId,participantIds,dueDate,signature,...(cardValue?{cashCard:JSON.parse(String(cardValue))}:{})});
     const date=issuedOn?{issuedOn}:{};
     if(appointment)onSubmit('checkout',{customerId:customer._id,appointmentId:appointment.appointment._id,actions,...date});
     else if(actions.length===1)onSubmit(actions[0].action,{...actions[0].data,...date});
     else onSubmit('checkout',{customerId:customer._id,actions,...date});
   }catch(e){setError((e as Error).message);}
 }
 return <ValidatedForm onSubmit={submit} className="cashier">
 <section className="panel panel-padded cashier-customer">
   <div className="section-head"><h3>1. Khách hàng</h3><div className="actions"><button type="button" disabled={busy} onClick={onNewCustomer}>+ Khách mới</button><button type="button" onClick={onInvoices}>Danh sách hóa đơn</button></div></div>
   <CustomerPicker label="Khách hàng" value={customer?._id || ''} onChange={()=>{}} onCustomerChange={row=>{setCustomer(row);resetSelection();}} required disabled={busy}/>
   <AppointmentCheckoutPicker customerId={customer?._id} initialId={initialAppointmentId} selectedId={appointment?.appointment?._id} busy={busy} onSelect={detail=>{
     resetSelection();if(!detail)return;
     setCustomer(detail.customer);setAppointment(detail);
     if(detail.invoice)return;
     setServiceItems(detail.services.map((row:Row)=>({...row,total:String(row.price),performerId:detail.appointment.staffId || ''})));
     setSessionItems(detail.treatments);setPerformerId(detail.appointment.staffId || '');
   }}/>
   {appointment?.invoice && <p>Điểm hẹn đã có hóa đơn. <button type="button" onClick={()=>onInvoice?.(appointment.invoice._id)}>Mở hóa đơn</button></p>}
 </section>
 <section className="panel panel-padded cashier-catalog">
   <h3>2. Thêm vào giỏ</h3><p>Có thể tích nhiều mục ở từng danh mục. Chuyển danh mục vẫn giữ toàn bộ giỏ.</p>
   <div className="cashier-modes" role="group" aria-label="Danh mục thu ngân">{([['service','Dịch vụ lẻ'],['session','Dùng gói đã mua'],['package','Bán gói mới'],['product','Sản phẩm']] as const).map(([key,title])=><button type="button" key={key} disabled={busy} aria-pressed={browseMode===key} onClick={()=>{setBrowseMode(key);setSearch('');setCategory('');setCatalogPage(1);}}>{title}</button>)}</div>
   <label>{browseMode==='product'?'Tìm sản phẩm':browseMode==='package'?'Tìm gói để bán mới':browseMode==='session'?'Tìm gói đã mua':'Tìm dịch vụ lẻ'}<input type="search" maxLength={100} value={search} disabled={busy} placeholder="Nhập tên để tìm…" onChange={e=>{setSearch(e.target.value);setCatalogPage(1);}}/></label>
   <label>{browseMode==='product'?'Nhóm sản phẩm':'Nhóm dịch vụ'}<select value={category} disabled={busy} onChange={e=>{setCategory(e.target.value);setCatalogPage(1);}}><option value="">Tất cả nhóm</option>{[...new Set([...categories,...(category?[category]:[])])].map(name=><option key={name} value={name}>{name}</option>)}</select></label>
   <div className="cashier-cards">{visibleCatalog.map(row=>{
     const selected=selectedItems.some(item=>item._id===row._id);
     return <button type="button" key={row._id} className={'cashier-card'+(selected?' is-selected':'')} aria-pressed={selected} disabled={busy || !customer || (!selected && selectedItems.length>=30) || (browseMode==='product' && row.stock<1 && !selected)} onClick={()=>choose(row)}><strong>{row.name}</strong><span>{browseMode==='product'?'Tồn '+row.stock+' '+row.unit:browseMode==='package' || browseMode==='session'?packageLabel(row):row.category || 'Dịch vụ'}</span><b>{money(browseMode==='session'?0:row.price)}</b>{selected && <small>Đã chọn ✓</small>}</button>;
   })}</div>
   {!catalog.length && <p>{browseMode==='session'?'Chọn khách để xem các gói khả dụng, hoặc khách chưa có gói phù hợp.':'Không có mục phù hợp.'}</p>}
   {actualPages>1 && <div className="customer-picker-pages"><button type="button" disabled={page<=1 || busy} onClick={()=>setCatalogPage(page-1)}>Trước</button><span>{page}/{actualPages}</span><button type="button" disabled={page>=actualPages || busy} onClick={()=>setCatalogPage(page+1)}>Sau</button></div>}
 </section>
 <section className="panel panel-padded cashier-receipt">
   <div className="section-head"><h3>3. Giỏ đã chọn ({basketCount})</h3>{basketCount>0 && <button type="button" disabled={busy} onClick={resetSelection}>Xóa giỏ</button>}</div>
   <div className="cashier-receipt-heading"><strong>{customer?.name || 'Chưa chọn khách'}</strong><small>{customer?.phone}</small></div>
   {!basketCount && <p>Chọn một hoặc nhiều dịch vụ, liệu trình, gói mới hoặc sản phẩm.</p>}
   <fieldset disabled={busy} className="cashier-fields">
   {serviceItems.map(item=><div className="cashier-service-line" key={item._id}><div className="section-head"><strong>{item.name}</strong><button type="button" onClick={()=>setServiceItems(old=>old.filter(row=>row._id!==item._id))}>Bỏ dịch vụ</button></div><label>Giá dịch vụ (VNĐ)<MoneyInput value={item.total} min={1} required onValueChange={total=>setServiceItems(old=>old.map(row=>row._id===item._id?{...row,total}:row))}/></label><label>Người thực hiện dòng này<select aria-label="Người thực hiện dòng này" value={item.performerId || ''} onChange={e=>setServiceItems(old=>old.map(row=>row._id===item._id?{...row,performerId:e.target.value}:row))}><option value="">Chưa chọn</option>{staffOptions.map((row:Row)=><option key={row._id} value={row._id}>{row.name}</option>)}</select></label></div>)}
   {sessionItems.map(item=><div className="cashier-service-line" key={item._id}><div className="section-head"><strong>{item.name} · 0đ</strong><button type="button" onClick={()=>setSessionItems(old=>old.filter(row=>row._id!==item._id))}>Bỏ liệu trình</button></div><label>Người thực hiện lượt này<select aria-label="Người thực hiện lượt này" value={item.performerId || ''} onChange={e=>setSessionItems(old=>old.map(row=>row._id===item._id?{...row,performerId:e.target.value}:row))}><option value="">Chưa chọn</option>{staffOptions.map((row:Row)=><option key={row._id} value={row._id}>{row.name}</option>)}</select></label></div>)}
   {productItems.map(item=><div className="cashier-service-line" key={item._id}><div className="section-head"><strong>{item.name}</strong><button type="button" onClick={()=>setProductItems(old=>old.filter(row=>row._id!==item._id))}>Bỏ sản phẩm</button></div><label>Số lượng ({item.unit})<input type="number" min={1} max={item.stock} step={1} required value={item.quantity} onChange={e=>setProductItems(old=>old.map(row=>row._id===item._id?{...row,quantity:e.target.value}:row))}/></label><label>Đơn giá (VNĐ)<MoneyInput value={item.unitPrice} min={1} required onValueChange={unitPrice=>setProductItems(old=>old.map(row=>row._id===item._id?{...row,unitPrice}:row))}/></label></div>)}
   {packageItems.map(item=><section className="cashier-service-line" key={item._id}>
     <div className="section-head"><strong>Gói mới: {item.name} · {packageLabel(item)}</strong><button type="button" onClick={()=>setPackageItems(old=>old.filter(row=>row._id!==item._id))}>Bỏ gói mới</button></div>
     <label>Giá gói (VNĐ)<MoneyInput value={item.total} min={1} required onValueChange={total=>updatePackage(item._id,{total})}/></label>
     {(timedPackage(item)) && <label>Ngày bắt đầu<input type="date" required value={item.startsOn} onChange={e=>updatePackage(item._id,{startsOn:e.target.value})}/><small>{timedPackage(item) && item.startsOn ? 'Dự kiến hết hạn: '+packageExpiry(item.startsOn,item.durationMonths):'Theo thỏa thuận gói.'} Gói triệt 36 tháng tính theo ngày mua.</small></label>}
     <label>Tên/ghi chú ưu đãi<input maxLength={2000} value={item.promotion} required={item.gifts.length>0 || amountOf(item.giftCashCardAmount)>0} placeholder="Ví dụ: ưu đãi tháng 10, mua gói tặng gội đầu" onChange={e=>updatePackage(item._id,{promotion:e.target.value})}/><small>Ghi tên chương trình để tra cứu; cần nhập khi tặng dịch vụ hoặc thẻ tiền.</small></label>
     {item.gifts.map((gift:Row,index:number)=><div key={gift.id} className="gift-row"><label>Dịch vụ lẻ tặng 1 lần · 0đ<select required value={gift.serviceId} onChange={e=>updatePackage(item._id,{gifts:item.gifts.map((row:Row,i:number)=>i===index?{...row,serviceId:e.target.value}:row)})}><option value="">Chọn dịch vụ tặng…</option>{data.services.filter((s:Row)=>s.active).map((s:Row)=><option key={s._id} value={s._id}>{s.name} · 1 lần</option>)}</select></label><button type="button" onClick={()=>updatePackage(item._id,{gifts:item.gifts.filter((_:Row,i:number)=>i!==index)})}>Bỏ quà tặng</button></div>)}
     <button type="button" disabled={item.gifts.length>=20 || !data.services.some((s:Row)=>s.active)} onClick={()=>updatePackage(item._id,{gifts:[...item.gifts,{id:crypto.randomUUID(),serviceId:''}]})}>+ Tặng dịch vụ lẻ 0đ</button>
     <label>Thẻ tiền tặng kèm (VNĐ)<MoneyInput value={item.giftCashCardAmount} min={0} required onValueChange={giftCashCardAmount=>updatePackage(item._id,{giftCashCardAmount})}/></label>
   </section>)}
   {packageItems.length>0 && <><SaleParticipants people={data.staff} value={participantIds} onChange={setParticipantIds} total={packageAmount} disabled={busy}/><p>Các gói mua trong lần này được gộp vào một hóa đơn, mỗi gói vẫn có hồ sơ liệu trình riêng.</p></>}
   {(serviceItems.length>0 || sessionItems.length>0) && <label>Nhân viên cấp hóa đơn (tùy chọn, không áp dụng cho từng dòng)<select aria-label="Nhân viên cấp hóa đơn" value={performerId} onChange={e=>setPerformerId(e.target.value)}><option value="">Không chọn</option>{staffOptions.map((row:Row)=><option key={row._id} value={row._id}>{row.name}</option>)}</select></label>}
   {basketCount>0 && <label>Hạn thanh toán{packageItems.length?'':' (nếu có)'}<input type="date" required={packageItems.length>0} min={packageItems.length?data.today:undefined} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>}
   {sessionItems.length>0 && <TreatmentConfirmations key={JSON.stringify([sessionItems.map(row=>row._id),serviceItems.map(row=>[row._id,row.total]),productItems.map(row=>[row._id,row.quantity,row.unitPrice])])} treatments={sessionItems} disabled={busy}/>}
   {cardEligible && customer && <section><h3>Thẻ tiền cho phần dịch vụ lẻ</h3><InvoiceCardPayment key={cardContext} customerId={customer._id} total={serviceAmount} disabled={busy} onAppliedChange={previewCard}/></section>}
   {serviceItems.length>1 && !sessionItems.length && !productItems.length && <p>Lưu hóa đơn trước, sau đó mở chi tiết hóa đơn để dùng thẻ và phân bổ riêng tiền thẻ, tiền thu thêm cho từng dịch vụ.</p>}
   </fieldset>
   <div className="cashier-total"><span>Tổng giỏ</span><strong>{money(Number.isFinite(amount)?amount:0)}</strong></div>
   {appliedCard>0 && <div className="cashier-total"><span>Còn phải trả sau khi trừ thẻ</span><strong>{money(Math.max(0,amount-appliedCard))}</strong></div>}
   <label>Ngày hóa đơn (để trống: hôm nay)<input type="date" max={data.today} value={issuedOn} disabled={busy} onChange={e=>setIssuedOn(e.target.value)}/></label>
   {error && <p className="negative" role="alert">{error}</p>}
   <button type="submit" className="primary cashier-save" disabled={busy || !customer || !basketCount || !!appointment?.invoice || (!!appointment && !['CONFIRMED','COMPLETED'].includes(appointment.appointment.status))}>{busy?'Đang lưu…':appointment?'Hoàn thành lịch & lưu hóa đơn':'Lưu toàn bộ giỏ'}</button>
   <small>Tiền chưa thu có thể thanh toán trên từng hóa đơn sau khi lưu. Gói đã mua không thu lại tiền buổi.</small>
 </section>
 </ValidatedForm>;
}
