import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Appointment, Audit, CashEntry, Control, Customer, Invoice, PackageTemplate, Payment, SaleCommission, SharedSaleCommission, Spa, Treatment, TreatmentUse, User, allModels } from '../src/lib/models';
import { assertConnectedServerIdentity, assertIntegrationEnvironment, inspectIntegrationSchema } from './integration-safety';
import { connect } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { operate } from '../src/lib/operations';
import { invoiceCode } from '../src/lib/invoice-code';
import { spaDay } from '../src/lib/rules';
import type { Actor } from '../src/lib/auth';

const password = () => `E2E-${randomUUID()}-synthetic`;
const syntheticSignature = { version: 1, strokes: [[[0.1, 0.2], [0.4, 0.5], [0.7, 0.6]]] };

type TestUser = { id: string; name: string; email: string; password: string };
type PaidPackage = {
  id: string;
  invoiceId: string;
  invoiceCode: string;
  updatedAt: string;
  paymentId: string;
  receiptId: string;
  treatmentId: string;
  appointmentId?: string;
  useId?: string;
  sessionInvoiceId?: string;
};

async function createUser(spaId: mongoose.Types.ObjectId, name: string, role: 'OWNER' | 'STAFF', active = true): Promise<TestUser> {
  const credentials = { id: String(new mongoose.Types.ObjectId()), name, email: `e2e-${randomUUID()}@example.test`, password: password() };
  await User.create({
    _id: credentials.id,
    spaId,
    name,
    email: credentials.email,
    passwordHash: hashPassword(credentials.password),
    role,
    cashier: role === 'OWNER',
    active,
  });
  return credentials;
}

async function createTenant(name: string, sequence: number) {
  const spa = await Spa.create({ name: `E2E fixture ${name}` });
  const spaId = spa._id;
  await Control.create({ spaId, invoiceSequence: sequence });
  const owner = await createUser(spaId, `E2E Chủ spa ${name}`, 'OWNER');
  const staff = await Promise.all([
    createUser(spaId, `E2E Tư vấn cũ ${name}`, 'STAFF'),
    createUser(spaId, `E2E Tư vấn cùng giao dịch ${name}`, 'STAFF'),
    createUser(spaId, `E2E Tư vấn mới ${name}`, 'STAFF'),
  ]);
  const ownerDocument = await User.findById(owner.id);
  if (!ownerDocument) throw new Error('E2E owner fixture was not created.');
  const actor: Actor = {
    id: owner.id,
    spaId: String(spaId),
    name: owner.name,
    role: 'OWNER',
    cashier: true,
  };
  const call = (action: string, data: unknown) => operate(actor, action, data, randomUUID());
  await call('openDay', { day: spaDay(), opening: 0 });
  const customerName = `E2E Khách giả ${name}`;
  const customer = await call('customer', { name: customerName, phone: `0900${String(sequence).slice(-6)}` });
  const service = await call('service', { name: `E2E Dịch vụ giả ${name}`, price: 1_750_000, duration: 30 });
  const template = await call('packageTemplate', {
    name: `E2E Gói giả ${name}`,
    serviceId: service.id,
    packageType: 'SESSIONS',
    totalSessions: 10,
    price: 1_750_000,
  });
  return { spaId, owner, staff, customer, customerName, service, template, call };
}

async function createPaidPackage(tenant: Awaited<ReturnType<typeof createTenant>>, attachSignedSession = false): Promise<PaidPackage> {
  const { spaId, customer, service, template, staff, call } = tenant;
  const sale = await call('sellPackage', {
    customerId: customer.id,
    templateId: template.id,
    total: 1_750_000,
    participantIds: [staff[0].id, staff[1].id],
  });
  const originalCreate = SharedSaleCommission.create;
  try {
    SharedSaleCommission.create = async function (...args: any[]) {
      const result = await (originalCreate as any).apply(SharedSaleCommission, args);
      await new Promise(resolve => setTimeout(resolve, 5));
      return result;
    } as typeof SharedSaleCommission.create;
    await call('payment', {
      invoiceId: sale.invoiceId,
      amount: 1_750_000,
      method: 'BANK_TRANSFER',
      receivedConfirmation: true,
      transferReference: `E2E chứng từ chuyển khoản ${randomUUID()}`,
    });
  } finally {
    SharedSaleCommission.create = originalCreate;
  }
  const invoice = await Invoice.findOne({ spaId, _id: sale.invoiceId });
  const payment = await Payment.findOne({ spaId, invoiceId: sale.invoiceId });
  if (!invoice || !payment) throw new Error('E2E paid-package fixture is incomplete.');
  const receipt = await CashEntry.findOne({ spaId, _id: payment.receiptId });
  if (!receipt) throw new Error('E2E transfer receipt fixture is missing.');
  const result: PaidPackage = {
    id: String(invoice._id),
    invoiceId: String(invoice._id),
    invoiceCode: invoiceCode(invoice),
    updatedAt: invoice.updatedAt.toISOString(),
    paymentId: String(payment._id),
    receiptId: String(receipt._id),
    treatmentId: String(sale.id),
  };

  if (attachSignedSession) {
    const visit = await Appointment.create({
      spaId,
      customerId: customer.id,
      serviceId: service.id,
      staffId: staff[1].id,
      treatmentId: sale.id,
      startAt: new Date(Date.now() - 3_600_000),
      endAt: new Date(Date.now() - 1_800_000),
      status: 'CONFIRMED',
    });
    await call('completeTreatmentAppointment', {
      id: String(visit._id),
      signature: syntheticSignature,
      remainingBefore: 10,
    });
    const use = await TreatmentUse.findOne({ spaId, treatmentId: sale.id });
    const sessionInvoice = await Invoice.findOne({ spaId, kind: 'SESSION', treatmentUseId: use?._id });
    if (!use || !sessionInvoice) throw new Error('E2E signed-session fixture is incomplete.');
    result.appointmentId = String(visit._id);
    result.useId = String(use._id);
    result.sessionInvoiceId = String(sessionInvoice._id);
  }
  return result;
}

export async function createInvoiceReplacementHttpFixture() {
  const target = assertIntegrationEnvironment(process.env);
  await connect();
  await assertConnectedServerIdentity(mongoose.connection, target);
  await inspectIntegrationSchema(mongoose.connection, allModels);

  const tenant = await createTenant('chính', 910_000);
  const inactiveOwner = await createUser(tenant.spaId, 'E2E Chủ spa đã khóa', 'OWNER', false);
  const primary = await createPaidPackage(tenant, true);
  const stale = await createPaidPackage(tenant);
  const missingReason = await createPaidPackage(tenant);

  const foreignTenant = await createTenant('khác', 920_000);
  const foreign = await createPaidPackage(foreignTenant);
  const ledger = await SharedSaleCommission.find({ spaId: tenant.spaId, invoiceId: primary.invoiceId }).sort({ _id: 1 }).lean();
  if (ledger.length !== 2 || new Set(ledger.map(row => row.earnedAt?.getTime())).size !== 2) {
    throw new Error('E2E fixture must contain two commission rows with distinct earnedAt values.');
  }
  const appointment = await Appointment.findById(primary.appointmentId).lean();
  const use = await TreatmentUse.findById(primary.useId).select('+signature').lean();
  const sessionInvoice = await Invoice.findById(primary.sessionInvoiceId).lean();
  const treatment = await Treatment.findById(primary.treatmentId).lean();
  const payment = await Payment.findById(primary.paymentId).lean();
  const receipt = await CashEntry.findById(primary.receiptId).lean();
  if (!appointment || !use?.signature || !sessionInvoice || !treatment || !payment || !receipt) {
    throw new Error('E2E immutable preservation snapshots could not be collected.');
  }

  return {
    owner: tenant.owner,
    staff: tenant.staff,
    inactiveOwner,
    customerName: tenant.customerName,
    newStaffId: tenant.staff[2].id,
    primary,
    stale,
    missingReason,
    foreign,
    foreignOwner: foreignTenant.owner,
    baseline: {
      appointment: { id: String(appointment._id), status: appointment.status, startAt: appointment.startAt.toISOString() },
      use: {
        id: String(use._id),
        signatureDigest: use.signatureDigest,
        digest: use.digest,
        sessionNumber: use.sessionNumber,
        signature: use.signature,
      },
      sessionInvoice: {
        id: String(sessionInvoice._id),
        kind: sessionInvoice.kind,
        total: sessionInvoice.total,
        paid: sessionInvoice.paid,
        treatmentUseId: String(sessionInvoice.treatmentUseId),
      },
      treatment: {
        id: String(treatment._id),
        remaining: treatment.remaining,
        totalSessions: treatment.totalSessions,
        status: treatment.status,
      },
      payment: {
        id: String(payment._id),
        receiptId: String(payment.receiptId),
        invoiceId: String(payment.invoiceId),
        amount: payment.amount,
        reversed: payment.reversed,
      },
      receipt: {
        id: String(receipt._id),
        amount: receipt.amount,
        direction: receipt.direction,
        method: receipt.method,
        kind: receipt.kind,
        transferReference: receipt.transferReference,
        reversed: receipt.reversed,
      },
      ledgerTotal: ledger.reduce((sum, row) => sum + row.amount, 0),
    },
  };
}

export async function verifyInvoiceReplacementHttpFixture(fixture: Awaited<ReturnType<typeof createInvoiceReplacementHttpFixture>>) {
  const target = assertIntegrationEnvironment(process.env);
  await connect();
  await assertConnectedServerIdentity(mongoose.connection, target);
  const spaId = (await User.findById(fixture.owner.id))?.spaId;
  if (!spaId) throw new Error('E2E owner fixture disappeared.');

  const [invoice, payment, receipt, treatment, appointment, use, sessionInvoice, ledger, audits] = await Promise.all([
    Invoice.findById(fixture.primary.invoiceId).lean(),
    Payment.findById(fixture.baseline.payment.id).lean(),
    CashEntry.findById(fixture.baseline.receipt.id).lean(),
    Treatment.findById(fixture.baseline.treatment.id).lean(),
    Appointment.findById(fixture.baseline.appointment.id).lean(),
    TreatmentUse.findById(fixture.baseline.use.id).select('+signature').lean(),
    Invoice.findById(fixture.baseline.sessionInvoice.id).lean(),
    SharedSaleCommission.find({ spaId, invoiceId: fixture.primary.invoiceId }).lean(),
    Audit.find({ spaId, action: 'replacePackageAdvisor', targetId: fixture.primary.invoiceId }).lean(),
  ]);
  if (!invoice || !payment || !receipt || !treatment || !appointment || !use || !sessionInvoice) {
    throw new Error('E2E post-run fixture documents are missing.');
  }
  const same = (actual: unknown, expected: unknown, label: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`E2E preservation check failed: ${label}.`);
  };
  same(
    { id: String(payment._id), receiptId: String(payment.receiptId), invoiceId: String(payment.invoiceId), amount: payment.amount, reversed: payment.reversed },
    fixture.baseline.payment,
    'Payment',
  );
  same(
    { id: String(receipt._id), amount: receipt.amount, direction: receipt.direction, method: receipt.method, kind: receipt.kind, transferReference: receipt.transferReference, reversed: receipt.reversed },
    fixture.baseline.receipt,
    'transfer receipt',
  );
  same(
    { id: String(treatment._id), remaining: treatment.remaining, totalSessions: treatment.totalSessions, status: treatment.status },
    fixture.baseline.treatment,
    'package rights',
  );
  same(
    { id: String(appointment._id), status: appointment.status, startAt: appointment.startAt.toISOString() },
    fixture.baseline.appointment,
    'appointment',
  );
  same(
    { id: String(use._id), signatureDigest: use.signatureDigest, digest: use.digest, sessionNumber: use.sessionNumber, signature: use.signature },
    fixture.baseline.use,
    'signed TreatmentUse',
  );
  same(
    { id: String(sessionInvoice._id), kind: sessionInvoice.kind, total: sessionInvoice.total, paid: sessionInvoice.paid, treatmentUseId: String(sessionInvoice.treatmentUseId) },
    fixture.baseline.sessionInvoice,
    'SESSION invoice',
  );
  if (invoice.documentHistory?.length !== 1 || invoice.saleCommissionAccrued !== fixture.baseline.ledgerTotal) {
    throw new Error('E2E post-run replacement or commission totals are incorrect.');
  }
  if (ledger.length !== 6 || ledger.reduce((sum, row) => sum + row.amount, 0) !== fixture.baseline.ledgerTotal) {
    throw new Error('E2E post-run commission ledger was duplicated or changed total.');
  }
  if (audits.length !== 1) throw new Error('E2E repeated confirmation created more than one replacement audit.');
}
