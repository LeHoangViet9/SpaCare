import assert from 'node:assert/strict';
import {optionalInvoiceDeadline,visibleInvoiceDeadline} from '../src/lib/invoice-deadline';
import {invoiceExportDocument} from '../src/lib/export-read';
import {renderPdf} from '../src/lib/render-pdf';
import {invoiceDiscount} from '../src/lib/invoice-discount';

assert.equal(optionalInvoiceDeadline.parse(undefined),undefined);
assert.equal(optionalInvoiceDeadline.parse(''),undefined);
assert.equal(optionalInvoiceDeadline.parse('2028-02-29'),'2028-02-29');
for(const value of ['2026-02-29','2026-02-30','2026-13-01','2026-00-01','11/11/2026','2026-11-11T00:00:00Z',null,123])assert.equal(optionalInvoiceDeadline.safeParse(value).success,false);
const recorded:string[]=[];
const context:any={measureText:(s:string)=>({width:s.length*10}),fillText:(s:string)=>recorded.push(s),fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){},drawImage(){}};
(globalThis as any).document={fonts:{ready:Promise.resolve()},createElement:()=>({width:0,height:0,getContext:()=>context,toDataURL:()=>`data:image/jpeg;base64,${Buffer.from([255,216,255,217]).toString('base64')}`})};

for(const [paid,dueDate,status,visible]of [
  [300,'2026-12-01','OPEN',true],
  [300,undefined,'PARTIALLY_PAID',false],
  [300,'','OPEN',false],
  [800,'2026-12-01','OPEN',false], // paid in full after discount, stale status
  [0,'2026-12-01','PAID',true],   // actual debt despite stale paid status
  [900,'2026-12-01','PARTIALLY_PAID',false],
] as const){
  const invoice={code:'HD000001',kind:'SERVICE',...invoiceDiscount(1000,{type:'PERCENT' as const,value:20}),paid,dueDate,status};
  const before=JSON.stringify(invoice);
  assert.equal(visibleInvoiceDeadline(invoice),visible?dueDate:undefined);
  const doc=invoiceExportDocument({invoice,customer:{name:'Synthetic'},gifts:[],adjustments:[]} as any);
  assert.deepEqual(doc.tables.at(-1)!.rows.filter(row=>row[0]==='Hạn thanh toán'),visible?[['Hạn thanh toán',dueDate]]:[]);
  recorded.length=0;await renderPdf(doc);
  assert.equal(recorded.includes('Hạn thanh toán'),visible);
  assert.equal(JSON.stringify(invoice),before,'rendering never modifies saved deadline or financial fields');
}
