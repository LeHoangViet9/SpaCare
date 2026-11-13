import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { operate } from '../src/lib/operations';
import {
  DiscountProgram, SaleCommission, SharedSaleCommission, InvoiceLineCommission, Product,
  StockMovement, TreatmentUse, ActivityNotification, Appointment, Commission,
  ServiceGroup, User, Control, Customer, Invoice, CashEntry, CashCard, CashCardUse,
  Payment, Day, Audit, Idempotency, Treatment, PackageTemplate, Service
} from '../src/lib/models';
import { spaDay } from '../src/lib/rules';
import { allowedPushEndpoint, urlBase64ToUint8Array } from '../src/lib/push-validation';
import { invoiceEditorAction, invoiceDueDateVisible } from '../src/lib/invoice-editing';
import type { Signature } from '../src/lib/signature';

const sigB: Signature = { version: 1, strokes: [[[0.1, 0.1], [0.1, 0.4], [0.1, 0.8]]] };
const sigC: Signature = { version: 1, strokes: [[[0.2, 0.1], [0.2, 0.5], [0.2, 0.9]]] };
const sigD: Signature = { version: 1, strokes: [[[0.3, 0.1], [0.3, 0.5], [0.3, 0.9]]] };

const spaId = 'a'.repeat(24);
const ownerId = 'b'.repeat(24);
const customerA = 'c'.repeat(24);
const customerB = 'd'.repeat(24);
const staff1 = 'e'.repeat(24);
const staff2 = 'f'.repeat(24);
const serviceId = '1'.repeat(24);
const templateId = '2'.repeat(24);

const actor = { id: ownerId, spaId, name: 'Owner', role: 'OWNER' as const, cashier: false };
const clone = (v: any) => JSON.parse(JSON.stringify(v));

let state: Record<string, any[]> = {};
function match(row: any, filter: any): boolean {
  return Object.entries(filter).every(([k, v]: any) => {
    if (v && typeof v === 'object' && '$in' in v) {
      return v.$in.some((x: any) => String(x) === String(row[k]));
    }
    return String(row[k]) === String(v);
  });
}

function doc(name: string, row: any): any {
  if (!row) return null;
  return {
    ...clone(row),
    ...(name === 'Appointment' ? { startAt: new Date(row.startAt) } : {}),
    toObject() {
      const { toObject, save, ...v } = this;
      return clone(v);
    },
    async save() {
      const i = state[name].findIndex(v => String(v._id) === String(this._id));
      if (i >= 0) state[name][i] = this.toObject();
    }
  };
}

function query(value: any): any {
  return {
    limit(){return this;},
    distinct: (key: string) => query([...new Set((value || []).map((row: any) => row[key]).filter(Boolean))]),
    session: async () => value,
    then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject)
  };
}

let failModel = '';
for (const model of [
  DiscountProgram, SaleCommission, SharedSaleCommission, InvoiceLineCommission, Product,
  StockMovement, TreatmentUse, ActivityNotification, Appointment, Commission,
  ServiceGroup, User, Control, Customer, Invoice, CashEntry, CashCard, CashCardUse,
  Payment, Day, Audit, Idempotency, Treatment, PackageTemplate, Service
]) {
  const name = model.modelName;
  state[name] = [];
  (model as any).find = (filter: any) => query(state[name].filter(row => match(row, filter)));
  (model as any).countDocuments = (filter: any) => query(state[name].filter(row => match(row, filter)).length);
  (model as any).findOne = (filter: any) => query(doc(name, state[name].find(row => match(row, filter))));
  (model as any).exists = (filter: any) => query(state[name].find(row => match(row, filter)) || null);
  (model as any).findOneAndUpdate = (filter: any, update: any) => {
    const row = state[name].find(row => match(row, filter));
    if (name === 'Control' && row) {
      for (const [field, value] of Object.entries(update?.$inc || {})) {
        row[field] = (row[field] || 0) + Number(value);
      }
    }
    return query(doc(name, row));
  };
  (model as any).create = async (rows: any[], options: any) => {
    assert.ok(options.session, 'every financial/operational write needs the transaction');
    if (failModel === name) throw new Error('INJECTED_FAILURE');
    const result = [];
    for (const row of rows) {
      const item = new model(row);
      await item.validate();
      const v = clone(item.toObject());
      state[name].push(v);
      result.push(doc(name, v));
    }
    return result;
  };
}

(Treatment.collection as any).indexes = async () => [{ name: 'treatment_invoice_lookup', key: { spaId: 1, invoiceId: 1 } }];
(mongoose as any).connect = () => Promise.resolve(mongoose); // Permit connect() but skip real DB
(mongoose.connection as any).readyState = 1; // Simulate already-connected so connect() returns early

let queue = Promise.resolve();
(mongoose.connection as any).transaction = (fn: any) => {
  const result = queue.then(async () => {
    const before = clone(state);
    try {
      return await fn({ fixture: true });
    } catch (e) {
      state = before;
      throw e;
    }
  });
  queue = result.catch(() => {});
  return result;
};

const call = (action: string, data: any, key = randomUUID()) => operate(actor, action, data, key);

// Initialize baseline state
state.User = [
  { _id: ownerId, spaId, name: 'Owner', role: 'OWNER', active: true, cashier: false },
  { _id: staff1, spaId, name: 'KTV 1', role: 'STAFF', active: true, cashier: false },
  { _id: staff2, spaId, name: 'KTV 2', role: 'STAFF', active: true, cashier: false }
];
state.Control = [{ _id: '9'.repeat(24), spaId, revision: 0 }];
state.Customer = [
  { _id: customerA, spaId, name: 'Chủ gói A', phone: '0901111111' },
  { _id: customerB, spaId, name: 'Người thân B', phone: '0902222222' }
];
state.Service = [{ _id: serviceId, spaId, name: 'Chăm sóc da', price: 300000, active: true, commission: 15000 }];
state.PackageTemplate = [{
  _id: templateId,
  spaId,
  serviceId,
  name: 'Gói chăm sóc da 10 buổi',
  price: 2500000,
  active: true,
  totalSessions: 10,
  packageType: 'SESSIONS'
}];
state.Day = [{ _id: '8'.repeat(24), spaId, day: spaDay(), status: 'OPEN' }];

console.log('--- TEST 1: PACKAGE OWNER USE WITHOUT SEPARATE RECIPIENTS ---');
// Setup: Create a treatment package for Customer A with 5 sessions
const treatmentId = '7'.repeat(24);
const treatmentInvoiceId = '6'.repeat(24);
state.Invoice.push({
  _id: treatmentInvoiceId,
  spaId,
  customerId: customerA,
  serviceId,
  kind: 'PACKAGE',
  total: 2500000,
  paid: 2500000,
  status: 'PAID'
});
state.Treatment = [{
  _id: treatmentId,
  spaId,
  invoiceId: treatmentInvoiceId,
  customerId: customerA,
  serviceId,
  packageType: 'SESSIONS',
  totalSessions: 5,
  remaining: 5,
  status: 'ACTIVE',
  startsOn: spaDay(),
  token: 'initial-token'
}];

// One unsigned use belongs to the package owner and consumes exactly one session.
const singleUseKey = randomUUID();
const singlePayload = {treatmentId,remainingBefore:5,staffId:staff1};
const firstUse = await call('use',singlePayload,singleUseKey);
assert.deepEqual(await call('use',singlePayload,singleUseKey),firstUse);
assert.equal(state.Treatment[0].remaining,4);
assert.equal(state.TreatmentUse.length,1);
const assertOwnerUse = (use:any) => {
  assert.equal(use.customerId,customerA);
  assert.equal(use.ownerCustomerId,customerA);
  const snapshot=JSON.parse(use.snapshot);
  assert.equal(snapshot.customerId,customerA);
  assert.equal(snapshot.ownerCustomerId,customerA);
  for(const key of ['recipientCustomerId','recipientName','recipientPhone','isShared']){
    assert.equal(Object.hasOwn(use,key),false,key);
    assert.equal(Object.hasOwn(snapshot,key),false,key);
  }
};
assertOwnerUse(state.TreatmentUse[0]);
assert.equal(state.TreatmentUse[0].method,'STAFF_RECORDED');
assert.equal(state.TreatmentUse[0].staffId,staff1);
assert.ok(state.TreatmentUse[0].performedAt);
assert.equal(state.TreatmentUse[0].sessionNumber,1);
const purchaseBefore=clone(state.Invoice[0]);
const receiptsBefore=clone([state.Payment,state.CashEntry]);

// Explicit batches retain one decrement per recorded use and per-line technicians.
const multiUseKey = randomUUID();
const batch={treatmentId,remainingBefore:4,sessions:[{staffId:staff1,signature:sigB},{staffId:staff2,signature:sigC}]};
const multi=await call('use',batch,multiUseKey);
assert.deepEqual(await call('use',batch,multiUseKey),multi);
assert.equal(state.Treatment[0].remaining,2);
assert.equal(state.TreatmentUse.length,3);
for(const use of state.TreatmentUse)assertOwnerUse(use);
assert.equal(state.TreatmentUse[1].staffId,staff1);
assert.equal(state.TreatmentUse[2].staffId,staff2);
assert.deepEqual(state.TreatmentUse[1].signature,sigB);
assert.deepEqual(state.TreatmentUse[2].signature,sigC);
assert.deepEqual(state.Invoice[0],purchaseBefore);
assert.deepEqual([state.Payment,state.CashEntry],receiptsBefore);
assert.deepEqual(state.InvoiceLineCommission.map(row=>row.amount),[15000,15000,15000]);

// Removed fields are rejected before any new operational or audit write.
for(const field of ['recipientCustomerId','recipientName','recipientPhone','isShared']){
  const before=clone(state);
  const value=field==='recipientCustomerId'?customerB:field==='isShared'?true:'legacy recipient';
  for(const [action,data] of [
    ['use',{treatmentId,staffId:staff1,[field]:value}],
    ['use',{treatmentId,sessions:[{staffId:staff1,[field]:value}]}],
  ] as const)await assert.rejects(call(action,data),(error:any)=>error.issues?.some((issue:any)=>issue.code==='unrecognized_keys'));
  assert.deepEqual(state,before);
}
await assert.rejects(call('use',{treatmentId,staffId:staff1,sessions:[{},{},{}]}),/vượt quá|Số lượt/i);
assert.equal(state.Treatment[0].remaining,2);
const stateBeforeFailure=clone(state);
failModel='TreatmentUse';
await assert.rejects(call('use',{treatmentId,sessions:[{staffId:staff1},{staffId:staff2}]}),/INJECTED_FAILURE/);
failModel='';
assert.deepEqual(state,stateBeforeFailure,'failed recording restores quota, commissions and history');

// Legacy recipient evidence remains readable and byte-for-byte unchanged.
const legacy=new TreatmentUse({_id:new mongoose.Types.ObjectId(),spaId,treatmentId:new mongoose.Types.ObjectId(),actorId:ownerId,
  customerId:customerA,ownerCustomerId:customerA,recipientCustomerId:customerB,recipientName:'Legacy recipient',recipientPhone:'0902222222',
  isShared:true,sessionNumber:1,signature:sigD,snapshot:JSON.stringify({recipientName:'Legacy recipient',isShared:true})});
await legacy.validate();
const historical=clone(legacy.toObject());state.TreatmentUse.push(historical);
const legacyBefore=clone(historical);
const finalUse=await call('use',{treatmentId,remainingBefore:2,staffId:staff1});
assert.equal(state.Treatment[0].remaining,1);
assertOwnerUse(state.TreatmentUse.find(row=>row._id===finalUse.id));
assert.deepEqual(state.TreatmentUse.find(row=>row._id===historical._id),legacyBefore);
assert.deepEqual(state.Invoice[0],purchaseBefore);
assert.deepEqual([state.Payment,state.CashEntry],receiptsBefore);

// Cashier invoice and appointment completion also record the package owner without recipient input.
const flowTreatmentId=String(new mongoose.Types.ObjectId());
state.Treatment.push({...clone(state.Treatment[0]),_id:flowTreatmentId,totalSessions:5,remaining:5,status:'ACTIVE'});
let countBefore=state.TreatmentUse.length;
const fromInvoice=await call('invoice',{customerId:customerA,serviceId,treatments:[
  {treatmentId:flowTreatmentId,remainingBefore:5,performerId:staff1},
]});
assert.equal(state.Treatment.find(row=>row._id===flowTreatmentId)!.remaining,4);
assert.equal(state.TreatmentUse.length,countBefore+1);
assertOwnerUse(state.TreatmentUse.at(-1));
assert.equal(state.Invoice.find(row=>row._id===fromInvoice.id)!.customerId,customerA);
const appointmentId=String(new mongoose.Types.ObjectId());
state.Appointment.push({_id:appointmentId,spaId,customerId:customerA,serviceId,treatmentId:flowTreatmentId,
  staffId:staff1,startAt:new Date(Date.now()-3600000).toISOString(),status:'CONFIRMED'});
countBefore=state.TreatmentUse.length;
const completed=await call('completeTreatmentAppointment',{id:appointmentId});
assert.equal(state.Treatment.find(row=>row._id===flowTreatmentId)!.remaining,3);
assert.equal(state.TreatmentUse.length,countBefore+1);
assertOwnerUse(state.TreatmentUse.at(-1));
assert.equal(state.TreatmentUse.at(-1)!.staffId,staff1);
await call('completeTreatmentAppointment',{id:appointmentId});
assert.equal(state.Treatment.find(row=>row._id===flowTreatmentId)!.remaining,3,'completed appointment cannot consume another session');
assert.equal(state.TreatmentUse.length,countBefore+1);
assert.equal(state.Invoice.find(row=>row._id===completed.invoiceId)!.customerId,customerA);
assert.deepEqual(state.TreatmentUse.find(row=>row._id===historical._id),legacyBefore);
assert.deepEqual(state.Invoice[0],purchaseBefore);
assert.deepEqual([state.Payment,state.CashEntry],receiptsBefore);

console.log('--- TEST 2: SHORTEN INVOICE FORM WHEN FULLY PAID ---');
// Exercise the same helpers used by Workspace.editInvoice, not a test-only copy of its logic.
const unpaidInvoice = { _id: '6'.repeat(24), total: 500000, paid: 0, dueDate: '2026-12-31' };
assert.equal(invoiceEditorAction(unpaidInvoice), 'updateInvoice');
assert.equal(invoiceDueDateVisible(unpaidInvoice.total, unpaidInvoice.paid), true, 'Unpaid invoice editor shows dueDate');
const fullyPaidInvoice = { _id: '5'.repeat(24), total: 500000, paid: 500000, dueDate: '2026-12-31', description: 'Ghi chú gốc' };
assert.equal(invoiceEditorAction(fullyPaidInvoice), 'correctInvoiceDate', 'Paid invoice opens the date-only correction form');
assert.equal(invoiceDueDateVisible(fullyPaidInvoice.total, fullyPaidInvoice.paid), false, 'Fully paid invoice hides dueDate');
assert.equal(invoiceDueDateVisible(500000, 600000), false, 'Overpaid invoice hides dueDate');
console.log('TEST 2 PASSED: Workspace invoice editor hides dueDate for paid invoices');

console.log('--- TEST 3: SELL MULTIPLE PACKAGES IN A SINGLE INVOICE ---');
// Sell 2 packages of the SAME template in one invoice via checkout
const multiPackageCart = {
  customerId: customerA,
  actions: [
    {
      action: 'sellPackage',
      data: {
        cartId: 'cart-line-1',
        templateId,
        dueDate: spaDay(),
        promotion: 'Gói 1 ưu đãi'
      }
    },
    {
      action: 'sellPackage',
      data: {
        cartId: 'cart-line-2',
        templateId,
        dueDate: spaDay(),
        promotion: 'Gói 2 ưu đãi'
      }
    }
  ]
};

const checkoutKey = randomUUID();
const checkoutResult = await call('checkout', multiPackageCart, checkoutKey);
// Idempotency: second call with same key returns identical result
const idempotentResult = await call('checkout', multiPackageCart, checkoutKey);
assert.equal(checkoutResult.invoiceId, idempotentResult.invoiceId);

const multiPackInvoice = state.Invoice.find(r => r._id === checkoutResult.invoiceId);
assert.ok(multiPackInvoice);
assert.equal(multiPackInvoice.packageItems.length, 2, 'Invoice has 2 distinct package items');
assert.equal(multiPackInvoice.packageItems[0].templateId, templateId);
assert.equal(multiPackInvoice.packageItems[1].templateId, templateId);
assert.notEqual(multiPackInvoice.packageItems[0].lineId, multiPackInvoice.packageItems[1].lineId);
assert.equal(multiPackInvoice.total, 5000000, 'Combined invoice total is 2 x 2.5m = 5m');

// Verify treatments created for both packages
const createdTreatments = state.Treatment.filter(r => r.invoiceId === checkoutResult.invoiceId);
assert.equal(createdTreatments.length, 2, 'Exactly 2 Treatment records created');
assert.equal(createdTreatments[0].totalSessions, 10);
assert.equal(createdTreatments[1].totalSessions, 10);
assert.equal(createdTreatments[0].remaining, 10);
assert.equal(createdTreatments[1].remaining, 10);

console.log('--- TEST 4: MOBILE PUSH NOTIFICATIONS ---');
// 4.1: Endpoint validation for mobile push services (Android FCM, Apple APNs)
assert.equal(allowedPushEndpoint('https://android.googleapis.com/gcm/send/device-token'), true);
assert.equal(allowedPushEndpoint('https://api.push.apple.com/3/device/device-token'), true);
assert.equal(allowedPushEndpoint('https://web.push.apple.com/test'), true);
assert.equal(allowedPushEndpoint('https://fcm.googleapis.com/fcm/send/device-token'), true);
assert.equal(allowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/token'), true);
assert.equal(allowedPushEndpoint('https://wns2-sn3p.notify.windows.com/w/token'), true);

assert.equal(allowedPushEndpoint('http://android.googleapis.com/test'), false, 'Non-HTTPS rejected');
assert.equal(allowedPushEndpoint('https://evil-push-gateway.com/send'), false, 'Untrusted domain rejected');

// 4.2: urlBase64ToUint8Array conversion test
// Covers keys with URL-safe characters '-' and '_' and all needed padding lengths
// Case 1: 87-character VAPID key (length % 4 == 3, needs 1 '=' padding) with '-' and '_'
const key87 = 'BGtLD68jBFmg8eTafcdRtaDUL9dOy07Ul2pxRC4lB0GXZqbyvqWr0qegUr4z27kMYO3blWWEcXLBHBoRhFoY-q_';
assert.ok(key87.includes('-') && key87.includes('_'));
assert.equal(key87.length, 87);
const bytes87 = urlBase64ToUint8Array(key87);
assert.equal(bytes87.length, 65, 'Uncompressed P-256 public key is 65 bytes');
assert.deepEqual(Buffer.from(bytes87), Buffer.from(key87, 'base64url'));

// Case 2: 22-character auth token (length % 4 == 2, needs 2 '=' padding) with '-' and '_'
const key22 = 'auth-token_with-dash_1';
assert.ok(key22.includes('-') && key22.includes('_'));
assert.equal(key22.length, 22);
const bytes22 = urlBase64ToUint8Array(key22);
assert.equal(bytes22.length, 16, 'Auth token is 16 bytes');
assert.deepEqual(Buffer.from(bytes22), Buffer.from(key22, 'base64url'));

// Case 3: 16-character string (length % 4 == 0, needs 0 '=' padding) with '-' and '_'
const key16 = 'no-padding_key16';
assert.ok(key16.includes('-') && key16.includes('_'));
assert.equal(key16.length, 16);
const bytes16 = urlBase64ToUint8Array(key16);
assert.equal(bytes16.length, 12);
assert.deepEqual(Buffer.from(bytes16), Buffer.from(key16, 'base64url'));

console.log('--- FLEXIBLE NEW-INVOICE LINE PRICES (model doubles; no database) ---');
const priceBaseline=clone(state.Invoice);
const pricePayments=state.Payment.length, priceCash=state.CashEntry.length;
for(const total of [undefined, 0, 123000]) {
  const before=state.InvoiceLineCommission.length;
  const created=await call('serviceInvoice',{customerId:customerA,items:[{serviceId,performerId:staff1,...(total===undefined?{}:{total})}]});
  const saved=state.Invoice.find(row=>String(row._id)===created.id)!;
  assert.equal(saved.total,total ?? 300000);assert.equal(saved.paid,0);
  assert.equal(saved.serviceItems[0].total,total ?? 300000);
  assert.equal(state.InvoiceLineCommission.length,before+1);
  assert.equal(state.InvoiceLineCommission.at(-1)!.amount,15000,'fixed catalog commission is independent of actual price');
  if(total===0)assert.equal(saved.status,'PAID');
}
const legacyFree=await call('invoice',{customerId:customerA,serviceId,total:0,staffId:staff1});
assert.equal(state.Invoice.find(row=>String(row._id)===legacyFree.id)!.total,0);
for(const total of [0,123000,undefined]) {
  const sale=await call('sellPackage',{customerId:customerA,templateId,...(total===undefined?{}:{total})});
  const saved=state.Invoice.find(row=>String(row._id)===sale.invoiceId)!;
  assert.equal(saved.total,total ?? 2500000);assert.equal(saved.saleCommissionAccrued,0);
  assert.equal(state.Treatment.find(row=>String(row.invoiceId)===String(saved._id))!.remaining,10);
}
const freeProductId='7'.repeat(24);
state.Product.push({_id:freeProductId,spaId,name:'Synthetic product',sku:'PRICE-TEST',unit:'chai',price:80000,stock:20,active:true});
for(const action of ['productInvoice','sellProduct']) {
  const created=await call(action,action==='productInvoice'?{customerId:customerA,items:[{productId:freeProductId,quantity:2,unitPrice:0}]}:{customerId:customerA,productId:freeProductId,quantity:2,unitPrice:0});
  const saved=state.Invoice.find(row=>String(row._id)===created.id)!;
  assert.equal(saved.total,0);assert.equal(saved.paid,0);assert.equal(saved.status,'PAID');
}
assert.equal(state.Product.find(row=>row._id===freeProductId)!.stock,16,'free products still consume stock');
const grouped=await call('checkout',{customerId:customerA,actions:[
  {action:'serviceInvoice',data:{items:[{serviceId,total:0,performerId:staff1}],additionalProducts:[{productId:freeProductId,quantity:1,unitPrice:0}]}},
  {action:'sellPackage',data:{cartId:'free-package',templateId,total:0}},
  {action:'sellPackage',data:{cartId:'paid-package',templateId,total:200000}},
]});
assert.equal(grouped.total,200000);assert.equal(grouped.invoiceIds.length,1);
const mixed=state.Invoice.find(row=>String(row._id)===grouped.invoiceId)!;
assert.equal(mixed.status,'OPEN');assert.deepEqual(mixed.packageItems.map((line:any)=>line.total),[0,200000]);
assert.equal(mixed.serviceItems[0].total,0);assert.equal(mixed.productItems[0].total,0);
for(const invalid of [-1,0.5,1_000_000_000_001]) {
  for(const [action,data] of [
    ['serviceInvoice',{customerId:customerA,items:[{serviceId,total:invalid}]}],
    ['invoice',{customerId:customerA,serviceId,total:invalid}],
    ['sellPackage',{customerId:customerA,templateId,total:invalid}],
    ['productInvoice',{customerId:customerA,items:[{productId:freeProductId,quantity:1,unitPrice:invalid}]}],
    ['sellProduct',{customerId:customerA,productId:freeProductId,quantity:1,unitPrice:invalid}],
  ] as const) {const before=clone(state);await assert.rejects(call(action,data));assert.deepEqual(state,before,'invalid prices must roll back');}
}
assert.equal(state.Payment.length,pricePayments);assert.equal(state.CashEntry.length,priceCash,'zero-priced sales never create customer receipts');
for(const old of priceBaseline)assert.deepEqual(state.Invoice.find(row=>String(row._id)===String(old._id)),old,'existing invoices are unchanged');
console.log('All multi-use, invoice due date, multi-package, flexible line prices and push notification tests PASSED!');
