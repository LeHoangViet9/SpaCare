// Reprice stored lines without consulting today's catalog or changing earned fixed commissions.
export function repriceInvoiceItems<T extends {total:number}>(items:T[], total:number):T[] {
  if(!Number.isSafeInteger(total) || total <= 0 || !items.length || items.some(i=>!Number.isSafeInteger(i.total) || i.total < 0)) throw new Error('Giá hóa đơn không hợp lệ.');
  const sum=items.reduce((n,i)=>n+BigInt(i.total),0n);
  if(sum === 0n) throw new Error('Giá hóa đơn không hợp lệ.');
  const parts=items.map(i=>Number(BigInt(i.total)*BigInt(total)/sum));
  let remainder=total-parts.reduce((n,v)=>n+v,0);
  for(let i=0;remainder>0;i++,remainder--) parts[i%parts.length]++;
  return items.map((item,i)=>({...item,total:parts[i]}));
}

export function invoiceDeletionBlock(invoice:{status?:string;paid?:number;cardPaid?:number;refunded?:number;saleCommissionAccrued?:number;openingBalance?:boolean;performedAt?:unknown;performedBy?:unknown;appointmentId?:unknown;treatmentId?:unknown;treatmentUseId?:unknown;giftOfInvoiceId?:unknown;productId?:unknown;kind?:string}):string {
  if(invoice.status !== 'CANCELLED') return 'Hủy hóa đơn trước khi xóa vĩnh viễn.';
  if(invoice.paid || invoice.cardPaid || invoice.refunded || invoice.saleCommissionAccrued) return 'Hóa đơn đã phát sinh thanh toán hoặc hoa hồng, không được xóa vĩnh viễn.';
  if(invoice.openingBalance || invoice.performedAt || invoice.performedBy || invoice.appointmentId || invoice.treatmentId || invoice.treatmentUseId || invoice.giftOfInvoiceId || invoice.productId || invoice.kind === 'PRODUCT' || invoice.kind === 'SESSION' || invoice.kind === 'GIFT') return 'Hóa đơn có dữ liệu vận hành hoặc chuyển số dư, chỉ được giữ trạng thái hủy.';
  return '';
}
