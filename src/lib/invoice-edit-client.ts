type Row=Record<string,any>;
export function hasInvoiceEditContext(context:any):boolean{
  return !!context?.client&&!!context?.source&&!!context?.locks&&!!context?.catalogs&&
    ['serviceItems','productItems','packageItems'].every(key=>Array.isArray(context.client[key])&&Array.isArray(context.source[key]))&&
    Array.isArray(context.source.treatmentSessions)&&Array.isArray(context.locks.services)&&Array.isArray(context.locks.packages)&&
    Array.isArray(context.references?.gifts)&&Array.isArray(context.references?.giftCards)&&
    ['staff','services','products','packageTemplates'].every(key=>Array.isArray(context.catalogs[key]));
}
export async function loadInvoiceAdjustment(id:string,mode:'CORRECT'|'VOID',signal?:AbortSignal):Promise<Row>{
  const response=await fetch('/api/invoices/'+encodeURIComponent(id)+'?edit=1',{cache:'no-store',signal});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Không tải được thông tin hóa đơn.');
  if(String(result.invoice?._id)!==id)throw Error('Dữ liệu trả về không đúng hóa đơn đang sửa.');
  if(mode==='CORRECT'&&!hasInvoiceEditContext(result.editContext))throw Error('Chưa tải được nội dung và kỹ thuật viên của hóa đơn. Tải lại; không thể lưu form thiếu dữ liệu.');
  return {...result.invoice,editContext:result.editContext,payments:result.payments||[],adjustmentContext:result.adjustmentContext,
    customerName:result.customer?.name,customerPhone:result.customer?.phone};
}
