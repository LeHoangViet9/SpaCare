'use client';
import {useEffect,useState} from 'react';
import {invoiceDiscount,type InvoiceDiscountInput} from '@/lib/invoice-discount';
import {formatCurrency} from '@/lib/currency';
import InvoiceDiscountFields from './invoice-discount-fields';
type Program={_id:string;code:string;name:string;percent:number;updatedAt:string};
export function useInvoiceProgram(day:string,eligible:boolean){
 const key=eligible?day:'';
 const [state,setState]=useState<{key:string;program:Program|null;error:string}>({key:'',program:null,error:''});
 useEffect(()=>{
  if(!key)return;
  const controller=new AbortController();
  fetch('/api/discount-programs?day='+encodeURIComponent(day),{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Không tải được chương trình giảm giá.');return data.program||null;})
   .then(program=>setState({key,program,error:''})).catch(error=>{if(!controller.signal.aborted)setState({key,program:null,error:error.message});});
  return ()=>controller.abort();
 },[key,day]);
 return {program:key&&state.key===key?state.program:null,loading:!!key&&state.key!==key,error:key&&state.key===key?state.error:'',eligible};
}
export function InvoiceProgramDiscount({state,subtotal,value,onChange,disabled,manualAllowed=true}:{state:ReturnType<typeof useInvoiceProgram>;subtotal:number;value?:InvoiceDiscountInput;onChange:(value?:InvoiceDiscountInput)=>void;disabled?:boolean;manualAllowed?:boolean}){
 if(state.loading)return <p data-program-blocked role="status">Đang kiểm tra chương trình giảm giá…</p>;
 if(state.error)return <p data-program-blocked role="alert">{state.error} Tải lại form trước khi lưu.</p>;
 let automatic:ReturnType<typeof invoiceDiscount>|undefined;let previewError='';
 if(state.program)try{automatic=invoiceDiscount(subtotal,{type:'PERCENT',value:state.program.percent});}catch(e){previewError=(e as Error).message;}
 return <>{state.eligible&&<input type="hidden" name="discountProgram" value={JSON.stringify(state.program?{id:state.program._id,updatedAt:state.program.updatedAt}:null)}/>}
  {state.program?<section className="invoice-discount-fields" aria-label="Chương trình giảm giá áp dụng"><strong>{state.program.name}</strong>{automatic?<><p>Tự áp dụng {state.program.percent}% · Giảm {formatCurrency(automatic.discount?.amount||0)}</p><p>Tạm tính: {formatCurrency(subtotal)} · Tổng thanh toán sau giảm: {formatCurrency(automatic.total)}</p></>:<p data-program-blocked role="alert">{previewError}</p>}<p>Áp dụng một chương trình; không cộng thêm giảm thủ công.</p></section>:manualAllowed?<InvoiceDiscountFields subtotal={subtotal} value={value} onChange={onChange} disabled={disabled}/>:null}</>;
}
