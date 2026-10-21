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
  { name: { type: String, required: true }, phone: String, notes: String },
  [[{ spaId: 1, phone: 1 }]],
);

export const Service = model('Service', {
  name: String,
  price: amount,
  duration: Number,
  active: { type: Boolean, default: true },
});

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
  appointmentId: optionalId,
  customerId: id,
  serviceId: optionalId,
  description: String,
  total: amount,
  paid: { ...amount, default: 0 },
  dueDate: String,
  status: { type: String, enum: ['OPEN', 'PARTIALLY_PAID', 'PAID'], default: 'OPEN' },
}, [[{ spaId: 1, appointmentId: 1 }, { unique: true, partialFilterExpression: { appointmentId: { $exists: true } } }]]);

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
    amount,
    direction: { type: String, enum: ['IN', 'OUT'], required: true },
    method: { type: String, enum: ['CASH', 'BANK_TRANSFER'], required: true },
    transferReference: String,
    kind: {
      type: String,
      enum: ['DEPOSIT', 'PAYMENT', 'INCOME', 'EXPENSE', 'REVERSAL'],
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
    [
      { spaId: 1, originalId: 1 },
      { unique: true, partialFilterExpression: { originalId: { $exists: true } } },
    ],
  ],
);

export const Treatment = model(
  'Treatment',
  {
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
  Appointment,
  Invoice,
  Deposit,
  Allocation,
  Payment,
  CashEntry,
  Treatment,
  TreatmentUse,
  Day,
  Audit,
  Idempotency,
  Migration,
];
