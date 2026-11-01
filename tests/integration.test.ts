Warning: truncated output (original token count: 53525)
Total output lines: 2341

import { readReport } from '../src/lib/report-read';
import { parseOpening, inspectOpening, writeOpening, checkOpeningIndexes } from '../src/lib/opening-balances';
import { ServiceGroup } from '../src/lib/models';
import { CashCard, CashCardUse } from '../src/lib/models';
import { readCashCards } from '../src/lib/cash-card-read';
import { importCatalog } from '../src/lib/catalog-import';
import type { CatalogEntry } from '../src/lib/catalog-import-plan';
import test from 'node:test';
const signed = { version: 1, strokes: [[[0.1, 0.6], [0.3, 0.2], [0.7, 0.8]]] }; 
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { allModels, Spa, User, Control, Deposit, Invoice, CashEntry, Treatment, Appointment, Audit, TreatmentUse, Allocation, Payment, Idempotency, Day, Customer, PackageTemplate, Commission, InvoiceLineCommission, Payroll, Service, Product, ProductGroup, StockMovement, SaleCommission, SharedSaleCommission, StaffLeave, Workday } from '../src/lib/models';
import { productQuery } from '../src/lib/product-rules';
import { readProducts } from '../src/lib/product-read';
import { hashPassword } from '../src/lib/password';
import { operate } from '../src/lib/operations';
import type { Actor } from '../src/lib/auth';
import { spaDay } from '../src/lib/rules';
import { findCustomerPage } from '../src/lib/customer-search';
import { readWorkspace } from '../src/lib/workspace-read';
import { readInvoice } from '../src/lib/invoice-read';
import { readCustomerHistory } from '../src/lib/customer-history';
import { readPayroll, payrollQuery } from '../src/lib/payroll-read';
import { monthBounds } from '../src/lib/payroll-rules';
import { workspaceQuery } from '../src/lib/workspace-query';
import { reservePublicBooking } from '../src/lib/public-booking';
import { GET as productImageGET } from '../src/app/api/product-images/[id]/route';
import { Notification, ActivityNotification } from '../src/lib/models';
import { assertConnectedServerIdentity, assertIntegrationEnvironment, inspectIntegrationSchema } from './integration-safety';

test('transactions: idempotency, cạnh tranh cọc/lượt dùng, quyền và chốt ngày', async t => {
  // Fail closed before the MongoDB driver is allowed to create a connection.
  const target = assertIntegrationEnvironment(process.env);
  await connect();
  let spaId: mongoose.Types.ObjectId | undefined;
  const extraSpaIds: mongoose.Types.ObjectId[] = [];
  try {
    // Both checks are read-only and must pass before the first fixture mutation.
    await assertConnectedServerIdentity(mongoose.connection, target);
    await inspectIntegrationSchema(mongoose.connection, allModels);
    const spa = await Spa.create({ name: `Integration ${randomUUID()}` }); spaId = spa._id;
    const owner = await User.create({ spaId, name: 'Owner test', email: `${randomUUID()}@example.test`, passwordHash: hashPassword(randomUUID()), role: 'OWNER', cashier: true });
    const staff = await User.create({ spaId, name: 'Staff test', email: `${randomUUID()}@example.test`, passwordHash: hashPassword(randomUUID()), role: 'STAFF', cashier: false });
    await Control.create({ spaId, revision: 0 });
    const actor: Actor = { id: String(owner._id), spaId: String(spaId), name: 'Owner test', role: 'OWNER', cashier: true };
    const employee: Actor = { ...actor, id: String(staff._id), role: 'STAFF', cashier: false };
    const call = (action: string, data: unknown, key = randomUUID()) => operate(actor, action, data, key);
    await call('openDay', { day: spaDay(), opening: 0 });
    await t.test('STAFF security: old debt collection, day permissions and assigned customer/package/use reads', async () => {
      const spa = await Spa.create({ name: 'STAFF security ' + randomUUID() }); extraSpaIds.push(spa._id);
      const scope = { spaId: spa._id };
      await Control.create(scope);
      const owner = await User.create({ ...scope, name: 'Owner', email: randomUUID() + '@example.test', passwordHash: hashPassword(randomUUID()), role: 'OWNER' });
      const cashier = await User.create({ ...scope, name: 'Cashier', email: randomUUID() + '@example.test', passwordHash: hashPassword(randomUUID()), role: 'STAFF', cashier: true });
      const staff = await User.create({ ...scope, name: 'Staff', email: randomUUID() + '@example.test', passwordHash: hashPassword(randomUUID()), role: 'STAFF', cashier: false });
      const who = (u: any): Actor => ({ id: String(u._id), spaId: String(spa._id), name: u.name, role: u.role, cashier: u.cashier });
      const perform = (u: any, action: string, data: unknown, key = randomUUID()) => operate(who(u), action, data, key);
      const denied = (e: any) => e.status === 403;
      await assert.rejects(perform(staff, 'openDay', { day: spaDay(), opening: 0 }), denied);
      await perform(cashier, 'openDay', { day: spaDay(), opening: 0 });
      const customer = await Customer.create({ ...scope, name: 'Assigned customer', phone: '0900000001' });
      const other = await Customer.create({ ...scope, name: 'Unassigned customer', phone: '0900000002' });
      const old = await Invoice.create({ ...scope, customerId: other._id, total: 100, paid: 0, createdAt: new Date('2020-01-01') });
      assert.equal((await readInvoice(who(cashier), String(old._id))).invoice.total, 100);
      await assert.rejects(readInvoice(who(staff), String(old._id)), (e: any) => e.status === 404);
      await assert.rejects(perform(staff, 'payment', { invoiceId: String(old._id), amount: 100, method: 'CASH', receivedConfirmation: true }), denied);
      const key = randomUUID(), payload = { invoiceId: String(old._id), amount: 100, method: 'CASH', receivedConfirmation: true };
      const paid = await perform(cashier, 'payment', payload, key);
      assert.deepEqual(await perform(cashier, 'payment', payload, key), paid);
      assert.equal((await readInvoice(who(cashier), String(old._id))).invoice.paid, 100);
      assert.equal((await readInvoice(who(owner), String(old._id))).invoice.paid, 100);
      await assert.rejects(readInvoice(actor, String(old._id)), (e: any) => e.status === 404);
      const historicalPaid = await Invoice.create({ ...scope, customerId: other._id, total: 100, paid: 100, createdAt: new Date('2020-01-01') });
      await assert.rejects(readInvoice(who(cashier), String(historicalPaid._id)), (e: any) => e.status === 404);
      const cancelled = await Invoice.create({ ...scope, customerId: other._id, total: 100, paid: 0, status: 'CANCELLED', createdAt: new Date('2020-01-01') });
      await assert.rejects(readInvoice(who(cashier), String(cancelled._id)), (e: any) => e.status === 404);
      await assert.rejects(perform(cashier, 'payment', { ...payload, invoiceId: String(cancelled._id) }), (e: any) => e.status === 409);
      assert.equal(await Payment.countDocuments({ ...scope, invoiceId: old._id }), 1);
      const receipt = await CashEntry.findOne({ ...scope, kind: 'PAYMENT' });
      assert.equal(receipt!.day, spaDay()); assert.equal(String(receipt!.actorId), String(cashier._id));
      const ownBill = await Invoice.create({ ...scope, customerId: customer._id, total: 0, paid: 0 });
      const service = await Service.create({ ...scope, name: 'STAFF fixture service', price: 100, duration: 30 });
      const own = await Treatment.create({ ...scope, customerId: customer._id, invoiceId: ownBill._id, serviceId: service._id, totalSessions: 2, remaining: 2 });
      const hidden = await Treatment.create({ ...scope, customerId: customer._id, invoiceId: old._id, totalSessions: 2, remaining: 2 });
      const visit = new Appointment({ ...scope, customerId: customer._id, serviceId: service._id, staffId: staff._id, treatmentId: own._id, startAt: new Date(), status: 'CONFIRMED' });
      assert.ifError(visit.validateSync());
      await visit.save();
      await TreatmentUse.create({ ...scope, customerId: customer._id, treatmentId: own._id, actorId: staff._id, staffId: staff._id });
      await TreatmentUse.create({ ...scope, customerId: other._id, treatmentId: hidden._id, actorId: owner._id, staffId: owner._id });
      const customers = await findCustomerPage(String(spa._id), { search: '', page: 1, pageSize: 20 }, who(staff));
      assert.deepEqual(customers.customers.map(c => String(c._id)), [String(customer._id)]);
      await assert.rejects(readCustomerHistory(who(staff), String(other._id), 'treatments', 1), (e: any) => e.status === 404);
      const history = await readCustomerHistory(who(staff), String(customer._id), 'treatments', 1);
      assert.deepEqual(history.rows.map(r => String(r._id)), [String(own._id)]);
      assert.equal(history.summary.activePackages, 1);
      for (const section of ['packages', 'treatment_uses']) {
        const data = await readWorkspace(who(staff), workspaceQuery(new URLSearchParams({ section })));
        assert.ok(!data.treatments.some(p => String(p._id) === String(hidden._id)));
        assert.ok(data.uses.every(u => String(u.actorId) === String(staff._id)));
      }
      for (const u of [staff, cashier]) {
        await assert.rejects(readReport(who(u), workspaceQuery(new URLSearchParams({ section: 'reports' }))), denied);
        const overview = await readWorkspace(who(u), workspaceQuery(new URLSearchParams()));
        for (const field of ['debt', 'credit', 'inflow', 'outflow']) assert.equal(overview.totals[field as keyof typeof overview.totals], 0);
        await assert.rejects(perform(u, 'closeDay', { day: spaDay(), counted: 100 }), denied);
      }
      await perform(owner, 'closeDay', { day: spaDay(), counted: 100 });
      for (const u of [staff, cashier]) await assert.rejects(perform(u, 'reopenDay', { day: spaDay(), reason: 'Denied' }), denied);
      await perform(owner, 'reopenDay', { day: spaDay(), reason: 'Synthetic regression' });
    });
    const originalDay = await Day.findOne({ spaId, day: spaDay() });
    const reusedDay = await call('openDay', { day: spaDay(), opening: 999999 });
    assert.equal(reusedDay.id, String(originalDay!._id));
    assert.equal((await Day.findById(originalDay!._id))!.opening, 0);
    assert.equal(await Day.countDocuments({ spaId, day: spaDay() }), 1);
    const filteredDays = await readWorkspace(actor, workspaceQuery(new URLSearchParams({ section: 'days', status: 'CLOSED', search: 'hidden-stale-search' })));
    assert.equal(filteredDays.pages.days.total, 0);
    assert.equal(filteredDays.todayDay!.status, 'OPEN');
    const customer = await call('customer', { name: 'Khách test', phone: '0900000000' });
    const service = await call('service', { name: 'Dịch vụ test', price: 350000, duration: 60 });
    await t.test('internal appointment creation queues one inbox notification for owners and assigned staff',async()=>{
      const otherStaff=await User.create({spaId,name:'Other appointment staff',email:randomUUID()+'@example.test',passwordHash:hashPassword(randomUUID()),role:'STAFF'});
      const startAt=spaDay(new Date(Date.now()+86400000))+'T13:00:00+07:00';
      const data={customerId:customer.id,serviceId:service.id,staffId:String(staff._id),startAt};
      const key=randomUUID();
      const created=await call('appointment',data,key);
      assert.deepEqual(await call('appointment',data,key),created);
      const rows=await Notification.find({spaId,appointmentId:created.id}).sort({userId:1}).lean();
      assert.deepEqual(rows.map(row=>String(row.userId)).sort(),[String(owner._id),String(staff._id)].sort());
      assert.ok(rows.every(row=>row.title==='Lịch hẹn mới được tạo'));
      assert.ok(rows.every(row=>row.url===`/workspace/appointments?search=${created.id}`));
      assert.ok(rows.every(row=>row.body.includes('Dịch vụ test')));
      assert.equal(await Notification.countDocuments({spaId,appointmentId:created.id,userId:otherStaff._id}),0);
      await Appointment.updateOne({ _id: created.id, spaId }, { $set: { status: 'CANCELLED' } });
    });
    await t.test('open day preview includes all cash and reversals, excludes bank and rejects stale closing',async()=>{
      const spa=await Spa.create({name:'Day preview test'});extraSpaIds.push(spa._id);
      const owner=await User.create({spaId:spa._id,name:'Day owner',email:randomUUID()+'@example.test',passwordHash:hashPassword(randomUUID()),role:'OWNER'});
      await Control.create({spaId:spa._id,revision:0});
      const day=await Day.create({spaId:spa._id,day:spaDay(),opening:100,status:'OPEN'});
      const a:Actor={id:String(owner._id),spaId:String(spa._id),name:'Day owner',role:'OWNER',cashier:true};
      const base={spaId:spa._id,actorId:owner._id,day:spaDay(),method:'CASH',kind:'INCOME'};
      await CashEntry.create([{...base,direction:'IN',amount:500},{...base,direction:'OUT',amount:200,kind:'EXPENSE'},{...base,direction:'IN',amount:100,reversed:true},{...base,direction:'OUT',amount:100,kind:'REVERSAL'},{...base,direction:'IN',amount:900,method:'BANK_TRANSFER'}]);
      const view=await readWorkspace(a,workspaceQuery(new URLSearchParams({section:'days',pageSize:'5'})));
      const preview=view.pages.days.rows.find((r:any)=>String(r._id)===String(day._id));
      assert.equal(preview.cashIn,600);assert.equal(preview.cashOut,300);assert.equal(preview.liveExpected,400);assert.equal(preview.liveBankNet,900);
      assert.equal((await Day.findById(day._id))!.expected,undefined);
      await assert.rejects(operate(a,'closeDay',{day:spaDay(),counted:400,expectedPreview:399},randomUUID()),/Thu chi đã thay đổi/);
      assert.equal((await Day.findById(day._id))!.status,'OPEN');
      const key=randomUUID();await operate(a,'closeDay',{day:spaDay(),counted:390,expectedPreview:400},key);
      await operate(a,'closeDay',{day:spaDay(),counted:390,expectedPreview:400},key);
      const closed=await Day.findById(day._id);assert.equal(closed!.expected,400);assert.equal(closed!.difference,-10);
    });
    await t.test('owner removes a paid mistaken invoice with cash correction; invoice date is optional',async()=>{
      const bill=await call('serviceInvoice',{customerId:customer.id,staffId:String(staff._id),items:[{serviceId:service.id,total:100000}],issuedOn:'2026-10-01'});
      const before=await Invoice.findById(bill.id);assert.equal(spaDay(before!.createdAt),'2026-10-01');assert.ok(before!.recordedAt);
      await call('payment',{invoiceId:bill.id,amount:100000,method:'CASH',receivedConfirmation:true});
      const fresh=await Invoice.findById(bill.id);
      const payload={id:bill.id,expectedUpdatedAt:fresh!.updatedAt.toISOString(),reason:'Nhập sai hóa đơn',confirmDelete:true};
      await assert.rejects(operate(employee,'deleteInvoice',payload,randomUUID()),/Chỉ chủ spa/);
      const key=randomUUID();await call('deleteInvoice',payload,key);await call('deleteInvoice',payload,key);
      const retained=await Invoice.findById(bill.id);assert.equal(retained!.status,'CANCELLED');assert.equal(retained!.total,0);assert.equal(retained!.cancelledTotal,100000);
      const payment=await Payment.findOne({spaId,invoiceId:bill.id});assert.equal(payment!.reversed,true);
      assert.equal(await CashEntry.countDocuments({spaId,kind:'REVERSAL',originalId:payment!.receiptId}),1);
      assert.equal(await InvoiceLineCommission.countDocuments({spaId,invoiceId:bill.id}),0);
    });
    await t.test('voiding product invoices is single-shot across retries, new keys and concurrent requests',async()=>{
      const makeSale=async()=>{
        const product=await Product.create({spaId,name:'Void once '+randomUUID(),sku:randomUUID(),unit:'chai',price:90000,stock:10});
        const sale=await call('sellProduct',{customerId:customer.id,productId:String(product._id),quantity:2});
        return {product,invoice:(await Invoice.findById(sale.id))!,movement:(await StockMovement.findOne({spaId,invoiceId:sale.id}))!};
      };
      const first=await makeSale();
      const payload={id:String(first.invoice._id),expectedUpdatedAt:first.invoice.updatedAt.toISOString(),reason:'Void inventory once',confirmDelete:true};
      const key=randomUUID();
      await call('deleteInvoice',payload,key);
      await call('deleteInvoice',payload,key);
      assert.equal((await Product.findById(first.product._id))!.stock,10);
      const reversals=await StockMovement.find({spaId,reversalOf:first.movement._id});
      assert.equal(reversals.length,1);assert.equal(reversals[0].direction,'IN');assert.equal(reversals[0].quantity,2);
      assert.equal(await Audit.countDocuments({spaId,action:'deleteInvoice',targetId:first.invoice._id}),1);
      assert.equal(await Idempotency.countDocuments({spaId,key}),1);
      await assert.rejects(call('deleteInvoice',payload,randomUUID()),(error:any)=>error.status===409);
      const tombstone=(await Invoice.findById(first.invoice._id))!;
      await assert.rejects(call('deleteInvoice',{...payload,expectedUpdatedAt:tombstone.updatedAt.toISOString()},randomUUID()),(error:any)=>error.status===409);
      assert.equal((await Product.findById(first.product._id))!.stock,10);
      assert.equal(await StockMovement.countDocuments({spaId,reversalOf:first.movement._id}),1);

      const concurrent=await makeSale();
      const concurrentPayload={id:String(concurrent.invoice._id),expectedUpdatedAt:concurrent.invoice.updatedAt.toISOString(),reason:'Concurrent void once',confirmDelete:true};
      const keys=[randomUUID(),randomUUID()];
      const results=await Promise.allSettled(keys.map(requestKey=>call('deleteInvoice',concurrentPayload,requestKey)));
      assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
      assert.equal(results.filter(result=>result.status==='rejected').length,1);
      assert.equal((await Product.findById(concurrent.product._id))!.stock,10);
      assert.equal(await StockMovement.countDocuments({spaId,reversalOf:concurrent.movement._id}),1);
      assert.equal(await Audit.countDocuments({spaId,action:'deleteInvoice',targetId:concurrent.invoice._id}),1);
      assert.equal(await Idempotency.countDocuments({spaId,key:{$in:keys}}),1);
    });
    await t.test('invoice void preserves immutable snapshots for all commission ledgers',async()=>{
      const earners=[];
      for(let index=0;index<7;index++)earners.push(await User.create({spaId,name:`Void earner ${index}`,email:randomUUID()+'@example.test',passwordHash:hashPassword(randomUUID()),role:'STAFF'}));
      const earningService=await call('service',{name:'Void service '+randomUUID(),price:200000,commission:12000,duration:60});
      const secondService=await call('service',{name:'Void second service '+randomUUID(),price:300000,commission:18000,duration:60});
      const template=await call('packageTemplate',{serviceId:earningService.id,name:'Void package '+randomUUID(),totalSessions:5,price:2000000});
      const earnersActor=(staff:any):Actor=>({...actor,id:String(staff._id),name:staff.name,role:'STAFF',cashier:false});
      const createPackageInvoice=async(saleData:Record<string,unknown>,participants?:string[])=>{
        const sale=await call('sellPackage',{customerId:customer.id,templateId:template.id,dueDate:spaDay(),...saleData,...(participants?{participantIds:participants}:{})});
        const invoice=(await Invoice.findById(sale.invoiceId))!;
        await call('payment',{invoiceId:String(invoice._id),amount:invoice.total,method:'CASH',receivedConfirmation:true});
        return (await Invoice.findById(invoice._id))!;
      };
      // Preserve coverage for the legacy Commission ledger with an invoice created
      // before serviceItems/InvoiceLineCommission were introduced.
      const legacyAppointment=await Appointment.create({spaId,customerId:customer.id,serviceId:earningService.id,staffId:earners[0]._id,startAt:new Date(Date.now()-86400000),endAt:new Date(Date.now()-82800000),status:'CONFIRMED'});
      const legacyInvoice=await Invoice.create({spaId,appointmentId:legacyAppointment._id,customerId:customer.id,serviceId:earningService.id,description:earningService.name,total:100000,paid:0,commission:12000,kind:'SERVICE'});
      await call('completeAppointment',{id:String(legacyAppointment._id),existingInvoiceId:String(legacyInvoice._id)});
      const invoices=[
        {kind:'Commission',invoice:String(legacyInvoice._id)},
        {kind:'InvoiceLineCommission',invoice:(await call('serviceInvoice',{customerId:customer.id,items:[
          {serviceId:earningService.id,total:100000,performerId:String(earners[1]._id)},
          {serviceId:secondService.id,total:150000,performerId:String(earners[2]._id)},
        ]})).id},
        {kind:'SaleCommission',invoice:String((await createPackageInvoice({sellerId:String(earners[3]._id)}))._id)},
        {kind:'SharedSaleCommission',invoice:String((await createPackageInvoice({},[String(earners[4]._id),String(earners[5]._id)]))._id)},
      ];
      const ledgerModels={commission:Commission,invoiceLineCommission:InvoiceLineCommission,saleCommission:SaleCommission,sharedSaleCommission:SharedSaleCommission};
      const ledgerNames=Object.keys(ledgerModels) as Array<keyof typeof ledgerModels>;
      const ledgerByKind:Record<string,keyof typeof ledgerModels>={Commission:'commission',InvoiceLineCommission:'invoiceLineCommission',SaleCommission:'saleCommission',SharedSaleCommission:'sharedSaleCommission'};
      const ledgerRows=async(invoiceId:string)=>Object.fromEntries(await Promise.all(ledgerNames.map(async name=>[
        name,await ledgerModels[name].find({spaId,invoiceId}).lean(),
      ]))) as Record<keyof typeof ledgerModels,any[]>;
      const auditFor=(invoiceId:string)=>Audit.findOne({spaId,action:'deleteInvoice',targetId:new mongoose.Types.ObjectId(invoiceId)});
      const crossTenantSpa=await Spa.create({name:'Cross-tenant void '+randomUUID()});extraSpaIds.push(crossTenantSpa._id);
      await Control.create({spaId:crossTenantSpa._id,revision:0});
      const crossTenantOwner=await User.create({spaId:crossTenantSpa._id,name:'Foreign owner',email:randomUUID()+'@example.test',passwordHash:hashPassword(randomUUID()),role:'OWNER'});
      const lineInvoice=(await Invoice.findById(invoices[1].invoice))!;
      await assert.rejects(operate({...actor,id:String(crossTenantOwner._id),spaId:String(crossTenantSpa._id)},'deleteInvoice',{
        id:String(lineInvoice._id),expectedUpdatedAt:lineInvoice.updatedAt.toISOString(),reason:'Cross tenant attempt',confirmDelete:true,
      },randomUUID()),(error:any)=>error.status===404);
      assert.equal((await Invoice.findById(lineInvoice._id))!.status,'OPEN');
      assert.equal(await auditFor(String(lineInvoice._id)),null);

      for(const scenario of invoices){
        const invoice=(await Invoice.findById(scenario.invoice))!;
        const beforeRows=await ledgerRows(scenario.invoice);
        const beforeTotals=ledgerNames.reduce((sum,name)=>sum+beforeRows[name].reduce((n,row)=>n+row.amount,0),0);
        assert.ok(beforeTotals>0,`${scenario.kind} fixture must have earned commission`);
        assert.ok(beforeRows[ledgerByKind[scenario.kind]].length>0,`${scenario.kind} ledger fixture exists`);
        if(scenario.kind==='InvoiceLineCommission')assert.equal(beforeRows.invoiceLineCommission.length,2);
        const key=randomUUID();
        const payload={id:String(invoice._id),expectedUpdatedAt:invoice.updatedAt.toISOString(),reason:`Void ${scenario.kind}`,confirmDelete:true};
        const first=await call('deleteInvoice',payload,key);
        assert.deepEqual(await call('deleteInvoice',payload,key),first);
        const audit=(await auditFor(scenario.invoice))!;
        assert.ok(audit);
        assert.equal(String(audit.actorId),actor.id);
        assert.equal(audit.details.invoiceId,scenario.invoice);
        assert.equal(audit.details.reason,payload.reason);
        assert.ok(audit.createdAt instanceof Date);
        const snapshots=audit.details.commissionLedgers;
        assert.ok(snapshots?.before && snapshots?.after);
        assert.ok(!JSON.stringify(snapshots).includes('Khách test'));
        assert.ok(!JSON.stringify(snapshots).includes('0900000000'));
        for(const name of ledgerNames){
          const before=snapshots.before[name];
          const after=snapshots.after[name];
          assert.deepEqual(before.map((row:any)=>row.ledgerId).sort(),beforeRows[name].map((row:any)=>String(row._id)).sort());
          assert.deepEqual(after.map((row:any)=>row.ledgerId).sort(),before.map((row:any)=>row.ledgerId).sort());
          for(const snapshot of before){
            const original=beforeRows[name].find((row:any)=>String(row._id)===snapshot.ledgerId)!;
            assert.equal(snapshot.spaId,String(spaId));
            assert.equal(snapshot.invoiceId,scenario.invoice);
            assert.equal(snapshot.staffId,String(original.staffId));
            assert.equal(snapshot.amount,original.amount);
            assert.equal(snapshot.customerId,String(original.customerId));
            if(original.serviceId)assert.equal(snapshot.serviceId,String(original.serviceId));
            assert.equal(snapshot.status,'PENDING');
            assert.ok(snapshot.sourceType);
            assert.ok(snapshot.sourceId);
          }
          for(const snapshot of after){
            assert.equal(snapshot.amount,0);
            assert.equal(snapshot.status,'CANCELLED');
            assert.ok(snapshot.cancelledAt instanceof Date);
          }
          const retained=await ledgerModels[name].find({spaId,invoiceId:scenario.invoice}).lean();
          assert.deepEqual(retained.map((row:any)=>({id:String(row._id),amount:row.amount,cancelled:!!row.cancelledAt})).sort((a:any,b:any)=>a.id.localeCompare(b.id)),
            beforeRows[name].map((row:any)=>({id:String(row._id),amount:0,cancelled:true})).sort((a:any,b:any)=>a.id.localeCompare(b.id)));
        }
        if(scenario.kind==='InvoiceLineCommission'){
          assert.deepEqual(new Set(snapshots.before.invoiceLineCommission.map((row:any)=>row.staffId)),new Set([String(earners[1]._id),String(earners[2]._id)]));
        }
        assert.equal(await Audit.countDocuments({spaId,action:'deleteInvoice',targetId:invoice._id}),1);
        await assert.rejects(call('deleteInvoice',payload,randomUUID()),(error:any)=>error.status===409);
        const afterNewKeyAudit=(await auditFor(scenario.invoice))!;
        assert.deepEqual(afterNewKeyAudit.details.commissionLedgers,snapshots);
        const afterNewKeyRows=await ledgerRows(scenario.invoice);
        for(const name of ledgerNames)assert.deepEqual(afterNewKeyRows[name].map((row:any)=>({id:String(row._id),amount:row.amount,cancelled:!!row.cancelledAt})).sort((a:any,b:any)=>a.id.localeCompare(b.id)),
          beforeRows[name].map((row:any)=>({id:String(row._id),amount:0,cancelled:true})).sort((a:any,b:any)=>a.id.localeCompare(b.id)));
        for(const staff of earners){
          const rows=(await readPayroll(earnersActor(staff),payrollQuery(new URLSearchParams({month:spaDay().slice(0,7),view:'commission'})))).rows;
          assert.ok(rows.every((row:any)=>String(row.invoiceId)!==scenario.invoice));
        }
      }

      const rollbackInvoice=(await call('serviceInvoice',{customerId:customer.id,items:[{serviceId:earningService.id,total:100000,performerId:String(earners[0]._id)}]}));
      await call('payment',{invoiceId:rollbackInvoice.id,amount:100000,method:'CASH',receivedConfirmation:true});
      const rollbackBill=(await Invoice.findById(rollbackInvoice.id))!;
      const rollbackCommission=await InvoiceLineCommission.findOne({spaId,invoiceId:rollbackBill._id});
      assert.ok(rollbackCommission,'rollback fixture must create a per-line commission ledger');
      const rollbackPayment=(await Payment.findOne({spaId,invoiceId:rollbackBill._id}))!;
      const originalReceipt=(await CashEntry.findById(rollbackPayment.receiptId))!;
      const product=await Product.create({spaId,name:'Rollback movement '+randomUUID(),sku:randomUUID(),unit:'chai',price:1,stock:1});
      await StockMovement.create({spaId,productId:product._id,productName:product.name,sku:product.sku,unit:product.unit,actorId:actor.id,actorName:actor.name,direction:'IN',kind:'MANUAL',quantity:1,invoiceId:rollbackBill._id});
      const rollbackPayload={id:String(rollbackBill._id),expectedUpdatedAt:rollbackBill.updatedAt.toISOString(),reason:'Must rollback',confirmDelete:true};
      await assert.rejects(call('deleteInvoice',rollbackPayload,randomUUID()),(error:any)=>error.status===409);
      assert.equal((await InvoiceLineCommission.findById(rollbackCommission._id))!.amount,rollbackCommission.amount);
      assert.equal((await InvoiceLineCommission.findById(rollbackCommission._id))!.cancelledAt,undefined);
      assert.equal((await Payment.findById(rollbackPayment._id))!.reversed,false);
      assert.equal((await CashEntry.findById(originalReceipt._id))!.reversed,false);
      assert.equal(await CashEntry.countDocuments({spaId,kind:'REVERSAL',originalId:originalReceipt._id}),0);
      assert.notEqual((await Invoice.findById(rollbackBill._id))!.status,'CANCELLED');
      assert.equal(await auditFor(String(rollbackBill._id)),null);

      const assertPayrollBlocksVoid=async(staff:any,status:'APPROVED'|'PAID'|'LEGACY')=>{
        const appointment=await Appointment.create({spaId,customerId:customer.id,serviceId:earningService.id,staffId:staff._id,startAt:new Date(Date.now()-86400000),endAt:new Date(Date.now()-82800000),status:'CONFIRMED'});
        const createdBill=await Invoice.create({spaId,appointmentId:appointment._id,customerId:customer.id,serviceId:earningService.id,description:earningService.name,total:100000,paid:0,commission:12000,kind:'SERVICE'});
        await call('completeAppointment',{id:String(appointment._id),existingInvoiceId:String(createdBill._id)});
        const bill=(await Invoice.findById(createdBill._id))!;
        const commission=await Commission.findOne({spaId,invoiceId:bill._id});
        assert.ok(commission,'legacy commission fixture must create a Commission ledger row');
        assert.equal(commission.amount,12000);
        let payroll:any;
        if(status==='LEGACY'){
          payroll=await Payroll.create({spaId,staffId:staff._id,staffName:staff.name,month:spaDay().slice(0,7),baseSalary:0,commissionTotal:commission.amount,total:commission.amount,commissionIds:[commission._id],status:'APPROVED',approvedBy:actor.id,approvedAt:new Date()});
          assert.equal(commission.payrollId,undefined,'legacy settled fixture uses the payroll snapshot without backfilling payrollId');
        }else{
          const saved=await call('savePayroll',{staffId:String(staff._id),month:spaDay().slice(0,7),baseSalary:0});
          payroll=(await Payroll.findById(saved.id))!;
          assert.ok(payroll.commissionIds.some((id:any)=>String(id)===String(commission._id)),'saved payroll must contain this Commission ID');
          assert.equal(commission.payrollId,undefined,'saving a draft must not claim the commission');
          await call('approvePayroll',{id:saved.id,expectedTotal:payroll.total});
          if(status==='PAID')await call('payPayroll',{id:saved.id,method:'CASH',receivedConfirmation:true});
          payroll=(await Payroll.findById(saved.id))!;
        }
        const expectedStatus=status==='LEGACY'?'APPROVED':status;
        assert.equal(payroll.status,expectedStatus);
        assert.ok(payroll.commissionIds.some((id:any)=>String(id)===String(commission._id)),'settled payroll snapshot must own the invoice commission ID');
        const settledCommission=(await Commission.findById(commission._id))!;
        assert.equal(String(settledCommission.payrollId || ''),status==='LEGACY'?'':String(payroll._id));
        const payload={id:String(bill._id),expectedUpdatedAt:bill.updatedAt.toISOString(),reason:`Blocked ${status}`,confirmDelete:true};
        await assert.rejects(call('deleteInvoice',payload,randomUUID()),(error:any)=>error.status===409);
        const afterRejectedDelete=(await Commission.findById(commission._id))!;
        assert.equal(afterRejectedDelete.amount,commission.amount);
        assert.equal(String(afterRejectedDelete.payrollId || ''),status==='LEGACY'?'':String(payroll._id));
        assert.equal((await Invoice.findById(bill._id))!.status,'OPEN');
        assert.equal(await auditFor(String(bill._id)),null);
      };
      await assertPayrollBlocksVoid(earners[4],'APPROVED');
      await assertPayrollBlocksVoid(earners[5],'PAID');
      await assertPayrollBlocksVoid(earners[6],'LEGACY');
    });
    await t.test('signed package visit and additional standalone service commit together and retry once',async()=>{
      const template=await call('packageTemplate',{serviceId:service.id,name:'Mixed visit',price:900000,totalSessions:3});
      const sale=await call('sellPackage',{customerId:customer.id,templateId:template.id,dueDate:spaDay(),gifts:[],promotion:''});
      const plan=await Treatment.findOne({spaId,invoiceId:sale.invoiceId});
      const product=await Product.create({spaId,name:'Product mixed',sku:randomUUID(),unit:'ml',price:80000,stock:5});
      const data={additionalProducts:[{productId:String(product._id),quantity:2,unitPrice:80000}],customerId:customer.id,serviceId:service.id,treatmentId:String(plan!._id),staffId:String(staff._id),signature:signed,remainingBefore:3,additionalServices:[{serviceId:service.id,total:60000}]};
      const key=randomUUID();const result=await call('invoice',data,key);await call('invoice',data,key);
      const invoice=await Invoice.findById(result.invoiceId);assert.equal(invoice!.total,220000);assert.equal(invoice!.kind,'SESSION');assert.equal(invoice!.serviceItems[0].total,0);
      assert.equal((await Treatment.findById(plan!._id))!.remaining,2);
      assert.equal((await Product.findById(product._id))!.stock,3);
      assert.equal(await StockMovement.countDocuments({spaId,checkoutInvoiceId:invoice!._id}),1);
      await assert.rejects(call('invoice',{...data,remainingBefore:2,additionalServices:[{serviceId:new mongoose.Types.ObjectId().toString(),total:10}]}));
      await assert.rejects(call('invoice',{...data,remainingBefore:2,additionalProducts:[{productId:String(product._id),quantity:99,unitPrice:80000}]}));
      assert.equal((await Treatment.findById(plan!._id))!.remaining,2);
      assert.equal((await Product.findById(product._id))!.stock,3);
    });
    await t.test('multiple treatments share a visit and invoice with independent signatures, atomic debit and commission',async()=>{
      const svcA=await call('service',{name:'Gội hai gói',price:100000,commission:10000});
      const svcB=await call('service',{name:'Triệt hai gói',price:300000,commission:20000});
      const a=await call('packageTemplate',{serviceId:svcA.id,name:'Gói gội',price:600000,totalSessions:5});
      const b=await call('packageTemplate',{serviceId:svcB.id,name:'Gói triệt',price:900000,totalSessions:5});
      const buy=async(templateId:string,customerId=customer.id)=>{
        const sale=await call('sellPackage',{customerId,templateId,dueDate:spaDay()});
        return (await Treatment.findOne({spaId,invoiceId:sale.invoiceId}))!;
      };
      const one=await buy(a.id),two=await buy(b.id);
      const otherCustomer=await call('customer',{name:'Khách gói khác',phone:'0900012345'});
      const foreign=await buy(b.id,otherCustomer.id);
      const uses=(left=5,right=5)=>[{treatmentId:String(one._id),remainingBefore:left,signature:signed,performerId:String(staff._id)},{treatmentId:String(two._id),remainingBefore:right,signature:signed,performerId:String(staff._id)}];
      const payload={customerId:customer.id,serviceId:svcA.id,staffId:String(staff._id),treatments:uses()};
      await assert.rejects(call('invoice',{...payload,treatments:[uses()[0],uses()[0]]}),/trùng/);
      const rollbackBefore={
        invoices:await Invoice.countDocuments({spaId}),uses:await TreatmentUse.countDocuments({spaId}),
        commissions:await Commission.countDocuments({spaId}),remaining:[one,two,foreign].map(plan=>…35525 tokens truncated…(targetMonth: string, view: 'salary' | 'commission' = 'salary') =>
        readPayroll(actor, payrollQuery(new URLSearchParams({
          month: targetMonth, view, employee: String(person._id),
        })));
      const preview = async (targetMonth: string) => (await readMonth(targetMonth)).rows[0];
      assert.equal((await preview(previousMonth)).serviceCommissionTotal, 700);
      const monthPreview = await readMonth(month);
      assert.equal(monthPreview.rows[0].serviceCommissionTotal, 300);
      assert.equal(monthPreview.summary.unsettled, 300);
      const nextMonth = period.end.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);
      assert.equal((await preview(nextMonth)).serviceCommissionTotal, 300);
      assert.equal((await readMonth(month, 'commission')).summary.unsettled, 300);

      const draft = await call('savePayroll', { staffId: String(person._id), month, baseSalary: 0 });
      const saved = await Payroll.findById(draft.id);
      assert.equal(saved!.serviceCommissionTotal, 300);
      assert.equal(saved!.commissionIds.length, 2);
      assert.equal(saved!.carryoverCount, 0);
      await call('approvePayroll', { id: draft.id, expectedTotal: 300 });
      const approved = await Payroll.findById(draft.id);
      assert.equal(approved!.status, 'APPROVED');
      assert.equal(approved!.serviceCommissionTotal, 300);
      assert.equal((await readMonth(month)).summary.unsettled, 0);
      const afterApproval = await Commission.find({ _id: { $in: commissions.map(row => row._id) } }).sort({ earnedAt: 1 });
      assert.equal(afterApproval.filter((row: { payrollId?: mongoose.Types.ObjectId }) => String(row.payrollId) === draft.id).length, 2);
      assert.equal(afterApproval[0].payrollId, undefined);
      assert.equal(afterApproval[3].payrollId, undefined);
      assert.equal((await preview(previousMonth)).serviceCommissionTotal, 700);
      assert.equal((await preview(nextMonth)).serviceCommissionTotal, 300);
    });
    await t.test('legacy approved and paid line commissions are settled, correction-protected and tenant-scoped',async()=>{
      const person=await User.create({spaId,name:'Legacy line payroll',email:randomUUID()+'@example.test',passwordHash:hashPassword(randomUUID()),role:'STAFF',baseSalary:4000000});
      const lineService=await call('service',{name:'Legacy payroll line service',price:100000,commission:12000});
      const currentMonth=spaDay().slice(0,7);
      const prior=new Date();prior.setMonth(prior.getMonth()-1);
      const priorMonth=prior.toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
      for(const [offset,statusValue] of [[0,'APPROVED'],[1,'PAID']] as const) {
        const bill=await call('serviceInvoice',{customerId:customer.id,items:[{serviceId:lineService.id,total:100000,performerId:String(person._id)}]});
        const invoice=(await Invoice.findById(bill.id))!;
        const line=(await InvoiceLineCommission.findOne({spaId,invoiceId:bill.id}))!;
        const month=new Date(prior);month.setMonth(month.getMonth()-offset);
        await Payroll.create({spaId,staffId:person._id,staffName:person.name,month:month.toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7),baseSalary:4000000,earnedBase:4000000,commissionTotal:12000,serviceCommissionTotal:12000,saleCommissionTotal:0,commissionCount:1,commissionIds:[line._id],bonus:0,deductions:0,total:4012000,note:'Legacy '+statusValue,status:statusValue});
        const beforeInvoice=JSON.stringify(invoice.toObject());const beforeLine=JSON.stringify(line.toObject());
        const auditCount=await Audit.countDocuments({spaId,targetId:invoice._id});
        const correction={id:bill.id,expectedUpdatedAt:invoice.updatedAt.toISOString(),description:invoice.description,total:invoice.total,reason:'Legacy settled must block'};
        for(const [action,data] of [['updateInvoice',correction],['cancelInvoice',{id:bill.id,expectedUpdatedAt:invoice.updatedAt.toISOString(),reason:correction.reason}],['deleteInvoice',{id:bill.id,expectedUpdatedAt:invoice.updatedAt.toISOString(),reason:correction.reason,confirmDelete:true}]] as const) {
          await assert.rejects(call(action,data),status(409));
          assert.equal(JSON.stringify((await Invoice.findById(invoice._id))!.toObject()),beforeInvoice);
          assert.equal(JSON.stringify((await InvoiceLineCommission.findById(line._id))!.toObject()),beforeLine);
        }
        assert.equal(await Audit.countDocuments({spaId,targetId:invoice._id}),auditCount);
        assert.equal((await InvoiceLineCommission.findById(line._id))!.payrollId,undefined);
      }

      const crossTenantBill=await call('serviceInvoice',{customerId:customer.id,items:[{serviceId:lineService.id,total:100000,performerId:String(person._id)}]});
      const crossTenantInvoice=(await Invoice.findById(crossTenantBill.id))!;
      const crossTenantLine=(await InvoiceLineCommission.findOne({spaId,invoiceId:crossTenantBill.id}))!;
      const foreignSpa=await Spa.create({name:'Foreign legacy payroll '+randomUUID()});extraSpaIds.push(foreignSpa._id);
      await Payroll.create({spaId:foreignSpa._id,staffId:person._id,staffName:person.name,month:priorMonth,baseSalary:0,earnedBase:0,commissionTotal:12000,serviceCommissionTotal:12000,saleCommissionTotal:0,commissionCount:1,commissionIds:[crossTenantLine._id],bonus:0,deductions:0,total:12000,note:'Foreign tenant reference',status:'APPROVED'});
      const crossTenantInvoiceBefore=JSON.stringify(crossTenantInvoice.toObject());
      const crossTenantLineBefore=JSON.stringify(crossTenantLine.toObject());
      const crossTenantAuditCount=await Audit.countDocuments({spaId,targetId:crossTenantInvoice._id});
      await assert.rejects(call('updateInvoice',{id:crossTenantBill.id,expectedUpdatedAt:crossTenantInvoice.updatedAt.toISOString(),description:crossTenantInvoice.description,total:crossTenantInvoice.total,reason:'Line commission history blocks edits'}),/hoa hồng theo dòng/i);
      assert.equal(JSON.stringify((await Invoice.findById(crossTenantInvoice._id))!.toObject()),crossTenantInvoiceBefore);
      assert.equal(JSON.stringify((await InvoiceLineCommission.findById(crossTenantLine._id))!.toObject()),crossTenantLineBefore);
      assert.equal(await Audit.countDocuments({spaId,targetId:crossTenantInvoice._id}),crossTenantAuditCount);
      await call('cancelInvoice',{id:crossTenantBill.id,expectedUpdatedAt:crossTenantInvoice.updatedAt.toISOString(),reason:'Foreign tenant payroll must not block'});
      assert.equal((await Invoice.findById(crossTenantInvoice._id))!.status,'CANCELLED');
      assert.equal((await InvoiceLineCommission.findById(crossTenantLine._id))!.amount,0);

      const payrollPreviewBill=await call('serviceInvoice',{customerId:customer.id,items:[{serviceId:lineService.id,total:100000,performerId:String(person._id)}]});
      const payrollPreviewLine=(await InvoiceLineCommission.findOne({spaId,invoiceId:payrollPreviewBill.id}))!;

      const draft=await call('savePayroll',{staffId:String(person._id),month:currentMonth,bonus:0,deductions:0,note:''});
      const saved=(await Payroll.findById(draft.id))!;
      assert.equal(saved.commissionTotal,12000);assert.deepEqual(saved.invoiceLineCommissionIds.map(String),[String(payrollPreviewLine._id)]);
      const view=await readPayroll(actor,payrollQuery(new URLSearchParams({month:currentMonth,employee:String(person._id)})));
      assert.equal(view.summary.unsettled,12000);assert.equal(view.summary.unsettledCount,1);
    });
    const closedBill = await call('invoice', { customerId: customer.id, serviceId: service.id });
    const closedPayment = await call('payment', { invoiceId: closedBill.id, amount: 100000, method: 'CASH', receivedConfirmation: true });
    await call('closeDay', { day: spaDay(), counted: 450000 });
    await assert.rejects(call('openDay', { day: spaDay(), opening: 0 }), (error: any) => error.status === 409);
    await assert.rejects(call('cash', { direction: 'IN', amount: 1000, method: 'CASH', note: 'Sau chốt' }));
    await t.test('sổ đã chốt: lỗi đảo tiền rollback cả invoice/payment dù đã xử lý chúng trước touchDay', async () => {
      const originalPayment = (await Payment.findById(closedPayment.id))!;
      const receiptId = String(originalPayment.receiptId);
      const before = await snapshot();
      const key = randomUUID();
      await assert.rejects(call('reverseCash', { id: receiptId, reason: 'Day is closed' }, key), status(400));
      assert.deepEqual(await snapshot(), before);
      assert.equal((await Invoice.findById(closedBill.id))!.paid, 100000);
      assert.equal((await Payment.findById(closedPayment.id))!.reversed, false);
      assert.equal((await CashEntry.findById(receiptId))!.reversed, false);
      assert.equal(await Idempotency.countDocuments({ spaId, key }), 0);
      assert.equal((await Day.findOne({ spaId, day: spaDay() }))!.status, 'CLOSED');
    });
    await t.test('package sales, refunds, leave approval and attendance share transactional payroll', async () => {
      const spa = await Spa.create({name:'Update regression '+randomUUID()});extraSpaIds.push(spa._id);
      const scope={spaId:spa._id};await Control.create(scope);
      const owner=await User.create({...scope,name:'Owner',email:randomUUID()+'@example.test',passwordHash:hashPassword(randomUUID()),role:'OWNER'});
      const staff=await User.create({...scope,name:'Seller',email:randomUUID()+'@example.test',passwordHash:hashPassword(randomUUID()),role:'STAFF'});
      const who:Actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER',cashier:false};
      const employee:Actor={...who,id:String(staff._id),role:'STAFF'};
      const call=(action:string,data:unknown,key=randomUUID())=>operate(who,action,data,key);
      await call('openDay',{day:spaDay(),opening:0});
      const customer=await call('customer',{name:'Guest',phone:'0912345678'});
      const service=await call('service',{name:'Service',duration:60,price:2000000,commission:20000});
      const template=await call('packageTemplate',{name:'Package',serviceId:service.id,totalSessions:10,price:2000000});
      const sale=await call('sellPackage',{customerId:customer.id,templateId:template.id,sellerId:String(staff._id),dueDate:spaDay(),promotion:'Gift',gifts:[{serviceId:service.id}]});
      const invoice=(await Invoice.findById(sale.invoiceId))!;assert.equal(String(invoice.sellerId),String(staff._id));
      assert.equal(await SaleCommission.countDocuments(scope),0);
      const payment={invoiceId:sale.invoiceId,amount:500000,method:'CASH',receivedConfirmation:true};const key=randomUUID();
      const first=await call('payment',payment,key);assert.deepEqual(await call('payment',payment,key),first);
      await call('payment',{...payment,amount:1500000});
      assert.equal((await SaleCommission.find(scope)).reduce((n,r)=>n+r.amount,0),100000);
      assert.equal(await SaleCommission.countDocuments(scope),2);
      await assert.rejects(call('payment',{...payment,amount:1}));
      const refund={exceptionApproved:true,invoiceId:sale.invoiceId,amount:500000,method:'CASH',receivedConfirmation:true,reason:'Owner approved refund'};const rk=randomUUID();
      await call('refundPackage',refund,rk);await call('refundPackage',refund,rk);
      assert.equal((await SaleCommission.find(scope)).reduce((n,r)=>n+r.amount,0),75000);
      assert.equal(await CashEntry.countDocuments({...scope,kind:'REFUND'}),1);
      await assert.rejects(operate(employee,'refundPackage',refund,randomUUID()),(e:any)=>e.status===403);
      const product=await call('product',{name:'No SKU',sizeMl:100,price:100000});
      assert.match((await Product.findById(product.id))!.sku,/^SP-/);
      await call('stockMovement',{productId:product.id,direction:'IN',quantity:2});
      assert.equal((await Product.findById(product.id))!.stock,2);
      const month=spaDay().slice(0,7),day=month+'-01';
      const request=await operate(employee,'recordStaffLeave',{staffId:String(staff._id),startDay:day,endDay:day,period:'AM',type:'PERMITTED'},randomUUID());
      assert.equal((await StaffLeave.findById(request.id))!.status,'PENDING');
      await assert.rejects(operate(employee,'reviewStaffLeave',{id:request.id,status:'APPROVED'},randomUUID()),(e:any)=>e.status===403);
      await call('reviewStaffLeave',{id:request.id,status:'APPROVED',paid:true});
      await assert.rejects(operate(employee,'recordStaffLeave',{id:request.id,staffId:String(staff._id),day,type:'UNPERMITTED'},randomUUID()),(e:any)=>e.status===403);
      await assert.rejects(call('recordWorkday',{staffId:String(staff._id),day,period:'AM'}),/trùng/);
      await call('recordWorkday',{staffId:String(staff._id),day,period:'PM'});
      await call('setStaffSalary',{staffId:String(staff._id),baseSalary:5200000});
      await call('setSalaryPolicy',{staffId:String(staff._id),standardDays:26,paidLeaveDays:1,mode:'DAILY'});
      await assert.rejects(call('savePayroll',{staffId:String(staff._id),month}),/ngày công/);
      const draft=await call('savePayroll',{staffId:String(staff._id),month,attendanceConfirmed:true});
      const payroll=(await Payroll.findById(draft.id))!;assert.equal(payroll.earnedBase,200000);assert.equal(payroll.saleCommissionTotal,75000);assert.equal(payroll.total,275000);
      await call('setSalaryPolicy',{staffId:String(staff._id),standardDays:25,paidLeaveDays:1,mode:'DAILY'});
      await assert.rejects(call('approvePayroll',{id:draft.id,expectedTotal:payroll.total}),/đã đổi/);
      await call('savePayroll',{id:draft.id,staffId:String(staff._id),month,attendanceConfirmed:true});
      const updated=(await Payroll.findById(draft.id))!;await call('approvePayroll',{id:draft.id,expectedTotal:updated.total});
      assert.equal(await SaleCommission.countDocuments({...scope,payrollId:updated._id}),3);
      const own=await readPayroll(employee,payrollQuery(new URLSearchParams({month,view:'commission'})));
      assert.equal(own.summary.saleCommission,75000);assert.equal(own.total,3);
      assert.equal(own.rows[0].customerName,'Guest'); assert.equal(own.rows[0].customerPhone,'0912345678');
      const ownerSale=await call('sellPackage',{customerId:customer.id,templateId:template.id,dueDate:spaDay()});
      const ownerPlan=await Treatment.findById(ownerSale.id);
      const ownerPayment={invoiceId:String(ownerPlan!.invoiceId),amount:100000,method:'CASH',receivedConfirmation:true};
      const ownerKey=randomUUID(); await call('payment',ownerPayment,ownerKey); await call('payment',ownerPayment,ownerKey);
      const ownerCommissions=await readPayroll(who,payrollQuery(new URLSearchParams({month,view:'commission',employee:who.id})));
      assert.equal(ownerCommissions.total,1); assert.equal(ownerCommissions.summary.saleCommission,5000);
      assert.equal(String(ownerCommissions.rows[0].staffId),who.id);
      assert.equal(ownerCommissions.rows[0].customerName,'Guest'); assert.equal(ownerCommissions.rows[0].customerPhone,'0912345678');
      const staffOnly=await readPayroll(employee,payrollQuery(new URLSearchParams({month,view:'commission'})));
      assert.equal(staffOnly.total,3); assert.ok(staffOnly.rows.every(r=>String(r.staffId)===employee.id));
      const salaryView=await readPayroll(who,payrollQuery(new URLSearchParams({month,view:'salary'})));
      assert.ok(salaryView.people.every(p=>p.role==='STAFF')); assert.ok(!salaryView.people.some(p=>String(p._id)===who.id));
      const ownerSalary=await readPayroll(who,payrollQuery(new URLSearchParams({month,view:'salary',employee:who.id})));
      assert.equal(ownerSalary.total,0); assert.equal(ownerSalary.workTotal,0); assert.equal(ownerSalary.leaveTotal,0); assert.equal(ownerSalary.salarySummary.length,0);
      for (const [action,data] of [
        ['setStaffSalary',{staffId:who.id,baseSalary:1000000}],
        ['setSalaryPolicy',{staffId:who.id,standardDays:26,paidLeaveDays:0,mode:'NONE'}],
        ['recordWorkday',{staffId:who.id,day:spaDay(),period:'FULL'}],
        ['recordStaffLeave',{staffId:who.id,day:spaDay(),period:'FULL',type:'PERMITTED'}],
        ['savePayroll',{staffId:who.id,month,baseSalary:1000000}],
      ] as const) await assert.rejects(call(action,data));
      const afterOwnerRejection=await readPayroll(who,payrollQuery(new URLSearchParams({month,view:'commission',employee:who.id})));
      assert.equal(afterOwnerRejection.summary.saleCommission,5000);


    });
    await t.test('shared package sale commissions: equal pool, installments, rollback, refunds and payroll', async () => {
      const spa=await Spa.create({name:'Shared commission '+randomUUID()}); extraSpaIds.push(spa._id);
      const scope={spaId:spa._id}; await Control.create(scope);
      const people=[];
      for(const role of ['OWNER','STAFF','STAFF']) people.push(await User.create({...scope,name:'Share '+role+' '+people.length,email:randomUUID()+'@example.test',passwordHash:hashPassword(randomUUID()),role}));
      const who:Actor={id:String(people[0]._id),spaId:String(spa._id),name:people[0].name,role:'OWNER',cashier:false};
      const worker:Actor={...who,id:String(people[1]._id),name:people[1].name,role:'STAFF'};
      const call=(action:string,data:unknown,key=randomUUID())=>operate(who,action,data,key);
      await call('openDay',{day:spaDay(),opening:0});
      const customer=await call('customer',{name:'Shared guest',phone:'0912345678'});
      const service=await call('service',{name:'Shared service',duration:60,price:2000000});
      const template=await call('packageTemplate',{name:'Shared plan',serviceId:service.id,totalSessions:10,price:2000000});
      const sale={customerId:customer.id,templateId:template.id,dueDate:spaDay(),participantIds:people.slice(1).map(p=>String(p._id))};
      const before=await Invoice.countDocuments(scope);
      await assert.rejects(call('sellPackage',{...sale,participantIds:[worker.id,worker.id]}));
      await assert.rejects(call('sellPackage',{...sale,participantIds:[worker.id,actor.id]}));
      await User.updateOne({_id:people[2]._id},{$set:{active:false}});
      await assert.rejects(call('sellPackage',sale)); await User.updateOne({_id:people[2]._id},{$set:{active:true}});
      assert.equal(await Invoice.countDocuments(scope),before);
      const sold=await call('sellPackage',sale); const plan=await Treatment.findById(sold.id); const invoiceId=String(plan!.invoiceId);
      const purchase=(await Invoice.findById(invoiceId))!; assert.equal(purchase.saleCommissionVersion,2); assert.equal(purchase.saleParticipants.length,2);
      assert.equal(await SharedSaleCommission.countDocuments(scope),0);
      const payment={invoiceId,amount:1000001,method:'CASH',receivedConfirmation:true}; const key=randomUUID();
      const paid=await call('payment',payment,key); assert.deepEqual(await call('payment',payment,key),paid);
      await call('payment',{...payment,amount:999999});
      assert.equal(await SharedSaleCommission.countDocuments(scope),4); assert.equal(await SaleCommission.countDocuments(scope),0);
      let ledger=await SharedSaleCommission.find(scope); assert.equal(ledger.reduce((n,r)=>n+r.amount,0),100000);
      for(const person of people.slice(1)) assert.equal(ledger.filter(r=>String(r.staffId)===String(person._id)).reduce((n,r)=>n+r.amount,0),50000);
      // The purchase snapshot survives staff name/activity changes.
      await User.updateOne({_id:people[2]._id},{$set:{name:'Changed after sale',active:false}});
      const month=spaDay().slice(0,7);
      const view=await readPayroll(worker,payrollQuery(new URLSearchParams({month,view:'commission'})));
      assert.equal(view.summary.saleCommission,50000); assert.ok(view.rows.every(r=>String(r.staffId)===worker.id && r.shareCount===2));
      assert.equal(view.rows[0].customerName,'Shared guest');
      await assert.rejects(readPayroll(worker,payrollQuery(new URLSearchParams({month,view:'commission',employee:who.id}))));
      const overview=await readPayroll(who,payrollQuery(new URLSearchParams({month,view:'salary',employee:worker.id})));
      assert.equal(overview.total,1); assert.equal(overview.rows.length,1); assert.equal(overview.rows[0].status,'NOT_CREATED');
      assert.equal(overview.rows[0].total,null); assert.equal(overview.rows[0].saleCommissionTotal,50000);
      assert.equal(await Payroll.countDocuments({...scope,staffId:worker.id}),0);
      const draft=await call('savePayroll',{staffId:worker.id,month,baseSalary:0}); const payroll=(await Payroll.findById(draft.id))!;
      assert.equal(payroll.saleCommissionTotal,50000); assert.equal(payroll.sharedSaleCommissionIds.length,2); assert.equal(payroll.saleCommissionIds.length,0);
      await call('approvePayroll',{id:draft.id,expectedTotal:50000}); await call('payPayroll',{id:draft.id,method:'CASH',receivedConfirmation:true});
      assert.equal(await SharedSaleCommission.countDocuments({...scope,payrollId:payroll._id}),2);
      await call('refundPackage',{invoiceId,amount:500000,method:'CASH',receivedConfirmation:true,reason:'Approved exception test',exceptionApproved:true});
      ledger=await SharedSaleCommission.find(scope); assert.equal(ledger.reduce((n,r)=>n+r.amount,0),75000);
      assert.equal((await Payroll.findById(draft.id))!.total,50000); assert.equal((await Payroll.findById(draft.id))!.status,'PAID');
      assert.equal(await SharedSaleCommission.countDocuments({...scope,staffId:worker.id,amount:-12500,payrollId:{$exists:false}}),1);
      const invoiceAfter=await Invoice.findById(invoiceId); assert.equal(invoiceAfter!.saleCommissionAccrued,75000);
      await User.updateOne({_id:people[2]._id},{$set:{active:true}});
      const three=await call('sellPackage',{...sale,participantIds:people.map(p=>String(p._id))}); const threePlan=await Treatment.findById(three.id);
      await call('payment',{...payment,invoiceId:String(threePlan!.invoiceId),amount:2000000});
      const thirds=await SharedSaleCommission.find({...scope,invoiceId:threePlan!.invoiceId});
      assert.equal(thirds.length,3); assert.equal(thirds.reduce((n,r)=>n+r.amount,0),100000);
      assert.equal(Math.max(...thirds.map(r=>r.amount))-Math.min(...thirds.map(r=>r.amount)),1);
      const own=await readPayroll(who,payrollQuery(new URLSearchParams({month,view:'commission',employee:who.id})));
      assert.equal(own.summary.saleCommission,thirds.find(r=>String(r.staffId)===who.id)!.amount);
    });
    await t.test('catalog import: owner authentication, concurrent retries, package date and atomic rollback', async () => {
      const spa = await Spa.create({ name: 'Catalog import fixture' }); extraSpaIds.push(spa._id);
      const scope = { spaId: spa._id }, password = randomUUID();
      const owner = await User.create({ ...scope, name: 'Catalog owner', email: randomUUID() + '@example.test', passwordHash: hashPassword(password), role: 'OWNER' });
      const employee = await User.create({ ...scope, name: 'Catalog staff', email: randomUUID() + '@example.test', passwordHash: hashPassword(password), role: 'STAFF' });
      await Control.create({ ...scope, revision: 0 });
      const row: CatalogEntry = { row: 2, service: { name: 'Triệt lông Nách', category: 'TRIỆT LÔNG', price: 100000, commission: 0 }, source: { min: 700000, max: 700000, notes: 'fixture' }, package: { name: 'Triệt lông Nách · 3 năm', packageType: 'TIME', durationMonths: 36, price: 700000 } };
      await assert.rejects(importCatalog(String(employee._id), password, [row]), (e:any)=>e.status===403);
      await assert.rejects(importCatalog(String(owner._id), 'wrong', [row]), (e:any)=>e.status===403);
      await Promise.all([importCatalog(String(owner._id), password, [row]), importCatalog(String(owner._id), password, [row])]);
      assert.equal(await Service.countDocuments(scope), 1); assert.equal(await PackageTemplate.countDocuments(scope), 1);
      assert.equal(await Audit.countDocuments({ ...scope, action:'importCatalog' }), 1);
      assert.equal(await Invoice.countDocuments(scope), 0); assert.equal(await CashEntry.countDocuments(scope), 0); assert.equal(await Commission.countDocuments(scope), 0);
      const plan = await PackageTemplate.findOne(scope), service = await Service.findOne(scope);
      assert.equal(service!.duration, undefined); assert.equal(service!.price,100000); assert.equal(plan!.price,700000); assert.equal(plan!.totalSessions,undefined);
      await assert.rejects(importCatalog(String(owner._id), password, [{...row,service:{...row.service,price:200000}}]), (e:any)=>e.status===409);
      const originalCreate = PackageTemplate.create;
      try {
        (PackageTemplate as any).create = async () => { throw new Error('import rollback fixture'); };
        await assert.rejects(importCatalog(String(owner._id),password,[{...row,row:3,service:{...row.service,name:'Triệt lông Mép'},package:{...row.package!,name:'Triệt lông Mép · 3 năm'}}]), /import rollback/);
      } finally { (PackageTemplate as any).create = originalCreate; }
      assert.equal(await Service.countDocuments(scope),1); assert.equal(await Idempotency.countDocuments(scope),1);
      const guest=await Customer.create({...scope,name:'Catalog guest',phone:'0987654321'});
      const who: Actor = {id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER',cashier:true};
      const sale=await operate(who,'sellPackage',{customerId:String(guest._id),templateId:String(plan!._id),dueDate:spaDay(),startsOn:'2020-01-01'},randomUUID());
      const treatment=await Treatment.findById(sale.id);
      assert.equal(treatment!.startsOn,spaDay()); assert.equal(treatment!.packageType,'TIME'); assert.equal(treatment!.remaining,undefined);
      const visit=await operate(who,'appointment',{customerId:String(guest._id),serviceId:String(service!._id),staffId:who.id,startAt: spaDay(new Date(Date.now()+86400000))+'T22:00:00+07:00'},randomUUID());
      assert.equal((await Appointment.findById(visit.id))!.endAt,undefined);
    });
    await t.test('multi-use and shared sessions, multi-package checkout, due date preservation, rollback and concurrency', async () => {
      const spa = await Spa.create({ name: 'Multi-use integration ' + randomUUID() }); extraSpaIds.push(spa._id);
      const scope = { spaId: spa._id };
      await Control.create(scope);
      const owner = await User.create({ ...scope, name: 'Owner Multi', email: randomUUID() + '@example.test', passwordHash: hashPassword(randomUUID()), role: 'OWNER', cashier: true });
      const staff = await User.create({ ...scope, name: 'Staff Multi', email: randomUUID() + '@example.test', passwordHash: hashPassword(randomUUID()), role: 'STAFF', cashier: false });
      const who: Actor = { id: String(owner._id), spaId: String(spa._id), name: owner.name, role: 'OWNER', cashier: true };
      const callOp = (action: string, data: unknown, key = randomUUID()) => operate(who, action, data, key);

      await callOp('openDay', { day: spaDay(), opening: 0 });
      const customerA = await Customer.create({ ...scope, name: 'Khách A', phone: '0901111111' });
      const customerB = await Customer.create({ ...scope, name: 'Người thân B', phone: '0902222222' });
      const service = await Service.create({ ...scope, name: 'Chăm sóc da', price: 500000, duration: 60, commission: 25000, active: true });
      const template = await PackageTemplate.create({ ...scope, serviceId: service._id, name: 'Gói chăm sóc da 10 buổi', price: 4000000, totalSessions: 10, packageType: 'SESSIONS', active: true });

      // 1. Sell multiple packages of the SAME template in one invoice via checkout
      const cartKey = randomUUID();
      const multiCart = {
        customerId: String(customerA._id),
        actions: [
          { action: 'sellPackage', data: { cartId: 'c1', templateId: String(template._id), dueDate: spaDay() } },
          { action: 'sellPackage', data: { cartId: 'c2', templateId: String(template._id), dueDate: spaDay() } },
        ]
      };
      const cartResult = await callOp('checkout', multiCart, cartKey);
      const replayResult = await callOp('checkout', multiCart, cartKey);
      assert.equal(cartResult.invoiceId, replayResult.invoiceId);
      const invoice = await Invoice.findById(cartResult.invoiceId);
      assert.ok(invoice);
      assert.equal(invoice!.packageItems?.length, 2);
      assert.equal(invoice!.total, 8000000);
      assert.equal(invoice!.paid, 0);

      const treatments = await Treatment.find({ ...scope, invoiceId: invoice!._id });
      assert.equal(treatments.length, 2);
      const treatment1 = treatments[0];

      // 2. Multi-use batch treatment & sharing with family in one transaction
      const sig1 = { version: 1 as const, strokes: [[[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]]] as [number, number][][] };
      const sig2 = { version: 1 as const, strokes: [[[0.4, 0.4], [0.5, 0.5], [0.6, 0.6]]] as [number, number][][] };
      const useBatchKey = randomUUID();
      const useBatchPayload = {
        treatmentId: String(treatment1._id),
        remainingBefore: 10,
        sessions: [
          {
            recipientCustomerId: String(customerB._id),
            recipientName: 'Người thân B',
            recipientPhone: '0902222222',
            staffId: String(staff._id),
            signature: sig1,
          },
          {
            recipientName: 'Bạn C',
            recipientPhone: '0903333333',
            staffId: String(staff._id),
            signature: sig2,
          }
        ]
      };
      const firstUseBatch=await callOp('use',useBatchPayload,useBatchKey);
      assert.deepEqual(await callOp('use',useBatchPayload,useBatchKey),firstUseBatch);

      const refreshedTreatment1 = await Treatment.findById(treatment1._id);
      assert.equal(refreshedTreatment1!.remaining, 8, 'Deducted exactly 2 sessions');

      const uses = await TreatmentUse.find({ ...scope, treatmentId: treatment1._id }).sort({ createdAt: 1 });
      assert.equal(uses.length, 2);
      assert.equal(String(uses[0].ownerCustomerId), String(customerA._id));
      assert.equal(String(uses[0].recipientCustomerId), String(customerB._id));
      assert.equal(uses[0].isShared, true);
      assert.equal(uses[1].recipientName, 'Bạn C');
      assert.equal(uses[1].isShared, true);

      // 3. Signature independence: cannot use same signature for different recipients
      await assert.rejects(callOp('use', {
        treatmentId: String(treatment1._id),
        remainingBefore: 8,
        sessions: [
          { recipientName: 'Khách 1', signature: sig1 },
          { recipientName: 'Khách 2', signature: sig1 },
        ]
      }), (e: any) => e.status === 409);
      assert.equal((await Treatment.findById(treatment1._id))!.remaining, 8);

      // 4. Concurrency: race condition between two competing batch use requests
      const sigA = { version: 1 as const, strokes: [[[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]] as [number, number][][] };
      const sigB = { version: 1 as const, strokes: [[[0.2, 0.3], [0.4, 0.5], [0.6, 0.7]]] as [number, number][][] };
      const sigC = { version: 1 as const, strokes: [[[0.3, 0.4], [0.5, 0.6], [0.7, 0.8]]] as [number, number][][] };
      const sigD = { version: 1 as const, strokes: [[[0.4, 0.5], [0.6, 0.7], [0.8, 0.9]]] as [number, number][][] };
      const sigE = { version: 1 as const, strokes: [[[0.5, 0.6], [0.7, 0.8], [0.9, 0.1]]] as [number, number][][] };
      const competingUses1 = [
        { recipientName: 'K1', signature: sigA }, { recipientName: 'K2', signature: sigB },
        { recipientName: 'K3', signature: sigC }, { recipientName: 'K4', signature: sigD },
        { recipientName: 'K5', signature: sigE }
      ];
      const competingUses2 = [
        { recipientName: 'K6', signature: sigA }, { recipientName: 'K7', signature: sigB },
        { recipientName: 'K8', signature: sigC }, { recipientName: 'K9', signature: sigD },
        { recipientName: 'K10', signature: sigE }
      ];
      const results = await Promise.allSettled([
        callOp('use', { treatmentId: String(treatment1._id), remainingBefore: 8, sessions: competingUses1 }),
        callOp('use', { treatmentId: String(treatment1._id), remainingBefore: 8, sessions: competingUses2 })
      ]);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      assert.equal(fulfilled.length, 1, 'Only one competing request succeeds');
      assert.equal(rejected.length, 1, 'Competing request exceeding quota is rejected');
      assert.equal((await Treatment.findById(treatment1._id))!.remaining, 3);

      // 5. Preserving due date on invoice update
      const standaloneService = await callOp('serviceInvoice', {
        customerId: String(customerA._id),
        dueDate: '2026-12-31',
        items: [{ serviceId: String(service._id), total: 500000 }]
      });
      const bill = await Invoice.findById(standaloneService.id);
      assert.equal(bill!.dueDate, '2026-12-31');

      // Pay in full
      await callOp('payment', {
        invoiceId: String(bill!._id),
        amount: 500000,
        method: 'CASH',
        receivedConfirmation: true
      });
      assert.equal((await Invoice.findById(bill!._id))!.paid, 500000);

      // Paid invoices are protected from content edits; the UI routes them to the date-only form.
      const beforeUpdate = (await Invoice.findById(bill!._id))!.toObject();
      const paymentsBefore=await Payment.find({spaId:scope.spaId,invoiceId:bill!._id}).lean();
      const receiptsBefore=await CashEntry.find({_id:{$in:paymentsBefore.map(row=>row.receiptId)}}).lean();
      const commissionsBefore=await Commission.find({spaId:scope.spaId,invoiceId:bill!._id}).lean();
      const lineCommissionsBefore=await InvoiceLineCommission.find({spaId:scope.spaId,invoiceId:bill!._id}).lean();
      const updateAuditCount=await Audit.countDocuments({spaId:scope.spaId,action:'updateInvoice',targetId:bill!._id});
      await assert.rejects(callOp('updateInvoice', {
        id: String(bill!._id),
        expectedUpdatedAt: beforeUpdate.updatedAt.toISOString(),
        description: 'Đã cập nhật ghi chú',
        total: 500000,
        reason: 'Sửa ghi chú'
      }),/lịch sử giao dịch/i);
      const afterUpdate = await Invoice.findById(bill!._id);
      assert.deepEqual(afterUpdate!.toObject(),beforeUpdate,'rejected paid-invoice edit leaves the full invoice unchanged');
      assert.equal(afterUpdate!.dueDate, '2026-12-31', 'dueDate remains unchanged after rejected content edit');
      assert.deepEqual(await Payment.find({spaId:scope.spaId,invoiceId:bill!._id}).lean(),paymentsBefore,'payment history is unchanged');
      assert.deepEqual(await CashEntry.find({_id:{$in:paymentsBefore.map(row=>row.receiptId)}}).lean(),receiptsBefore,'cash receipts are unchanged');
      assert.deepEqual(await Commission.find({spaId:scope.spaId,invoiceId:bill!._id}).lean(),commissionsBefore,'legacy commission ledger is unchanged');
      assert.deepEqual(await InvoiceLineCommission.find({spaId:scope.spaId,invoiceId:bill!._id}).lean(),lineCommissionsBefore,'per-line commission ledger is unchanged');
      assert.equal(await Audit.countDocuments({spaId:scope.spaId,action:'updateInvoice',targetId:bill!._id}),updateAuditCount,'rejected edit writes no audit');
    });
  } finally {
    if (spaId) {
      const fixtureSpaIds = [spaId, ...extraSpaIds];
      const imageBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'product_images' });
      const fixtureImages = await imageBucket.find({ 'metadata.spaId': { $in: fixtureSpaIds.map(String) } }).toArray();
      for (const image of fixtureImages) await imageBucket.delete(image._id);
      for (const model of allModels) if (model.schema.path('spaId')) await model.deleteMany({ spaId: { $in: fixtureSpaIds } });
      await Spa.deleteMany({ _id: { $in: fixtureSpaIds } });
    }
    await mongoose.disconnect();
  }
});
