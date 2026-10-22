import test from 'node:test';
const signed = { version: 1, strokes: [[[0.1, 0.6], [0.3, 0.2], [0.7, 0.8]]] }; 
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { allModels, Spa, User, Control, Deposit, Invoice, CashEntry, Treatment, Appointment, Audit, TreatmentUse, Allocation, Payment, Idempotency, Day, Customer, PackageTemplate, Commission, Payroll, Service, Product, ProductGroup, StockMovement } from '../src/lib/models';
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
import { workspaceQuery } from '../src/lib/workspace-query';

test('transactions: idempotency, cạnh tranh cọc/lượt dùng, quyền và chốt ngày', async t => {
  const uri = process.env.MONGODB_URI || '';
  assert.equal(new URL(uri).pathname, '/spacare_test', 'Chỉ chạy trên database riêng tên spacare_test.');
  await connect();
  let spaId: mongoose.Types.ObjectId | undefined;
  const extraSpaIds: mongoose.Types.ObjectId[] = [];
  try {
    for (const model of allModels) { await model.createCollection(); await model.createIndexes(); }
    const spa = await Spa.create({ name: `Integration ${randomUUID()}` }); spaId = spa._id;
    const owner = await User.create({ spaId, name: 'Owner test', email: `${randomUUID()}@example.test`, passwordHash: hashPassword(randomUUID()), role: 'OWNER', cashier: true });
    const staff = await User.create({ spaId, name: 'Staff test', email: `${randomUUID()}@example.test`, passwordHash: hashPassword(randomUUID()), role: 'STAFF', cashier: false });
    await Control.create({ spaId, revision: 0 });
    const actor: Actor = { id: String(owner._id), spaId: String(spaId), name: 'Owner test', role: 'OWNER', cashier: true };
    const employee: Actor = { ...actor, id: String(staff._id), role: 'STAFF', cashier: false };
    const call = (action: string, data: unknown, key = randomUUID()) => operate(actor, action, data, key);
    await call('openDay', { day: spaDay(), opening: 0 });
    const customer = await call('customer', { name: 'Khách test', phone: '0900000000' });
    const service = await call('service', { name: 'Dịch vụ test', price: 350000, duration: 60 });
    await assert.rejects(call('customer', { name: 'Duplicate', phone: '+84 900 000 000' }), /Số điện thoại đã tồn tại/);
    await call('updateCustomer', { id: customer.id, name: 'Updated', phone: '0900000000' });
    await call('updateService', { id: service.id, name: 'Updated service', price: 350000, duration: 60 });
    await assert.rejects(operate(employee, 'updateService', { id: service.id, name: 'Denied', price: 1, duration: 5 }, randomUUID()));
    await assert.rejects(call('user', { name: 'Duplicate', email: owner.email.toUpperCase(), password: randomUUID() }), /Email đã tồn tại/);
    await call('updateUser', { id: String(staff._id), name: 'Updated staff', email: staff.email, cashier: false });
    await call('userStatus', { id: String(staff._id), active: false });
    await assert.rejects(operate(employee, 'customer', { name: 'Denied', phone: '0911111111' }, randomUUID()));
    await call('userStatus', { id: String(staff._id), active: true });
    await assert.rejects(call('userStatus', { id: actor.id, active: false }));
    await call('serviceStatus', { id: service.id, active: false });
    await assert.rejects(call('invoice', { customerId: customer.id, serviceId: service.id }));
    await call('serviceStatus', { id: service.id, active: true });
    // Postponing frees the old slot; rescheduling checks collisions and records history.
    const at = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
    const firstTime = at(24), laterTime = at(27);
    const bookingData = { customerId: customer.id, serviceId: service.id, staffId: String(staff._id) };
    const a = await call('appointment', { ...bookingData, startAt: firstTime });
    await assert.rejects(call('appointmentStatus', { id: a.id, status: 'POSTPONED' }), /Cần lý do/);
    // Use a real second STAFF to test authorization; operate reloads DB roles.
    const other = await User.create({ spaId, name: 'Other', email: randomUUID() + '@example.test', passwordHash: hashPassword(randomUUID()), role: 'STAFF' });
    await assert.rejects(operate({ ...employee, id: String(other._id) }, 'rescheduleAppointment', { id: a.id, staffId: String(other._id), startAt: laterTime, reason: 'Wrong staff' }, randomUUID()));
    await call('appointmentStatus', { id: a.id, status: 'POSTPONED', reason: 'Khách đến muộn' });
    assert.equal((await Appointment.findById(a.id))!.status, 'POSTPONED');
    const b = await call('appointment', { ...bookingData, startAt: firstTime });
    await assert.rejects(call('rescheduleAppointment', { id: a.id, staffId: bookingData.staffId, startAt: firstTime, reason: 'Occupied' }), /đã có lịch/);
    assert.equal((await Appointment.findById(a.id))!.status, 'POSTPONED');
    await assert.rejects(call('rescheduleAppointment', { id: a.id, staffId: bookingData.staffId, startAt: at(-1), reason: 'Past' }));
    await call('updateService', { id: service.id, name: 'Updated service', price: 350000, duration: 90 });
    const moveKey = randomUUID();
    const move = { id: a.id, staffId: bookingData.staffId, startAt: laterTime, reason: 'Khách đổi giờ' };
    const moved = await Promise.all([call('rescheduleAppointment', move, moveKey), call('rescheduleAppointment', move, moveKey)]);
    assert.equal(moved[0].id, moved[1].id);
    assert.ok(moved[0].replacementAppointmentId);
    assert.notEqual(moved[0].replacementAppointmentId, a.id);
    const old = (await Appointment.findById(a.id))!;
    assert.equal(old.status, 'POSTPONED');
    assert.equal(old.startAt.toISOString(), firstTime);
    const saved = (await Appointment.findById(moved[0].replacementAppointmentId))!;
    assert.equal(String(saved.rescheduledFromId), a.id);
    assert.equal(await Appointment.countDocuments({ spaId, rescheduledFromId: a.id }), 1);
    await assert.rejects(call('rescheduleAppointment', move), /đã được xếp lại/);
    assert.equal(saved.status, 'CONFIRMED');
    assert.equal(saved.startAt.toISOString(), laterTime);
    assert.equal(saved.endAt.getTime() - saved.startAt.getTime(), 60 * 60000);
    const history = (await Audit.findOne({ spaId, action: 'rescheduleAppointment', targetId: a.id }))!;
    assert.equal(new Date(history.details.before.startAt).toISOString(), firstTime);
    assert.equal(history.details.after.status, 'POSTPONED');
    assert.equal(history.details.replacementAppointmentId, String(saved._id));
    assert.equal(await Audit.countDocuments({ spaId, action: 'rescheduleAppointment', targetId: a.id }), 1);
    await call('appointmentStatus', { id: String(saved._id), status: 'POSTPONED', reason: 'Chưa chốt ngày' });
    await call('appointmentStatus', { id: a.id, status: 'CANCELLED', reason: 'Khách hủy' });
    await assert.rejects(call('rescheduleAppointment', move));
    await call('appointmentStatus', { id: b.id, status: 'CANCELLED', reason: 'Dọn fixture' });
    assert.equal(await CashEntry.countDocuments({ spaId }), 0);
    // Completing a single-service appointment creates exactly one unpaid invoice atomically.
    const past = new Date(Date.now() - 2 * 3600000);
    const makePast = async () => Appointment.create({ spaId, customerId: customer.id, serviceId: service.id, staffId: staff._id, startAt: past, endAt: new Date(past.getTime() + 3600000), status: 'CONFIRMED' });
    const billable = await makePast();
    await assert.rejects(operate({ ...employee, id: String(other._id) }, 'completeAppointment', { id: String(billable._id) }, randomUUID()));
    assert.equal((await Appointment.findById(billable._id))!.status, 'CONFIRMED');
    const completeKey = randomUUID();
    const completed = await Promise.all([call('completeAppointment', { id: String(billable._id) }, completeKey), call('completeAppointment', { id: String(billable._id) }, completeKey)]);
    assert.equal(completed[0].invoiceId, completed[1].invoiceId);
    assert.equal(await Invoice.countDocuments({ spaId, appointmentId: billable._id }), 1);
    const completedInvoice = (await Invoice.findById(completed[0].invoiceId))!;
    assert.equal(completedInvoice.total, 350000);
    assert.equal(completedInvoice.paid, 0);
    assert.equal(completedInvoice.status, 'OPEN');
    assert.equal((await Appointment.findById(billable._id))!.status, 'COMPLETED');
    const retried = await call('completeAppointment', { id: String(billable._id) });
    assert.equal(retried.invoiceId, completed[0].invoiceId);
    assert.equal(await CashEntry.countDocuments({ spaId }), 0);
    const manualInvoice = await call('invoice', { customerId: customer.id, serviceId: service.id });
    const legacy = await makePast();
    await Appointment.updateOne({ _id: legacy._id, spaId }, { status: 'COMPLETED' }); // legacy fixture from before automatic billing
    const invoiceCount = await Invoice.countDocuments({ spaId });
    const linked = await call('completeAppointment', { id: String(legacy._id), existingInvoiceId: manualInvoice.id });
    assert.equal(linked.invoiceId, manualInvoice.id);
    assert.equal(await Invoice.countDocuments({ spaId }), invoiceCount);
    const staffBillable = await makePast();
    const staffResult = await operate(employee, 'completeAppointment', { id: String(staffBillable._id) }, randomUUID());
    assert.equal(await Invoice.countDocuments({ spaId, appointmentId: staffBillable._id }), 1);
    assert.ok(staffResult.invoiceId);
    const wrong = await makePast();
    await assert.rejects(call('completeAppointment', { id: String(wrong._id), existingInvoiceId: manualInvoice.id }));
    assert.equal((await Appointment.findById(wrong._id))!.status, 'CONFIRMED');
    const invalidDate = await makePast();
    await assert.rejects(call('completeAppointment', { id: String(invalidDate._id), dueDate: '2026-02-30' }));
    assert.equal((await Appointment.findById(invalidDate._id))!.status, 'CONFIRMED');
    assert.equal(await Invoice.countDocuments({ spaId, appointmentId: invalidDate._id }), 0);
    const future = await call('appointment', { ...bookingData, startAt: at(48) });
    await assert.rejects(call('completeAppointment', { id: future.id }));
    await call('appointmentStatus', { id: future.id, status: 'POSTPONED', reason: 'Not billable' });
    await assert.rejects(call('completeAppointment', { id: future.id }));
    await call('appointmentStatus', { id: future.id, status: 'CANCELLED' });
    await assert.rejects(call('completeAppointment', { id: future.id }));
    const invoice = await call('invoice', { customerId: customer.id, serviceId: service.id });
    const key = randomUUID();
    const payload = { customerId: customer.id, amount: 500000, method: 'CASH' };
    const receipts = await Promise.all([call('deposit', payload, key), call('deposit', payload, key)]);
    assert.equal(receipts[0].id, receipts[1].id);
    assert.equal(await CashEntry.countDocuments({ spaId, kind: 'DEPOSIT' }), 1);
    await assert.rejects(call('deposit', { ...payload, amount: 500001 }, key));
    const allocations = await Promise.allSettled([1, 2].map(() => call('allocate', { depositId: receipts[0].id, invoiceId: invoice.id, amount: 350000, reason: 'Chuyển dịch vụ' })));
    assert.equal(allocations.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await Deposit.findById(receipts[0].id))!.balance, 150000);
    assert.equal((await Invoice.findById(invoice.id))!.paid, 350000);
    assert.equal(await CashEntry.countDocuments({ spaId }), 1);
    await assert.rejects(operate(employee, 'cash', { direction: 'IN', amount: 1000, method: 'CASH', note: 'Không được phép' }, randomUUID()));
    await assert.rejects(call('invoice', { customerId: String(new mongoose.Types.ObjectId()), serviceId: service.id }));
    const treatment = await call('treatment', { invoiceId: invoice.id, name: 'Gói một buổi', totalSessions: 1 });
    await assert.rejects(call('use', { treatmentId: treatment.id, method: 'ALTERNATIVE', reason: '', evidenceReference: 'MSG-001' }));
    const uses = await Promise.allSettled([1, 2].map(() => call('use', { treatmentId: treatment.id, signature: signed, remainingBefore: 1 })));
    assert.equal(uses.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await Treatment.findById(treatment.id))!.remaining, 0);
    // A booked package session deducts once, records evidence, and never creates a new invoice.
    const packageBill = await call('invoice', { customerId: customer.id, serviceId: service.id });
    const packagePlan = await call('treatment', { invoiceId: packageBill.id, name: 'Gói hai buổi', totalSessions: 2 });
    const packageBooking = await call('appointment', { ...bookingData, startAt: at(72), treatmentId: packagePlan.id });
    assert.equal(String((await Appointment.findById(packageBooking.id))!.treatmentId), packagePlan.id);
    const otherCustomer = await call('customer', { name: 'Other customer', phone: '0900000002' });
    await assert.rejects(call('appointment', { ...bookingData, customerId: otherCustomer.id, startAt: at(76), treatmentId: packagePlan.id }));
    // Test-only fixture represents a visit whose booked start has passed.
    await Appointment.updateOne({ _id: packageBooking.id, spaId }, { startAt: past, endAt: new Date(past.getTime() + 3600000) });
    const packageComplete = { id: packageBooking.id, signature: signed, remainingBefore: 2 };
    await assert.rejects(call('completeTreatmentAppointment', { ...packageComplete, signature: { version: 1, strokes: [] } }));
    assert.equal((await Treatment.findById(packagePlan.id))!.remaining, 2);
    assert.equal((await Appointment.findById(packageBooking.id))!.status, 'CONFIRMED');
    await assert.rejects(call('completeAppointment', { id: packageBooking.id }));
    await assert.rejects(operate(employee, 'appointmentStatus', { id: packageBooking.id, status: 'COMPLETED' }, randomUUID()));
    const beforePackageInvoices = await Invoice.countDocuments({ spaId });
    const beforePackageCash = await CashEntry.countDocuments({ spaId });
    const packageResults = await Promise.all([operate(employee, 'completeTreatmentAppointment', packageComplete, randomUUID()), operate(employee, 'completeTreatmentAppointment', packageComplete, randomUUID())]);
    assert.equal(packageResults[0].treatmentUseId, packageResults[1].treatmentUseId);
    assert.equal((await Treatment.findById(packagePlan.id))!.remaining, 1);
    assert.equal((await Appointment.findById(packageBooking.id))!.status, 'COMPLETED');
    assert.equal(await TreatmentUse.countDocuments({ spaId, appointmentId: packageBooking.id }), 1);
    assert.equal(await Invoice.countDocuments({ spaId }), beforePackageInvoices + 1);
    assert.equal(await CashEntry.countDocuments({ spaId }), beforePackageCash);
    const lastVisit = await Appointment.create({ spaId, customerId: customer.id, serviceId: service.id, staffId: staff._id, treatmentId: packagePlan.id, startAt: past, endAt: new Date(past.getTime() + 3600000) });
    await call('completeTreatmentAppointment', { ...packageComplete, id: String(lastVisit._id), remainingBefore: 1 });
    assert.equal((await Treatment.findById(packagePlan.id))!.remaining, 0);
    await assert.rejects(call('appointment', { ...bookingData, startAt: at(80), treatmentId: packagePlan.id }));
    // Partial, full and reversed receipts keep invoice state consistent.
    await assert.rejects(call('payment', { invoiceId: packageBill.id, amount: 100000, method: 'CASH', receivedConfirmation: false }));
    await call('payment', { invoiceId: packageBill.id, amount: 100000, method: 'CASH', receivedConfirmation: true });
    assert.equal((await Invoice.findById(packageBill.id))!.status, 'PARTIALLY_PAID');
    const finalReceipt = await call('payment', { invoiceId: packageBill.id, amount: 250000, method: 'BANK_TRANSFER', receivedConfirmation: true, transferReference: 'GROUP-PHOTO-TEST' });
    assert.equal((await Invoice.findById(packageBill.id))!.status, 'PAID');
    const lastPayment = await mongoose.model('Payment').findById(finalReceipt.id);
    await call('reverseCash', { id: String(lastPayment!.receiptId), reason: 'Sai khoản chuyển test' });
    assert.equal((await Invoice.findById(packageBill.id))!.status, 'PARTIALLY_PAID');
    // Single-operation package sale, unpaid use, staff collections and deposit access.
    const template = await call('packageTemplate', { name: 'Sale test', serviceId: service.id, totalSessions: 5, price: 900000 });
      const sale = { templateId: template.id, customerId: customer.id, serviceId: service.id, name: 'Sale test', totalSessions: 5, total: 900000, dueDate: spaDay(new Date(Date.now() + 7 * 86400000)) };
    await t.test('catalog sale: gifts zero, consultant snapshots, price overrides and signed session invoices', async () => {
      await call('updateCustomer', { id: customer.id, name: 'Updated', phone: '0900000000', consultantId: employee.id });
      await call('updateService', { id: service.id, name: 'Updated service', price: 350000, duration: 90, commission: 30000 });
      const saleData = { ...sale, promotion: 'October', gifts: [{ templateId: template.id }] };
      const key = randomUUID();
      const beforeCash = await CashEntry.countDocuments({ spaId });
      const sold = await call('sellPackage', saleData, key);
      assert.deepEqual(await call('sellPackage', saleData, key), sold);
      const purchase = (await Invoice.findById(sold.invoiceId))!;
      assert.equal(purchase.creatorName, owner.name);
      assert.equal(purchase.consultantId.toString(), employee.id);
      assert.equal(purchase.commission, 30000);
      const giftBills = await Invoice.find({ spaId, giftOfInvoiceId: sold.invoiceId });
      assert.equal(giftBills.length, 1);
      assert.equal(giftBills[0].total, 0); assert.equal(giftBills[0].status, 'PAID');
      const giftPlan = (await Treatment.findOne({ spaId, invoiceId: giftBills[0]._id }))!;
      assert.equal(giftPlan.remaining, 5);
      const entered = await call('invoice', { customerId: customer.id, serviceId: service.id, description: 'Adjusted description', total: 123000, consultantId: String(other._id) });
      const enteredBill = (await Invoice.findById(entered.id))!;
      assert.equal(enteredBill.total, 123000); assert.equal(enteredBill.description, 'Adjusted description');
      assert.equal(String(enteredBill.consultantId), String(other._id));
      const sessionKey = randomUUID();
      const payload = { customerId: customer.id, serviceId: service.id, treatmentId: String(giftPlan._id), total: 999999, signature: signed, remainingBefore: 5 };
      const sessionInvoice = await call('invoice', payload, sessionKey);
      assert.deepEqual(await call('invoice', payload, sessionKey), sessionInvoice);
      const bill = (await Invoice.findById(sessionInvoice.id))!;
      assert.equal(bill.total, 0); assert.equal(bill.paid, 0); assert.equal(bill.status, 'PAID');
      assert.equal((await Treatment.findById(giftPlan._id))!.remaining, 4);
      assert.equal(await CashEntry.countDocuments({ spaId }), beforeCash);
      const detail = await readInvoice(actor, sessionInvoice.id);
      assert.deepEqual(detail.signature, signed);
      assert.equal(detail.signatures.length, 1);
      assert.deepEqual(detail.signatures[0].signature, signed);
      const packageDetail = await readInvoice(actor, String(giftBills[0]._id));
      assert.equal(packageDetail.signatureTotal, 1);
      assert.deepEqual(packageDetail.signatures[0].signature, signed);
      const parentDetail = await readInvoice(actor, sold.invoiceId);
      assert.equal(parentDetail.signatureTotal, 1);
      assert.deepEqual(parentDetail.signatures[0].signature, signed);
      assert.equal((await readInvoice(actor, sold.invoiceId, 99)).signaturePage, 1);
      assert.equal((await Audit.findOne({ spaId, action: 'invoice', targetId: bill._id }))!.details.signature, undefined);
      await assert.rejects(readInvoice({ ...employee, id: String(other._id) }, sessionInvoice.id));
      const beforePlans = await Treatment.countDocuments({ spaId });
      await assert.rejects(call('sellPackage', { ...saleData, gifts: [{ templateId: String(new mongoose.Types.ObjectId()) }] }));
      assert.equal(await Treatment.countDocuments({ spaId }), beforePlans);
      await assert.rejects(call('invoice', { ...payload, signature: { version: 1, strokes: [] }, remainingBefore: 4 }));
      assert.equal((await Treatment.findById(giftPlan._id))!.remaining, 4);
      await call('updateCustomer', { id: customer.id, name: 'Updated', phone: '0900000000' });
    });
    const saleKey = randomUUID();
    const invoiceCountBeforeSale = await Invoice.countDocuments({ spaId });
    const sold = await Promise.all([call('sellPackage', sale, saleKey), call('sellPackage', sale, saleKey)]);
    assert.equal(sold[0].id, sold[1].id);
    assert.equal(sold[0].invoiceId, sold[1].invoiceId);
    assert.equal(await Invoice.countDocuments({ spaId }), invoiceCountBeforeSale + 1);
    const soldPlan = (await Treatment.findById(sold[0].id))!;
    const soldBill = (await Invoice.findById(sold[0].invoiceId))!;
    assert.equal(String(soldPlan.invoiceId), String(soldBill._id));
    assert.equal(soldBill.total, sale.total);
    assert.equal(soldBill.dueDate, sale.dueDate);
    assert.equal(soldBill.paid, 0);
    await assert.rejects(call('sellPackage', { ...sale, total: 900001 }, saleKey), /nội dung khác/);
    const packageCount = await Treatment.countDocuments({ spaId });
    const billCount = await Invoice.countDocuments({ spaId });
    await assert.rejects(call('sellPackage', { ...sale, dueDate: '2026-02-30' }));
    await assert.rejects(operate(employee, 'sellPackage', sale, randomUUID()));
    assert.equal(await Treatment.countDocuments({ spaId }), packageCount);
    assert.equal(await Invoice.countDocuments({ spaId }), billCount);
    const saleVisit = await call('appointment', { ...bookingData, startAt: at(120), treatmentId: sold[0].id });
    await Appointment.updateOne({ _id: saleVisit.id, spaId }, { startAt: past, endAt: new Date(past.getTime() + 3600000) });
    const useData = { id: saleVisit.id, signature: signed, remainingBefore: 5 };
    await operate(employee, 'completeTreatmentAppointment', useData, randomUUID());
    assert.equal((await Treatment.findById(sold[0].id))!.remaining, 4);
    assert.equal((await Invoice.findById(sold[0].invoiceId))!.paid, 0);
    const collect = { invoiceId: sold[0].invoiceId, amount: 100000, method: 'CASH', receivedConfirmation: true };
    const wrongEmployee = { ...employee, id: String(other._id) };
    await assert.rejects(operate(wrongEmployee, 'payment', collect, randomUUID()));
    const collectionKey = randomUUID();
    const moneyBefore = await CashEntry.countDocuments({ spaId });
    const collected = await Promise.all([operate(employee, 'payment', collect, collectionKey), operate(employee, 'payment', collect, collectionKey)]);
    assert.equal(collected[0].id, collected[1].id);
    assert.equal(await CashEntry.countDocuments({ spaId }), moneyBefore + 1);
    await assert.rejects(operate(employee, 'payment', { ...collect, method: 'BANK_TRANSFER' }, randomUUID()), /tham chiếu/);
    await operate(employee, 'payment', { ...collect, method: 'BANK_TRANSFER', transferReference: 'GROUP-IMAGE-42' }, randomUUID());
    assert.equal((await mongoose.model('Payment').findOne({ spaId, transferReference: 'GROUP-IMAGE-42' }))!.receivedConfirmation, true);
    const credit = await call('deposit', { customerId: customer.id, amount: 800000, method: 'CASH' });
    const apply = { depositId: credit.id, invoiceId: sold[0].invoiceId, amount: 700000, reason: 'Apply to package' };
    await assert.rejects(operate(wrongEmployee, 'allocate', apply, randomUUID()));
    const beforeApplyCash = await CashEntry.countDocuments({ spaId });
    const applyKey = randomUUID();
    await Promise.all([operate(employee, 'allocate', apply, applyKey), operate(employee, 'allocate', apply, applyKey)]);
    assert.equal((await Deposit.findById(credit.id))!.balance, 100000);
    assert.equal((await Invoice.findById(sold[0].invoiceId))!.paid, 900000);
    assert.equal(await CashEntry.countDocuments({ spaId }), beforeApplyCash);
    await assert.rejects(operate(employee, 'reverseAllocation', { id: (await mongoose.model('Allocation').findOne({ spaId, invoiceId: sold[0].invoiceId }))!._id.toString(), reason: 'Denied' }, randomUUID()));
    assert.equal(await Audit.countDocuments({ spaId, action: 'sellPackage', targetId: sold[0].id }), 1);
    // Unrelated invoices and foreign-spa references never authorize staff collections.
    const independentBill = await call('invoice', { customerId: customer.id, serviceId: service.id });
    await assert.rejects(operate(employee, 'payment', { ...collect, invoiceId: independentBill.id }, randomUUID()));
    await assert.rejects(call('sellPackage', { ...sale, customerId: String(new mongoose.Types.ObjectId()) }));
    const status = (code: number) => (error: unknown) => (error as { status?: number }).status === code;
    const perform = (who: Actor, action: string, data: unknown, key = randomUUID()) => operate(who, action, data, key);
    const snapshot = async () => ({
      invoices: await Invoice.countDocuments({ spaId }), treatments: await Treatment.countDocuments({ spaId }),
      payments: await Payment.countDocuments({ spaId }), cash: await CashEntry.countDocuments({ spaId }),
      allocations: await Allocation.countDocuments({ spaId }), uses: await TreatmentUse.countDocuments({ spaId }),
      audit: await Audit.countDocuments({ spaId }), keys: await Idempotency.countDocuments({ spaId }),
      control: (await Control.findOne({ spaId }))!.revision,
    });
    const cashierRecord = await call('user', { name: 'Cashier test', email: randomUUID() + '@example.test', password: randomUUID(), cashier: true });
    const cashier: Actor = { ...employee, id: cashierRecord.id, cashier: true };

    await t.test('quyền lấy lại từ DB; STAFF/thu ngân không sửa giao dịch, MANAGER chưa được hỗ trợ', async () => {
      const before = await snapshot();
      const forgedOwner: Actor = { ...employee, role: 'OWNER', cashier: true };
      for (const who of [employee, cashier, forgedOwner]) {
        await assert.rejects(perform(who, 'reverseCash', { id: receipts[0].id, reason: 'Denied' }), status(403));
        await assert.rejects(perform(who, 'reopenDay', { day: spaDay(), reason: 'Denied' }), status(403));
      }
      // A cast/claim saying MANAGER cannot override the stored STAFF role.
      await assert.rejects(perform({ ...employee, role: 'MANAGER' } as unknown as Actor, 'updateService', { id: service.id, name: 'Denied', price: 1, duration: 5 }), status(403));
      await assert.rejects(new User({ spaId, name: 'Manager', email: randomUUID() + '@example.test', passwordHash: 'test-only', role: 'MANAGER' }).validate());
      assert.deepEqual(await snapshot(), before);
      await call('userStatus', { id: cashier.id, active: false });
      await assert.rejects(perform(cashier, 'invoice', { customerId: customer.id, serviceId: service.id }), status(401));
      await call('userStatus', { id: cashier.id, active: true });
      await call('updateUser', { id: cashier.id, name: 'Cashier test', email: (await User.findById(cashier.id))!.email, cashier: false });
      await assert.rejects(perform(cashier, 'sellPackage', sale), status(403)); // stale cashier=true must not grant permission
      await call('updateUser', { id: cashier.id, name: 'Cashier test', email: (await User.findById(cashier.id))!.email, cashier: true });
    });

    await t.test('bán gói rollback cả hóa đơn/audit/idempotency khi tạo liệu trình lỗi giữa transaction', async () => {
      const before = await snapshot();
      const failKey = randomUUID();
      const injected = t.mock.method(Treatment, 'create', async () => { throw new Error('TEST_ONLY_TREATMENT_CREATE_FAILURE'); });
      try {
        await assert.rejects(call('sellPackage', sale, failKey), /TEST_ONLY_TREATMENT_CREATE_FAILURE/);
      } finally { injected.mock.restore(); }
      assert.deepEqual(await snapshot(), before);
      assert.equal(await Idempotency.countDocuments({ spaId, key: failKey }), 0);
      const recovered = await perform(cashier, 'sellPackage', sale, failKey);
      assert.equal(String((await Treatment.findById(recovered.id))!.invoiceId), recovered.invoiceId);
      assert.equal((await Invoice.findById(recovered.invoiceId))!.paid, 0);
      assert.equal(await Audit.countDocuments({ spaId, action: 'sellPackage', targetId: recovered.id }), 1);
    });

    await t.test('dùng gói còn nợ vào ngày hạn; cạnh tranh thu tiền không vượt nợ', async () => {
      const plan = await call('sellPackage', { ...sale, total: 1000000, dueDate: spaDay() });
      const visit = await Appointment.create({ spaId, customerId: customer.id, serviceId: service.id, staffId: staff._id, treatmentId: plan.id, startAt: past, endAt: new Date(past.getTime() + 3600000) });
      const beforeCash = await CashEntry.countDocuments({ spaId });
      const used = await perform(employee, 'completeTreatmentAppointment', { id: String(visit._id), signature: signed, remainingBefore: sale.totalSessions });
      assert.ok(used.treatmentUseId);
      assert.equal((await Treatment.findById(plan.id))!.remaining, sale.totalSessions - 1);
      assert.equal((await Invoice.findById(plan.invoiceId))!.paid, 0);
      assert.equal(await CashEntry.countDocuments({ spaId }), beforeCash);
      const paymentData = { invoiceId: plan.invoiceId, amount: 600000, method: 'CASH', receivedConfirmation: true };
      const concurrent = await Promise.allSettled([perform(employee, 'payment', paymentData), perform(employee, 'payment', paymentData)]);
      assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1);
      const bill = (await Invoice.findById(plan.invoiceId))!;
      assert.equal(bill.paid, 600000);
      assert.equal(bill.status, 'PARTIALLY_PAID');
      assert.equal(await Payment.countDocuments({ spaId, invoiceId: plan.invoiceId }), 1);
      const beforeRejected = await snapshot();
      await assert.rejects(perform(employee, 'payment', { ...paymentData, amount: 400001 }), status(400));
      await assert.rejects(perform(employee, 'payment', { ...paymentData, amount: 1, receivedConfirmation: false }));
      assert.deepEqual(await snapshot(), beforeRejected);
      await perform(employee, 'payment', { ...paymentData, amount: 400000, method: 'BANK_TRANSFER', note: 'Ảnh nhóm lúc 10:30' });
      assert.equal((await Invoice.findById(plan.invoiceId))!.status, 'PAID');
      assert.equal((await CashEntry.findOne({ spaId, kind: 'PAYMENT', note: 'Ảnh nhóm lúc 10:30' }))!.actorId.toString(), employee.id);
    });

    await t.test('cọc sai khách/vượt số dư/vượt nợ bị từ chối và không để lại thay đổi', async () => {
      const bill = await call('invoice', { customerId: customer.id, serviceId: service.id });
      const ownCredit = await call('deposit', { customerId: customer.id, amount: 500000, method: 'CASH' });
      const otherCredit = await call('deposit', { customerId: otherCustomer.id, amount: 500000, method: 'CASH' });
      const before = await snapshot();
      for (const payload of [
        { depositId: otherCredit.id, invoiceId: bill.id, amount: 1, reason: 'Wrong customer' },
        { depositId: ownCredit.id, invoiceId: bill.id, amount: 500001, reason: 'Above balance' },
        { depositId: ownCredit.id, invoiceId: bill.id, amount: 350001, reason: 'Above debt' },
      ]) await assert.rejects(call('allocate', payload), status(400));
      await assert.rejects(perform(cashier, 'allocate', { depositId: ownCredit.id, invoiceId: bill.id, amount: 1, reason: 'Cashier without assigned visit' }), status(403));
      assert.deepEqual(await snapshot(), before);
      assert.equal((await Deposit.findById(ownCredit.id))!.balance, 500000);
      assert.equal((await Deposit.findById(otherCredit.id))!.balance, 500000);
      assert.equal((await Invoice.findById(bill.id))!.paid, 0);
    });

    await t.test('cách ly spa: ID tồn tại ở spa khác vẫn không được dùng để thu/áp cọc/bán gói', async () => {
      const foreignSpa = await Spa.create({ name: 'Isolated test ' + randomUUID() });
      extraSpaIds.push(foreignSpa._id);
      const foreignCustomer = await Customer.create({ spaId: foreignSpa._id, name: 'Foreign customer', phone: '0900000099' });
      const foreignBill = await Invoice.create({ spaId: foreignSpa._id, customerId: foreignCustomer._id, total: 100000, paid: 0 });
      const foreignCredit = await Deposit.create({ spaId: foreignSpa._id, customerId: foreignCustomer._id, amount: 100000, balance: 100000 });
      const before = await snapshot();
      await assert.rejects(call('payment', { invoiceId: String(foreignBill._id), amount: 1, method: 'CASH', receivedConfirmation: true }), status(404));
      await assert.rejects(call('allocate', { invoiceId: independentBill.id, depositId: String(foreignCredit._id), amount: 1, reason: 'Foreign credit' }), status(404));
      await assert.rejects(call('sellPackage', { ...sale, customerId: String(foreignCustomer._id) }), status(404));
      assert.deepEqual(await snapshot(), before);
      assert.equal((await Invoice.findById(foreignBill._id))!.paid, 0);
      assert.equal((await Deposit.findById(foreignCredit._id))!.balance, 100000);
    });

    await t.test('nhân viên hoãn và xếp lại lịch gói của mình: giữ nguyên bản cũ, retry chỉ một lịch mới', async () => {
      const plan = await call('sellPackage', sale);
      const visit = await call('appointment', { ...bookingData, startAt: at(160), treatmentId: plan.id, notes: 'Keep notes' });
      await perform(employee, 'appointmentStatus', { id: visit.id, status: 'POSTPONED', reason: 'Khách xin hoãn' });
      const before = (await Appointment.findById(visit.id))!.toObject();
      const counts = await snapshot();
      const payload = { id: visit.id, staffId: employee.id, startAt: at(164), reason: 'Khách chốt giờ mới' };
      await assert.rejects(perform(employee, 'rescheduleAppointment', { ...payload, staffId: String(other._id) }), status(403));
      const key = randomUUID();
      const moved = await perform(employee, 'rescheduleAppointment', payload, key);
      assert.deepEqual(await perform(employee, 'rescheduleAppointment', payload, key), moved);
      await assert.rejects(perform(employee, 'rescheduleAppointment', payload), status(409));
      await assert.rejects(perform(employee, 'rescheduleAppointment', { ...payload, reason: 'Changed payload' }, key), status(409));
      assert.deepEqual((await Appointment.findById(visit.id))!.toObject(), before);
      const replacement = (await Appointment.findById(moved.replacementAppointmentId))!;
      assert.equal(String(replacement.treatmentId), plan.id);
      assert.equal(String(replacement.customerId), customer.id);
      assert.equal(String(replacement.serviceId), service.id);
      assert.equal(replacement.notes, 'Keep notes');
      assert.equal(await Appointment.countDocuments({ spaId, rescheduledFromId: visit.id }), 1);
      assert.equal((await Treatment.findById(plan.id))!.remaining, sale.totalSessions);
      const after = await snapshot();
      assert.equal(after.invoices, counts.invoices);
      assert.equal(after.cash, counts.cash);
      assert.equal(after.uses, counts.uses);
      const audit = (await Audit.findOne({ spaId, action: 'rescheduleAppointment', targetId: visit.id }))!;
      assert.equal(String(audit.actorId), employee.id);
      assert.equal(audit.details.replacementAppointmentId, String(replacement._id));
    });

    await t.test('chỉ OWNER đảo phân bổ; trả lại số dư/nợ đúng một lần và không phát sinh thu chi', async () => {
      const bill = await call('invoice', { customerId: customer.id, serviceId: service.id });
      const credit = await call('deposit', { customerId: customer.id, amount: 500000, method: 'CASH' });
      const allocation = await call('allocate', { depositId: credit.id, invoiceId: bill.id, amount: 350000, reason: 'Original allocation' });
      const original = (await Allocation.findById(allocation.id))!;
      const originalReceipt = (await Deposit.findById(credit.id))!.receiptId.toString();
      const before = await snapshot();
      for (const who of [employee, cashier]) await assert.rejects(perform(who, 'reverseAllocation', { id: allocation.id, reason: 'Denied' }), status(403));
      await assert.rejects(call('reverseCash', { id: originalReceipt, reason: 'Still allocated' }), status(400));
      assert.deepEqual(await snapshot(), before);
      const reverseKey = randomUUID();
      const payload = { id: allocation.id, reason: 'Recorded against wrong invoice' };
      const reversed = await call('reverseAllocation', payload, reverseKey);
      assert.deepEqual(await call('reverseAllocation', payload, reverseKey), reversed);
      await assert.rejects(call('reverseAllocation', payload), status(400));
      const stored = (await Allocation.findById(allocation.id))!;
      assert.equal(stored.amount, original.amount);
      assert.equal(stored.reason, original.reason);
      assert.equal(stored.reversed, true);
      assert.equal((await Deposit.findById(credit.id))!.balance, 500000);
      assert.equal((await Invoice.findById(bill.id))!.paid, 0);
      assert.equal((await Invoice.findById(bill.id))!.status, 'OPEN');
      assert.equal(await CashEntry.countDocuments({ spaId }), before.cash);
      assert.equal(await Audit.countDocuments({ spaId, action: 'reverseAllocation', targetId: allocation.id }), 1);
      const reverseCredit = await call('reverseCash', { id: originalReceipt, reason: 'Đảo khoản cọc ghi nhầm sau khi đã gỡ phân bổ' });
      assert.equal((await Deposit.findById(credit.id))!.amount, 500000);
      assert.equal((await Deposit.findById(credit.id))!.balance, 0);
      assert.equal((await CashEntry.findById(originalReceipt))!.reversed, true);
      assert.equal((await CashEntry.findById(reverseCredit.id))!.direction, 'OUT');
      assert.equal(await Allocation.countDocuments({ spaId, _id: allocation.id }), 1); // financial history is retained

    });

    await t.test('đảo khoản thu tạo bút toán đối ứng, giữ bản gốc và không đảo lần hai', async () => {
      const bill = await call('invoice', { customerId: customer.id, serviceId: service.id });
      const payment = await perform(cashier, 'payment', { invoiceId: bill.id, amount: 100000, method: 'CASH', receivedConfirmation: true, note: 'Original receipt' });
      const paid = (await Payment.findById(payment.id))!;
      const receiptId = String(paid.receiptId);
      const original = (await CashEntry.findById(receiptId))!;
      const before = await snapshot();
      for (const who of [employee, cashier]) await assert.rejects(perform(who, 'reverseCash', { id: receiptId, reason: 'Denied' }), status(403));
      await assert.rejects(call('reverseCash', { id: receiptId, reason: '' }));
      assert.deepEqual(await snapshot(), before);
      const payload = { id: receiptId, reason: 'Sai khoản ghi nhận, không phải hoàn tiền' };
      const key = randomUUID();
      const reversed = await Promise.all([call('reverseCash', payload, key), call('reverseCash', payload, key)]);
      assert.deepEqual(reversed[0], reversed[1]);
      await assert.rejects(call('reverseCash', payload), status(400));
      await assert.rejects(call('reverseCash', { id: reversed[0].id, reason: 'Cannot reverse a reversal' }), status(400));
      const stored = (await CashEntry.findById(receiptId))!;
      assert.equal(stored.amount, original.amount);
      assert.equal(stored.note, original.note);
      assert.equal(stored.direction, 'IN');
      assert.equal(stored.reversed, true);
      const counter = (await CashEntry.findById(reversed[0].id))!;
      assert.equal(counter.kind, 'REVERSAL');
      assert.equal(counter.direction, 'OUT');
      assert.equal(counter.amount, stored.amount);
      assert.equal(counter.day, spaDay());
      assert.equal(String(counter.originalId), receiptId);
      assert.equal((await Invoice.findById(bill.id))!.paid, 0);
      assert.equal((await Payment.findById(payment.id))!.reversed, true);
      assert.equal(await CashEntry.countDocuments({ spaId, originalId: receiptId }), 1);
      assert.equal(await Audit.countDocuments({ spaId, action: 'reverseCash', targetId: reversed[0].id }), 1);
    });

    await t.test('Idempotency-Key không được dùng lại bởi actor khác hoặc payload khác', async () => {
      const bill = await call('invoice', { customerId: customer.id, serviceId: service.id });
      const payload = { invoiceId: bill.id, amount: 100000, method: 'CASH', receivedConfirmation: true };
      const key = randomUUID();
      const paid = await call('payment', payload, key);
      const before = await snapshot();
      assert.deepEqual(await call('payment', payload, key), paid);
      await assert.rejects(perform(cashier, 'payment', payload, key), status(409));
      await assert.rejects(call('payment', { ...payload, amount: 100001 }, key), status(409));
      // A successful retry touches the transaction guard, but adds no financial/audit/idempotency event.
      const after = await snapshot();
      assert.deepEqual({ ...after, control: before.control }, before);
      assert.equal((await Invoice.findById(bill.id))!.paid, 100000);
    });

    await t.test('đảo thu/chi khác giữ khoản gốc và tạo đúng hướng đối ứng', async () => {
      for (const direction of ['IN', 'OUT']) {
        const original = await call('cash', { direction, amount: 25000, method: 'CASH', note: 'Bút toán test ' + direction });
        const reversed = await call('reverseCash', { id: original.id, reason: 'Ghi nhầm hướng ' + direction });
        const stored = (await CashEntry.findById(original.id))!;
        const counter = (await CashEntry.findById(reversed.id))!;
        assert.equal(stored.amount, 25000);
        assert.equal(stored.reversed, true);
        assert.equal(stored.direction, direction);
        assert.equal(counter.direction, direction === 'IN' ? 'OUT' : 'IN');
        const net = [stored, counter].reduce((sum, entry) => sum + (entry.direction === 'IN' ? entry.amount : -entry.amount), 0);
        assert.equal(net, 0);
        assert.equal(await CashEntry.countDocuments({ spaId, originalId: original.id }), 1);
      }
    });

    await t.test('ký trực tiếp và bảo lưu: quyền, retry, stale chữ ký, rollback và không tự mở lại', async () => {
      const plan = await call('sellPackage', { ...sale, totalSessions: 5 });
      const scope = { spaId, treatmentId: plan.id };
      const payload = { treatmentId: plan.id, signature: signed, remainingBefore: 5 };
      const before = await snapshot();
      for (const raw of [{ treatmentId: plan.id, method: 'SIGNATURE_REFERENCE', evidenceReference: 'OLD' },
        { ...payload, signature: { version: 1, strokes: [] } }, { ...payload, signature: '<svg>bad</svg>' }]) await assert.rejects(call('use', raw));
      assert.deepEqual(await snapshot(), before);
      const useKey = randomUUID();
      const used = await operate(employee, 'use', payload, useKey);
      assert.equal((await operate(employee, 'use', payload, useKey)).id, used.id);
      await assert.rejects(operate(employee, 'use', payload, randomUUID()), status(409));
      const stored = (await TreatmentUse.findById(used.id).select('+signature'))!;
      assert.deepEqual(stored.signature, signed); assert.equal(stored.method, 'DRAWN_SIGNATURE');
      assert.equal(stored.sessionNumber, 1); assert.equal(String(stored.customerId), customer.id);
      assert.equal(String(stored.staffId), employee.id);
      const proof = JSON.parse(stored.snapshot); assert.equal(proof.signatureDigest, stored.signatureDigest);
      assert.equal(proof.remainingBefore, 5); assert.ok(proof.customerName); assert.ok(proof.staffName);
      assert.equal((await TreatmentUse.findById(used.id))!.signature, undefined);
      const audit = (await Audit.findOne({ spaId, action: 'use', targetId: used.id }))!;
      assert.equal(audit.details.signature, undefined); assert.equal(audit.details.signatureDigest, stored.signatureDigest);
      const until = spaDay(new Date(Date.now() + 7 * 86400000));
      const hold = { id: plan.id, holdUntil: until, reason: 'Chủ spa xét lý do hợp lý' };
      for (const person of [employee, cashier]) {
        await assert.rejects(perform(person, 'pauseTreatment', hold), status(403));
        await assert.rejects(perform(person, 'resumeTreatment', { id: plan.id, reason: 'Không được phép' }), status(403));
        await assert.rejects(perform(person, 'extendTreatmentHold', hold), status(403));
      }
      await assert.rejects(call('pauseTreatment', { ...hold, holdUntil: '2026-02-30' }));
      const holdKey = randomUUID(); await call('pauseTreatment', hold, holdKey); await call('pauseTreatment', hold, holdKey);
      assert.equal(await Audit.countDocuments({ spaId, action: 'pauseTreatment', targetId: plan.id }), 1);
      assert.equal((await Treatment.findById(plan.id))!.remaining, 4);
      assert.equal((await Treatment.findById(plan.id))!.expiresOn, undefined);
      const pausedVisit = await Appointment.create({ spaId, customerId: customer.id, serviceId: service.id, staffId: staff._id,
        treatmentId: plan.id, startAt: past, endAt: new Date(past.getTime()+3600000) });
      await assert.rejects(perform(employee, 'completeTreatmentAppointment', { id: String(pausedVisit._id), signature: signed, remainingBefore: 4 }), status(400));
      await assert.rejects(perform(employee, 'use', { ...payload, remainingBefore: 4 }), status(400));
      await assert.rejects(call('appointment', { ...bookingData, startAt: at(200), treatmentId: plan.id }), status(400));
      assert.equal((await Appointment.findById(pausedVisit._id))!.status, 'CONFIRMED');
      // Advancing beyond the entered end date never resumes a paused package.
      await Treatment.updateOne({ spaId, _id: plan.id }, { holdUntil: spaDay(new Date(Date.now()-86400000)) });
      await assert.rejects(call('use', { ...payload, remainingBefore: 4 }), status(400));
      await call('extendTreatmentHold', { ...hold, holdUntil: until });
      assert.equal((await Treatment.findById(plan.id))!.status, 'PAUSED');
      await call('resumeTreatment', { id: plan.id, reason: 'Khách quay lại, không duyệt gia hạn' });
      assert.equal((await Treatment.findById(plan.id))!.expiresOn, undefined);
      assert.equal((await Treatment.findById(plan.id))!.remaining, 4);
      const rollbackBefore = await snapshot();
      const mock = t.mock.method(Audit, 'create', async () => { throw new Error('INJECT_AUDIT_SIGNATURE_FAILURE'); });
      try { await assert.rejects(call('completeTreatmentAppointment', { id: String(pausedVisit._id), signature: signed, remainingBefore: 4 }), /INJECT_AUDIT_SIGNATURE_FAILURE/); }
      finally { mock.mock.restore(); }
      assert.deepEqual(await snapshot(), rollbackBefore);
      assert.equal((await Appointment.findById(pausedVisit._id))!.status, 'CONFIRMED');
      const completed = await perform(employee, 'completeTreatmentAppointment', { id: String(pausedVisit._id), signature: signed, remainingBefore: 4 });
      assert.ok(completed.treatmentUseId); assert.equal((await Treatment.findById(plan.id))!.remaining, 3);
      await call('pauseTreatment', hold);
      await call('resumeTreatment', { id: plan.id, reason: 'Chủ spa duyệt hạn mới riêng', expiresOn: until });
      assert.equal((await Treatment.findById(plan.id))!.expiresOn, until);
      assert.equal(await TreatmentUse.countDocuments(scope), 2);
      // A real foreign ID cannot be signed or paused in this spa.
      const foreign = await Treatment.create({ spaId: extraSpaIds[0], customerId: customer.id, invoiceId: new mongoose.Types.ObjectId(), totalSessions: 1, remaining: 1 });
      await assert.rejects(call('use', { treatmentId: String(foreign._id), signature: signed, remainingBefore: 1 }), status(404));
      await assert.rejects(call('pauseTreatment', { ...hold, id: String(foreign._id) }), status(404));
    });

    await t.test('customer search and paging reach beyond 500 and keep spa boundaries', async () => {
      const pagingSpa = await Spa.create({ name: `Customer paging ${randomUUID()}` });
      extraSpaIds.push(pagingSpa._id);
      const fixtures = await Customer.insertMany(Array.from({ length: 505 }, (_, n) => ({
        spaId: pagingSpa._id, name: n === 0 ? 'Oldest customer [VIP].*' : `Paging customer ${n}`, phone: `080${String(n).padStart(7, '0')}`,
        createdAt: new Date(2020, 0, 1, 0, 0, n),
      })));
      const query = { search: '', page: 26, pageSize: 20 };
      const last = await findCustomerPage(String(pagingSpa._id), query);
      assert.equal(last.total, 505); assert.equal(last.customers.length, 5);
      assert.ok(last.customers.some((row: any) => String(row._id) === String(fixtures[0]._id)));
      const found = await findCustomerPage(String(pagingSpa._id), { ...query, page: 1, search: '[VIP].*' });
      assert.equal(found.total, 1);
      const foreign = await findCustomerPage(String(spaId), { ...query, page: 1, id: String(fixtures[0]._id) });
      assert.equal(foreign.total, 0);
      const clamped = await findCustomerPage(String(pagingSpa._id), { ...query, page: 9999 });
      assert.equal(clamped.page, 26);
      const pagingUser = await User.create({ spaId: pagingSpa._id, name: 'Paging owner', email: randomUUID() + '@example.test', passwordHash: hashPassword(randomUUID()), role: 'OWNER' });
      const pagingActor: Actor = { id: String(pagingUser._id), spaId: String(pagingSpa._id), role: 'OWNER', name: 'Paging owner', cashier: false };
      const entries = await CashEntry.insertMany(Array.from({ length: 505 }, (_, n) => ({ spaId: pagingSpa._id, actorId: pagingUser._id, customerId: fixtures[0]._id, direction: 'IN', kind: 'INCOME', method: 'CASH', amount: 1000, day: '2020-01-01', note: n === 0 ? 'Oldest ledger [VIP].*' : `Ledger ${n}`, createdAt: new Date(2020, 0, 1, 0, 0, n) })));
      await Invoice.insertMany(Array.from({ length: 505 }, (_, n) => ({ spaId: pagingSpa._id, customerId: fixtures[0]._id, total: 1000, paid: 1000, status: 'PAID', description: `Historical invoice ${n}` })));
      await Audit.insertMany(Array.from({ length: 505 }, (_, n) => ({ spaId: pagingSpa._id, actorId: pagingUser._id, action: 'cash', details: { note: `Audit fixture ${n}` } })));
      const read = (params: Record<string, string>) => readWorkspace(pagingActor, workspaceQuery(new URLSearchParams(params)));
      for (const section of ['cash', 'invoices', 'audit']) {
        const result = await read({ section, page: '26', pageSize: '20' });
        const key = section === 'audit' ? 'audit' : section;
        assert.equal(result.pages[key].total, 505);
        assert.equal(result.pages[key].rows.length, 5);
        if (section !== 'audit') assert.equal(result.customers[0]?.name, fixtures[0].name);
      }
      const filteredCash = await read({ section: 'cash', pageSize: '5', from: '2020-01-01', to: '2020-01-01', method: 'CASH', direction: 'IN' });
      assert.equal(filteredCash.pages.cash.total, 505);
      assert.equal(filteredCash.pages.cash.rows.length, 5);
      assert.equal(filteredCash.pages.cash.summary.incoming, 505000);
      assert.equal((await read({ section: 'cash', method: 'BANK_TRANSFER' })).pages.cash.total, 0);
      assert.equal((await read({ section: 'cash', employee: String(new mongoose.Types.ObjectId()) })).pages.cash.total, 0);
      assert.equal((await read({ section: 'invoices', status: 'DEBT' })).pages.invoices.total, 0);
      assert.equal((await read({ section: 'invoices', status: 'PAID' })).pages.invoices.total, 505);
      const profile = await readCustomerHistory(pagingActor, String(fixtures[0]._id), 'invoices', 1);
      assert.equal(profile.summary.invoices, 505); assert.equal(profile.summary.debt, 0);
      const unauthorizedProfile = await readCustomerHistory({ ...pagingActor, role: 'STAFF', id: String(new mongoose.Types.ObjectId()) }, String(fixtures[0]._id), 'invoices', 1);
      assert.equal(unauthorizedProfile.summary.invoices, 0); assert.equal(unauthorizedProfile.summary.credit, null);
      const cashSearch = await read({ section: 'cash', search: 'Oldest ledger [VIP].*' });
      assert.equal(cashSearch.pages.cash.total, 1);
      assert.equal(String(cashSearch.pages.cash.rows[0]._id), String(entries[0]._id));
      const report = await read({ section: 'reports', from: '2020-01-01', to: '2020-01-01' });
      assert.equal(report.report.inflow, 505000);
      assert.equal(report.report.outflow, 0);
      const regularStaff: Actor = { ...pagingActor, role: 'STAFF', id: String(new mongoose.Types.ObjectId()) };
      const staffCash = await readWorkspace(regularStaff, workspaceQuery(new URLSearchParams({ section: 'cash' })));
      assert.equal(staffCash.pages.cash.total, 0);
      await assert.rejects(readWorkspace(regularStaff, workspaceQuery(new URLSearchParams({ section: 'audit' }))), status(403));
      await assert.rejects(readWorkspace(regularStaff, workspaceQuery(new URLSearchParams({ section: 'reports' }))), status(403));
    });
    await t.test('sản phẩm: nhập xuất, bán chống âm kho/trùng, snapshot, quyền và rollback', async () => {
      const group = await call('productGroup', { name: 'Chăm sóc da' });
      await assert.rejects(call('productGroup', { name: ' chăm  sóc da ' }), status(409));
      const product = await call('product', { name: 'Serum test', sku: randomUUID(), unit: 'Chai', groupId: group.id, price: 120000, stock: 999 });
      assert.equal((await Product.findById(product.id))!.stock, 0);
      await assert.rejects(operate(employee, 'stockMovement', { productId: product.id, direction: 'IN', quantity: 10, reason: 'Nhập test' }, randomUUID()), status(403));
      const stockKey = randomUUID(), stockData = { productId: product.id, direction: 'IN', quantity: 5, reason: 'Nhập test' };
      const incoming = await call('stockMovement', stockData, stockKey);
      assert.deepEqual(await call('stockMovement', stockData, stockKey), incoming);
      assert.equal((await Product.findById(product.id))!.stock, 5);
      const saleData = { customerId: customer.id, productId: product.id, quantity: 3 };
      const results = await Promise.allSettled([call('sellProduct', saleData), call('sellProduct', saleData)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal((await Product.findById(product.id))!.stock, 2);
      const sold = (results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
      assert.equal((await Invoice.findById(sold.id))!.total, 360000);
      assert.equal((await Invoice.findById(sold.id))!.paid, 0);
      const retryKey = randomUUID();
      const one = await call('sellProduct', { ...saleData, quantity: 1 }, retryKey);
      assert.deepEqual(await call('sellProduct', { ...saleData, quantity: 1 }, retryKey), one);
      assert.equal(await StockMovement.countDocuments({ spaId, invoiceId: one.id }), 1);
      await call('updateProduct', { id: product.id, name: 'Renamed serum', sku: randomUUID(), unit: 'Hộp', price: 999999, groupId: group.id });
      const bill = (await readInvoice(actor, sold.id)).invoice;
      assert.equal(bill.productName, 'Serum test'); assert.equal(bill.unitPrice, 120000); assert.equal(bill.productUnit, 'Chai');
      const originalCreate = StockMovement.create;
      StockMovement.create = (async () => { throw new Error('Forced stock failure'); }) as any;
      const rollbackKey = randomUUID();
      const beforeInvoices = await Invoice.countDocuments({ spaId });
      try { await assert.rejects(call('sellProduct', { ...saleData, quantity: 1 }, rollbackKey), /Forced stock failure/); }
      finally { StockMovement.create = originalCreate; }
      assert.equal((await Product.findById(product.id))!.stock, 1);
      assert.equal(await Invoice.countDocuments({ spaId }), beforeInvoices);
      assert.equal(await Idempotency.countDocuments({ spaId, key: rollbackKey }), 0);
      await assert.rejects(readProducts(employee, productQuery(new URLSearchParams())), status(403));
      assert.equal((await readProducts(actor, productQuery(new URLSearchParams('search=Renamed')))).total, 1);
      await call('productStatus', { id: product.id, active: false });
      await assert.rejects(call('sellProduct', { ...saleData, quantity: 1 }), /ngừng bán/);
      await call('payment', { invoiceId: sold.id, amount: 360000, method: 'CASH', receivedConfirmation: true });
      assert.equal((await Invoice.findById(sold.id))!.paid, 360000);
    });
    await t.test('lương và hoa hồng: snapshot, quà0, chống trùng, duyệt và chi có rollback', async () => {
      const person = await User.create({ spaId, name: 'Payroll employee', email: randomUUID() + '@example.test', passwordHash: hashPassword(randomUUID()), role: 'STAFF' });
      const who: Actor = { ...employee, id: String(person._id) };
      const month = spaDay().slice(0, 7);
      await call('setStaffSalary', { staffId: who.id, baseSalary: 5000000 });
      assert.equal((await User.findById(person._id).lean())!.baseSalary, undefined);
      await assert.rejects(perform(who, 'setStaffSalary', { staffId: who.id, baseSalary: 1 }), status(403));
      await call('updateService', { id: service.id, name: 'Payroll service', price: 350000, duration: 90, commission: 25000 });
      const bill = await call('invoice', { customerId: customer.id, serviceId: service.id });
      await assert.rejects(perform(who, 'setServiceCommission', { serviceId: service.id, commission: 1 }), status(403));
      await assert.rejects(call('setServiceCommission', { serviceId: new mongoose.Types.ObjectId().toString(), commission: 10000 }), status(404));
      await call('setServiceCommission', { serviceId: service.id, commission: 99999 });
      assert.equal((await Service.findById(service.id))!.price, 350000);
      assert.equal((await Service.findById(service.id))!.commission, 99999);
      const completeKey = randomUUID();
      await Promise.all([call('completeInvoiceService', { id: bill.id, staffId: who.id }, completeKey), call('completeInvoiceService', { id: bill.id, staffId: who.id }, completeKey)]);
      assert.equal((await Commission.findOne({ spaId, invoiceId: bill.id }))!.amount, 25000);
      assert.equal(await Commission.countDocuments({ spaId, invoiceId: bill.id }), 1);
      assert.equal((await Invoice.findById(bill.id))!.paid, 0);
      await assert.rejects(perform(who, 'completeInvoiceService', { id: bill.id, staffId: who.id }), status(403));
      const gifts = await call('sellPackage', { ...sale, promotion: 'Payroll gift', gifts: [{ templateId: template.id }] });
      const giftBill = (await Invoice.findOne({ spaId, giftOfInvoiceId: gifts.invoiceId }))!;
      const gift = (await Treatment.findOne({ spaId, invoiceId: giftBill._id }))!;
      const used = await perform(who, 'use', { treatmentId: String(gift._id), signature: signed, remainingBefore: 5 });
      const useCommission = (await Commission.findOne({ spaId, sourceType: 'TREATMENT_USE', sourceId: used.id }))!;
      assert.equal(useCommission.amount, 99999);
      assert.equal((await Invoice.findById(useCommission.invoiceId))!.total, 0);
      const visit = await Appointment.create({ spaId, customerId: customer.id, serviceId: service.id, staffId: person._id, startAt: past, endAt: new Date(past.getTime() + 3600000) });
      await Promise.all([perform(who, 'completeAppointment', { id: String(visit._id) }), perform(who, 'completeAppointment', { id: String(visit._id) })]);
      assert.equal(await Commission.countDocuments({ spaId, sourceType: 'APPOINTMENT', sourceId: visit._id }), 1);
      const draftData = { staffId: who.id, month, bonus: 50000, deductions: 10000, note: 'Confirmed adjustment' };
      const draftKey = randomUUID();
      const draft = await call('savePayroll', draftData, draftKey);
      assert.deepEqual(await call('savePayroll', draftData, draftKey), draft);
      await assert.rejects(call('savePayroll', draftData), status(409));
      const original = (await Payroll.findById(draft.id))!;
      assert.equal(original.total, 5000000 + 25000 + 99999 + 99999 + 50000 - 10000);
      const extraBill = await call('invoice', { customerId: customer.id, serviceId: service.id });
      await call('completeInvoiceService', { id: extraBill.id, staffId: who.id });
      await assert.rejects(call('approvePayroll', { id: draft.id, expectedTotal: original.total }), status(409));
      await call('savePayroll', { ...draftData, id: draft.id });
      const refreshed = (await Payroll.findById(draft.id))!;
      await call('approvePayroll', { id: draft.id, expectedTotal: refreshed.total });
      assert.equal(await Commission.countDocuments({ spaId, payrollId: draft.id }), 4);
      await assert.rejects(call('savePayroll', { ...draftData, id: draft.id }), status(409));
      await assert.rejects(perform(who, 'payPayroll', { id: draft.id, method: 'CASH', receivedConfirmation: true }), status(403));
      await assert.rejects(call('payPayroll', { id: draft.id, method: 'CASH', receivedConfirmation: false }));
      const payData = { id: draft.id, method: 'CASH', receivedConfirmation: true };
      const payKey = randomUUID();
      const injected = t.mock.method(CashEntry, 'create', (() => { throw new Error('TEST_PAYROLL_RECEIPT_FAILURE'); }) as any);
      try { await assert.rejects(call('payPayroll', payData, payKey), /TEST_PAYROLL_RECEIPT_FAILURE/); }
      finally { injected.mock.restore(); }
      assert.equal((await Payroll.findById(draft.id))!.status, 'APPROVED');
      assert.equal(await CashEntry.countDocuments({ spaId, payrollId: draft.id }), 0);
      assert.equal(await Idempotency.countDocuments({ spaId, key: payKey }), 0);
      await Promise.all([call('payPayroll', payData, payKey), call('payPayroll', payData, payKey)]);
      await call('payPayroll', payData);
      assert.equal((await Payroll.findById(draft.id))!.status, 'PAID');
      assert.equal(await CashEntry.countDocuments({ spaId, payrollId: draft.id }), 1);
      const receipt = (await CashEntry.findOne({ spaId, payrollId: draft.id }))!;
      assert.equal(receipt.amount, refreshed.total); assert.equal(receipt.direction, 'OUT'); assert.equal(receipt.kind, 'PAYROLL');
      await assert.rejects(call('reverseCash', { id: String(receipt._id), reason: 'Not a generic cash reversal' }));
      const privateView = await readPayroll(who, payrollQuery(new URLSearchParams({ month })));
      assert.equal(privateView.people.length, 1); assert.equal(String(privateView.people[0]._id), who.id);
      assert.ok(privateView.rows.every((r: any) => String(r.staffId) === who.id));
      await assert.rejects(readPayroll({ ...who, cashier: true }, payrollQuery(new URLSearchParams({ month, employee: employee.id }))), status(403));
      const lateBill = await call('invoice', { customerId: customer.id, serviceId: service.id });
      await call('completeInvoiceService', { id: lateBill.id, staffId: who.id });
      assert.equal((await Payroll.findById(draft.id))!.total, refreshed.total);
      assert.equal(await Commission.countDocuments({ spaId, staffId: who.id, payrollId: { $exists: false } }), 1);
    });
    const closedBill = await call('invoice', { customerId: customer.id, serviceId: service.id });
    const closedPayment = await call('payment', { invoiceId: closedBill.id, amount: 100000, method: 'CASH', receivedConfirmation: true });
    await call('closeDay', { day: spaDay(), counted: 450000 });
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
  } finally {
    if (spaId) {
      const fixtureSpaIds = [spaId, ...extraSpaIds];
      for (const model of allModels) if (model.schema.path('spaId')) await model.deleteMany({ spaId: { $in: fixtureSpaIds } });
      await Spa.deleteMany({ _id: { $in: fixtureSpaIds } });
    }
    await mongoose.disconnect();
  }
});
