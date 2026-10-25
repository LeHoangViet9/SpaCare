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

export function invoiceDeletionBlock(invoice:{openingBalance?:boolean;treatmentUseId?:unknown;giftOfInvoiceId?:unknown;refunded?:number}):string {
 if(invoice.openingBalance || invoice.treatmentUseId || invoice.giftOfInvoiceId) return 'Chứng từ mở đầu hoặc buổi liệu trình đã ký cần xử lý riêng, không xóa trực tiếp.';
 if(invoice.refunded) return 'Hóa đơn đã có hoàn tiền cần đối soát riêng.';
 return '';
}
