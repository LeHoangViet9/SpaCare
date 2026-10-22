import { isValidSignature, type Signature } from './signature';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { packageTemplateInput, packageSaleInput, invoiceCharge } from './package-input';
import { payrollInputs, monthBounds, salaryTotal } from './payroll-rules';
import { productInputs, productNameKey, stockBalance, productTotal } from './product-rules';
import type { Actor } from './auth';
import { hashPassword } from './password';
import { connect } from './db';
import {
  User,
  Control,
  Customer,
  Service,
  PackageTemplate,
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
  Commission,
  Payroll,
  Product, ProductGroup, StockMovement,
} from './models';
import {
  ensure,
  money,
  allocationResult,
  dayBounds,
  spaDay,
  MAX_MONEY,
  invoiceState,
  packagePaymentDeadline,
  paymentEvidence,
} from './rules';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ');
const text = z.string().trim().min(1).max(500);
const note = z.string().trim().max(2000).default('');
const moneySchema = z.number().int().positive().max(MAX_MONEY);
const zeroMoney = z.number().int().min(0).max(MAX_MONEY);
const method = z.enum(['CASH', 'BANK_TRANSFER']);
const date = z.string().datetime({ offset: true });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const signature = z.custom<Signature>(isValidSignature, 'Khách cần ký trực tiếp để xác nhận buổi.');
const remainingBefore = z.number().int().min(1).max(1000);
const phone = z.string().trim().transform(value => value.replace(/[\s().-]/g, '').replace(/^\+84/, '0')).pipe(z.string().regex(/^0\d{9,10}$/, 'Số điện thoại phải có 10–11 chữ số, bắt đầu bằng 0 hoặc +84.'));

const schemas = {
  ...productInputs,
  ...payrollInputs,
  customer: z.object({ name: text, phone, notes: note, consultantId: objectId.optional() }),
  updateCustomer: z.object({ id: objectId, name: text, phone, notes: note, consultantId: objectId.optional() }),
  updateService: z.object({ id: objectId, name: text, price: moneySchema, duration: z.number().int().min(5).max(480), commission: zeroMoney.default(0), category: z.string().trim().max(100).default('') }),
  packageTemplate: packageTemplateInput,
  updatePackageTemplate: packageTemplateInput.extend({ id: objectId }),
  packageTemplateStatus: z.object({ id: objectId, active: z.boolean() }),
  serviceStatus: z.object({ id: objectId, active: z.boolean() }),
  updateUser: z.object({ id: objectId, name: text, email: z.string().trim().email().toLowerCase(), cashier: z.boolean() }),
  userStatus: z.object({ id: objectId, active: z.boolean() }),
  service: z.object({
    category: z.string().trim().max(100).default(''),
    commission: zeroMoney.default(0),
    name: text,
    price: moneySchema,
    duration: z.number().int().min(5).max(480),
  }),
  user: z.object({
    name: text,
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(12).max(128),
    cashier: z.boolean().default(false),
  }),
  appointment: z.object({
    treatmentId: objectId.optional(),
    customerId: objectId,
    serviceId: objectId,
    staffId: objectId,
    startAt: date,
    notes: note,
  }),
  appointmentStatus: z.object({ id: objectId, status: z.enum(['COMPLETED', 'CANCELLED', 'POSTPONED']), reason: note }),
  rescheduleAppointment: z.object({ id: objectId, staffId: objectId, startAt: date, reason: text }),
  completeTreatmentAppointment: z.object({ id: objectId, signature, remainingBefore }),
  completeAppointment: z.object({ id: objectId, existingInvoiceId: objectId.optional(), dueDate: dateOnly.optional(), description: text.optional(), total: moneySchema.optional(), consultantId: objectId.optional() }),
  sellPackage: packageSaleInput,
  invoice: z.object({
    staffId: objectId.optional(),
    treatmentId: objectId.optional(), signature: signature.optional(), remainingBefore: remainingBefore.optional(),
    customerId: objectId,
    serviceId: objectId,
    description: text.optional(),
    total: zeroMoney.optional(),
    consultantId: objectId.optional(),
    dueDate: dateOnly.optional(),
  }),
  deposit: z.object({ customerId: objectId, amount: moneySchema, method, note }),
  allocate: z.object({
    depositId: objectId,
    invoiceId: objectId,
    amount: moneySchema,
    reason: text,
  }),
  reverseAllocation: z.object({ id: objectId, reason: text }),
  payment: z.object({ invoiceId: objectId, amount: moneySchema, method, note, transferReference: z.string().trim().max(500).optional(), receivedConfirmation: z.literal(true, 'Cần xác nhận đã thực nhận tiền.') }),
  cash: z.object({ direction: z.enum(['IN', 'OUT']), amount: moneySchema, method, note: text }),
  reverseCash: z.object({ id: objectId, reason: text }),
  treatment: z.object({
    invoiceId: objectId,
    name: text,
    totalSessions: z.number().int().min(1).max(1000),
  }),
  use: z.object({ treatmentId: objectId, signature, remainingBefore, staffId: objectId.optional() }),
  pauseTreatment: z.object({ id: objectId, holdUntil: dateOnly, reason: text }),
  extendTreatmentHold: z.object({ id: objectId, holdUntil: dateOnly, reason: text }),
  resumeTreatment: z.object({ id: objectId, reason: text, expiresOn: dateOnly.optional() }),
  openDay: z.object({ day: dateOnly, opening: zeroMoney }),
  closeDay: z.object({ day: dateOnly, counted: zeroMoney, note }),
  reopenDay: z.object({ day: dateOnly, reason: text }),
};

export type Operation = keyof typeof schemas;

const ownerActions = new Set<Operation>([
  'product', 'updateProduct', 'productStatus', 'productGroup', 'updateProductGroup', 'stockMovement',
  'setServiceCommission', 'setStaffSalary', 'savePayroll', 'approvePayroll', 'payPayroll',
  'packageTemplate', 'updatePackageTemplate', 'packageTemplateStatus',
  'pauseTreatment', 'extendTreatmentHold', 'resumeTreatment',
  'updateCustomer', 'updateService', 'serviceStatus', 'updateUser', 'userStatus',
  'service',
  'user',
  'reverseAllocation',
  'reverseCash',
  'reopenDay',
]);
const cashierActions = new Set<Operation>([
  'sellProduct',
  'completeInvoiceService',
  'invoice',
  'deposit',
  'cash',
  'treatment',
  'sellPackage',
  'openDay',
  'closeDay',
]);

const sha = (x: string) => createHash('sha256').update(x).digest('hex');

export async function operate(initial: Actor, action: string, raw: unknown, key: string) {
  ensure(Object.hasOwn(schemas, action), 'Thao tác không hợp lệ.');
  ensure(/^[a-zA-Z0-9-]{16,100}$/.test(key), 'Cần Idempotency-Key hợp lệ.');
  const op = action as Operation;
  const data = schemas[op].parse(raw);
  const fingerprint = sha(JSON.stringify({ action, data }));
  await connect();
  return mongoose.connection.transaction(
    async session => {
      // A per-spa write guard serializes competing writes, including interval checks and day closure.
      // withTransaction retries transient conflicts with a fresh snapshot.
      const control = await Control.findOneAndUpdate(
        { spaId: initial.spaId },
        { $inc: { revision: 1 } },
        { session, new: true },
      );
      ensure(control, 'Chạy npm run db:setup trước khi dùng ứng dụng.', 503);
      const user = await User.findOne({
        _id: initial.id,
        spaId: initial.spaId,
        active: true,
      }).session(session);
      ensure(user, 'Tài khoản không hoạt động.', 401);
      const actor = { ...initial, role: user.role, cashier: user.cashier };
      if (ownerActions.has(op))
        ensure(actor.role === 'OWNER', 'Chỉ chủ spa được thực hiện thao tác này.', 403);
      if (cashierActions.has(op))
        ensure(actor.role === 'OWNER' || actor.cashier, 'Cần quyền thu ngân.', 403);
      const scope = { spaId: actor.spaId };
      const previous = await Idempotency.findOne({ ...scope, key }).session(session);
      if (previous) {
        ensure(
          String(previous.userId) === actor.id && previous.fingerprint === fingerprint,
          'Mã yêu cầu đã dùng cho nội dung khác.',
          409,
        );
        return previous.result;
      }
      const create = async (model: mongoose.Model<any>, values: Record<string, unknown>) =>
        (await model.create([{ ...scope, ...(model === Invoice ? { createdBy: actor.id, creatorName: user.name } : {}), ...values }], { session }))[0];
      const get = async (model: mongoose.Model<any>, id: string) => {
        const doc = await model.findOne({ ...scope, _id: id }).session(session);
        ensure(doc, 'Không tìm thấy dữ liệu trong spa này.', 404);
        return doc;
      };
      const today = spaDay();
      const consultant = async (customer: any, selectedId?: string) => {
        const consultantId = selectedId || (customer.consultantId ? String(customer.consultantId) : undefined);
        if (!consultantId) return {};
        const person = await get(User, consultantId);
        ensure(person.active, 'Nhân viên tư vấn đã ngừng hoạt động.');
        return { consultantId, consultantName: person.name };
      };
      const touchDay = async () => {
        const day = await Day.findOneAndUpdate(
          { ...scope, day: today, status: 'OPEN' },
          { $inc: { revision: 1 } },
          { session, new: true },
        );
        ensure(day, 'Hãy mở sổ hôm nay trước khi ghi tiền. Nếu đã chốt, chủ spa cần mở lại.');
      };
      const receipt = async (values: Record<string, unknown>) => {
        await touchDay();
        return create(CashEntry, { ...values, day: today, actorId: actor.id });
      };
      const updatePaid = async (invoice: any, delta: number) => {
        invoice.paid += delta;
        ensure(
          invoice.paid >= 0 && invoice.paid <= invoice.total,
          'Số thanh toán hóa đơn không hợp lệ.',
        );
        invoice.status = invoiceState(invoice.total, invoice.paid);
        await invoice.save({ session });
      };
      // Ordinary staff may collect/apply credit only for invoices attached to their visits.
      const assignedInvoice = async (invoice: any) => {
        const treatment = await Treatment.findOne({ ...scope, invoiceId: invoice._id }).session(session);
        const references = [
          ...(invoice.appointmentId ? [{ _id: invoice.appointmentId }] : []),
          ...(treatment ? [{ treatmentId: treatment._id }] : []),
        ];
        if (!references.length) return false;
        return !!await Appointment.exists({ ...scope, staffId: actor.id, status: { $in: ['CONFIRMED', 'COMPLETED'] }, $or: references }).session(session);
      };
      const accrueCommission = async (invoice: any, staffId: string, sourceType: string, sourceId: string, earnedAt = new Date()) => {
        const staff = await get(User, staffId);
        const service = await get(Service, String(invoice.serviceId));
        const existing = await Commission.findOne({ ...scope, sourceType, sourceId }).session(session);
        if (existing) return existing;
        const commission = await create(Commission, { staffId, staffName: staff.name, serviceId: service._id, serviceName: service.name,
          customerId: invoice.customerId, invoiceId: invoice._id, sourceType, sourceId, amount: money(invoice.commission ?? service.commission ?? 0), earnedAt });
        invoice.performedBy = staffId; invoice.performedAt = earnedAt;
        await invoice.save({ session });
        return commission;
      };
      const pendingCommissions = async (staffId: string, month: string) => {
        const bounds = monthBounds(month);
        return Commission.find({ ...scope, staffId, payrollId: { $exists: false }, earnedAt: { $lt: bounds.end } }).sort({ earnedAt: 1, _id: 1 }).session(session);
      };
      const fillPayroll = (payroll: any, commissions: any[]) => {
        payroll.commissionTotal = commissions.reduce((sum, c) => sum + c.amount, 0);
        payroll.commissionCount = commissions.length;
        payroll.carryoverCount = commissions.filter(c => c.earnedAt < monthBounds(payroll.month).start).length;
        payroll.commissionIds = commissions.map(c => c._id);
        payroll.total = salaryTotal(payroll.baseSalary, payroll.commissionTotal, payroll.bonus, payroll.deductions);
      };
      const payrollSnapshot = (p: any) => Object.fromEntries(['staffId', 'staffName', 'month', 'baseSalary', 'commissionTotal', 'commissionCount', 'carryoverCount', 'bonus', 'deductions', 'total', 'note', 'status', 'approvedBy', 'approvedAt', 'paidBy', 'paidAt', 'receiptId'].map(key => [key, p[key]]));
      const recordUse = async (d: z.infer<typeof schemas.use>, appointmentId?: string, staffId = d.staffId || actor.id) => {
        ensure(!d.staffId || d.staffId === actor.id || actor.role === 'OWNER' || actor.cashier, 'Chỉ chủ spa hoặc thu ngân được chọn nhân viên thực hiện khác.', 403);
        const treatment = await get(Treatment, d.treatmentId);
        ensure(treatment.status === 'ACTIVE' && treatment.remaining > 0, 'Gói đang bảo lưu hoặc không còn buổi khả dụng. Chủ spa phải mở lại gói trước.');
        ensure(treatment.remaining === d.remainingBefore, 'Số buổi đã thay đổi. Tải lại gói và yêu cầu khách ký lại.', 409);
        const customer = await get(Customer, String(treatment.customerId));
        const staff = await get(User, staffId);
        ensure(staff.active, 'Nhân viên thực hiện không hoạt động.');
        const performedAt = new Date();
        const signatureDigest = sha(JSON.stringify(d.signature));
        const sessionNumber = treatment.totalSessions - treatment.remaining + 1;
        const snapshot = JSON.stringify({ treatmentId: d.treatmentId, ...(appointmentId ? { appointmentId } : {}),
          customerId: String(customer._id), customerName: customer.name, name: treatment.name,
          staffId, staffName: staff.name, actorId: actor.id, sessionNumber, remainingBefore: treatment.remaining,
          performedAt: performedAt.toISOString(), method: 'DRAWN_SIGNATURE', signatureDigest,
          confirmationText: 'Khách ký xác nhận đã thực hiện buổi liệu trình này.' });
        const recorded = await create(TreatmentUse, { treatmentId: d.treatmentId, ...(appointmentId ? { appointmentId } : {}),
          actorId: actor.id, staffId, customerId: customer._id, sessionNumber, method: 'DRAWN_SIGNATURE',
          signature: d.signature, signatureDigest, performedAt, snapshot, digest: sha(snapshot) });
        const purchase = await get(Invoice, String(treatment.invoiceId));
        const serviceId = treatment.serviceId || purchase.serviceId;
        const service = serviceId ? await get(Service, String(serviceId)) : null;
        const sessionInvoice = await create(Invoice, { customerId: customer._id, ...(service ? { serviceId: service._id } : {}),
          ...(appointmentId ? { appointmentId } : {}), treatmentId: treatment._id, treatmentUseId: recorded._id,
          kind: 'SESSION', description: treatment.name + ' · Buổi ' + sessionNumber, total: invoiceCharge(service?.price || 0, undefined, true), paid: 0, status: 'PAID',
          commission: service?.commission || 0,
          ...(purchase.consultantId ? { consultantId: purchase.consultantId, consultantName: purchase.consultantName } : await consultant(customer)) });
        linkedInvoiceId = String(sessionInvoice._id);
        if (service) await accrueCommission(sessionInvoice, staffId, 'TREATMENT_USE', String(recorded._id), performedAt);
        treatment.remaining -= 1;
        if (!treatment.remaining) treatment.status = 'COMPLETED';
        await treatment.save({ session });
        return recorded;
      };
      let target: any;
      let appointmentBefore: Record<string, unknown> | undefined;
      let linkedInvoiceId: string | undefined;
      let treatmentUseId: string | undefined;
      let replacementAppointmentId: string | undefined;
      let financialBefore: Record<string, unknown> | undefined;
      switch (op) {
        case 'productGroup':
        case 'updateProductGroup': {
          const d = schemas[op].parse(data);
          const nameKey = productNameKey(d.name);
          const existingId = 'id' in d && typeof d.id === 'string' ? d.id : undefined;
          ensure(!await ProductGroup.exists({ ...scope, nameKey, ...(existingId ? { _id: { $ne: existingId } } : {}) }).session(session), 'Tên nhóm sản phẩm đã tồn tại.', 409);
          if (existingId) { target = await get(ProductGroup, existingId); target.name = d.name; target.nameKey = nameKey; await target.save({ session }); }
          else target = await create(ProductGroup, { name: d.name, nameKey });
          break;
        }
        case 'product':
        case 'updateProduct': {
          const d = schemas[op].parse(data);
          const existingId = 'id' in d && typeof d.id === 'string' ? d.id : undefined;
          if (d.groupId) await get(ProductGroup, d.groupId);
          ensure(!await Product.exists({ ...scope, sku: d.sku, ...(existingId ? { _id: { $ne: existingId } } : {}) }).session(session), 'Mã sản phẩm đã tồn tại.', 409);
          const values = { name: d.name, sku: d.sku, unit: d.unit, price: d.price, groupId: d.groupId || undefined, description: d.description || undefined, imageUrl: (d.imageUrl && d.imageUrl.trim()) ? d.imageUrl.trim() : undefined, minStock: d.minStock ?? 0 };
          if (existingId) { target = await get(Product, existingId); Object.assign(target, values); await target.save({ session }); }
          else target = await create(Product, values);
          break;
        }
        case 'productStatus': {
          const d = schemas.productStatus.parse(data); target = await get(Product, d.id); target.active = d.active; await target.save({ session }); break;
        }
        case 'stockMovement': {
          const d = schemas.stockMovement.parse(data); const product = await get(Product, d.productId);
          const before = product.stock; product.stock = stockBalance(before, d.direction, d.quantity);
          await product.save({ session });
          target = await create(StockMovement, { ...d, productName: product.name, sku: product.sku, unit: product.unit, actorId: actor.id, actorName: user.name, kind: 'MANUAL', before, after: product.stock });
          break;
        }
        case 'sellProduct': {
          const d = schemas.sellProduct.parse(data); const customer = await get(Customer, d.customerId); const product = await get(Product, d.productId);
          ensure(product.active, 'Sản phẩm đã ngừng bán.');
          if (d.dueDate) dayBounds(d.dueDate);
          const before = product.stock; product.stock = stockBalance(before, 'OUT', d.quantity);
          const unitPrice = d.unitPrice ?? product.price;
          target = await create(Invoice, { customerId: customer._id, productId: product._id, productName: product.name, productSku: product.sku, productUnit: product.unit, quantity: d.quantity, unitPrice, description: product.name, total: productTotal(unitPrice, d.quantity), paid: 0, kind: 'PRODUCT', ...(d.dueDate ? { dueDate: d.dueDate } : {}), ...await consultant(customer, d.consultantId) });
          await product.save({ session });
          await create(StockMovement, { productId: product._id, productName: product.name, sku: product.sku, unit: product.unit, actorId: actor.id, actorName: user.name, kind: 'SALE', direction: 'OUT', quantity: d.quantity, before, after: product.stock, reason: 'Bán hàng', invoiceId: target._id });
          linkedInvoiceId = String(target._id);
          break;
        }
        case 'setServiceCommission': {
          const d = schemas.setServiceCommission.parse(data);
          target = await get(Service, d.serviceId);
          financialBefore = { serviceId: target._id, commission: target.commission ?? 0 };
          target.commission = d.commission;
          await target.save({ session });
          break;
        }
        case 'setStaffSalary': {
          const d = schemas.setStaffSalary.parse(data);
          target = await User.findOne({ ...scope, _id: d.staffId }).select('+baseSalary').session(session);
          ensure(target, 'Không tìm thấy nhân viên trong spa.', 404);
          financialBefore = { staffId: target._id, baseSalary: target.baseSalary ?? null };
          target.baseSalary = d.baseSalary;
          await target.save({ session });
          break;
        }
        case 'savePayroll': {
          const d = schemas.savePayroll.parse(data);
          ensure(d.month <= today.slice(0, 7), 'Chưa lập bảng lương tháng tương lai.');
          ensure(!(d.bonus || d.deductions) || !!d.note.trim(), 'Nhập lý do cho thưởng hoặc khấu trừ.');
          const staff = await User.findOne({ ...scope, _id: d.staffId }).select('+baseSalary').session(session);
          ensure(staff, 'Không tìm thấy nhân viên trong spa.', 404);
          const existing = await Payroll.findOne({ ...scope, staffId: d.staffId, month: d.month }).session(session);
          ensure(!existing || existing.status === 'DRAFT', 'Bảng lương đã duyệt, không được sửa số liệu.', 409);
          ensure(existing ? d.id === String(existing._id) : !d.id, 'Bảng lương đã tồn tại hoặc đã thay đổi. Mở đúng bản nháp để cập nhật.', 409);
          financialBefore = existing ? payrollSnapshot(existing) : { status: null };
          const baseSalary = d.baseSalary ?? existing?.baseSalary ?? staff.baseSalary;
          ensure(baseSalary !== undefined, 'Cần cài lương cơ bản hoặc nhập lương tháng trước.');
          const commissions = await pendingCommissions(d.staffId, d.month);
          const { id, ...input } = d;
          const values: any = { ...input, baseSalary, staffName: staff.name };
          fillPayroll(values, commissions);
          if (existing) { Object.assign(existing, values); await existing.save({ session }); target = existing; }
          else target = await create(Payroll, values);
          break;
        }
        case 'approvePayroll': {
          const d = schemas.approvePayroll.parse(data);
          target = await get(Payroll, d.id);
          financialBefore = payrollSnapshot(target);
          if (target.status !== 'DRAFT') { ensure(target.total === d.expectedTotal, 'Số tiền bảng lương đã thay đổi.', 409); break; }
          const commissions = await pendingCommissions(String(target.staffId), target.month);
          const ids = commissions.map(c => String(c._id)).sort().join(',');
          ensure(ids === target.commissionIds.map((id: any) => String(id)).sort().join(','), 'Hoa hồng đã thay đổi. Cập nhật bản nháp trước khi duyệt.', 409);
          fillPayroll(target, commissions);
          ensure(target.total === d.expectedTotal, 'Số tiền đã thay đổi. Kiểm tra lại bảng lương.', 409);
          await Commission.updateMany({ ...scope, _id: { $in: target.commissionIds }, payrollId: { $exists: false } }, { $set: { payrollId: target._id } }, { session });
          target.status = 'APPROVED'; target.approvedBy = actor.id; target.approvedAt = new Date();
          await target.save({ session });
          break;
        }
        case 'payPayroll': {
          const d = schemas.payPayroll.parse(data);
          target = await get(Payroll, d.id);
          financialBefore = payrollSnapshot(target);
          if (target.status === 'PAID') break;
          ensure(target.status === 'APPROVED', 'Chủ spa cần duyệt bảng lương trước khi chi.');
          ensure(d.method !== 'BANK_TRANSFER' || (d.transferReference || d.note).trim().length >= 3, 'Nhập ghi chú/tham chiếu chuyển khoản lương.');
          if (target.total > 0) {
            const entry = await receipt({ amount: target.total, direction: 'OUT', method: d.method, kind: 'PAYROLL',
              payrollId: target._id, employeeId: target.staffId, note: d.note || `Lương ${target.month} · ${target.staffName}`, transferReference: d.transferReference });
            target.receiptId = entry._id;
          }
          target.status = 'PAID'; target.paidBy = actor.id; target.paidAt = new Date();
          await target.save({ session });
          break;
        }
        case 'completeInvoiceService': {
          const d = schemas.completeInvoiceService.parse(data);
          target = await get(Invoice, d.id);
          ensure(target.serviceId && (!target.kind || target.kind === 'SERVICE'), 'Chỉ hoàn thành hóa đơn dịch vụ lẻ.');
          ensure(!target.appointmentId, 'Hoàn thành dịch vụ có lịch tại mục Lịch hẹn.');
          ensure(!await Treatment.exists({ ...scope, invoiceId: target._id }).session(session), 'Hóa đơn bán gói không phải buổi thực hiện.');
          if (target.performedAt) { ensure(String(target.performedBy) === d.staffId, 'Dịch vụ đã ghi nhận cho nhân viên khác.', 409); break; }
          const staff = await get(User, d.staffId);
          ensure(staff.active, 'Nhân viên không hoạt động.');
          await accrueCommission(target, d.staffId, 'INVOICE', String(target._id));
          break;
        }
        case 'customer': {
          const d = schemas.customer.parse(data);
          const customers = await Customer.find(scope).select('phone').session(session);
          if (d.consultantId) await consultant({}, d.consultantId);
          ensure(!customers.some(c => phone.safeParse(c.phone).data === d.phone), 'Số điện thoại đã tồn tại.', 409);
          target = await create(Customer, d);
          break;
        }
        case 'updateCustomer': {
          const { id, ...d } = schemas.updateCustomer.parse(data);
          target = await get(Customer, id);
          if (d.consultantId) await consultant({}, d.consultantId);
          if (!d.consultantId) target.consultantId = undefined;
          const customers = await Customer.find({ ...scope, _id: { $ne: id } }).select('phone').session(session);
          ensure(!customers.some(c => phone.safeParse(c.phone).data === d.phone), 'Số điện thoại đã tồn tại.', 409);
          Object.assign(target, d);
          await target.save({ session });
          break;
        }
        case 'packageTemplate':
        case 'updatePackageTemplate': {
          const d = op === 'packageTemplate' ? schemas.packageTemplate.parse(data) : schemas.updatePackageTemplate.parse(data);
          const service = await get(Service, d.serviceId);
          ensure(service.active, 'Dịch vụ không hoạt động.');
          if ('id' in d) { target = await get(PackageTemplate, String(d.id)); const { id, ...values } = d; Object.assign(target, values); await target.save({ session }); }
          else target = await create(PackageTemplate, d);
          break;
        }
        case 'packageTemplateStatus': {
          const d = schemas.packageTemplateStatus.parse(data);
          target = await get(PackageTemplate, d.id); target.active = d.active; await target.save({ session }); break;
        }
        case 'updateService': {
          const { id, ...d } = schemas.updateService.parse(data);
          target = await get(Service, id);
          Object.assign(target, d);
          await target.save({ session });
          break;
        }
        case 'serviceStatus': {
          const d = schemas.serviceStatus.parse(data);
          target = await get(Service, d.id);
          ensure(d.active || !await Appointment.exists({ ...scope, serviceId: d.id, status: 'CONFIRMED' }).session(session), 'Dịch vụ còn lịch hẹn chưa xử lý.', 409);
          target.active = d.active;
          await target.save({ session });
          break;
        }
        case 'updateUser': {
          const { id, ...d } = schemas.updateUser.parse(data);
          target = await get(User, id);
          ensure(target.role === 'STAFF', 'Chỉ sửa tài khoản nhân viên.', 403);
          ensure(!await User.exists({ _id: { $ne: id }, email: d.email }).session(session), 'Email đã tồn tại.', 409);
          Object.assign(target, d);
          await target.save({ session });
          break;
        }
        case 'userStatus': {
          const d = schemas.userStatus.parse(data);
          target = await get(User, d.id);
          ensure(target.role === 'STAFF' && d.id !== actor.id, 'Không thể khóa tài khoản chủ spa.', 403);
          ensure(d.active || !await Appointment.exists({ ...scope, staffId: d.id, status: 'CONFIRMED' }).session(session), 'Nhân viên còn lịch hẹn chưa xử lý.', 409);
          target.active = d.active;
          await target.save({ session });
          break;
        }
        case 'service':
          target = await create(Service, schemas.service.parse(data));
          break;
        case 'user': {
          const d = schemas.user.parse(data);
          ensure(!await User.exists({ email: d.email }).session(session), 'Email đã tồn tại.', 409);
          target = await create(User, {
            name: d.name,
            email: d.email,
            passwordHash: hashPassword(d.password),
            role: 'STAFF',
            cashier: d.cashier,
          });
          break;
        }
        case 'appointment': {
          const d = schemas.appointment.parse(data);
          await get(Customer, d.customerId);
          const service = await get(Service, d.serviceId);
          const staff = await get(User, d.staffId);
          ensure(service.active && staff.active, 'Dịch vụ/nhân viên không hoạt động.');
          if (d.treatmentId) {
            const treatment = await get(Treatment, d.treatmentId);
            const packageInvoice = await get(Invoice, String(treatment.invoiceId));
            ensure(String(treatment.customerId) === d.customerId && String(packageInvoice.serviceId) === d.serviceId, 'Gói phải thuộc đúng khách và dịch vụ.');
            ensure(treatment.status === 'ACTIVE' && treatment.remaining > 0, 'Gói không còn buổi khả dụng.');
          }
          const startAt = new Date(d.startAt);
          ensure(startAt >= new Date(), 'Không đặt lịch trong quá khứ.');
          const endAt = new Date(startAt.getTime() + service.duration * 60_000);
          const conflict = await Appointment.findOne({
            ...scope,
            status: 'CONFIRMED',
            staffId: d.staffId,
            startAt: { $lt: endAt },
            endAt: { $gt: startAt },
          }).session(session);
          ensure(!conflict, 'Nhân viên đã có lịch trong khoảng này.', 409);
          target = await create(Appointment, { ...d, startAt, endAt });
          break;
        }
        case 'appointmentStatus': {
          const d = schemas.appointmentStatus.parse(data);
          target = await get(Appointment, d.id);
          ensure(target.status === 'CONFIRMED' || (target.status === 'POSTPONED' && d.status === 'CANCELLED'), 'Trạng thái lịch không cho phép thao tác này.');
          ensure(
            actor.role === 'OWNER' || actor.cashier || String(target.staffId) === actor.id,
            'Chỉ được cập nhật lịch của mình.',
            403,
          );
          if (d.status === 'COMPLETED') {
            ensure(!target.treatmentId, 'Lịch thuộc gói phải hoàn thành kèm xác nhận buổi.');
            ensure(target.startAt <= new Date(), 'Chưa tới thời gian thực hiện lịch.');
            let invoice = await Invoice.findOne({ ...scope, appointmentId: target._id }).session(session);
            if (!invoice) {
              const service = await get(Service, String(target.serviceId));
                const customer = await get(Customer, String(target.customerId));
                invoice = await create(Invoice, { appointmentId: target._id, customerId: target.customerId, serviceId: target.serviceId, description: service.name, total: money(service.price), paid: 0, kind: 'SERVICE', commission: service.commission || 0, ...await consultant(customer) });
            }
            linkedInvoiceId = String(invoice._id);
              await accrueCommission(invoice, String(target.staffId), 'APPOINTMENT', String(target._id));
          }
          if (d.status === 'POSTPONED') ensure(d.reason.length > 0, 'Cần lý do hoãn lịch.');
          appointmentBefore = target.toObject();
          target.status = d.status;
          target.changeReason = d.reason;
          await target.save({ session });
          break;
        }
        case 'completeTreatmentAppointment': {
          const d = schemas.completeTreatmentAppointment.parse(data);
          target = await get(Appointment, d.id);
          ensure(actor.role === 'OWNER' || actor.cashier || String(target.staffId) === actor.id, 'Chỉ được hoàn thành lịch của mình.', 403);
          ensure(target.treatmentId, 'Lịch không liên kết gói liệu trình.');
          ensure(['CONFIRMED', 'COMPLETED'].includes(target.status), 'Lịch hoãn hoặc hủy không thể hoàn thành.');
          ensure(target.startAt <= new Date(), 'Chưa tới thời gian thực hiện lịch.');
          const oldUse = await TreatmentUse.findOne({ ...scope, appointmentId: target._id }).session(session);
          if (oldUse) {
            ensure(target.status === 'COMPLETED', 'Trạng thái lịch và buổi ghi nhận không khớp.', 409);
            treatmentUseId = String(oldUse._id);
            const existing = await Invoice.findOne({ ...scope, treatmentUseId: oldUse._id }).session(session);
            if (existing) linkedInvoiceId = String(existing._id);
            break;
          }
          const treatment = await get(Treatment, String(target.treatmentId));
          const packageInvoice = await get(Invoice, String(treatment.invoiceId));
          ensure(String(treatment.customerId) === String(target.customerId) && String(packageInvoice.serviceId) === String(target.serviceId), 'Gói không khớp khách hoặc dịch vụ.');
          ensure(!await Invoice.exists({ ...scope, appointmentId: target._id }).session(session), 'Lịch đã có hóa đơn dịch vụ lẻ; cần đối chiếu trước.', 409);
          appointmentBefore = target.toObject();
          const recorded = await recordUse({ treatmentId: String(treatment._id), signature: d.signature, remainingBefore: d.remainingBefore }, String(target._id), String(target.staffId));
          treatmentUseId = String(recorded._id);
          target.status = 'COMPLETED';
          await target.save({ session });
          break;
        }
        case 'completeAppointment': {
          const d = schemas.completeAppointment.parse(data);
          target = await get(Appointment, d.id);
          const finance = actor.role === 'OWNER' || actor.cashier;
          ensure(finance || String(target.staffId) === actor.id, 'Chỉ được hoàn thành lịch của mình.', 403);
          ensure(finance || (!d.existingInvoiceId && !d.dueDate && !d.description && d.total === undefined && !d.consultantId), 'Chỉ thu ngân được chọn hoặc nhập thông tin hóa đơn.', 403);
          ensure(!target.treatmentId, 'Lịch thuộc gói không tạo hóa đơn dịch vụ lẻ.');
          ensure(['CONFIRMED', 'COMPLETED'].includes(target.status), 'Chỉ lập hóa đơn cho lịch đang xác nhận hoặc đã hoàn thành.');
          ensure(target.startAt <= new Date(), 'Chưa tới thời gian thực hiện lịch.');
          if (d.dueDate) dayBounds(d.dueDate);
          const existing = await Invoice.findOne({ ...scope, appointmentId: target._id }).session(session);
          let invoice = existing;
          if (existing && d.existingInvoiceId)
            ensure(String(existing._id) === d.existingInvoiceId, 'Lịch đã liên kết hóa đơn khác.', 409);
          if (!invoice && d.existingInvoiceId) {
            invoice = await get(Invoice, d.existingInvoiceId);
            ensure(String(invoice.customerId) === String(target.customerId) && String(invoice.serviceId) === String(target.serviceId), 'Hóa đơn phải đúng khách và dịch vụ của lịch.');
            ensure(!invoice.appointmentId, 'Hóa đơn đã liên kết lịch khác.', 409);
            ensure(!invoice.performedAt, 'Hóa đơn đã ghi nhận thực hiện dịch vụ, không gắn thêm lịch.', 409);
            ensure(!await Treatment.exists({ ...scope, invoiceId: invoice._id }).session(session), 'Hóa đơn gói liệu trình không dùng cho lịch dịch vụ lẻ.');
            invoice.appointmentId = target._id;
            await invoice.save({ session });
          }
          if (!invoice) {
            const service = await get(Service, String(target.serviceId));
            const customer = await get(Customer, String(target.customerId));
            invoice = await create(Invoice, { appointmentId: target._id, customerId: target.customerId, serviceId: target.serviceId, description: d.description || service.name, total: invoiceCharge(service.price, d.total, false), paid: 0, kind: 'SERVICE', commission: service.commission || 0, ...await consultant(customer, d.consultantId), ...(d.dueDate ? { dueDate: d.dueDate } : {}) });
          }
          appointmentBefore = target.toObject();
          if (target.status === 'CONFIRMED') await accrueCommission(invoice, String(target.staffId), 'APPOINTMENT', String(target._id));
          target.status = 'COMPLETED';
          await target.save({ session });
          linkedInvoiceId = String(invoice._id);
          break;
        }
        case 'rescheduleAppointment': {
          const d = schemas.rescheduleAppointment.parse(data);
          target = await get(Appointment, d.id);
          ensure(['CONFIRMED', 'POSTPONED'].includes(target.status), 'Chỉ dời lịch đang xác nhận hoặc đang hoãn.');
          ensure(actor.role === 'OWNER' || actor.cashier || (String(target.staffId) === actor.id && d.staffId === actor.id), 'Chỉ được dời lịch của mình, không tự giao cho nhân viên khác.', 403);
          if (target.status === 'POSTPONED') ensure(!await Appointment.exists({ ...scope, rescheduledFromId: target._id }).session(session), 'Lịch hoãn đã được xếp lại.', 409);
          const staff = await get(User, d.staffId);
          const service = await get(Service, String(target.serviceId));
          ensure(staff.active && service.active, 'Dịch vụ/nhân viên không hoạt động.');
          const startAt = new Date(d.startAt);
          ensure(startAt >= new Date(), 'Không dời lịch vào quá khứ.');
          // Preserve the appointment's booked duration, even if the catalog changed.
          const duration = target.endAt.getTime() - target.startAt.getTime();
          ensure(duration > 0, 'Thời lượng lịch cũ không hợp lệ.');
          const endAt = new Date(startAt.getTime() + duration);
          const conflict = await Appointment.exists({ ...scope, _id: { $ne: target._id }, status: 'CONFIRMED', staffId: d.staffId, startAt: { $lt: endAt }, endAt: { $gt: startAt } }).session(session);
          ensure(!conflict, 'Nhân viên đã có lịch trong khoảng này.', 409);
          appointmentBefore = target.toObject();
          // Keep the postponed record, its original time, and all references intact.
          if (target.status === 'POSTPONED') {
            const replacement = await create(Appointment, {
              customerId: target.customerId, serviceId: target.serviceId,
              ...(target.treatmentId ? { treatmentId: target.treatmentId } : {}),
              staffId: d.staffId, startAt, endAt, notes: target.notes,
              changeReason: d.reason, rescheduledFromId: target._id,
            });
            replacementAppointmentId = String(replacement._id);
          } else {
            Object.assign(target, { staffId: d.staffId, startAt, endAt, changeReason: d.reason });
            await target.save({ session });
          }
          break;
        }
        case 'sellPackage': {
          const d = schemas.sellPackage.parse(data);
          const customer = await get(Customer, d.customerId);
          const template = await get(PackageTemplate, d.templateId);
          ensure(template.active, 'Gói mẫu đã ngừng bán.');
          const service = await get(Service, String(template.serviceId));
          ensure(service.active, 'Dịch vụ không hoạt động.');
          packagePaymentDeadline(d.dueDate, today);
          ensure(!d.gifts.length || d.promotion.trim().length > 0, 'Nhập đợt khuyến mãi khi có quà tặng.');
          const advisor = await consultant(customer, d.consultantId);
          const invoice = await create(Invoice, { customerId: d.customerId, serviceId: service._id, description: template.name + ' · ' + service.name, total: money(d.total ?? template.price), paid: 0, dueDate: d.dueDate, kind: 'PACKAGE', promotion: d.promotion, commission: service.commission || 0, ...advisor });
          target = await create(Treatment, { customerId: d.customerId, serviceId: service._id, templateId: template._id, invoiceId: invoice._id, name: template.name, totalSessions: template.totalSessions, remaining: template.totalSessions });
          for (const gift of d.gifts) {
            const giftTemplate = await get(PackageTemplate, gift.templateId);
            ensure(giftTemplate.active, 'Gói quà tặng đã ngừng bán.');
            const giftService = await get(Service, String(giftTemplate.serviceId));
            ensure(giftService.active, 'Dịch vụ quà tặng không hoạt động.');
            const giftInvoice = await create(Invoice, { customerId: customer._id, serviceId: giftService._id, description: 'Quà tặng · ' + giftTemplate.name, kind: 'GIFT', total: 0, paid: 0, status: 'PAID', giftOfInvoiceId: invoice._id, promotion: d.promotion, ...advisor });
            await create(Treatment, { customerId: customer._id, invoiceId: giftInvoice._id, serviceId: giftService._id, templateId: giftTemplate._id, name: giftTemplate.name, totalSessions: giftTemplate.totalSessions, remaining: giftTemplate.totalSessions, giftOfInvoiceId: invoice._id, promotion: d.promotion });
          }
          linkedInvoiceId = String(invoice._id);
          break;
        }
        case 'invoice': {
          const d = schemas.invoice.parse(data);
          const customer = await get(Customer, d.customerId);
          const service = await get(Service, d.serviceId);
          if (d.treatmentId) {
            const plan = await get(Treatment, d.treatmentId);
            const purchase = await get(Invoice, String(plan.invoiceId));
            ensure(String(plan.customerId) === d.customerId && String(plan.serviceId || purchase.serviceId) === d.serviceId, 'Gói không khớp khách hoặc dịch vụ.');
            const recorded = await recordUse(schemas.use.parse({ treatmentId: d.treatmentId, signature: d.signature, remainingBefore: d.remainingBefore, staffId: d.staffId }));
            treatmentUseId = String(recorded._id);
            target = await get(Invoice, linkedInvoiceId!);
            if (d.description) target.description = d.description;
            if (d.consultantId) Object.assign(target, await consultant(customer, d.consultantId));
            await target.save({ session });
            break;
          }
          ensure(service.active, 'Dịch vụ không hoạt động.');
          ensure(!d.signature && !d.remainingBefore, 'Chỉ dùng chữ ký xác nhận khi chọn liệu trình.');
          ensure(!d.staffId, 'Chọn nhân viên thực hiện khi hoàn thành dịch vụ, không phải lúc tạo hóa đơn lẻ.');
          if (d.dueDate) dayBounds(d.dueDate);
          ensure((d.total ?? service.price) > 0, 'Dịch vụ mua lẻ phải có giá lớn hơn 0.');
          target = await create(Invoice, {
            ...d,
            ...await consultant(customer, d.consultantId), kind: 'SERVICE', commission: service.commission || 0,
            description: d.description || service.name,
            total: invoiceCharge(service.price, d.total, false),
            paid: 0,
          });
          break;
        }
        case 'deposit': {
          const d = schemas.deposit.parse(data);
          await get(Customer, d.customerId);
          const entry = await receipt({ ...d, kind: 'DEPOSIT', direction: 'IN' });
          target = await create(Deposit, {
            customerId: d.customerId,
            amount: d.amount,
            balance: d.amount,
            note: d.note,
            receiptId: entry._id,
          });
          break;
        }
        case 'allocate': {
          const d = schemas.allocate.parse(data);
          const deposit = await get(Deposit, d.depositId);
          const invoice = await get(Invoice, d.invoiceId);
          ensure(actor.role === 'OWNER' || await assignedInvoice(invoice), 'Chỉ phân bổ cọc cho hóa đơn lịch mình phụ trách.', 403);
          ensure(
            String(deposit.customerId) === String(invoice.customerId),
            'Cọc và hóa đơn phải thuộc cùng khách.',
          );
          allocationResult(deposit.balance, invoice.total - invoice.paid, d.amount);
          deposit.balance -= d.amount;
          await deposit.save({ session });
          await updatePaid(invoice, d.amount);
          // No CashEntry here: allocation is not new money received.
          target = await create(Allocation, { ...d, approvedBy: actor.id });
          break;
        }
        case 'reverseAllocation': {
          const d = schemas.reverseAllocation.parse(data);
          target = await get(Allocation, d.id);
          ensure(!target.reversed, 'Phân bổ đã được đảo.');
          const deposit = await get(Deposit, String(target.depositId));
          const invoice = await get(Invoice, String(target.invoiceId));
          deposit.balance += target.amount;
          ensure(deposit.balance <= deposit.amount, 'Số dư cọc vượt tiền gốc.');
          await deposit.save({ session });
          await updatePaid(invoice, -target.amount);
          target.reversed = true;
          await target.save({ session });
          break;
        }
        case 'payment': {
          const d = schemas.payment.parse(data);
          const invoice = await get(Invoice, d.invoiceId);
          ensure(actor.role === 'OWNER' || actor.cashier || await assignedInvoice(invoice), 'Chỉ thu tiền hóa đơn lịch mình phụ trách.', 403);
          paymentEvidence(d.method, d.receivedConfirmation, d.note, d.transferReference);
          ensure(d.amount <= invoice.total - invoice.paid, 'Số thu vượt công nợ hóa đơn.');
          const entry = await receipt({
            amount: d.amount,
            method: d.method,
            note: d.note,
            transferReference: d.transferReference,
            customerId: invoice.customerId,
            kind: 'PAYMENT',
            direction: 'IN',
          });
          await updatePaid(invoice, d.amount);
          target = await create(Payment, {
            invoiceId: d.invoiceId,
            transferReference: d.transferReference,
            receivedConfirmation: true,
            amount: d.amount,
            receiptId: entry._id,
          });
          break;
        }
        case 'cash': {
          const d = schemas.cash.parse(data);
          target = await receipt({ ...d, kind: d.direction === 'IN' ? 'INCOME' : 'EXPENSE' });
          break;
        }
        case 'reverseCash': {
          const d = schemas.reverseCash.parse(data);
          const original = await get(CashEntry, d.id);
          ensure(original.kind !== 'PAYROLL', 'Khoản chi lương không được đảo qua thao tác thu chi thông thường.');
          ensure(!original.reversed && original.kind !== 'REVERSAL', 'Giao dịch không thể đảo.');
          if (original.kind === 'DEPOSIT') {
            const deposit = await Deposit.findOne({
              ...scope,
              receiptId: original._id,
            }).session(session);
            ensure(deposit && deposit.balance === deposit.amount, 'Cần đảo mọi phân bổ của cọc trước.');
            deposit.balance = 0;
            await deposit.save({ session });
          }
          if (original.kind === 'PAYMENT') {
            const payment = await Payment.findOne({
              ...scope,
              receiptId: original._id,
              reversed: false,
            }).session(session);
            ensure(payment, 'Không tìm thấy lần thanh toán.');
            const invoice = await get(Invoice, String(payment.invoiceId));
            await updatePaid(invoice, -payment.amount);
            payment.reversed = true;
            await payment.save({ session });
          }
          target = await receipt({
            amount: original.amount,
            method: original.method,
            note: d.reason,
            direction: original.direction === 'IN' ? 'OUT' : 'IN',
            kind: 'REVERSAL',
            originalId: original._id,
            customerId: original.customerId,
          });
          original.reversed = true;
          await original.save({ session });
          break;
        }
        case 'treatment': {
          const d = schemas.treatment.parse(data);
          const invoice = await get(Invoice, d.invoiceId);
          ensure(!invoice.appointmentId, 'Hóa đơn lịch dịch vụ lẻ không dùng tạo gói.');
          target = await create(Treatment, {
            ...d,
            serviceId: invoice.serviceId,
            customerId: invoice.customerId,
            remaining: d.totalSessions,
          });
          break;
        }
        case 'pauseTreatment':
        case 'extendTreatmentHold': {
          const d = op === 'pauseTreatment' ? schemas.pauseTreatment.parse(data) : schemas.extendTreatmentHold.parse(data);
          target = await get(Treatment, d.id);
          dayBounds(d.holdUntil);
          ensure(d.holdUntil >= today, 'Ngày kết thúc bảo lưu không được trước hôm nay.');
          ensure(target.remaining > 0, 'Gói không còn buổi để bảo lưu.');
          ensure(target.status === (op === 'pauseTreatment' ? 'ACTIVE' : 'PAUSED'), 'Trạng thái gói không cho phép thao tác này.', 409);
          if (op === 'extendTreatmentHold') ensure(d.holdUntil > target.holdUntil, 'Ngày mới phải sau ngày kết thúc bảo lưu hiện tại.');
          appointmentBefore = target.toObject();
          target.status = 'PAUSED'; target.holdUntil = d.holdUntil; target.holdReason = d.reason;
          target.heldAt = new Date(); target.heldBy = actor.id;
          await target.save({ session });
          break;
        }
        case 'resumeTreatment': {
          const d = schemas.resumeTreatment.parse(data);
          target = await get(Treatment, d.id);
          ensure(target.status === 'PAUSED' && target.remaining > 0, 'Chỉ mở lại gói đang bảo lưu và còn buổi.', 409);
          if (d.expiresOn) {
            dayBounds(d.expiresOn);
            ensure(d.expiresOn >= today && (!target.expiresOn || d.expiresOn > target.expiresOn), 'Hạn sử dụng mới phải từ hôm nay và sau hạn hiện tại.');
          }
          appointmentBefore = target.toObject();
          target.status = 'ACTIVE'; target.resumedAt = new Date(); target.resumedBy = actor.id;
          if (d.expiresOn) target.expiresOn = d.expiresOn;
          await target.save({ session });
          break;
        }
        case 'use': {
          target = await recordUse(schemas.use.parse(data));
          break;
        }
        case 'openDay': {
          const d = schemas.openDay.parse(data);
          dayBounds(d.day);
          ensure(d.day === today, 'Bản MVP chỉ mở sổ ngày hiện tại.');
          ensure(
            !await Day.exists({ ...scope, day: d.day }).session(session),
            'Ngày đã có sổ; chủ spa có thể mở lại sổ đã chốt.',
          );
          target = await create(Day, d);
          break;
        }
        case 'closeDay': {
          const d = schemas.closeDay.parse(data);
          dayBounds(d.day);
          ensure(d.day <= today, 'Không chốt ngày tương lai.');
          target = await Day.findOne({ ...scope, day: d.day, status: 'OPEN' }).session(session);
          ensure(target, 'Ngày chưa mở hoặc đã chốt.');
          const entries = await CashEntry.find({ ...scope, day: d.day }).session(session);
          const net = (method: string) =>
            entries
              .filter(e => e.method === method)
              .reduce((s, e) => s + (e.direction === 'IN' ? e.amount : -e.amount), 0);
          target.expected = target.opening + net('CASH');
          target.bankNet = net('BANK_TRANSFER');
          target.counted = d.counted;
          target.difference = d.counted - target.expected;
          target.note = d.note;
          target.status = 'CLOSED';
          target.closedBy = actor.id;
          target.closedAt = new Date();
          await target.save({ session });
          break;
        }
        case 'reopenDay': {
          const d = schemas.reopenDay.parse(data);
          target = await Day.findOne({ ...scope, day: d.day, status: 'CLOSED' }).session(session);
          ensure(target, 'Không tìm thấy ngày đã chốt.');
          target.status = 'OPEN';
          await target.save({ session });
          break;
        }
      }
      const details = { ...data } as Record<string, unknown>;
      if (appointmentBefore) {
        details.before = appointmentBefore;
        details.after = target.toObject();
      }
      if (financialBefore) {
        details.before = financialBefore;
        details.after = op === 'setServiceCommission' ? { serviceId: target._id, commission: target.commission } : op === 'setStaffSalary' ? { staffId: target._id, baseSalary: target.baseSalary } : payrollSnapshot(target);
      }
      if (replacementAppointmentId) details.replacementAppointmentId = replacementAppointmentId;
      if (linkedInvoiceId) details.invoiceId = linkedInvoiceId;
      delete details.password;
      if (treatmentUseId) details.treatmentUseId = treatmentUseId;
      if (op === 'use' || op === 'completeTreatmentAppointment' || (op === 'invoice' && 'signature' in data && data.signature)) {
        delete details.evidenceReference;
        delete details.signature;
        details.signatureDigest = sha(JSON.stringify((data as z.infer<typeof schemas.use>).signature));
        details.evidenceRecorded = true;
      }
      if (op === 'closeDay' || op === 'reopenDay') details.daySnapshot = target.toObject();
      await create(Audit, { actorId: actor.id, action: op, targetId: target._id, details });
      const result = { id: String(target._id), message: 'Đã lưu thành công.', ...(linkedInvoiceId ? { invoiceId: linkedInvoiceId } : {}), ...(replacementAppointmentId ? { replacementAppointmentId } : {}), ...(treatmentUseId ? { treatmentUseId } : {}) };
      await create(Idempotency, { userId: actor.id, key, fingerprint, result });
      return result;
    },
    { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
  );
}
