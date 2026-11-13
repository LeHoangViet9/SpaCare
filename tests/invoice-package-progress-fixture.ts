import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {Treatment,TreatmentUse} from '../src/lib/models';
import {readInvoicePackageProgress} from '../src/lib/invoice-package-progress';
import {invoiceExportDocument} from '../src/lib/export-read';
import {renderPdf} from '../src/lib/render-pdf';

const spaId='a'.repeat(24),customerId='b'.repeat(24),invoiceId='c'.repeat(24);
const packageId='d'.repeat(24),secondId='e'.repeat(24);
let plans:any[]=[{_id:packageId,invoiceId,name:'Gói chăm sóc da',packageType:'SESSIONS',totalSessions:10,remaining:10}];
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
  assert.equal(filter.spaId,spaId);assert.deepEqual(filter.treatmentId.$in,plans.filter(p=>p.packageType==='TIME'||!p.openingBalance&&Number.isSafeInteger(p.totalSessions)&&p.totalSessions>0).map(p=>p._id));
  return query(uses);
});
const savedUse=(treatmentId:string,number:number,remainingBefore:number,checkoutInvoiceId='visit')=>({
  _id:`${treatmentId}-${number}`,treatmentId,sessionNumber:number,checkoutInvoiceId,
  snapshot:JSON.stringify({name:plans.find(plan=>plan._id===treatmentId)?.name,remainingBefore}),
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
doc=await print();assert.equal(doc.tables[1].rows[0][0],'Gói chăm sóc da\nBuổi 1/10 · Còn lại: 9 buổi');
uses=[savedUse(packageId,3,8),savedUse(packageId,1,10),savedUse(packageId,2,9)];plans[0].remaining=7;
doc=await print();assert.match(doc.tables[1].rows[0][0],/Buổi 3\/10 · Còn lại: 7 buổi/);
uses[0].snapshot='legacy non-JSON snapshot';
doc=await print();assert.match(doc.tables[1].rows[0][0],/3\/10 · Còn lại: 7 buổi/);
// More than the five signatures displayed per page must still use the latest visit.
uses=Array.from({length:7},(_,i)=>savedUse(packageId,i+1,10-i));plans[0].remaining=3;
doc=await print();assert.match(doc.tables[1].rows[0][0],/7\/10 · Còn lại: 3 buổi/);
plans.push({_id:secondId,invoiceId,name:'Gói massage',packageType:'SESSIONS',totalSessions:5,remaining:3});
uses.push(savedUse(secondId,2,4));bill.packageItems.push({treatmentId:secondId,name:'Gói massage',total:0});
doc=await print();assert.match(doc.tables[1].rows[1][0],/2\/5 · Còn lại: 3 buổi/);
// Each saved session follows its explicit line identity and excludes later visits.
bill._id='session-invoice';bill.kind='SESSION';bill.packageItems=[];
bill.treatmentSessions=[{lineId:'one',treatmentId:packageId,treatmentUseId:`${packageId}-3`,name:'Buổi chăm sóc',total:0},
  {lineId:'two',treatmentId:secondId,treatmentUseId:`${secondId}-2`,name:'Buổi massage',total:0}];
bill.serviceItems=[{lineId:'one',name:'Buổi chăm sóc',total:0},{lineId:'two',name:'Buổi massage',total:0},{lineId:'extra',name:'Dịch vụ lẻ',total:1000000}];
doc=await print();
assert.match(doc.tables[1].rows[0][0],/3\/10 · Còn lại: 7 buổi/);
assert.match(doc.tables[1].rows[1][0],/2\/5 · Còn lại: 3 buổi/);
assert.doesNotMatch(doc.tables[1].rows[2][0],/Buổi đang thực hiện|Còn lại:/);
// TIME keeps its own invoice's saved visit, even when later visits exist.
plans[0].packageType='TIME';delete plans[0].totalSessions;delete plans[0].remaining;
plans[0].usedSessions=99;plans[1].openingBalance=true;
doc=await print();assert.match(doc.tables[1].rows[0][0],/ · Buổi 3\nKỹ thuật viên:/);
assert.doesNotMatch(JSON.stringify(doc),/Buổi đang thực hiện|Còn lại:/);
// Two TIME visits of the same plan on one invoice retain distinct recorded numbers.
bill.treatmentSessions[1]={lineId:'two',treatmentId:packageId,treatmentUseId:`${packageId}-2`,name:'Buổi gói thứ hai',total:0};
doc=await print();
assert.match(doc.tables[1].rows[0][0],/ · Buổi 3\nKỹ thuật viên:/);
assert.match(doc.tables[1].rows[1][0],/ · Buổi 2\nKỹ thuật viên:/);
assert.doesNotMatch(doc.tables[1].rows[2][0],/\nBuổi \d|Còn lại:/);
// A legitimate TIME total is independent of its saved usage-counter snapshot.
plans[0].totalSessions=10;
uses.find(use=>use.sessionNumber===2&&use.treatmentId===packageId)!.snapshot=JSON.stringify({packageType:'TIME',remainingBefore:1});
doc=await print();assert.match(doc.tables[1].rows[1][0],/2\/10 · Còn lại: 8 buổi/);
// Sales show the latest saved TIME visit; missing/invalid quotas cannot invent a balance.
bill._id=invoiceId;bill.kind='PACKAGE';bill.serviceItems=[];bill.treatmentSessions=[];
bill.packageItems=[{treatmentId:packageId,name:'Gói TIME',total:1000000}];
for(const total of [undefined,0,-1,2.5,NaN,Infinity]){
  plans[0].totalSessions=total;
  doc=await print();assert.equal(doc.tables[1].rows[0][0],'Gói TIME\nBuổi 7');
  const progress=await readInvoicePackageProgress(spaId,bill);
  assert.equal(progress[0].sessionNumber,7);
  assert.equal(Object.hasOwn(progress[0],'remaining'),false);
  assert.equal(Object.hasOwn(progress[0],'totalSessions'),false);
}
// Unused TIME packages have no current visit or finite remaining count.
uses=[];
doc=await print();assert.equal(doc.tables[1].rows[0][0],'Gói TIME');
plans[0].totalSessions=10;
doc=await print();assert.equal(doc.tables[1].rows[0][0],'Gói TIME\nCòn lại: 10 buổi');
// Mixed sale rows retain an independent finite balance and unlimited TIME visit.
plans[1]={_id:secondId,invoiceId,name:'Gói massage',packageType:'SESSIONS',totalSessions:5,remaining:3};
delete plans[0].totalSessions;
uses=[savedUse(packageId,2,1),savedUse(secondId,2,4)];
bill.packageItems.push({treatmentId:secondId,name:'Gói 5 buổi',total:0});
doc=await print();
assert.equal(doc.tables[1].rows[0][0],'Gói TIME\nBuổi 2');
assert.equal(doc.tables[1].rows[1][0],'Gói 5 buổi\nBuổi 2/5 · Còn lại: 3 buổi');
// Legacy TIME SESSION references still select their exact use, not the latest one.
bill._id='legacy-session';bill.kind='SESSION';bill.packageItems=[];
bill.treatmentId=packageId;bill.treatmentUseId=`${packageId}-2`;
uses.push(savedUse(packageId,8,7));
doc=await print();assert.match(doc.tables[1].rows[0][0],/ · Buổi 2\nKỹ thuật viên:/);
// checkoutInvoiceId alone is also a valid saved link for a TIME visit.
delete bill.treatmentUseId;
uses[0].checkoutInvoiceId=bill._id;
doc=await print();assert.match(doc.tables[1].rows[0][0],/ · Buổi 2\nKỹ thuật viên:/);
uses[0].sessionNumber=0;
doc=await print();assert.doesNotMatch(JSON.stringify(doc),/\nBuổi \d|Còn lại:/);
delete bill.treatmentId;
plans=[];uses=[];bill.kind='PRODUCT';bill.serviceItems=[];bill.treatmentSessions=[];
bill.productItems=[{name:'Gói 10 buổi (tên sản phẩm)',quantity:1,unitPrice:1000000,total:1000000}];
doc=await print();assert.doesNotMatch(JSON.stringify(doc),/Buổi đang thực hiện|Còn lại:/);
// Legacy PACKAGE invoices still use the explicit Treatment.invoiceId association.
bill._id=invoiceId;bill.kind='PACKAGE';bill.productItems=[];
plans=[{_id:packageId,invoiceId,name:'Gói chăm sóc da',totalSessions:10,remaining:7}];uses=[savedUse(packageId,3,8)];
doc=await print();assert.match(doc.tables[1].rows[0][0],/3\/10 · Còn lại: 7 buổi/);

const drawn:{text:string;x:number}[]=[];
const context:any={measureText:(text:string)=>({width:text.length*10}),fillText:(text:string,x:number)=>drawn.push({text,x}),fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){},drawImage(){}};
(globalThis as any).document={fonts:{ready:Promise.resolve()},createElement:()=>({width:0,height:0,getContext:()=>context,toDataURL:()=>`data:image/jpeg;base64,${Buffer.from([255,216,255,217]).toString('base64')}`})};
const file=await renderPdf(doc);
assert.match(Buffer.from(await file.arrayBuffer()).toString('latin1'),/\/MediaBox \[0 0 226\.77 /);
for(const label of ['Buổi 3/10 · Còn lại: 7 buổi']){
  const text=drawn.find(row=>row.text===label);assert.ok(text,label);
  assert.ok(text.x+context.measureText(text.text).width<=648,'package text stays within receipt width');
}
assert.ok(drawn.some(row=>row.text==='Cảm ơn và hẹn gặp lại Quý khách!'));
// The same renderer keeps mixed TIME/finite progress within the 80mm receipt.
bill.packageItems=[{treatmentId:packageId,name:'Gói theo thời hạn',total:1000000},{treatmentId:secondId,name:'Gói theo buổi',total:0}];
plans=[{_id:packageId,invoiceId,name:'Gói TIME',packageType:'TIME'},
  {_id:secondId,invoiceId,name:'Gói massage',packageType:'SESSIONS',totalSessions:10,remaining:8}];
uses=[savedUse(packageId,2,1),savedUse(secondId,2,9)];
drawn.length=0;
doc=await print();await renderPdf(doc);
for(const label of ['Buổi 2','Buổi 2/10 · Còn lại: 8 buổi']){
  const text=drawn.find(row=>row.text===label);assert.ok(text,label);
  assert.ok(text.x+context.measureText(text.text).width<=648,'mixed TIME progress stays within receipt width');
}
// Normalize a real stored session line from separate names, never by stripping "Buổi".
bill._id='normalized-session';bill.kind='SESSION';bill.packageItems=[];
plans=[{_id:packageId,invoiceId,name:'Tên hiện tại đã đổi',packageType:'TIME'},
  {_id:secondId,invoiceId,name:'Gói Buổi Sáng',packageType:'SESSIONS',totalSessions:10,remaining:8}];
uses=[{...savedUse(packageId,2,1),snapshot:JSON.stringify({name:'linda',remainingBefore:1})},savedUse(secondId,2,9)];
bill.treatmentSessions=[{lineId:'time',treatmentId:packageId,treatmentUseId:`${packageId}-2`,name:'linda · Buổi 2',total:0},
  {lineId:'finite',treatmentId:secondId,treatmentUseId:`${secondId}-2`,name:'Gói Buổi Sáng · Buổi 2',total:0}];
bill.serviceItems=[{lineId:'time',name:'linda · Buổi 2',total:0,performerName:'Thư'},
  {lineId:'finite',name:'Gói Buổi Sáng · Buổi 2',total:0,performerName:'Quỳnh'}];
doc=await print();
assert.equal(doc.tables[1].rows[0][0],'linda · Buổi 2\nKỹ thuật viên: Thư');
assert.equal(doc.tables[1].rows[0][0].split('Buổi 2').length-1,1);
assert.equal(doc.tables[1].rows[1][0],'Gói Buổi Sáng\nKỹ thuật viên: Quỳnh\nBuổi 2/10 · Còn lại: 8 buổi');
assert.equal(doc.tables[1].rows[1][0].split('Buổi 2').length-1,1);
// Invoice text cannot override the exact use's saved ordinal or historical package name.
bill.serviceItems[0].name='linda · Buổi 99';
doc=await print();assert.equal(doc.tables[1].rows[0][0],'linda · Buổi 2\nKỹ thuật viên: Thư');
// A literal numbered word in the package name is preserved in full.
plans[1].name='Gói Buổi 2';uses[1].snapshot=JSON.stringify({name:'Gói Buổi 2',remainingBefore:9});
doc=await print();assert.equal(doc.tables[1].rows[1][0],'Gói Buổi 2\nKỹ thuật viên: Quỳnh\nBuổi 2/10 · Còn lại: 8 buổi');
// Multiple finite visits of one package also resolve by their exact use ID.
bill.treatmentSessions[0]={lineId:'time',treatmentId:secondId,treatmentUseId:`${secondId}-1`,name:'Gói Buổi 2 · Buổi 1',total:0};
uses.push({...savedUse(secondId,1,10),snapshot:JSON.stringify({name:'Gói Buổi 2',remainingBefore:10})});
doc=await print();assert.match(doc.tables[1].rows[0][0],/\nBuổi 1\/10 · Còn lại: 9 buổi$/);
assert.match(doc.tables[1].rows[1][0],/\nBuổi 2\/10 · Còn lại: 8 buổi$/);
// Legacy recipient details remain present when rebuilding the printed title.
bill.treatmentSessions[0]={lineId:'time',treatmentId:packageId,treatmentUseId:`${packageId}-2`,name:'linda · Buổi 2 (Khách cũ)',total:0};
uses[0].snapshot=JSON.stringify({name:'linda',isShared:true,recipientName:'Khách cũ'});
doc=await print();assert.equal(doc.tables[1].rows[0][0],'linda · Buổi 2 (Khách cũ)\nKỹ thuật viên: Thư');
// With no separate historical or current name, retain legacy text intact.
delete plans[0].name;uses[0].snapshot='legacy';bill.serviceItems[0].name='Gói Buổi Sáng · Buổi 2';
doc=await print();assert.equal(doc.tables[1].rows[0][0],'Gói Buổi Sáng · Buổi 2\nKỹ thuật viên: Thư');
mock.restoreAll();
