import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Invoice, Customer, Treatment, TreatmentUse, Audit, Spa, Appointment, Payment, CashEntry, User } from '../src/lib/models';
import { invoiceExport } from '../src/lib/export-read';
import { readTreatmentSignature } from '../src/lib/treatment-signature';
import { readInvoice } from '../src/lib/invoice-read';
import { StockMovement, Allocation, CashCard, CashCardUse, Commission, Day, InvoiceLineCommission, SaleCommission, SharedSaleCommission } from '../src/lib/models';
import type { Actor } from '../src/lib/auth';
const id = 'a'.repeat(24), spaId = 'b'.repeat(24), packageId = 'c'.repeat(24), actorId = 'd'.repeat(24);
const signature = { version: 1, strokes: [[[0, 0], [0.2, 0.2], [0.4, 0.3]]] };
const invoice = { _id: id, customerId: 'e'.repeat(24), appointmentId: 'f'.repeat(24), total: 2000000, paid: 1500000, refunded: 100000, description: 'Package' };
let queried: any, offset = 0;
function query(result: any) {
  return { select() { return this; }, sort() { return this; }, skip(n: number) { offset = n; return this; }, limit(n: number) { assert.equal(n, 5); return this; }, async lean() { return result; } };
}
mock.method(Invoice, 'findOne', () => query(invoice));
mock.method(Invoice, 'find', () => query([]));
mock.method(Payment, 'find', () => query([]));
mock.method(CashEntry, 'find', () => query([]));
mock.method(Customer, 'findOne', () => query({ name: 'Customer', phone: '0329357116' }));
mock.method(Spa, 'findById', () => query({ name: 'SpaCare' }));
mock.method(Treatment, 'find', () => query([{ _id: packageId, name: 'Package' }]));
mock.method(TreatmentUse, 'countDocuments', async (filter: any) => { queried = filter; return 7; });
mock.method(TreatmentUse, 'find', () => query([{ _id: 'use', treatmentId: packageId, actorId, signature, sessionNumber: 2, performedAt: new Date() }]));
mock.method(Audit, 'find', () => query([]));
mock.method(Appointment, 'find', () => query([{ _id: 'appointment', staffId: actorId, status: 'COMPLETED', treatmentId: 'treatment' }]));
const owner: Actor = { id: actorId, spaId, name: 'Owner', role: 'OWNER', cashier: true };
for(const model of [Payment,CashCard,Commission,InvoiceLineCommission,SaleCommission,SharedSaleCommission])mock.method(model,'find',()=>query([]));
for(const model of [StockMovement,TreatmentUse,Appointment,Allocation,CashCardUse,SaleCommission,SharedSaleCommission])mock.method(model,'exists',async(filter:any)=>{assert.equal(filter.spaId,spaId);return null;});
mock.method(Day,'findOne',()=>query(null));
const result = await readInvoice(owner, id, 99);
assert.equal(result.signaturePage, 2);
assert.equal(offset, 5);
assert.equal(result.signatureTotal, 7);
assert.deepEqual(result.signatures[0].signature, signature);
assert.equal(result.signatures[0].packageName, 'Package');
assert.equal(queried.spaId, spaId);
assert.ok(queried.$and[0].$or.some((c: any) => c.appointmentId === invoice.appointmentId));
assert.ok(queried.$and[0].$or.some((c: any) => c.treatmentId?.$in.includes(packageId)));
await readInvoice({ ...owner, role: 'STAFF' }, id);
assert.deepEqual(queried.$and[1], { $or: [{ actorId }, { staffId: actorId }] });
const pdf = await invoiceExport(owner, id);
assert.ok(pdf.tables[0].rows.some(row => row.includes('0329357116')));
assert.deepEqual(pdf.tables[2].rows.slice(0,4).map(row=>row[1].replace(/[^\d]/g,'')),['2000000','1500000','100000','500000']);
invoice.total=0; invoice.paid=0; invoice.refunded=0;
const free=await invoiceExport(owner,id);
assert.equal(free.tables[2].rows[0][1].replace(/[^\d]/g,''),'0');
await assert.rejects(invoiceExport({...owner,role:'CUSTOMER'},id),(e:any)=>e.status===403);

let source:any={_id:'source',actorId,staffId:actorId,signature};
let sourceFilter:any;
mock.method(TreatmentUse,'findOne',(filter:any)=>{sourceFilter=filter;return query(source);});
const shared={actorId,staffId:actorId,customerId:'customer',checkoutInvoiceId:'checkout',confirmationUseId:'source'};
assert.deepEqual(await readTreatmentSignature(owner,shared),signature);
assert.deepEqual(sourceFilter,{_id:'source',spaId,customerId:'customer',checkoutInvoiceId:'checkout'});
assert.equal(await readTreatmentSignature(owner,{actorId}),null,'unsigned record has no fabricated signature');
await assert.rejects(readTreatmentSignature({...owner,role:'STAFF',id:'unauthorized'},shared),/Chỉ xem/);
await assert.rejects(readTreatmentSignature(owner,{...shared,checkoutInvoiceId:undefined}),/Thiếu liên kết/);
source=null;await assert.rejects(readTreatmentSignature(owner,shared),/Không tìm thấy/);
source={actorId:'another',signature};await assert.rejects(readTreatmentSignature({...owner,role:'STAFF'},shared),/Chỉ xem/);

(invoice as any).kind='PRODUCT';(invoice as any).productItems=[{productId:'p1',name:'Product A',quantity:2,unitPrice:50000,total:100000,unit:'ml'},{productId:'p2',name:'Product B',quantity:1,unitPrice:60000,total:60000,unit:'ml'}];
const productPdf=await invoiceExport(owner,id);
assert.equal(productPdf.tables[1].rows.length,2,'product-only invoice must not duplicate its total as an extra line');
delete (invoice as any).productItems;

// Detail reads preserve each recorded receipt and each explicit line assignment.
const staffA = '1'.repeat(24), staffB = '2'.repeat(24);
(invoice as any).performedBy = actorId;
(invoice as any).serviceItems = [
  { lineId: 'line-a', serviceId: 'a', name: 'Massage CVG', total: 500000, performerId: staffA },
  { lineId: 'line-b', serviceId: 'b', name: 'Dầu gội khách', total: 1000000, performerId: staffB },
  { lineId: 'line-c', serviceId: 'c', name: 'Chưa phân công', total: 0 },
];
invoice.total = 1500000; invoice.paid = 1500000;
mock.method(User, 'findOne', () => query({ name: 'Invoice performer must not fill missing lines' }));
mock.method(User, 'find', (filter: any) => {
  assert.equal(filter.spaId, spaId);
  assert.deepEqual(filter._id.$in, [staffA, staffB]);
  return query([{ _id: staffA, name: 'Thư' }, { _id: staffB, name: 'Quỳnh' }]);
});
mock.method(Payment, 'find', (filter: any) => {
  if (filter.invoiceId?.$in) assert.deepEqual(filter, { spaId, invoiceId: { $in: [id] } });
  else assert.deepEqual(filter, { spaId, invoiceId: id, reversed: false });
  return query([{ _id: 'p1', receiptId: 'r1', amount: 500000 }, { _id: 'p2', receiptId: 'r2', amount: 1000000 }, { _id: 'p3', receiptId: 'missing', amount: 100 }]);
});
mock.method(CashEntry, 'find', (filter: any) => {
  assert.deepEqual(filter, { spaId, _id: { $in: ['r1', 'r2', 'missing'] }, kind: 'PAYMENT', direction: 'IN', reversed: false });
  return query([{ _id: 'r1', method: 'BANK_TRANSFER',day:'2026-11-06' }, { _id: 'r2', method: 'CASH',day:'2026-11-07' }]);
});
const detail = await readInvoice(owner, id);
assert.deepEqual(detail.invoice.serviceItems?.map((item: any) => item.performerName), ['Thư', 'Quỳnh', null]);
assert.deepEqual(detail.payments, [
  { _id: 'p1', amount: 500000, method: 'BANK_TRANSFER',receiptId:'r1',day:'2026-11-06' },
  { _id: 'p2', amount: 1000000, method: 'CASH',receiptId:'r2',day:'2026-11-07' },
  { _id: 'p3', amount: 100, method: null,receiptId:'missing',day:null },
]);
assert.equal(detail.invoice.total, 1500000);
assert.equal(detail.invoice.paid, 1500000);
assert.ok(detail.handling, 'main handling reasons remain available with separate payment sources');
(invoice as any).treatmentSessions = [{lineId:'session-a',treatmentUseId:'session',name:'Buổi gói',total:0,performerId:staffB}];
const withSessions = await readInvoice(owner,id);
assert.equal(withSessions.invoice.treatmentSessions?.[0].performerName,'Quỳnh');

// Display decisions come from scoped operational references, not only invoice metadata.
(invoice as any).kind='SERVICE';delete (invoice as any).productItems;delete (invoice as any).productId;delete (invoice as any).packageItems;
mock.method(Payment,'find',()=>query([]));mock.method(CashEntry,'find',()=>query([]));
mock.method(Invoice,'find',()=>query([]));mock.method(Treatment,'find',()=>query([]));
mock.method(StockMovement,'exists',async(filter:any)=>{assert.equal(filter.spaId,spaId);return null;});
assert.deepEqual((await readInvoice(owner,id)).adjustmentContext,{stock:false,packages:false,gifts:false});
mock.method(StockMovement,'exists',async(filter:any)=>{assert.deepEqual(filter.$or,[{invoiceId:id},{checkoutInvoiceId:id}]);return {_id:'legacy-stock'};});
assert.equal((await readInvoice(owner,id)).adjustmentContext?.stock,true);
mock.method(StockMovement,'exists',async()=>null);
mock.method(Invoice,'find',()=>query([{_id:'gift',customerId:invoice.customerId,total:0}]));
mock.method(Treatment,'find',()=>query([{_id:'gift-plan',invoiceId:'gift',name:'Gift only'}]));
assert.deepEqual((await readInvoice(owner,id)).adjustmentContext,{stock:false,packages:false,gifts:true});
mock.method(Invoice,'find',()=>query([]));mock.method(Treatment,'find',()=>query([{_id:packageId,invoiceId:id,name:'Purchased plan'}]));
assert.equal((await readInvoice(owner,id)).adjustmentContext?.packages,true);
mock.method(StockMovement,'exists',async()=>assert.fail('STAFF must not receive owner adjustment context'));
assert.equal((await readInvoice({...owner,role:'STAFF'},id)).adjustmentContext,undefined);
mock.restoreAll();
