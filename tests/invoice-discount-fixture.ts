import assert from 'node:assert/strict';
import {invoiceDiscount,invoiceSummary} from '../src/lib/invoice-discount';
import {invoiceExportDocument} from '../src/lib/export-read';
import {Invoice} from '../src/lib/models';
import {renderPdf} from '../src/lib/render-pdf';
import {MAX_MONEY,invoiceState,allocationResult} from '../src/lib/rules';

assert.deepEqual(invoiceDiscount(2300000,{type:'AMOUNT',value:300000}),{subtotal:2300000,discount:{type:'AMOUNT',value:300000,amount:300000},total:2000000});
assert.equal(invoiceDiscount(2300000,{type:'PERCENT',value:10}).total,2070000);
assert.equal(invoiceDiscount(15,{type:'PERCENT',value:10}).discount?.amount,2);
for(const subtotal of [0,1,MAX_MONEY])for(const type of ['AMOUNT','PERCENT'] as const){
  assert.equal(invoiceDiscount(subtotal,{type,value:0}).total,subtotal);
  assert.equal(invoiceDiscount(subtotal,{type,value:type==='AMOUNT'?subtotal:100}).total,0);
}
for(const input of [{type:'AMOUNT',value:-1},{type:'AMOUNT',value:1001},{type:'AMOUNT',value:0.1},{type:'PERCENT',value:101},{type:'PERCENT',value:-1},{type:'PERCENT',value:1.5},{type:'PERCENT',value:NaN},{type:'OTHER',value:1}]){
  assert.throws(()=>invoiceDiscount(1000,input as any));
}
assert.throws(()=>invoiceDiscount(MAX_MONEY+1));
assert.equal(invoiceState(invoiceDiscount(1000,{type:'PERCENT',value:20}).total,300),'PARTIALLY_PAID');
assert.deepEqual(allocationResult(1000,800,500),{balance:500,due:300});
assert.throws(()=>allocationResult(1000,800,801));
assert.deepEqual(invoiceSummary({total:500}),{subtotal:500,discountAmount:0,adjustment:0});

const bill=new Invoice({spaId:'a'.repeat(24),customerId:'b'.repeat(24),kind:'SERVICE',description:'Test',paid:500,...invoiceDiscount(1000,{type:'PERCENT',value:20})});
await bill.validate();
const stored=JSON.parse(JSON.stringify(bill.toObject()));
assert.deepEqual(stored.discount,{type:'PERCENT',value:20,amount:200});
assert.equal(stored.subtotal,1000);assert.equal(stored.total,800);
const doc=invoiceExportDocument({invoice:{...stored,kind:'PACKAGE',creatorName:'Thu ngân',serviceItems:[
  {lineId:'1',name:'Dịch vụ A',total:400,performerName:'Thư'},
  {lineId:'2',name:'Dịch vụ A',total:300,performerName:'Quỳnh'},
  {lineId:'3',name:'Dịch vụ B',total:0},
],packageItems:[{name:'Gói mới',total:200}],productItems:[{name:'Sản phẩm',quantity:1,unit:'chai',unitPrice:100,total:100}],
  treatmentSessions:[{lineId:'4',name:'Buổi gói',total:0,performerName:'An'}]},customer:{name:'Khách thử',phone:'0900000000'},gifts:[],adjustments:[]} as any);
const rows=doc.tables[1].rows;
assert.equal(rows.length,6,'mixed bill preserves every line');
assert.deepEqual(rows.slice(1,5).map(row=>row[0]),['Dịch vụ A\nKỹ thuật viên: Thư','Dịch vụ A\nKỹ thuật viên: Quỳnh','Dịch vụ B\nKỹ thuật viên: Chưa có','Buổi gói\nKỹ thuật viên: An']);
const summary=doc.tables.at(-1)!.rows;
assert.deepEqual(summary.slice(0,5).map(row=>row[0]),['Tạm tính','Giảm giá (20%)','Tổng thanh toán sau giảm','Đã trả','Còn nợ']);
assert.deepEqual(summary.slice(0,5).map(row=>Number(row[1].replace(/[^\d]/g,''))),[1000,200,800,500,300]);
assert.doesNotMatch(doc.notes.join('\n'),/Bản PDF tra cứu|Số tiền phản ánh/);
assert.deepEqual(invoiceSummary({...stored,total:0}),{subtotal:1000,discountAmount:200,adjustment:-800});

// Exercise the renderer, recording text drawn to the real PDF image pipeline.
const text:string[]=[];
const context:any={measureText:(s:string)=>({width:s.length*10}),fillText:(s:string)=>text.push(s),fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){},drawImage(){}};
(globalThis as any).document={fonts:{ready:Promise.resolve()},createElement:()=>({width:0,height:0,getContext:()=>context,toDataURL:()=>`data:image/jpeg;base64,${Buffer.from([255,216,255,217]).toString('base64')}`})};
const file=await renderPdf(doc);
assert.equal(file.type,'application/pdf');assert.ok(file.size>0);
assert.ok(text.includes('Cảm ơn và hẹn gặp lại Quý khách!'));
assert.ok(text.includes('Kỹ thuật viên: Quỳnh'));
assert.ok(text.includes('Tổng thanh toán sau giảm'));
assert.ok(!text.some(s=>/Xuất lúc:|Bản PDF tra cứu|Số tiền phản ánh/.test(s)));
