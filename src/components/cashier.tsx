'use client';
import InvoiceDiscountFields from './invoice-discount-fields';
import {invoiceDiscount,type InvoiceDiscountInput} from '@/lib/invoice-discount';
import GroupedCartLines from './grouped-cart-lines';
import AppointmentCheckoutPicker from './appointment-checkout-picker';
import {useCallback,useEffect,useRef,useState} from 'react';
import {packageLabel,timedPackage,treatmentDay,packageExpiry} from '@/lib/treatment-rules';
import {formatCurrency,parseMoney} from '@/lib/currency';
import {cashierCatalog,type CashierMode} from '@/lib/cashier-catalog';
import {cashierActions,toggleCartItem,addServiceItem,removeServiceItem,updateServiceItemPerformers,addPackageItem} from '@/lib/cashier-cart';
import {isValidSignature} from '@/lib/signature';
import CustomerPicker from './customer-picker';
import MoneyInput from './money-input';
import ValidatedForm from './validated-form';
import SaleParticipants from './sale-participants';
import InvoiceCardPayment from './invoice-card-payment';
import CreationPayments from './creation-payments';
import {TreatmentConfirmations} from './treatment-selection';
type Row=Record<string,any>;
const money=formatCurrency;
const amountOf=(value:string)=>{try{return parseMoney(value);}catch{return 0;}};
function PerformerMultiSelect({staffOptions,selectedIds,onChange,disabled}:{
  staffOptions:Row[];selectedIds:string[];onChange:(ids:string[])=>void;disabled?:boolean;
}){
  const [open,setOpen]=useState(false);
  const containerRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    function handleClickOutside(e:MouseEvent){
      if(containerRef.current && !containerRef.current.contains(e.target as Node)){
        setOpen(false);
      }
    }
    document.addEventListener('mousedown',handleClickOutside);
    return ()=>document.removeEventListener('mousedown',handleClickOutside);
  },[open]);
  const selectedStaff=staffOptions.filter((s:Row)=>selectedIds.includes(s._id));
  const displayText=selectedStaff.length>0 ? selectedStaff.map((s:Row)=>s.name).join(', ') : 'Chọn kĩ thuật viên...';
  return <div className="relative w-full" ref={containerRef}>
    <button
      type="button"
      disabled={disabled}
      aria-expanded={open}
      aria-haspopup="listbox"
      className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-left transition-colors"
      onClick={()=>setOpen(prev=>!prev)}
    >
      <span className={`truncate flex-1 ${selectedStaff.length>0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{displayText}</span>
      <span className={`text-xs text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
    </button>
    {open && <div role="listbox" aria-multiselectable="true" className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg p-1">
      {staffOptions.length===0 ? <div className="px-3 py-2 text-sm text-gray-400">Không có nhân viên</div> : staffOptions.map((staff:Row)=>{
        const isSelected=selectedIds.includes(staff._id);
        return <label key={staff._id} className={`flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer select-none transition-colors ${isSelected ? 'bg-green-50 text-green-900 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
          <input
            type="checkbox"
            checked={isSelected}
            className="cursor-pointer"
            onChange={()=>{
              const next=isSelected ? selectedIds.filter((id:string)=>id!==staff._id) : [...selectedIds,staff._id];
              onChange(next);
            }}
          />
          <span className="flex-1 truncate">{staff.name}</span>
        </label>;
      })}
    </div>}
  </div>;
}

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
 const [performerId,setPerformerId]=useState(''),[issuedOn,setIssuedOn]=useState('');
 const [dueDate,setDueDate]=useState('');
 const [participantIds,setParticipantIds]=useState<string[]>([data.user.id || data.user._id]);
 const [error,setError]=useState('');
 const staffOptions=data.staff.filter((row:Row)=>row.active && ['OWNER','STAFF'].includes(row.role));
 const [cardPreview,setCardPreview]=useState({context:'',amount:0});
 const serviceAmount=serviceItems.reduce((n,item)=>n+amountOf(item.total),0);
 const productAmount=productItems.reduce((n,item)=>n+amountOf(item.unitPrice)*Number(item.quantity),0);
 const packageAmount=packageItems.reduce((n,item)=>n+amountOf(item.total),0);
 const subtotal=serviceAmount+productAmount+packageAmount;
 const [discount,setDiscount]=useState<InvoiceDiscountInput>();
 const selectedDiscount=discount;
 let amount=subtotal;try{amount=invoiceDiscount(subtotal,selectedDiscount).total;}catch{}
 const cardContext=JSON.stringify([customer?._id,serviceItems.map(item=>[item._id,item.total]),selectedDiscount]);
 const cardEligible=serviceItems.length===1 && !sessionItems.length && !productItems.length && !packageItems.length;
 const previewCard=useCallback((value:number)=>setCardPreview({context:cardContext,amount:value}),[cardContext]);
 const appliedCard=cardEligible && cardPreview.context===cardContext ? cardPreview.amount:0;
 const basketCount=serviceItems.length+sessionItems.length+productItems.length+packageItems.length;
 useEffect(()=>{if(!serviceItems.length && !productItems.length && !packageItems.length)setDiscount(undefined);},[serviceItems.length,productItems.length,packageItems.length]);
 function resetSelection(){setDueDate('');setDiscount(undefined);setAppointment(null);setServiceItems([]);setSessionItems([]);setProductItems([]);setPackageItems([]);setPerformerId('');setParticipantIds([data.user.id || data.user._id]);setError('');}
 useEffect(()=>{if(initialCustomer){setCustomer(initialCustomer);resetSelection();setCatalogPage(1);}},[initialCustomer?._id]);
 const allCatalog=cashierCatalog({services:data.services,products:data.products || [],packageTemplates:data.packageTemplates || [],treatments:data.treatments},browseMode,customer?._id || '',search);
 const categoryOf=(row:Row)=>browseMode==='product' ? data.productGroups?.find((group:Row)=>group._id===row.groupId)?.name : browseMode==='service' ? row.category || 'Chưa phân nhóm' : data.services.find((service:Row)=>service._id===row.serviceId)?.category;
 const categories=[...new Set<string>(allCatalog.map(categoryOf).filter(Boolean))].sort();
 const showServiceGroups=browseMode==='service' && !category;
 const catalog=allCatalog.filter(row=>!category || categoryOf(row)===category);
 const templates=cashierCatalog({services:data.services,packageTemplates:data.packageTemplates || [],treatments:data.treatments},'package','','');
 const pageCount=Math.max(1,Math.ceil(catalog.length/8)),page=Math.min(catalogPage,pageCount);
 const visibleCatalog=category && browseMode!=='product'?catalog:catalog.slice((page-1)*8,page*8);
 const actualPages=category && browseMode!=='product'?1:pageCount;
 const selectedItems=browseMode==='service'?serviceItems:browseMode==='session'?sessionItems:browseMode==='package'?packageItems:productItems;
 function choose(row:Row){
   setError('');
   try{
     if(browseMode==='service')setServiceItems(old=>addServiceItem(old,row));
     else if(browseMode==='session'){if(sessionItems.length>=30)throw new Error('Tối đa 30 lượt trong giỏ.');if(!timedPackage(row) && sessionItems.filter(item=>item._id===row._id).length>=row.remaining)throw new Error('Không đủ số buổi còn lại.');setSessionItems(old=>[...old,{...row,cartId:crypto.randomUUID()}]);}
     else if(browseMode==='product')setProductItems(old=>toggleCartItem(old,row,{unitPrice:String(row.price),quantity:'1'}));
     else setPackageItems(old=>addPackageItem(old,row));
   }catch(e){setError((e as Error).message);}
 }
 const updatePackage=(id:string,patch:Row)=>setPackageItems(old=>old.map(row=>(row.cartId || row._id)===id?{...row,...patch}:row));
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
     if(discount && subtotal===0 && !serviceItems.length && !productItems.length && !packageItems.length)throw new Error('Bỏ giảm giá khi giỏ không có khoản bán mới.');
     invoiceDiscount(subtotal,selectedDiscount);
     const date={...(issuedOn?{issuedOn}:{}),...(discount?{discount}:{})};
     const rawPayments=fd.get('payments'),payments=rawPayments?{payments:JSON.parse(String(rawPayments))}:{};
     if(appointment)onSubmit('checkout',{customerId:customer._id,appointmentId:appointment.appointment._id,actions,...date,...payments});
     else if(actions.length===1)onSubmit(actions[0].action,{...actions[0].data,...date,...payments});
     else onSubmit('checkout',{customerId:customer._id,actions,...date,...payments});
   }catch(e){setError((e as Error).message);}
 }
 return <ValidatedForm onSubmit={submit} className="cashier">
 <section className="panel panel-padded cashier-customer">
   <div className="section-head"><h3>1. Khách hàng</h3><div className="actions"><button type="button" disabled={busy} onClick={onNewCustomer}>+ Khách mới</button><button type="button" onClick={onInvoices}>Danh sách hóa đơn</button></div></div>
   <CustomerPicker searchOnly label="Khách hàng" value={customer?._id || ''} onChange={id=>{if(!id){setCustomer(null);resetSelection();}}} onCustomerChange={row=>{setCustomer(row);resetSelection();}} required disabled={busy}/>
   {initialAppointmentId && <div hidden>
   <AppointmentCheckoutPicker customerId={customer?._id} initialId={initialAppointmentId} selectedId={appointment?.appointment?._id} busy={busy} onSelect={detail=>{
     resetSelection();if(!detail)return;
     setCustomer(detail.customer);setAppointment(detail);
     if(detail.invoice)return;
     setServiceItems(detail.services.map((row:Row)=>({...row,lineId:crypto.randomUUID(),total:String(row.price),performerIds:detail.appointment.staffId ? [detail.appointment.staffId] : []})));
     setSessionItems(detail.treatments);setPerformerId(detail.appointment.staffId || '');
   }}/>
   </div>}
   {appointment?.invoice && <p>Điểm hẹn đã có hóa đơn. <button type="button" onClick={()=>onInvoice?.(appointment.invoice._id)}>Mở hóa đơn</button></p>}
 </section>
 <section className="panel panel-padded cashier-catalog">
   <h3>2. Thêm vào giỏ</h3>
   <div className="cashier-modes" role="group" aria-label="Danh mục thu ngân">{([['service','Dịch vụ lẻ'],['session','Dùng gói đã mua'],['package','Bán gói mới'],['product','Sản phẩm']] as const).map(([key,title])=><button type="button" key={key} disabled={busy} aria-pressed={browseMode===key} onClick={()=>{setBrowseMode(key);setSearch('');setCategory('');setCatalogPage(1);}}>{title}</button>)}</div>
   <label>{browseMode==='product'?'Tìm sản phẩm':browseMode==='package'?'Tìm gói để bán mới':browseMode==='session'?'Tìm gói đã mua':'Tìm dịch vụ lẻ'}<input type="search" maxLength={100} value={search} disabled={busy} placeholder="Nhập tên để tìm…" onChange={e=>{setSearch(e.target.value);setCatalogPage(1);}}/></label>
   {browseMode==='service' ? <div className="cashier-service-groups">{category ? <div className="section-head"><strong>{category}</strong><button type="button" disabled={busy} onClick={()=>{setCategory('');setSearch('');setCatalogPage(1);}}>← Các nhóm dịch vụ</button></div> : <><p>Chọn nhóm để xem dịch vụ</p><div className="cashier-cards" role="group" aria-label="Nhóm dịch vụ">{categories.map(name=><button type="button" className="cashier-card" key={name} disabled={busy} onClick={()=>{setCategory(name);setCatalogPage(1);}}><strong>{name}</strong><span>{allCatalog.filter(row=>categoryOf(row)===name).length} dịch vụ</span></button>)}</div></>}</div> : <label>{browseMode==='product'?'Nhóm sản phẩm':'Nhóm dịch vụ'}<select value={category} disabled={busy} onChange={e=>{setCategory(e.target.value);setCatalogPage(1);}}><option value="">Tất cả nhóm</option>{[...new Set([...categories,...(category?[category]:[])])].map(name=><option key={name} value={name}>{name}</option>)}</select></label>}
   {!showServiceGroups && <div className="cashier-cards">{visibleCatalog.map(row=>{
     const serviceCount=browseMode==='service' ? serviceItems.filter((item:Row)=>item._id===row._id).length : 0;
     const packageCount=browseMode==='package' ? packageItems.filter((item:Row)=>item._id===row._id).length : 0;
     const selected=browseMode==='service' ? serviceCount>0 : browseMode==='package' ? packageCount>0 : selectedItems.some(item=>item._id===row._id);
     return <button type="button" key={row._id} className={'cashier-card'+(selected?' is-selected':'')} aria-pressed={browseMode!=='service' ? selected : undefined} disabled={busy || !customer || (browseMode!=='service' && !selected && selectedItems.length>=30) || (browseMode==='service' && serviceItems.length>=30) || (browseMode==='product' && row.stock<1 && !selected)} onClick={()=>choose(row)}><strong>{row.name}</strong><span>{browseMode==='product'?'Tồn '+row.stock+' '+row.unit:browseMode==='package' || browseMode==='session'?packageLabel(row):row.category || 'Dịch vụ'}</span><b>{money(browseMode==='session'?0:row.price)}</b>{selected && <small>{browseMode==='service' ? 'Đã chọn x'+serviceCount : browseMode==='package' ? 'Đã chọn x'+packageCount : browseMode==='session' ? 'Đã chọn x'+sessionItems.filter(item=>item._id===row._id).length : 'Đã chọn ✓'}</small>}</button>;
   })}</div>}
   {!catalog.length && <p>{browseMode==='session'?'Chọn khách để xem các gói khả dụng, hoặc khách chưa có gói phù hợp.':'Không có mục phù hợp.'}</p>}
   {!showServiceGroups && actualPages>1 && <div className="customer-picker-pages"><button type="button" disabled={page<=1 || busy} onClick={()=>setCatalogPage(page-1)}>Trước</button><span>{page}/{actualPages}</span><button type="button" disabled={page>=actualPages || busy} onClick={()=>setCatalogPage(page+1)}>Sau</button></div>}
 </section>
 <section className="panel panel-padded cashier-receipt">
   <div className="section-head"><h3>3. Giỏ đã chọn ({basketCount})</h3>{basketCount>0 && <button type="button" className="cashier-clear-cart" aria-label="Xóa tất cả mục trong giỏ" title="Xóa tất cả mục trong giỏ" disabled={busy} onClick={resetSelection}>×</button>}</div>
   {!basketCount && <p>Chọn một hoặc nhiều dịch vụ, liệu trình, gói mới hoặc sản phẩm.</p>}
   <fieldset disabled={busy} className="cashier-fields">
   <GroupedCartLines items={serviceItems} label="Dịch vụ" renderItem={item=><div className="cashier-service-line" key={item.lineId || item._id}><div className="section-head"><strong>{item.name}</strong><button type="button" onClick={()=>setServiceItems(old=>removeServiceItem(old,item.lineId))}>Bỏ dịch vụ</button></div><label>Giá dịch vụ (VNĐ)<MoneyInput value={item.total} min={0} required onValueChange={total=>setServiceItems(old=>old.map(row=>row.lineId===item.lineId?{...row,total}:row))}/></label><div className="cashier-performers"><span>Kĩ thuật viên</span><PerformerMultiSelect staffOptions={staffOptions} selectedIds={item.performerIds || []} onChange={next=>setServiceItems(old=>updateServiceItemPerformers(old,item.lineId,next))} disabled={busy}/></div></div>}/>
   <GroupedCartLines items={sessionItems} label="Lượt dùng gói" renderItem={item=><div className="cashier-service-line" key={item.cartId || item._id}><div className="section-head"><strong>{item.name} · 0đ</strong><button type="button" onClick={()=>setSessionItems(old=>old.filter(row=>(row.cartId || row._id)!==(item.cartId || item._id)))}>Bỏ lượt</button></div><label>Kĩ thuật viên lượt này<select aria-label="Kĩ thuật viên lượt này" value={item.performerId || ''} onChange={e=>setSessionItems(old=>old.map(row=>(row.cartId || row._id)===(item.cartId || item._id)?{...row,performerId:e.target.value}:row))}><option value="">Chưa chọn</option>{staffOptions.map((row:Row)=><option key={row._id} value={row._id}>{row.name}</option>)}</select></label></div>}/>
   {productItems.map(item=><div className="cashier-service-line" key={item._id}><div className="section-head"><strong>{item.name}</strong><button type="button" onClick={()=>setProductItems(old=>old.filter(row=>row._id!==item._id))}>Bỏ sản phẩm</button></div><label>Số lượng ({item.unit})<input type="number" min={1} max={item.stock} step={1} required value={item.quantity} onChange={e=>setProductItems(old=>old.map(row=>row._id===item._id?{...row,quantity:e.target.value}:row))}/></label><label>Đơn giá (VNĐ)<MoneyInput value={item.unitPrice} min={0} required onValueChange={unitPrice=>setProductItems(old=>old.map(row=>row._id===item._id?{...row,unitPrice}:row))}/></label></div>)}
   <GroupedCartLines items={packageItems} label="Gói mới" renderItem={item=>{
     const pkgId = item.cartId || item._id;
     return <section className="cashier-service-line" key={pkgId}>
     <div className="section-head"><strong>Gói mới: {item.name} · {packageLabel(item)}</strong><button type="button" onClick={()=>setPackageItems(old=>old.filter(row=>(row.cartId || row._id)!==pkgId))}>Bỏ gói mới</button></div>
     <label>Giá gói (VNĐ)<MoneyInput value={item.total} min={0} required onValueChange={total=>updatePackage(pkgId,{total})}/></label>
     {(timedPackage(item)) && <label>Ngày bắt đầu<input type="date" required value={item.startsOn} onChange={e=>updatePackage(pkgId,{startsOn:e.target.value})}/><small>{timedPackage(item) && item.startsOn ? 'Dự kiến hết hạn: '+packageExpiry(item.startsOn,item.durationMonths):'Theo thỏa thuận gói.'} Gói triệt 36 tháng tính theo ngày mua.</small></label>}
     <label>Tên/ghi chú ưu đãi<input maxLength={2000} value={item.promotion} required={item.gifts.length>0 || amountOf(item.giftCashCardAmount)>0} placeholder="Ví dụ: ưu đãi tháng 10, mua gói tặng gội đầu" onChange={e=>updatePackage(pkgId,{promotion:e.target.value})}/><small>Ghi tên chương trình để tra cứu; cần nhập khi tặng dịch vụ hoặc thẻ tiền.</small></label>
     {item.gifts.map((gift:Row,index:number)=><div key={gift.id} className="gift-row"><label>Dịch vụ lẻ tặng 1 lần · 0đ<select required value={gift.serviceId} onChange={e=>updatePackage(pkgId,{gifts:item.gifts.map((row:Row,i:number)=>i===index?{...row,serviceId:e.target.value}:row)})}><option value="">Chọn dịch vụ tặng…</option>{data.services.filter((s:Row)=>s.active).map((s:Row)=><option key={s._id} value={s._id}>{s.name} · 1 lần</option>)}</select></label><button type="button" onClick={()=>updatePackage(pkgId,{gifts:item.gifts.filter((_:Row,i:number)=>i!==index)})}>Bỏ quà tặng</button></div>)}
     <button type="button" disabled={item.gifts.length>=20 || !data.services.some((s:Row)=>s.active)} onClick={()=>updatePackage(pkgId,{gifts:[...item.gifts,{id:crypto.randomUUID(),serviceId:''}]})}>+ Tặng dịch vụ lẻ 0đ</button>
     <label>Thẻ tiền tặng kèm (VNĐ)<MoneyInput value={item.giftCashCardAmount} min={0} required onValueChange={giftCashCardAmount=>updatePackage(pkgId,{giftCashCardAmount})}/></label>
   </section>;
   }}/>
   {packageItems.length>0 && <><SaleParticipants people={data.staff} value={participantIds} onChange={setParticipantIds} total={packageAmount} disabled={busy} showPreview={false}/></>}
   {sessionItems.length>0 && <TreatmentConfirmations key={JSON.stringify([sessionItems.map(row=>row._id),serviceItems.map(row=>[row._id,row.total]),productItems.map(row=>[row._id,row.quantity,row.unitPrice])])} treatments={sessionItems} disabled={busy} showPackageDetails={false}/>}
   {cardEligible && customer && <section><h3>Thẻ tiền cho phần dịch vụ lẻ</h3><InvoiceCardPayment key={cardContext} customerId={customer._id} total={Math.max(0,serviceAmount-(subtotal-amount))} disabled={busy} onAppliedChange={previewCard} defaultReceivedOn={issuedOn||data.today}/></section>}
   {serviceItems.length>1 && !sessionItems.length && !productItems.length && <p>Lưu hóa đơn trước, sau đó mở chi tiết hóa đơn để dùng thẻ hoặc thanh toán số còn nợ.</p>}
   </fieldset>
   {(serviceItems.length>0 || productItems.length>0 || packageItems.length>0) && <InvoiceDiscountFields subtotal={subtotal} value={discount} onChange={setDiscount} disabled={busy}/>}
   <div className="cashier-total"><span>Tổng thanh toán sau giảm</span><strong>{money(Number.isFinite(amount)?amount:0)}</strong></div>
   {appliedCard>0 && <div className="cashier-total"><span>Còn phải trả sau khi trừ thẻ</span><strong>{money(Math.max(0,amount-appliedCard))}</strong></div>}
   <label>Ngày hóa đơn (để trống: hôm nay)<input type="date" max={data.today} value={issuedOn} disabled={busy} onChange={e=>setIssuedOn(e.target.value)}/></label>
   <label>Hạn thanh toán<input type="date" name="dueDate" value={dueDate} disabled={busy} onChange={e=>setDueDate(e.target.value)}/></label>
   <small>Hạn thanh toán không bắt buộc. Để trống nếu chưa có hạn.</small>
   {basketCount>0&&appliedCard===0&&<CreationPayments issuedOn={issuedOn} today={data.today} total={amount} disabled={busy}/>}
   {error && <p className="negative" role="alert">{error}</p>}
   <button type="submit" className="primary cashier-save" disabled={busy || !customer || !basketCount || !!appointment?.invoice || (!!appointment && !['CONFIRMED','COMPLETED'].includes(appointment.appointment.status))}>{busy?'Đang lưu…':appointment?'Hoàn thành lịch & lưu hóa đơn':'Lưu toàn bộ giỏ'}</button>
   <small>Tiền chưa thu có thể thanh toán trên từng hóa đơn sau khi lưu. Gói đã mua không thu lại tiền buổi.</small>
 </section>
 </ValidatedForm>;
}
