import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {Treatment,TreatmentUse} from '../src/lib/models';
import {readInvoicePackageProgress} from '../src/lib/invoice-package-progress';
import {invoiceExportDocument} from '../src/lib/export-read';
import {renderPdf} from '../src/lib/render-pdf';

const spaId='a'.repeat(24),customerId='b'.repeat(24),invoiceId='c'.repeat(24);
const packageId='d'.repeat(24),secondId='e'.repeat(24);
let plans:any[]=[{_id:packageId,invoiceId,packageType:'SESSIONS',totalSessions:10,remaining:10}];
let uses:any[]=[];
const bill:any={_id:invoiceId,customerId,kind:'PACKAGE',description:'Gói liệu trình',total:1000000,paid:500000,
  packageItems:[{treatmentId:packageId,name:'Gói chăm sóc da',total:1000000}]};
const query=(rows:any[])=>({select(){return this;},async lean(){return structuredClone(rows);}});
mock.method(Treatment,'find',(filter:any)=>{
  assert.equal(filter.spaId,spaId);assert.equal(filter.customerId,customerId);
  assert.equal(filter.$or[0].invoiceId,bill._id);
  return query(plans);
});
mock.method(TreatmentUse,'find',(filter:any)=>{
  assert.equal(filter.spaId,spaId);assert.deepEqual(filter.treatmentId.$in,plans.filter(p=>p.packageType!=='TIME'&&!p.openingBalance&&p.totalSessions>0).map(p=>p._id));
  return query(uses);
});
const savedUse=(treatmentId:string,number:number,remainingBefore:number,checkoutInvoiceId='visit')=>({
  _id:`${treatmentId}-${number}`,treatmentId,sessionNumber:number,checkoutInvoiceId,
  snapshot:JSON.stringify({remainingBefore}),
});
async function print(){
  const before=JSON.stringify({bill,plans,uses});
  const progress=await readInvoicePackageProgress(spaId,bill);
  const doc=invoiceExportDocument({invoice:bill,customer:{name:'Khách thử'},gifts:[],adjustments:[]} as any,progress);
  assert.equal(JSON.stringify({bill,plans,uses}),before,'printing cannot mutate invoice or package history');
  assert.equal(doc.tables.at(-1)!.rows.find(row=>row[0]==='Đã trả')![1].replace(/\D/g,''),'500000');
  return doc;
}
let doc=await print();
assert.equal(doc.tables[1].rows[0][0],'Gói chăm sóc da\nCòn lại: 10 buổi');
uses=[savedUse(packageId,1,10)];plans[0].remaining=9;
doc=await print();assert.equal(doc.tables[1].rows[0][0],'Gói chăm sóc da\nBuổi đang thực hiện: 1/10\nCòn lại: 9 buổi');
uses=[savedUse(packageId,3,8),savedUse(packageId,1,10),savedUse(packageId,2,9)];plans[0].remaining=7;
doc=await print();assert.match(doc.tables[1].rows[0][0],/Buổi đang thực hiện: 3\/10\nCòn lại: 7 buổi/);
uses[0].snapshot='legacy non-JSON snapshot';
doc=await print();assert.match(doc.tables[1].rows[0][0],/3\/10\nCòn lại: 7 buổi/);
// More than the five signatures displayed per page must still use the latest visit.
uses=Array.from({length:7},(_,i)=>savedUse(packageId,i+1,10-i));plans[0].remaining=3;
doc=await print();assert.match(doc.tables[1].rows[0][0],/7\/10\nCòn lại: 3 buổi/);
plans.push({_id:secondId,invoiceId,packageType:'SESSIONS',totalSessions:5,remaining:3});
uses.push(savedUse(secondId,2,4));bill.packageItems.push({treatmentId:secondId,name:'Gói massage',total:0});
doc=await print();assert.match(doc.tables[1].rows[1][0],/2\/5\nCòn lại: 3 buổi/);
// Each saved session follows its explicit line identity and excludes later visits.
bill._id='session-invoice';bill.kind='SESSION';bill.packageItems=[];
bill.treatmentSessions=[{lineId:'one',treatmentId:packageId,treatmentUseId:`${packageId}-3`,name:'Buổi chăm sóc',total:0},
  {lineId:'two',treatmentId:secondId,treatmentUseId:`${secondId}-2`,name:'Buổi massage',total:0}];
bill.serviceItems=[{lineId:'one',name:'Buổi chăm sóc',total:0},{lineId:'two',name:'Buổi massage',total:0},{lineId:'extra',name:'Dịch vụ lẻ',total:1000000}];
doc=await print();
assert.match(doc.tables[1].rows[0][0],/3\/10\nCòn lại: 7 buổi/);
assert.match(doc.tables[1].rows[1][0],/2\/5\nCòn lại: 3 buổi/);
assert.doesNotMatch(doc.tables[1].rows[2][0],/Buổi đang thực hiện|Còn lại:/);
// TIME and imported packages have no known original quota to print as X/Y.
plans[0].packageType='TIME';plans[1].openingBalance=true;
doc=await print();assert.doesNotMatch(JSON.stringify(doc),/Buổi đang thực hiện|Còn lại:/);
plans=[];uses=[];bill.kind='PRODUCT';bill.serviceItems=[];bill.treatmentSessions=[];
bill.productItems=[{name:'Gói 10 buổi (tên sản phẩm)',quantity:1,unitPrice:1000000,total:1000000}];
doc=await print();assert.doesNotMatch(JSON.stringify(doc),/Buổi đang thực hiện|Còn lại:/);
// Legacy PACKAGE invoices still use the explicit Treatment.invoiceId association.
bill._id=invoiceId;bill.kind='PACKAGE';bill.productItems=[];
plans=[{_id:packageId,invoiceId,totalSessions:10,remaining:7}];uses=[savedUse(packageId,3,8)];
doc=await print();assert.match(doc.tables[1].rows[0][0],/3\/10\nCòn lại: 7 buổi/);

const drawn:{text:string;x:number}[]=[];
const context:any={measureText:(text:string)=>({width:text.length*10}),fillText:(text:string,x:number)=>drawn.push({text,x}),fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){},drawImage(){}};
(globalThis as any).document={fonts:{ready:Promise.resolve()},createElement:()=>({width:0,height:0,getContext:()=>context,toDataURL:()=>`data:image/jpeg;base64,${Buffer.from([255,216,255,217]).toString('base64')}`})};
const file=await renderPdf(doc);
assert.match(Buffer.from(await file.arrayBuffer()).toString('latin1'),/\/MediaBox \[0 0 226\.77 /);
for(const label of ['Buổi đang thực hiện: 3/10','Còn lại: 7 buổi']){
  const text=drawn.find(row=>row.text===label);assert.ok(text,label);
  assert.ok(text.x+context.measureText(text.text).width<=648,'package text stays within receipt width');
}
assert.ok(drawn.some(row=>row.text==='Cảm ơn và hẹn gặp lại Quý khách!'));
mock.restoreAll();
