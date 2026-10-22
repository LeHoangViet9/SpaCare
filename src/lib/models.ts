import mongoose, { Schema, type Model } from 'mongoose';

const id = { type: Schema.Types.ObjectId, required: true };
const optionalId = { type: Schema.Types.ObjectId };
const amount = {
  type: Number,
  required: true,
  min: 0,
  max: 1_000_000_000_000,
  validate: Number.isSafeInteger,
};

// Explicit schemas reject undeclared fields. Application services own cross-document invariants.
function model(
  name: string,
  fields: Record<string, unknown>,
  indexes: [Record<string, 1 | -1>, Record<string, unknown>?][] = [],
): Model<any> {
  const schema = new Schema(
    { spaId: id, ...fields },
    { timestamps: true, strict: 'throw', versionKey: false },
  );
  for (const [keys, options] of indexes) schema.index(keys, options || {});
  return mongoose.models[name] || mongoose.model(name, schema);
}

export const Spa =
  mongoose.models.Spa ||
  mongoose.model(
    'Spa',
    new Schema({ name: String, timezone: { type: String, default: 'Asia/Ho_Chi_Minh' } }),
  );

export const User = model(
  'User',
  {
    name: String,
    email: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    baseSalary: { ...amount, required: false, select: false },
    role: { type: String, enum: ['OWNER', 'STAFF'], required: true },
    cashier: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  [[{ email: 1 }, { unique: true }]],
);

export const Session = model(
  'Session',
  { userId: id, tokenHash: String, expiresAt: Date },
  [[{ tokenHash: 1 }, { unique: true }], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);

export const LoginAttempt =
  mongoose.models.LoginAttempt ||
  mongoose.model(
    'LoginAttempt',
    new Schema({
      key: { type: String, unique: true },
      count: Number,
      expiresAt: { type: Date, index: { expires: 0 } },
    }),
  );

export const Control = model('Control', { revision: { type: Number, default: 0 } }, [
  [{ spaId: 1 }, { unique: true }],
]);

export const Customer = model(
  'Customer',
  { name: { type: String, required: true }, phone: String, notes: String, consultantId: optionalId },
  [[{ spaId: 1, phone: 1 }]],
);

export const Service = model('Service', {
  category: String,
  commission: { ...amount, default: 0 },
  name: String,
  price: amount,
  duration: Number,
  active: { type: Boolean, default: true },
});

export const PackageTemplate = model('PackageTemplate', {
  name: { type: String, required: true }, serviceId: id,
  totalSessions: { type: Number, min: 1, max: 1000, required: true }, price: amount,
  active: { type: Boolean, default: true },
});

export const ProductGroup = model('ProductGroup', { name: { type: String, required: true }, nameKey: { type: String, required: true } }, [[{ spaId: 1, nameKey: 1 }, { unique: true }]]);
export const Product = model('Product', {
  name: { type: String, required: true }, sku: { type: String, required: true }, unit: { type: String, required: true },
  groupId: optionalId, price: amount, stock: { type: Number, min: 0, max: 1_000_000_000, validate: Number.isSafeInteger, default: 0 }, active: { type: Boolean, default: true },
  description: String, imageUrl: String,
  minStock: { type: Number, min: 0, max: 1_000_000_000, validate: Number.isSafeInteger, default: 0 },
}, [[{ spaId: 1, sku: 1 }, { unique: true }], [{ spaId: 1, groupId: 1, active: 1 }]]);
export const StockMovement = model('StockMovement', {
  productId: id, productName: String, sku: String, unit: String, actorId: id, actorName: String,
  direction: { type: String, enum: ['IN', 'OUT'], required: true }, kind: { type: String, enum: ['MANUAL', 'SALE'], required: true },
  quantity: { type: Number, min: 1, max: 1_000_000_000, validate: Number.isSafeInteger, required: true },
  before: Number, after: Number, reason: String, invoiceId: optionalId,
}, [[{ spaId: 1, productId: 1, createdAt: -1 }], [{ spaId: 1, invoiceId: 1 }, { unique: true, partialFilterExpression: { invoiceId: { $exists: true } } }]]);

export const Appointment = model(
  'Appointment',
  {
    customerId: id,
    serviceId: id,
    treatmentId: optionalId,
    rescheduledFromId: optionalId,
    staffId: id,
    startAt: Date,
    endAt: Date,
    status: { type: String, enum: ['CONFIRMED', 'POSTPONED', 'COMPLETED', 'CANCELLED'], default: 'CONFIRMED' },
    changeReason: String,
    notes: String,
  },
  [[{ spaId: 1, staffId: 1, startAt: 1, endAt: 1 }], [{ spaId: 1, rescheduledFromId: 1 }, { unique: true, partialFilterExpression: { rescheduledFromId: { $exists: true } } }]],
);

export const Invoice = model('Invoice', {
  performedBy: optionalId,
  performedAt: Date,
  createdBy: optionalId,
  creatorName: String,
  consultantId: optionalId,
  consultantName: String,
  commission: { ...amount, required: false },
  treatmentUseId: optionalId,
  treatmentId: optionalId,
  kind: { type: String, enum: ['SERVICE', 'PACKAGE', 'SESSION', 'GIFT', 'PRODUCT'] },
  productId: optionalId,
  productName: String,
  productSku: String,
  productUnit: String,
  quantity: Number,
  unitPrice: { ...amount, required: false },
  promotion: String,
  giftOfInvoiceId: optionalId,
  appointmentId: optionalId,
  customerId: id,
  serviceId: optionalId,
  description: String,
  total: amount,
  paid: { ...amount, default: 0 },
  dueDate: String,
  status: { type: String, enum: ['OPEN', 'PARTIALLY_PAID', 'PAID'], default: 'OPEN' },
}, [[{ spaId: 1, appointmentId: 1 }, { unique: true, partialFilterExpression: { appointmentId: { $exists: true } } }], [{ spaId: 1, treatmentUseId: 1 }, { unique: true, partialFilterExpression: { treatmentUseId: { $exists: true } } }]]);

export const Deposit = model('Deposit', {
  customerId: id,
  amount,
  balance: amount,
  note: String,
  receiptId: optionalId,
});

export const Allocation = model('Allocation', {
  depositId: id,
  invoiceId: id,
  amount,
  reason: String,
  approvedBy: id,
  reversed: { type: Boolean, default: false },
});

export const Payment = model('Payment', {
  transferReference: String,
  receivedConfirmation: Boolean,
  invoiceId: id,
  amount,
  receiptId: id,
  reversed: { type: Boolean, default: false },
});

export const CashEntry = model(
  'CashEntry',
  {
    payrollId: optionalId,
    employeeId: optionalId,
    amount,
    direction: { type: String, enum: ['IN', 'OUT'], required: true },
    method: { type: String, enum: ['CASH', 'BANK_TRANSFER'], required: true },
    transferReference: String,
    kind: {
      type: String,
      enum: ['DEPOSIT', 'PAYMENT', 'INCOME', 'EXPENSE', 'REVERSAL', 'PAYROLL'],
      required: true,
    },
    day: String,
    note: String,
    actorId: id,
    customerId: optionalId,
    reversed: { type: Boolean, default: false },
    originalId: optionalId,
  },
  [
    [{ spaId: 1, day: 1, method: 1 }],
    [{ spaId: 1, payrollId: 1 }, { unique: true, partialFilterExpression: { payrollId: { $exists: true } } }],
    [
      { spaId: 1, originalId: 1 },
      { unique: true, partialFilterExpression: { originalId: { $exists: true } } },
    ],
  ],
);

export const Treatment = model(
  'Treatment',
  {
    templateId: optionalId,
    giftOfInvoiceId: optionalId,
    promotion: String,
    customerId: id,
    invoiceId: id,
    serviceId: optionalId,
    name: String,
    totalSessions: Number,
    remaining: Number,
    status: { type: String, enum: ['ACTIVE', 'PAUSED', 'COMPLETED'], default: 'ACTIVE' },
    holdUntil: String,
    holdReason: String,
    heldAt: Date,
    heldBy: optionalId,
    resumedAt: Date,
    resumedBy: optionalId,
    expiresOn: String,
  },
  [[{ spaId: 1, invoiceId: 1 }, { unique: true }]],
);

export const TreatmentUse = model('TreatmentUse', {
  appointmentId: optionalId,
  treatmentId: id,
  actorId: id,
  method: String,
  reason: String,
  evidenceReference: String,
  signature: { type: Schema.Types.Mixed, select: false },
  signatureDigest: String,
  sessionNumber: Number,
  customerId: optionalId,
  staffId: optionalId,
  snapshot: String,
  digest: String,
  performedAt: Date,
}, [[{ spaId: 1, appointmentId: 1 }, { unique: true, partialFilterExpression: { appointmentId: { $exists: true } } }]]);

export const Commission = model('Commission', {
  staffId: id, staffName: String, serviceId: id, serviceName: String, customerId: id,
  invoiceId: id, sourceType: { type: String, enum: ['APPOINTMENT', 'TREATMENT_USE', 'INVOICE'], required: true },
  sourceId: id, amount, earnedAt: { type: Date, required: true }, payrollId: optionalId,
}, [[{ spaId: 1, sourceType: 1, sourceId: 1 }, { unique: true }], [{ spaId: 1, invoiceId: 1 }, { unique: true }], [{ spaId: 1, staffId: 1, earnedAt: -1 }]]);

export const Payroll = model('Payroll', {
  staffId: id, staffName: String, month: { type: String, required: true }, baseSalary: amount,
  commissionTotal: amount, commissionCount: Number, carryoverCount: Number,
  bonus: { ...amount, default: 0 }, deductions: { ...amount, default: 0 }, total: amount, note: String,
  commissionIds: [{ type: Schema.Types.ObjectId }],
  status: { type: String, enum: ['DRAFT', 'APPROVED', 'PAID'], default: 'DRAFT' },
  approvedBy: optionalId, approvedAt: Date, paidBy: optionalId, paidAt: Date, receiptId: optionalId,
}, [[{ spaId: 1, staffId: 1, month: 1 }, { unique: true }]]);

export const Day = model(
  'Day',
  {
    day: String,
    opening: amount,
    revision: { type: Number, default: 0 },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    expected: Number,
    counted: Number,
    difference: Number,
    bankNet: Number,
    note: String,
    closedBy: optionalId,
    closedAt: Date,
  },
  [[{ spaId: 1, day: 1 }, { unique: true }]],
);

export const Audit = model('Audit', {
  actorId: id,
  action: String,
  targetId: optionalId,
  details: Schema.Types.Mixed,
});

export const Idempotency = model(
  'Idempotency',
  { userId: id, key: String, fingerprint: String, result: Schema.Types.Mixed },
  [[{ spaId: 1, key: 1 }, { unique: true }]],
);

export const Migration =
  mongoose.models.Migration ||
  mongoose.model(
    'Migration',
    new Schema({ version: { type: Number, unique: true }, appliedAt: Date }),
  );

export const allModels = [
  Spa,
  User,
  Session,
  LoginAttempt,
  Control,
  Customer,
  Service,
  PackageTemplate,
  ProductGroup,
  Product,
  StockMovement,
  Appointment,
  Invoice,
  Deposit,
  Allocation,
  Payment,
  CashEntry,
  Treatment,
  TreatmentUse,
  Commission,
  Payroll,
  Day,
  Audit,
  Idempotency,
  Migration,
];
