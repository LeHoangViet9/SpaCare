import { ensureGroupedPackageIndex } from './package-invoice-indexes';
import { coversVisit } from './appointment-checkout';
import { invoiceDeletionBlock, repriceInvoiceItems } from './invoice-correction';
import { sequenceInvoiceCode } from './invoice-code';
import { queueInvoiceNotifications } from './notification-events';
import { appointmentServiceIds } from './appointment-services';
import { ServiceGroup } from './models';
import { serviceGroupName, serviceGroupKey } from './service-groups';
import { CashCard, CashCardUse } from './models';
import { invoiceCardInput, cashCardInputs, cardPayment, ensureCardService } from './cash-card-rules';
import { nextSessionNumber, timedPackage, treatmentAvailable, useToken, packageSnapshot, packageStartOnPurchase } from './treatment-rules';
import { leavesOverlap, summarizeLeave, attendanceSalary, dayUnits, leaveDays } from './leave-rules';
import { packageCommissionDelta, sharedCommissionDeltas } from './sale-commission';
import { isValidSignature, type Signature } from './signature';
import mongoose from 'mongoose';
import { staffPhone } from './login-identity';
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
  ActivityNotification,
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
  Commission, InvoiceLineCommission,
  Payroll,
  StaffLeave,
  Workday, SaleCommission, SharedSaleCommission,
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
  withinArrivalHours,
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
const remainingBefore = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const phone = z.string().trim().transform(value => value.replace(/[\s().-]/g, '').replace(/^\+84/, '0')).pipe(z.string().regex(/^0\d{9,10}$/, 'Số điện thoại phải có 10–11 chữ số, bắt đầu bằng 0 hoặc +84.'));

const schemas = {
  correctInvoiceDate: z.object({id:objectId,expectedUpdatedAt:date,issuedOn:dateOnly,adjustPaymentDates:z.boolean().default(false),reason:text}).strict(),
  linkAppointmentInvoice: z.object({appointmentId:objectId,invoiceId:objectId,reason:text}),
  checkout: z.object({customerId:objectId,appointmentId:objectId.optional(),actions:z.array(z.object({action:z.enum(['invoice','serviceInvoice','sellPackage','productInvoice']),data:z.record(z.string(),z.unknown())})).min(1).max(31)}),
  productInvoice: z.object({customerId:objectId,dueDate:dateOnly.optional(),items:z.array(z.object({productId:objectId,quantity:z.number().int().min(1).max(1_000_000_000),unitPrice:moneySchema})).min(1).max(30)}),
  serviceGroup: z.object({name:z.string().transform(serviceGroupName).pipe(z.string().min(1,'Nhập tên nhóm dịch vụ.').max(100))}),
  ...cashCardInputs,
  ...productInputs,
  ...payrollInputs,
  refundPackage: z.object({exceptionApproved:z.literal(true), invoiceId:objectId, amount:moneySchema, method:z.enum(['CASH','BANK_TRANSFER']), receivedConfirmation:z.literal(true), reason:z.string().trim().min(1).max(2000), transferReference:z.string().trim().max(500).optional()}),
  customer: z.object({ name: text, phone, notes: note, consultantId: objectId.optional() }),
  updateCustomer: z.object({ id: objectId, name: text, phone, notes: note, consultantId: objectId.optional() }),
  updateService: z.object({ id: objectId, name: text, price: moneySchema, duration: z.number().int().min(5).max(480).optional(), commission: zeroMoney.default(0), category: z.string().trim().max(100).default('') }),
  packageTemplate: packageTemplateInput,
  updatePackageTemplate: packageTemplateInput.safeExtend({ id: objectId }),
  packageTemplateStatus: z.object({ id: objectId, active: z.boolean() }),
  serviceStatus: z.object({ id: objectId, active: z.boolean() }),
  updateUser: z.object({ id: objectId, name: text, phone: staffPhone, cashier: z.boolean() }),
  userStatus: z.object({ id: objectId, active: z.boolean() }),
  service: z.object({
    category: z.string().trim().max(100).default(''),
    commission: zeroMoney.default(0),
    name: text,
    price: moneySchema,
    duration: z.number().int().min(5).max(480).optional(),
  }),
  user: z.object({
    name: text,
    phone: staffPhone,
    password: z.string().min(12).max(128),
    cashier: z.boolean().default(false),
  }),
  appointment: z.object({
    serviceIds:z.array(objectId).min(1).max(30).refine(ids=>new Set(ids).size===ids.length,'Không chọn trùng dịch vụ lẻ.').optional(),
    treatmentIds: z.array(objectId).min(1).max(30).refine(ids => new Set(ids).size === ids.length, 'Không chọn trùng liệu trình.').optional(),
    treatmentId: objectId.optional(),
    customerId: objectId,
    serviceId: objectId,
    staffId: objectId.optional(),
    startAt: date,
    notes: note,
  }),
  appointmentStatus: z.object({ id: objectId, status: z.enum(['COMPLETED', 'CANCELLED', 'POSTPONED']), reason: note }),
  rescheduleAppointment: z.object({ id: objectId, staffId: objectId, startAt: date, reason: text }),
  completeTreatmentAppointment: z.object({ id: objectId, staffId: objectId.optional(), signature: signature.optional(), remainingBefore: remainingBefore.optional(), treatments: z.array(z.object({treatmentId:objectId,signature:signature.optional(),remainingBefore})).min(1).max(30).optional() }),
  completeAppointment: z.object({ id: objectId, staffId: objectId.optional(), existingInvoiceId: objectId.optional(), dueDate: dateOnly.optional(), description: text.optional(), total: moneySchema.optional(), consultantId: objectId.optional() }),
  deleteInvoice: z.object({id:objectId,expectedUpdatedAt:date,reason:text,confirmDelete:z.literal(true)}),
  cancelInvoice: z.object({id:objectId, expectedUpdatedAt:date, reason:text}),
  updateInvoice: z.object({id:objectId, expectedUpdatedAt:date, issuedOn:dateOnly.optional(), description:text, total:moneySchema, dueDate:dateOnly.optional(), reason:text, items:z.array(z.object({serviceId:objectId,total:moneySchema})).min(1).max(30).optional(),
    packageName:text.optional(), packageType:z.enum(['SESSIONS','TIME']).optional(), totalSessions:z.number().int().min(1).max(10000).optional(), durationMonths:z.number().int().min(1).max(120).optional(), startsOn:dateOnly.optional()}),
  sellPackage: packageSaleInput,
  serviceInvoice: z.object({
    additionalProducts:z.array(z.object({productId:objectId,quantity:z.number().int().min(1).max(1_000_000_000),unitPrice:moneySchema})).max(30).optional(),
    customerId: objectId, staffId: objectId.optional(), dueDate: dateOnly.optional(), cashCard: invoiceCardInput.optional(),
    items: z.array(z.object({ serviceId: objectId, total: moneySchema.optional(), performerId: objectId.optional() })).min(1).max(30)
      .refine(items => new Set(items.map(item => item.serviceId)).size === items.length, 'Không chọn trùng dịch vụ.'),
  }),
  invoice: z.object({
    treatments: z.array(z.object({treatmentId:objectId,signature:signature.optional(),remainingBefore})).min(1).max(30).optional(),
    additionalProducts:z.array(z.object({productId:objectId,quantity:z.number().int().min(1).max(1_000_000_000),unitPrice:moneySchema})).max(30).optional(),
    additionalServices:z.array(z.object({serviceId:objectId,total:moneySchema})).max(30).optional(),
    cashCard: invoiceCardInput.optional(),
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
  use: z.object({ treatmentId: objectId, signature: signature.optional(), remainingBefore, staffId: objectId.optional() }),
  pauseTreatment: z.object({ id: objectId, holdUntil: dateOnly, reason: text }),
  extendTreatmentHold: z.object({ id: objectId, holdUntil: dateOnly, reason: text }),
  resumeTreatment: z.object({ id: objectId, reason: text, expiresOn: dateOnly.optional() }),
  openDay: z.object({ day: dateOnly, opening: zeroMoney }),
  closeDay: z.object({ day: dateOnly, counted: zeroMoney, note, expectedPreview:z.number().int().optional() }),
  reopenDay: z.object({ day: dateOnly, reason: text }),
};

export type Operation = keyof typeof schemas;

const ownerActions = new Set<Operation>([
  'serviceGroup',
  'correctInvoiceDate', 'linkAppointmentInvoice', 'updateInvoice', 'cancelInvoice', 'deleteInvoice', 'product', 'updateProduct', 'productStatus', 'productGroup', 'updateProductGroup', 'stockMovement',
  'refundPackage', 'reviewStaffLeave', 'setSalaryPolicy', 'recordWorkday', 'setServiceCommission', 'setStaffSalary', 'savePayroll', 'approvePayroll', 'payPayroll',
  'packageTemplate', 'updatePackageTemplate', 'packageTemplateStatus',
  'pauseTreatment', 'extendTreatmentHold', 'resumeTreatment',
  'updateCustomer', 'updateService', 'serviceStatus', 'updateUser', 'userStatus',
  'service',
  'user',
  'reverseAllocation',
  'reverseCash',
  'closeDay',
  'reopenDay',
]);
const cashierActions = new Set<Operation>([
  'checkout','productInvoice',
  'serviceInvoice',
  'sellCashCard',
  'sellProduct',
  'completeInvoiceService',
  'invoice',
  'deposit',
  'cash',
  'treatment',
  'sellPackage',
  'openDay',
]);

const sha = (x: string) => createHash('sha256').update(x).digest('hex');

export async function operate(initial: Actor, action: string, raw: unknown, key: string) {
  ensure(Object.hasOwn(schemas, action), 'Thao tác không hợp lệ.');
  ensure(/^[a-zA-Z0-9-]{16,100}$/.test(key), 'Cần Idempotency-Key hợp lệ.');
  const op = action as Operation;
  const data = {...schemas[op].parse(raw), ...(['invoice','serviceInvoice','sellPackage','sellProduct','productInvoice','checkout'].includes(op) ? {issuedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().parse((raw as Record<string,unknown>)?.issuedOn)} : {})};
  const fingerprint = sha(JSON.stringify({ action, data }));
  await connect();
  return mongoose.connection.transaction(
    async session => {
      // A per-spa write guard serializes competing writes, including interval checks and day closure.
      // withTransaction retries transient conflicts with a fresh snapshot.
      const control = await Control.findOneAndUpdate(
        { spaId: initial.spaId },
        { $inc: { revision: 1 } },
        { session, returnDocument: 'after' },
      );
      ensure(control, 'Chạy npm run db:setup trước khi dùng ứng dụng.', 503);
      const user = await User.findOne({
        _id: initial.id,
        spaId: initial.spaId,
        active: true,
      }).session(session);
      ensure(user, 'Tài khoản không hoạt động.', 401);
      const actor = { ...initial, role: user.role, cashier: user.cashier };
      ensure(['OWNER', 'STAFF'].includes(actor.role), 'Vai trò không được thực hiện thao tác quản trị.', 403);
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
      let groupedPackageSale = false;
      let packageInvoice: any;
      let checkoutAppointmentId: string | undefined;
      const createdInvoiceIds: string[] = [];
      const create = async (model: mongoose.Model<any>, values: Record<string, unknown>) => {
        if (model === Invoice) {
          const counter = await Control.findOneAndUpdate(scope, { $inc: { invoiceSequence: 1 } }, { session, returnDocument: 'after' });
          ensure(counter, 'Spa chưa sẵn sàng cấp mã hóa đơn.', 503);
          if(data.issuedOn) {dayBounds(data.issuedOn);ensure(data.issuedOn <= spaDay(),'Không nhập hóa đơn ngày tương lai.');}
          values = { ...values, code: sequenceInvoiceCode(counter.invoiceSequence), recordedAt:new Date(), ...(data.issuedOn ? {createdAt:new Date(data.issuedOn+'T12:00:00+07:00')} : {}) };
        }
        const record = (await model.create([{ ...scope, ...(model === Invoice ? { createdBy: actor.id, creatorName: user.name } : {}), ...values }], { session }))[0];
        if (model === Invoice) createdInvoiceIds.push(String(record._id));
        return record;
      };
      const get = async (model: mongoose.Model<any>, id: string) => {
        const doc = await model.findOne({ ...scope, _id: id }).session(session);
        ensure(doc, 'Không tìm thấy dữ liệu trong spa này.', 404);
        if(model === Invoice) ensure(doc.status !== 'CANCELLED', 'Hóa đơn đã hủy, không thể phát sinh thao tác mới.',409);
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
          { session, returnDocument: 'after' },
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
        const treatments = await Treatment.find({ ...scope, invoiceId: invoice._id }).session(session);
        const references = [
          ...(invoice.appointmentId ? [{ _id: invoice.appointmentId }] : []),
          ...(treatments.length ? [{ treatmentId: {$in:treatments.map(t=>t._id)} },{treatmentIds:{$in:treatments.map(t=>t._id)}}] : []),
        ];
        if (!references.length) return false;
        return !!await Appointment.exists({ ...scope, staffId: actor.id, status: { $in: ['CONFIRMED', 'COMPLETED'] }, $or: references }).session(session);
      };
      const redeemCard = async (d: z.infer<typeof cashCardInputs.redeemCashCard>) => {
          const invoice = await get(Invoice, d.invoiceId);
          ensure(actor.role === 'OWNER' || actor.cashier || await assignedInvoice(invoice), 'Chỉ dùng thẻ cho hóa đơn lịch mình phụ trách.', 403);
          ensureCardService(invoice.toObject());
          ensure(!await Treatment.exists({ ...scope, invoiceId: invoice._id }).session(session), 'Không dùng thẻ cho hóa đơn mua gói.', 409);
          const card = await get(CashCard, d.cardId);
          ensure(String(card.customerId) === String(invoice.customerId), 'Thẻ và hóa đơn phải cùng khách hàng.', 409);
          const before = card.balance;
          const next = cardPayment(before, invoice.total - invoice.paid, d.amount, d.additionalAmount);
          await touchDay();
          card.balance = next.balance;
          await card.save({ session });
          invoice.cardPaid = money((invoice.cardPaid || 0) + d.amount, true);
          await updatePaid(invoice, next.settled);
          const use = await create(CashCardUse, { cardId: card._id, customerId: invoice.customerId, invoiceId: invoice._id, amount: d.amount, balanceBefore: before, balanceAfter: next.balance, actorId: actor.id });
          if (d.additionalAmount) {
            const entry = await receipt({ customerId: invoice.customerId, amount: d.additionalAmount, method: d.method!, kind: 'PAYMENT', direction: 'IN', note: 'Thu thêm sau khi dùng thẻ tiền' });
            await create(Payment, { invoiceId: invoice._id, amount: d.additionalAmount, receiptId: entry._id, receivedConfirmation: true });
          }
          return use;
      };
      const accrueCommission = async (invoice: any, staffId: string, sourceType: string, sourceId: string, earnedAt = new Date()) => {
        const staff = await get(User, staffId);
        const service = invoice.serviceItems?.length ? { _id: invoice.serviceId, name: invoice.serviceItems.map((item: { name: string }) => item.name).join(' + '), commission: invoice.commission } : await get(Service, String(invoice.serviceId));
        const existing = await Commission.findOne({ ...scope, sourceType, sourceId }).session(session);
        if (existing) return existing;
        const commission = await create(Commission, { staffId, staffName: staff.name, serviceId: service._id, serviceName: service.name,
          customerId: invoice.customerId, invoiceId: invoice._id, sourceType, sourceId, amount: money(invoice.commission ?? service.commission ?? 0, true), earnedAt });
        invoice.performedBy = staffId; invoice.performedAt = earnedAt;
        await invoice.save({ session });
        return commission;
      };
      const syncSaleCommission = async (invoice:any, sourceType:string, sourceId:string) => {
        if (invoice.kind !== 'PACKAGE' || ![1,2].includes(invoice.saleCommissionVersion) || !invoice.sellerId) return;
        const shared = invoice.saleCommissionVersion === 2;
        const ledger = shared ? SharedSaleCommission : SaleCommission;
        const existing = await ledger.findOne({...scope,sourceType,sourceId}).session(session); if(existing) return;
        const accrued = invoice.saleCommissionAccrued || 0;
        const {target:total,delta} = packageCommissionDelta(invoice.paid,invoice.refunded || 0,invoice.total,accrued);
        if (shared) {
          const participants = invoice.saleParticipants || [];
          ensure(participants.length > 1, 'Hóa đơn thiếu danh sách chia hoa hồng.');
          for (const share of sharedCommissionDeltas(total, accrued, participants.map((p:any)=>String(p.staffId)))) {
            if (!share.amount) continue;
            const person = participants.find((p:any)=>String(p.staffId)===share.staffId);
            await create(SharedSaleCommission,{staffId:share.staffId,staffName:person.staffName,serviceId:invoice.serviceId,serviceName:invoice.description,customerId:invoice.customerId,invoiceId:invoice._id,sourceType,sourceId,shareCount:participants.length,amount:share.amount,earnedAt:new Date()});
          }
        } else if (delta) await create(SaleCommission,{staffId:invoice.sellerId,staffName:invoice.sellerName,serviceId:invoice.serviceId,serviceName:invoice.description,customerId:invoice.customerId,invoiceId:invoice._id,sourceType,sourceId,amount:delta,earnedAt:new Date()});
        invoice.saleCommissionAccrued=total; await invoice.save({session});
      };
      const pendingCommissions = async (staffId: string, month: string) => {
        const filter = {...scope,staffId,payrollId:{$exists:false},earnedAt:{$lt:monthBounds(month).end}};
        const service = await Commission.find({...filter,cancelledAt:{$exists:false}}).sort({earnedAt:1,_id:1}).session(session);
        const line = await InvoiceLineCommission.find({...filter,cancelledAt:{$exists:false}}).sort({earnedAt:1,_id:1}).session(session);
        const sale = await SaleCommission.find(filter).sort({earnedAt:1,_id:1}).session(session);
        const shared = await SharedSaleCommission.find(filter).sort({earnedAt:1,_id:1}).session(session);
        return [...service,...line,...sale,...shared];
      };
      const attendanceFor = async (staffId:string,month:string,confirmed:boolean) => {
        const staff = await User.findOne({...scope,_id:staffId}).select('+salaryPolicy').session(session);
        const leaves = await StaffLeave.find({...scope,staffId,$or:[{startDay:{$lt:monthBounds(month).end.toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'})},endDay:{$gte:month+'-01'}},{startDay:{$exists:false},day:{$gte:month+'-01',$lt:monthBounds(month).end.toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'})}}]}).sort({_id:1}).session(session);
        const work = await Workday.find({...scope,staffId,day:{$gte:month+'-01',$lt:monthBounds(month).end.toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'})}}).sort({day:1}).session(session);
        const leaveStats = summarizeLeave(leaves.map(r=>r.toObject()),month);
        const workdays = work.reduce((n,r)=>n+dayUnits(r.period),0);
        return {salaryPolicy:staff?.salaryPolicy, leaveStats, workdays:confirmed ? workdays : null,
          attendanceDigest:sha(JSON.stringify({policy:staff?.salaryPolicy,leaves:leaves.map(r=>r.toObject()),work:work.map(r=>r.toObject())}))};
      };
      const fillPayroll = (payroll: any, commissions: any[]) => {
        payroll.serviceCommissionTotal = commissions.filter(c=>c.category !== 'PACKAGE_SALE').reduce((n,c)=>n+c.amount,0);
        payroll.saleCommissionTotal = commissions.filter(c=>c.category === 'PACKAGE_SALE').reduce((n,c)=>n+c.amount,0);
        payroll.commissionTotal = payroll.serviceCommissionTotal + payroll.saleCommissionTotal;
        payroll.commissionCount = commissions.length;
        payroll.carryoverCount = commissions.filter(c => c.earnedAt < monthBounds(payroll.month).start).length;
        payroll.commissionIds = commissions.filter(c=>c.category !== 'PACKAGE_SALE').map(c=>c._id);
        payroll.saleCommissionIds = commissions.filter(c=>c.category === 'PACKAGE_SALE' && !c.sharedSale).map(c=>c._id);
        payroll.sharedSaleCommissionIds = commissions.filter(c=>c.sharedSale).map(c=>c._id);
        let base; try { base = attendanceSalary(payroll.baseSalary,payroll.salaryPolicy,payroll.workdays,payroll.leaveStats || {permitted:0,unpermitted:0,paid:0,unpaid:0}); } catch(e) { ensure(false,(e as Error).message); }
        Object.assign(payroll,base);
        payroll.total = money(payroll.earnedBase + payroll.commissionTotal + payroll.bonus - payroll.deductions - (payroll.advance || 0), true);
      };
      const payrollSnapshot = (p: any) => Object.fromEntries(['staffId', 'staffName', 'month', 'baseSalary', 'earnedBase', 'leaveDeduction', 'workdays', 'leaveStats', 'salaryPolicy', 'advance', 'serviceCommissionTotal', 'saleCommissionTotal', 'commissionTotal', 'commissionCount', 'carryoverCount', 'bonus', 'deductions', 'total', 'note', 'status', 'approvedBy', 'approvedAt', 'paidBy', 'paidAt', 'receiptId', 'sharedSaleCommissionIds'].map(key => [key, p[key]]));
      const commonSignature = (provided: Signature | undefined, items: {signature?:Signature}[]) => {
        const candidates = [provided,...items.map(item=>item.signature)].filter((value): value is Signature => !!value);
        ensure(candidates.every(value=>JSON.stringify(value)===JSON.stringify(candidates[0])), 'Một hóa đơn chỉ dùng một chữ ký chung.');
        return candidates[0];
      };
      const recordUse = async (d: z.infer<typeof schemas.use>, appointmentId: string | undefined = checkoutAppointmentId, staffId = d.staffId || actor.id, sharedInvoice?: any) => {
        ensure(!d.staffId || d.staffId === actor.id || actor.role === 'OWNER' || actor.cashier, 'Chỉ chủ spa hoặc thu ngân được chọn nhân viên thực hiện khác.', 403);
        const treatment = await get(Treatment, d.treatmentId);
        ensure(treatmentAvailable(treatment), 'Gói chưa đến ngày dùng, đã hết hạn, bảo lưu hoặc hết buổi.');
        ensure(useToken(treatment) === d.remainingBefore, 'Số buổi đã thay đổi. Tải lại gói và yêu cầu khách ký lại.', 409);
        const customer = await get(Customer, String(treatment.customerId));
        const staff = await get(User, staffId);
        ensure(staff.active && ['OWNER','STAFF'].includes(staff.role), 'Nhân viên thực hiện không hoạt động.');
        const performedAt = new Date();
        const signatureDigest = d.signature ? sha(JSON.stringify(d.signature)) : undefined;
        const confirmationUseId = sharedInvoice?.treatmentUseId;
        const confirmationMethod = d.signature ? (confirmationUseId ? 'INVOICE_SIGNATURE' : 'DRAWN_SIGNATURE') : 'STAFF_RECORDED';
        const sessionNumber = nextSessionNumber(treatment);
        const snapshot = JSON.stringify({ treatmentId: d.treatmentId, ...(appointmentId ? { appointmentId } : {}),
          customerId: String(customer._id), customerName: customer.name, name: treatment.name,
          staffId, staffName: staff.name, actorId: actor.id, sessionNumber, remainingBefore: useToken(treatment), packageType: treatment.packageType || 'SESSIONS', startsOn: treatment.startsOn, expiresOn: treatment.expiresOn,
          performedAt: performedAt.toISOString(), method: confirmationMethod, signatureDigest, ...(confirmationUseId ? {confirmationUseId:String(confirmationUseId)} : {}),
          confirmationText: d.signature ? 'Khách ký chung xác nhận các dịch vụ đã thực hiện trên hóa đơn.' : 'Nhân viên ghi nhận đã thực hiện; không có chữ ký khách hàng.' });
        const recorded = await create(TreatmentUse, { treatmentId: d.treatmentId, ...(appointmentId && !sharedInvoice ? { appointmentId } : {}),
          actorId: actor.id, staffId, customerId: customer._id, sessionNumber, method: confirmationMethod,
          ...(confirmationUseId ? {confirmationUseId} : d.signature ? {signature:d.signature} : {}), signatureDigest, performedAt, snapshot, digest: sha(snapshot) });
        const purchase = await get(Invoice, String(treatment.invoiceId));
        const serviceId = treatment.serviceId || purchase.serviceId;
        const service = serviceId ? await get(Service, String(serviceId)) : null;
        const line = { serviceId, name: treatment.name + ' · Buổi ' + sessionNumber, total: 0, commission: service?.commission || 0 };
        const sessionInvoice = sharedInvoice || await create(Invoice, { customerId: customer._id, ...(service ? { serviceId: service._id } : {}),
          ...(appointmentId ? { appointmentId } : {}), treatmentId: treatment._id, treatmentUseId: recorded._id,
          kind: 'SESSION', description: line.name, total: 0, paid: 0, status: 'PAID',
          commission: line.commission, serviceItems: service ? [line] : undefined,
          ...(purchase.consultantId ? { consultantId: purchase.consultantId, consultantName: purchase.consultantName } : await consultant(customer)) });
        const reference = {treatmentId:treatment._id,treatmentUseId:recorded._id,name:line.name};
        if (sharedInvoice) {
          ensure(String(sharedInvoice.customerId) === String(customer._id), 'Các liệu trình phải thuộc cùng khách.');
          sessionInvoice.description += ' + ' + line.name;
          sessionInvoice.serviceItems.push(line);
          sessionInvoice.commission = money((sessionInvoice.commission || 0) + line.commission, true);
          const earned = await Commission.findOne({...scope,invoiceId:sessionInvoice._id}).session(session);
          ensure(earned && !earned.payrollId, 'Không cập nhật được hoa hồng lần thực hiện.',409);
          earned.amount = sessionInvoice.commission; earned.serviceName = sessionInvoice.description;
          await earned.save({session});
        }
        sessionInvoice.treatmentSessions = [...(sessionInvoice.treatmentSessions || []),reference];
        await sessionInvoice.save({session});
        recorded.checkoutInvoiceId = sessionInvoice._id;
        await recorded.save({session});
        linkedInvoiceId = String(sessionInvoice._id);
        if (!sharedInvoice && service) await accrueCommission(sessionInvoice, staffId, 'TREATMENT_USE', String(recorded._id), performedAt);
        if (timedPackage(treatment)) treatment.usedSessions = sessionNumber;
        else { if(treatment.openingBalance) treatment.usedSessions=sessionNumber; treatment.remaining -= 1; if (!treatment.remaining) treatment.status = 'COMPLETED'; }
        await treatment.save({ session });
        return recorded;
      };
      const addServices = async (invoice:any, lines:{serviceId:string;total:number}[]) => {
        ensure(new Set(lines.map(item=>item.serviceId.toLowerCase())).size===lines.length,'Không chọn trùng dịch vụ lẻ.');
        const items=[];
        for(const line of lines){
          const service=await get(Service,line.serviceId);ensure(service.active,'Dịch vụ đã ngừng hoạt động.');
          items.push({serviceId:service._id,name:service.name,total:line.total,commission:service.commission || 0});
        }
        if(!items.length)return;
        invoice.serviceItems=[...(invoice.serviceItems || []),...items];
        invoice.total=money(invoice.total+items.reduce((sum,item)=>sum+item.total,0));
        invoice.status=invoiceState(invoice.total,invoice.paid);
        invoice.description+=' + '+items.map(item=>item.name).join(' + ');
        const earned=await Commission.findOne({...scope,invoiceId:invoice._id}).session(session);
        ensure(earned && !earned.payrollId,'Không cập nhật được hoa hồng lần thực hiện.',409);
        earned.amount=money(earned.amount+items.reduce((sum,item)=>sum+item.commission,0),true);
        earned.serviceName=invoice.description;await earned.save({session});invoice.commission=earned.amount;
        await invoice.save({session});
      };
      const addProducts = async (invoice:any, items:{productId:string;quantity:number;unitPrice:number}[]) => {
        ensure(new Set(items.map(item=>item.productId.toLowerCase())).size===items.length,'Không chọn trùng sản phẩm.');
        const lines=[];
        for(const item of items){
          const product=await get(Product,item.productId);ensure(product.active,'Sản phẩm đã ngừng bán.');
          const before=product.stock;product.stock=stockBalance(before,'OUT',item.quantity);
          const total=productTotal(item.unitPrice,item.quantity);
          lines.push({productId:product._id,name:product.name,unit:product.unit,quantity:item.quantity,unitPrice:item.unitPrice,total});
          await product.save({session});
          await create(StockMovement,{checkoutInvoiceId:invoice._id,productId:product._id,productName:product.name,sku:product.sku,unit:product.unit,actorId:actor.id,actorName:user.name,direction:'OUT',kind:'SALE',quantity:item.quantity,before,after:product.stock,reason:'Bán hàng tại thu ngân'});
        }
        if(!lines.length)return;
        invoice.productItems=lines;invoice.total=money(invoice.total+lines.reduce((sum,line)=>sum+line.total,0));
        invoice.status=invoiceState(invoice.total,invoice.paid);
        invoice.description=[invoice.description,...lines.map(line=>line.name)].filter(Boolean).join(' + ');
        await invoice.save({session});
      };
      let target: any;
      let appointmentBefore: Record<string, unknown> | undefined;
      let linkedInvoiceId: string | undefined;
      let treatmentUseId: string | undefined;
      let replacementAppointmentId: string | undefined;
      let financialBefore: Record<string, unknown> | undefined;
      const linkVisit = async (appointment:any,invoice:any,reason:string) => {
        ensure(['CONFIRMED','COMPLETED'].includes(appointment.status),'Lịch đã hủy hoặc hoãn, không thể lập hóa đơn.',409);
        ensure(appointment.startAt <= new Date(),'Chưa tới thời gian thực hiện lịch.');
        ensure(String(invoice.customerId)===String(appointment.customerId),'Hóa đơn phải đúng khách của lịch.');
        ensure((!invoice.kind || ['SERVICE','SESSION'].includes(invoice.kind)) && !invoice.openingBalance && !invoice.giftOfInvoiceId && !invoice.refunded,'Chỉ liên kết hóa đơn dịch vụ/buổi thực hiện phù hợp.');
        ensure(!invoice.appointmentId || String(invoice.appointmentId)===String(appointment._id),'Hóa đơn đã liên kết lịch khác.',409);
        const existing=await Invoice.findOne({...scope,appointmentId:appointment._id}).session(session);
        ensure(!existing || String(existing._id)===String(invoice._id),'Lịch đã có hóa đơn. Mở hóa đơn đã liên kết.',409);
        const uses=await TreatmentUse.find({...scope,checkoutInvoiceId:invoice._id}).session(session);
        const serviceIds=(invoice.serviceItems?.length ? invoice.serviceItems.filter((line:any)=>invoice.kind!=='SESSION' || line.total>0).map((line:any)=>String(line.serviceId)) : invoice.serviceId ? [String(invoice.serviceId)] : []);
        // Session service lines may share a serviceId with standalone work; the
        // explicit checkout selection is checked before creation as well.
        ensure(coversVisit(appointment,serviceIds,uses.map(use=>String(use.treatmentId))),'Hóa đơn chưa đủ dịch vụ/liệu trình của lịch.');
        ensure(uses.every(use=>!use.appointmentId || String(use.appointmentId)===String(appointment._id)),'Buổi đã liên kết lịch khác.',409);
        ensure(invoice.performedAt && invoice.performedBy,'Hóa đơn chưa ghi nhận người thực hiện.');
        ensure(!appointment.staffId || String(appointment.staffId)===String(invoice.performedBy),'Nhân viên thực hiện không khớp lịch.');
        const before={appointment:appointment.toObject(),invoiceAppointmentId:invoice.appointmentId};
        invoice.appointmentId=appointment._id;await invoice.save({session});
        if(uses.length && !uses.some(use=>use.appointmentId)) {uses[0].appointmentId=appointment._id;await uses[0].save({session});}
        appointment.staffId=invoice.performedBy;appointment.status='COMPLETED';await appointment.save({session});
        await create(Audit,{actorId:actor.id,action:'linkAppointmentInvoice',targetId:appointment._id,details:{before,after:appointment.toObject(),invoiceId:invoice._id,reason}});
      };
      const execute = async (op:Operation,data:any) => {
      target=undefined;appointmentBefore=undefined;linkedInvoiceId=undefined;treatmentUseId=undefined;replacementAppointmentId=undefined;financialBefore=undefined;
      switch (op) {
        case 'correctInvoiceDate': {
          const d=schemas.correctInvoiceDate.parse(data);
          const invoice=await get(Invoice,d.id);
          ensure(!invoice.openingBalance,'Chứng từ nhập ban đầu cần đối soát riêng, không đổi ngày bán.');
          ensure(invoice.updatedAt?.toISOString()===d.expectedUpdatedAt,'Hóa đơn đã thay đổi. Tải lại trước khi sửa.',409);
          dayBounds(d.issuedOn);
          ensure(d.issuedOn<=today,'Không nhập hóa đơn ngày tương lai.');
          const oldDay=spaDay(invoice.createdAt);
          for(const day of new Set([oldDay,d.issuedOn])) {
            ensure(!await Day.exists({...scope,day,status:'CLOSED'}).session(session),'Ngày '+day+' đã chốt sổ. Chủ spa cần mở lại trước khi sửa ngày hóa đơn.',409);
          }
          const receiptChanges: {receiptId:string;paymentId:string;amount:number;method:string;before:string;after:string}[]=[];
          if(d.adjustPaymentDates) {
            ensure(!invoice.refunded,'Hóa đơn đã hoàn tiền cần đối soát riêng trước khi sửa ngày thu.');
            const payments=await Payment.find({...scope,invoiceId:invoice._id,reversed:{$ne:true}}).session(session);
            ensure(payments.length>0,'Hóa đơn không có khoản thu trực tiếp để điều chỉnh ngày. Tiền cọc và thẻ không được chuyển ngày.');
            for(const payment of payments) {
              const receipt=await get(CashEntry,String(payment.receiptId));
              ensure(receipt.kind==='PAYMENT' && receipt.direction==='IN' && !receipt.reversed && receipt.amount===payment.amount,'Khoản thu không còn nguyên trạng, cần đối soát riêng.',409);
              ensure(!await CashEntry.exists({...scope,originalId:receipt._id}).session(session),'Khoản thu đã có giao dịch đảo, cần đối soát riêng.',409);
              ensure(!await Payment.exists({...scope,receiptId:receipt._id,_id:{$ne:payment._id}}).session(session),'Khoản thu dùng chung cần đối soát riêng.',409);
              if(receipt.day!==d.issuedOn) receiptChanges.push({receiptId:String(receipt._id),paymentId:String(payment._id),amount:receipt.amount,method:receipt.method,before:receipt.day,after:d.issuedOn});
            }
            for(const day of new Set(receiptChanges.flatMap(change=>[change.before,change.after]))) {
              const book=await Day.findOneAndUpdate({...scope,day,status:'OPEN'},{$inc:{revision:1}},{session,returnDocument:'after'});
              ensure(book,'Sổ ngày '+day+' chưa mở hoặc đã chốt. Chủ spa cần mở/mở lại sổ trước khi sửa ngày thu.',409);
            }
            for(const change of receiptChanges) {
              await CashEntry.updateOne({...scope,_id:change.receiptId,day:change.before},{$set:{day:change.after}},{session});
            }
          }
          const before={createdAt:invoice.createdAt,recordedAt:invoice.recordedAt};
          const createdAt=d.issuedOn===oldDay ? invoice.createdAt : new Date(d.issuedOn+'T12:00:00+07:00');
          const recordedAt=invoice.recordedAt || invoice.createdAt;
          await Invoice.updateOne({...scope,_id:invoice._id},{$set:{createdAt,recordedAt,updatedAt:new Date()}},{session,timestamps:false,overwriteImmutable:true});
          await create(Audit,{actorId:actor.id,action:op,targetId:invoice._id,details:{reason:d.reason,adjustPaymentDates:d.adjustPaymentDates,receiptChanges,before,after:{createdAt,recordedAt}}});
          return {id:String(invoice._id),invoiceId:String(invoice._id),message:d.adjustPaymentDates ? 'Đã điều chỉnh ngày hóa đơn và ngày thu tiền. Số tiền không đổi.' : 'Đã điều chỉnh ngày hóa đơn. Giữ nguyên tiền và lịch sử thực hiện.'};
        }
        case 'linkAppointmentInvoice': {
          const d=schemas.linkAppointmentInvoice.parse(data);
          target=await get(Appointment,d.appointmentId);
          const invoice=await get(Invoice,d.invoiceId);
          await linkVisit(target,invoice,d.reason);
          return {id:String(target._id),invoiceId:String(invoice._id),message:'Đã liên kết lịch và hóa đơn.'};
        }
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
          if (d.imageUrl?.startsWith('/api/product-images/')) {
            const imageId = d.imageUrl.slice('/api/product-images/'.length);
            const image = await mongoose.connection.db!.collection('product_images.files').findOne({
              _id: new mongoose.Types.ObjectId(imageId), 'metadata.spaId': actor.spaId, 'metadata.kind': 'PRODUCT_IMAGE',
            }, { session });
            ensure(image, 'Ảnh sản phẩm không thuộc spa này.', 400);
          }
          if (d.sku) ensure(!await Product.exists({ ...scope, sku: d.sku, ...(existingId ? { _id: { $ne: existingId } } : {}) }).session(session), 'Mã sản phẩm đã tồn tại.', 409);
          const values = { origin: d.origin || undefined, manufacturedOn: d.manufacturedOn || undefined, expiresOn: d.expiresOn || undefined, name: d.name, ...(d.sku ? { sku: d.sku } : {}), sizeMl: d.sizeMl, price: d.price, groupId: d.groupId || undefined, description: d.description || undefined, imageUrl: (d.imageUrl && d.imageUrl.trim()) ? d.imageUrl.trim() : undefined, minStock: d.minStock ?? 0 };
          if (existingId) { target = await get(Product, existingId); Object.assign(target, values); await target.save({ session }); }
          else target = await create(Product, { ...values, sku: d.sku || 'SP-' + new mongoose.Types.ObjectId().toHexString().toUpperCase(), unit: 'Sản phẩm' });
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
        case 'productInvoice': {
          const d=schemas.productInvoice.parse(data);await get(Customer,d.customerId);
          if(d.dueDate)dayBounds(d.dueDate);
          target=await create(Invoice,{customerId:d.customerId,kind:'PRODUCT',description:'',total:0,paid:0,...(d.dueDate?{dueDate:d.dueDate}:{})});
          await addProducts(target,d.items);linkedInvoiceId=String(target._id);break;
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
        case 'setSalaryPolicy': {
          const {staffId,...policy} = schemas.setSalaryPolicy.parse(data);
          target = await User.findOne({...scope,_id:staffId,role:'STAFF'}).select('+salaryPolicy').session(session);
          ensure(target,'Không tìm thấy nhân viên.',404); appointmentBefore = {salaryPolicy:target.salaryPolicy};
          target.salaryPolicy = policy; await target.save({session}); break;
        }
        case 'recordWorkday': {
          const d = schemas.recordWorkday.parse(data); ensure(d.day <= today,'Không ghi ngày công thực tế trong tương lai.'); const staff = await get(User,d.staffId);
          ensure(staff.role === 'STAFF','Lương và chấm công chỉ áp dụng cho nhân viên, không áp dụng cho chủ spa.',403);
          const leaves = await StaffLeave.find({...scope,staffId:d.staffId,status:{$ne:'REJECTED'}}).session(session);
          ensure(!leaves.some(r => leavesOverlap(r.toObject(),{day:d.day,period:d.period,type:'WORK'})),'Ngày công trùng thời gian nghỉ đã ghi nhận.',409);
          target = await Workday.findOne({...scope,staffId:d.staffId,day:d.day}).session(session);
          appointmentBefore = target?.toObject() || {status:null};
          if (!target) target = new Workday({...scope,staffId:d.staffId,day:d.day});
          Object.assign(target,{...d,actorId:actor.id}); await target.save({session}); break;
        }
        case 'recordStaffLeave': {
          const d = schemas.recordStaffLeave.parse(data);
          ensure(actor.role === 'OWNER' || d.staffId === actor.id,'Chỉ được gửi ngày nghỉ của mình.',403);
          const staff = await get(User,d.staffId); ensure(staff.role === 'STAFF','Lương và chấm công chỉ áp dụng cho nhân viên, không áp dụng cho chủ spa.',403);
          target = d.id ? await get(StaffLeave,d.id) : null;
          ensure(!target || String(target.staffId) === d.staffId,'Không đổi nhân viên của bản ghi nghỉ.');
          ensure(!target || actor.role === 'OWNER' || target.status === 'PENDING','Chỉ OWNER sửa bản nghỉ đã duyệt hoặc từ chối.',403);
          ensure(actor.role === 'OWNER' || !d.paid,'Chỉ OWNER xác định nghỉ hưởng lương.',403);
          const startDay = d.startDay || d.day!, endDay = d.endDay || startDay;
          const candidate = {...d,day:startDay,startDay,endDay,status:target?.status || 'PENDING'};
          const others = await StaffLeave.find({...scope,staffId:d.staffId,...(target ? {_id:{$ne:target._id}} : {})}).session(session);
          ensure(!others.some(r => leavesOverlap(r.toObject(),candidate)),'Khoảng nghỉ trùng bản ghi khác.',409);
          const work = await Workday.find({...scope,staffId:d.staffId,day:{$gte:startDay,$lte:endDay}}).session(session);
          ensure(!work.some(r => leavesOverlap(candidate,{day:r.day,period:r.period,type:'WORK'})),'Khoảng nghỉ trùng ngày công.',409);
          appointmentBefore = target?.toObject() || {status:null};
          if (!target) target = new StaffLeave({...scope,staffId:d.staffId});
          Object.assign(target,{day:startDay,startDay,endDay,period:d.period,type:d.type,note:d.note,paid:d.paid,staffName:staff.name,actorId:actor.id,status:candidate.status});
          if (target.status === 'APPROVED') {target.reviewedBy=actor.id;target.reviewedAt=new Date();}
          await target.save({session}); break;
        }
        case 'reviewStaffLeave': {
          const d = schemas.reviewStaffLeave.parse(data); target = await get(StaffLeave,d.id);
          ensure((await get(User,String(target.staffId))).role === 'STAFF','Không chấm công/nghỉ phép cho chủ spa.',403);
          ensure(target.status === 'PENDING','Bản ghi đã được xử lý; OWNER có thể sửa nội dung.',409);
          appointmentBefore = target.toObject(); target.status=d.status;target.paid=d.status === 'APPROVED' && d.paid;target.reviewedBy=actor.id;target.reviewedAt=new Date();
          await target.save({session});break;
        }
        case 'refundPackage': {
          const d = schemas.refundPackage.parse(data);
          ensure(!await CashCard.exists({ ...scope, sourceInvoiceId: d.invoiceId }).session(session), 'Gói có thẻ tiền tặng: cần chốt quy trình xử lý thẻ trước khi hoàn tiền.', 409); const invoice = await get(Invoice,d.invoiceId);
          ensure(!invoice.openingBalance,'Không hoàn tiền bằng chứng từ chuyển số dư lịch sử.',409);
          ensure(invoice.kind === 'PACKAGE','Chỉ hoàn tiền cho hóa đơn bán gói.');
          ensure(d.amount <= invoice.paid - (invoice.refunded || 0),'Số hoàn vượt phần thực thu còn lại.');
          paymentEvidence(d.method,d.receivedConfirmation,d.reason,d.transferReference);
          target = await receipt({amount:d.amount,method:d.method,direction:'OUT',kind:'REFUND',customerId:invoice.customerId,note:d.reason,transferReference:d.transferReference});
          invoice.refunded = (invoice.refunded || 0)+d.amount; await invoice.save({session});
          await syncSaleCommission(invoice,'REFUND',String(target._id)); break;
        }
        case 'setStaffSalary': {
          const d = schemas.setStaffSalary.parse(data);
          target = await User.findOne({ ...scope, _id: d.staffId, role: 'STAFF' }).select('+baseSalary').session(session);
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
          const staff = await User.findOne({ ...scope, _id: d.staffId, role: 'STAFF' }).select('+baseSalary').session(session);
          ensure(staff && staff.role === 'STAFF', 'Không tìm thấy nhân viên trong spa.', 404);
          const existing = await Payroll.findOne({ ...scope, staffId: d.staffId, month: d.month }).session(session);
          ensure(!existing || existing.status === 'DRAFT', 'Bảng lương đã duyệt, không được sửa số liệu.', 409);
          ensure(existing ? d.id === String(existing._id) : !d.id, 'Bảng lương đã tồn tại hoặc đã thay đổi. Mở đúng bản nháp để cập nhật.', 409);
          financialBefore = existing ? payrollSnapshot(existing) : { status: null };
          const baseSalary = d.baseSalary ?? existing?.baseSalary ?? staff.baseSalary;
          ensure(baseSalary !== undefined, 'Cần cài lương cơ bản hoặc nhập lương tháng trước.');
          const commissions = await pendingCommissions(d.staffId, d.month);
          const { id, ...input } = d;
          const attendance = await attendanceFor(d.staffId,d.month,d.attendanceConfirmed);
          const values: any = { ...input, ...attendance, baseSalary, staffName: staff.name };
          fillPayroll(values, commissions);
          if (existing) { Object.assign(existing, values); await existing.save({ session }); target = existing; }
          else target = await create(Payroll, values);
          break;
        }
        case 'approvePayroll': {
          const d = schemas.approvePayroll.parse(data);
          target = await get(Payroll, d.id);
          ensure((await get(User,String(target.staffId))).role === 'STAFF','Bảng lương chỉ áp dụng cho nhân viên.',403);
          financialBefore = payrollSnapshot(target);
          if (target.status !== 'DRAFT') { ensure(target.total === d.expectedTotal, 'Số tiền bảng lương đã thay đổi.', 409); break; }
          const commissions = await pendingCommissions(String(target.staffId), target.month);
          const ids = commissions.map(c => String(c._id)).sort().join(',');
          const attendance = await attendanceFor(String(target.staffId),target.month,target.attendanceConfirmed);
          ensure(target.attendanceDigest ? attendance.attendanceDigest === target.attendanceDigest : !attendance.salaryPolicy,'Ngày nghỉ, công hoặc chính sách đã đổi. Cập nhật nháp trước khi duyệt.',409);
          ensure(ids === [...target.commissionIds,...(target.saleCommissionIds || []),...(target.sharedSaleCommissionIds || [])].map((id: any) => String(id)).sort().join(','), 'Hoa hồng đã thay đổi. Cập nhật bản nháp trước khi duyệt.', 409);
          fillPayroll(target, commissions);
          ensure(target.total === d.expectedTotal, 'Số tiền đã thay đổi. Kiểm tra lại bảng lương.', 409);
          await Commission.updateMany({ ...scope, _id: { $in: target.commissionIds }, payrollId: { $exists: false } }, { $set: { payrollId: target._id } }, { session });
          await SaleCommission.updateMany({...scope,_id:{$in:target.saleCommissionIds || []},payrollId:{$exists:false}},{$set:{payrollId:target._id}},{session});
          await SharedSaleCommission.updateMany({...scope,_id:{$in:target.sharedSaleCommissionIds || []},payrollId:{$exists:false}},{$set:{payrollId:target._id}},{session});
          target.status = 'APPROVED'; target.approvedBy = actor.id; target.approvedAt = new Date();
          await target.save({ session });
          break;
        }
        case 'payPayroll': {
          const d = schemas.payPayroll.parse(data);
          target = await get(Payroll, d.id);
          ensure((await get(User,String(target.staffId))).role === 'STAFF','Bảng lương chỉ áp dụng cho nhân viên.',403);
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
          if ('id' in d) { target = await get(PackageTemplate, String(d.id)); const { id, ...values } = d; Object.assign(target, values); if (d.packageType === 'TIME') target.totalSessions = undefined; else target.durationMonths = undefined; await target.save({ session }); }
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
          ensure(!await User.exists({ _id: { $ne: id }, phone: d.phone }).session(session), 'Số điện thoại đã tồn tại.', 409);
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
        case 'serviceGroup': {
          const d = schemas.serviceGroup.parse(data);
          const nameKey = serviceGroupKey(d.name);
          const existing = await ServiceGroup.exists({...scope,nameKey}).session(session);
          const legacy = await Service.find(scope).distinct('category').session(session);
          ensure(!existing && !legacy.some(name=>typeof name==='string'&&serviceGroupKey(name)===nameKey), 'Nhóm dịch vụ đã tồn tại. Chọn nhóm có sẵn.',409);
          target = await create(ServiceGroup,{name:d.name,nameKey,actorId:actor.id});
          break;
        }
        case 'service':
          target = await create(Service, schemas.service.parse(data));
          break;
        case 'user': {
          const d = schemas.user.parse(data);
          ensure(!await User.exists({ phone: d.phone }).session(session), 'Số điện thoại đã tồn tại.', 409);
          target = await create(User, {
            name: d.name,
            phone: d.phone,
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
          const staff = d.staffId ? await get(User, d.staffId) : null;
          ensure(service.active && (!staff || (staff.active && ['OWNER', 'STAFF'].includes(staff.role))), 'Dịch vụ/nhân viên không hoạt động.');
          ensure(!(d.treatmentId && d.treatmentIds), 'Chỉ gửi một danh sách liệu trình.');
          const treatmentIds = d.treatmentIds || (d.treatmentId ? [d.treatmentId] : []);
          const requestedServices = [];
          const serviceIds=d.serviceIds || (!treatmentIds.length ? [d.serviceId] : []);
          for (const [index,id] of treatmentIds.entries()) {
            const treatment = await get(Treatment,id);
            const purchase = await get(Invoice,String(treatment.invoiceId));
            const selectedService = await get(Service,String(treatment.serviceId || purchase.serviceId));
            ensure(String(treatment.customerId) === d.customerId && (index > 0 || String(selectedService._id) === d.serviceId), 'Gói phải thuộc đúng khách và dịch vụ.');
            ensure(selectedService.active && treatmentAvailable(treatment,spaDay(new Date(d.startAt))), 'Gói chưa đến ngày dùng, hết hạn, bảo lưu hoặc hết buổi.');
            requestedServices.push({serviceId:selectedService._id,name:treatment.name});
          }
          for(const id of serviceIds){
            const selected=await get(Service,id);ensure(selected.active,'Dịch vụ đã ngừng hoạt động.');
            requestedServices.push({serviceId:selected._id,name:selected.name});
          }
          ensure(requestedServices.length<=60,'Tối đa 30 dịch vụ lẻ và 30 liệu trình.');
          ensure(treatmentIds.length || serviceIds[0]===d.serviceId,'Dịch vụ đầu không khớp danh sách.');
          const startAt = new Date(d.startAt);
          ensure(startAt >= new Date(), 'Không đặt lịch trong quá khứ.');
          ensure(withinArrivalHours(startAt), 'Giờ đến phải nằm trong 09:00–22:00.');
          target = await create(Appointment, { ...d, serviceIds, requestedServices, ...(treatmentIds.length ? {treatmentId:treatmentIds[0],treatmentIds} : {}), startAt });
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
            ensure(appointmentServiceIds(target).length<=1,'Dùng hoàn thành và lập hóa đơn để ghi đủ các dịch vụ.');
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
          const ids = target.treatmentIds?.length ? target.treatmentIds.map(String) : [String(target.treatmentId)];
          const selections = d.treatments || [{treatmentId:String(target.treatmentId),signature:d.signature,remainingBefore:d.remainingBefore}];
          const invoiceSignature = commonSignature(d.signature,selections);
          ensure(selections.length === ids.length && new Set(selections.map(item=>item.treatmentId)).size === ids.length && selections.every(item=>ids.includes(item.treatmentId)), 'Xác nhận đủ từng liệu trình trong lịch.');
          ensure(!await Invoice.exists({ ...scope, appointmentId: target._id }).session(session), 'Lịch đã có hóa đơn; cần đối chiếu trước.', 409);
          appointmentBefore = target.toObject();
          if (!target.staffId) {
            ensure(d.staffId, 'Chọn nhân viên thực hiện trước khi hoàn thành lịch.');
            const performer = await get(User, d.staffId!);
            ensure(performer.active && ['OWNER','STAFF'].includes(performer.role), 'Nhân viên thực hiện không hợp lệ.');
            target.staffId = performer._id;
          }
          let combined: any;
          for (const item of selections) {
            const treatment = await get(Treatment,item.treatmentId);
            ensure(String(treatment.customerId) === String(target.customerId), 'Gói không khớp khách.');
            const recorded = await recordUse(schemas.use.parse({...item,signature:invoiceSignature}),String(target._id),String(target.staffId),combined);
            treatmentUseId ||= String(recorded._id);
            combined = await get(Invoice,linkedInvoiceId!);
          }
          const extras=[];
          for(const id of target.serviceIds || []){
            const service=await get(Service,String(id));ensure(service.active,'Dịch vụ đã ngừng hoạt động.');
            extras.push({serviceId:String(service._id),total:money(service.price)});
          }
          await addServices(combined,extras);
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
          const requestedIds = appointmentServiceIds(target);
          if (requestedIds.length > 1 && !invoice) {
            ensure(!d.existingInvoiceId, 'Lịch nhiều dịch vụ cần lập hóa đơn đủ các dịch vụ.');
            const serviceItems = [];
            for (const id of requestedIds) {
              const service = await get(Service, id);
              ensure(service.active, 'Dịch vụ đã ngừng cung cấp.');
              serviceItems.push({ serviceId: service._id, name: service.name, total: invoiceCharge(service.price, undefined, false), commission: service.commission || 0 });
            }
            const total = money(serviceItems.reduce((sum, item) => sum + item.total, 0));
            ensure(d.total === undefined || d.total === total, 'Giá dịch vụ đã thay đổi. Tải lại lịch để kiểm tra.', 409);
            invoice = await create(Invoice, { appointmentId: target._id, customerId: target.customerId,
              kind: 'SERVICE', serviceItems, description: serviceItems.map(item => item.name).join(' + '), total, paid: 0,
              commission: money(serviceItems.reduce((sum, item) => sum + item.commission, 0), true),
              ...(d.dueDate ? { dueDate: d.dueDate } : {}) });
          }
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
          if (!target.staffId) {
            ensure(d.staffId, 'Chọn nhân viên thực hiện trước khi hoàn thành lịch.');
            const performer = await get(User, d.staffId!);
            ensure(performer.active && ['OWNER', 'STAFF'].includes(performer.role), 'Nhân viên thực hiện không hợp lệ hoặc đã ngừng hoạt động.');
            target.staffId = performer._id;
          }

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
          for(const id of (target.serviceIds?.length ? target.serviceIds : !target.treatmentId ? appointmentServiceIds(target) : [])){
            ensure((await get(Service,String(id))).active,'Dịch vụ đã ngừng hoạt động.');
          }
          for (const id of (target.treatmentIds?.length ? target.treatmentIds : target.treatmentId ? [target.treatmentId] : [])) ensure(treatmentAvailable(await get(Treatment,String(id)),spaDay(new Date(d.startAt))), 'Gói không khả dụng tại ngày dời lịch.');
          const startAt = new Date(d.startAt);
          ensure(startAt >= new Date(), 'Không dời lịch vào quá khứ.');
          ensure(withinArrivalHours(startAt), 'Giờ đến phải nằm trong 09:00–22:00.');
          appointmentBefore = target.toObject();
          // Keep the postponed record, its original time, and all references intact.
          if (target.status === 'POSTPONED') {
            const replacement = await create(Appointment, {
              customerId: target.customerId, serviceId: target.serviceId, requestedServices: target.requestedServices, treatmentIds: target.treatmentIds, serviceIds:target.serviceIds, bookingSource: target.bookingSource,
              ...(target.treatmentId ? { treatmentId: target.treatmentId } : {}),
              staffId: d.staffId, startAt, notes: target.notes,
              changeReason: d.reason, rescheduledFromId: target._id,
            });
            replacementAppointmentId = String(replacement._id);
          } else {
            Object.assign(target, { staffId: d.staffId, startAt, endAt: undefined, changeReason: d.reason });
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
          const startsOn = packageStartOnPurchase(template, service.category, data.issuedOn || today, d.startsOn);
          if (timedPackage(template)) { ensure(startsOn, 'Chọn ngày bắt đầu cho gói theo thời gian.'); dayBounds(startsOn!); }
          const advisor = await consultant(customer, d.consultantId);
          const participants = [];
          for (const personId of d.participantIds || [d.sellerId || actor.id]) {
            const person = await get(User, personId);
            ensure(person.active && ['OWNER','STAFF'].includes(person.role), 'Người tư vấn phải là nhân sự đang hoạt động trong spa.');
            participants.push({staffId:person._id,staffName:person.name});
          }
          const seller = participants[0];
          const invoice = groupedPackageSale && packageInvoice ? packageInvoice : await create(Invoice, { customerId: d.customerId, serviceId: service._id, description: template.name + ' · ' + service.name, total: money(d.total ?? template.price), paid: 0, dueDate: d.dueDate, kind: 'PACKAGE', ...(d.giftCashCardAmount ? {giftCashCardAmount:d.giftCashCardAmount}:{}), sellerId:seller.staffId, sellerName:seller.staffName, saleParticipants:participants, saleCommissionVersion:participants.length > 1 ? 2 : 1, saleCommissionAccrued:0, promotion: d.promotion, commission: service.commission || 0, ...advisor });
          target = await create(Treatment, { customerId: d.customerId, serviceId: service._id, templateId: template._id, invoiceId: invoice._id, name: template.name, ...packageSnapshot(template, startsOn) });
          if(groupedPackageSale) {
            if(packageInvoice) {
              ensure(JSON.stringify(invoice.saleParticipants.map((p:any)=>String(p.staffId)))===JSON.stringify(participants.map(p=>String(p.staffId))) && invoice.dueDate===d.dueDate && String(invoice.consultantId || '')===String(advisor.consultantId || ''),'Các gói trong cùng hóa đơn phải có cùng người tư vấn và hạn thanh toán.');
              invoice.total=money(invoice.total+money(d.total ?? template.price));
              invoice.giftCashCardAmount=money((invoice.giftCashCardAmount || 0)+(d.giftCashCardAmount || 0),true);
            }
            invoice.packageItems=[...(invoice.packageItems || []),{templateId:template._id,treatmentId:target._id,serviceId:service._id,name:template.name+' · '+service.name,total:money(d.total ?? template.price),promotion:d.promotion,giftCashCardAmount:d.giftCashCardAmount || 0}];
            invoice.description=invoice.packageItems.map((item:any)=>item.name).join(' + ');
            invoice.promotion=[...new Set(invoice.packageItems.map((item:any)=>item.promotion).filter(Boolean))].join('; ');
            await invoice.save({session});packageInvoice=invoice;
          }
          for (const gift of d.gifts) {
            const giftService = await get(Service,gift.serviceId);
            ensure(giftService.active,'Dịch vụ quà tặng không hoạt động.');
            const name='Tặng 1 lần · '+giftService.name;
            const giftInvoice=await create(Invoice,{customerId:customer._id,serviceId:giftService._id,description:name,kind:'GIFT',total:0,paid:0,status:'PAID',giftOfInvoiceId:invoice._id,promotion:d.promotion,...advisor});
            await create(Treatment,{customerId:customer._id,invoiceId:giftInvoice._id,serviceId:giftService._id,name,packageType:'SESSIONS',totalSessions:1,remaining:1,giftOfInvoiceId:invoice._id,promotion:d.promotion});

          }
          if (d.giftCashCardAmount && !groupedPackageSale) await create(CashCard, { customerId: customer._id, amount: d.giftCashCardAmount, balance: d.giftCashCardAmount, origin: 'GIFT', sourceInvoiceId: invoice._id, promotion: d.promotion, actorId: actor.id });
          linkedInvoiceId = String(invoice._id);
          break;
        }
        case 'deleteInvoice': {
          const d=schemas.deleteInvoice.parse(data);
          // Read explicitly: the generic mutation getter deliberately rejects canceled invoices.
          target=await Invoice.findOne({...scope,_id:d.id}).session(session);
          ensure(target,'Không tìm thấy hóa đơn trong spa này.',404);
          ensure(target.updatedAt?.toISOString()===d.expectedUpdatedAt,'Hóa đơn đã thay đổi. Tải lại trước khi xóa.',409);
          const deletionBlock=invoiceDeletionBlock(target);ensure(!deletionBlock,deletionBlock,409);
          const family=await Invoice.find({...scope,$or:[{_id:target._id},{giftOfInvoiceId:target._id}]}).session(session);
          const ids=family.map(i=>i._id);
          const plans=await Treatment.find({...scope,invoiceId:{$in:ids}}).session(session);
          ensure(!await TreatmentUse.exists({...scope,treatmentId:{$in:plans.map(p=>p._id)}}).session(session),'Gói đã có lượt dùng; không xóa lịch sử thực hiện.',409);
          ensure(!await Appointment.exists({...scope,$or:[{treatmentId:{$in:plans.map(p=>p._id)}},{treatmentIds:{$in:plans.map(p=>p._id)}}],status:{$in:['CONFIRMED','POSTPONED']}}).session(session),'Gói còn lịch hẹn. Xử lý lịch trước khi xóa.',409);
          const gifts=await CashCard.find({...scope,sourceInvoiceId:{$in:ids}}).session(session);
          for(const card of gifts) ensure(card.balance===card.amount && !await CashCardUse.exists({...scope,cardId:card._id}).session(session),'Thẻ tặng đã sử dụng; cần đối soát riêng.',409);
          appointmentBefore=target.toObject();appointmentBefore!.family=family.map(i=>i.toObject());
          const payments=await Payment.find({...scope,invoiceId:{$in:ids},reversed:false}).session(session);
          for(const payment of payments) {
            const original=await get(CashEntry,String(payment.receiptId));
            ensure(!original.reversed,'Khoản thu đã thay đổi, cần đối soát.',409);
            await receipt({amount:original.amount,method:original.method,direction:'OUT',kind:'REVERSAL',originalId:original._id,customerId:target.customerId,note:d.reason});
            original.reversed=true;payment.reversed=true;await original.save({session});await payment.save({session});
          }
          const allocations=await Allocation.find({...scope,invoiceId:{$in:ids},reversed:false}).session(session);
          for(const allocation of allocations) {
            const deposit=await get(Deposit,String(allocation.depositId));deposit.balance+=allocation.amount;
            ensure(deposit.balance<=deposit.amount,'Số dư cọc không hợp lệ.');await deposit.save({session});
            allocation.reversed=true;await allocation.save({session});
          }
          const cardUses=await CashCardUse.find({...scope,invoiceId:{$in:ids}}).session(session);
          for(const use of cardUses) {
            ensure(!use.reversedAt,'Lượt thẻ đã được điều chỉnh.',409);
            const card=await get(CashCard,String(use.cardId));card.balance+=use.amount;
            ensure(card.balance<=card.amount,'Số dư thẻ không hợp lệ.');await card.save({session});use.reversedAt=new Date();await use.save({session});
          }
          for(const model of [Commission,SaleCommission,SharedSaleCommission]) {
            const rows=await model.find({...scope,invoiceId:{$in:ids}}).session(session);
            for(const row of rows) {
              ensure(!row.payrollId,'Hoa hồng đã chốt/chi lương cần điều chỉnh bảng lương trước khi xóa.',409);
              row.amount=0;if(model===Commission)row.cancelledAt=new Date();await row.save({session});
            }
          }
          const movements=await StockMovement.find({...scope,$or:[{invoiceId:{$in:ids}},{checkoutInvoiceId:{$in:ids}}]}).session(session);
          for(const movement of movements) {
            ensure(movement.direction==='OUT','Phiếu kho không phải xuất bán, cần đối soát.',409);
            const product=await get(Product,String(movement.productId));const before=product.stock;product.stock=stockBalance(product.stock,'IN',movement.quantity);await product.save({session});
            await create(StockMovement,{productId:product._id,productName:product.name,sku:product.sku,unit:product.unit,actorId:actor.id,actorName:actor.name,direction:'IN',kind:'MANUAL',quantity:movement.quantity,before,after:product.stock,reason:d.reason});
          }
          for(const plan of plans) {plan.status='CANCELLED';await plan.save({session});}
          for(const card of gifts) {card.balance=0;await card.save({session});}
          for(const gift of family.filter(i=>String(i._id)!==String(target._id))) {gift.cancelledTotal=gift.total;gift.total=0;gift.paid=0;gift.status='CANCELLED';await gift.save({session});}
          await ActivityNotification.deleteMany({...scope,kind:'INVOICE_CREATED',invoiceId:{$in:ids}},{session});
          const deleted=await Invoice.deleteOne({...scope,_id:target._id,updatedAt:target.updatedAt},{session});
          ensure(deleted.deletedCount===1,'Hóa đơn đã thay đổi. Tải lại trước khi xóa.',409);
          break;
        }
        case 'cancelInvoice':
        case 'updateInvoice': {
          const cancelling = op === 'cancelInvoice';
          const d = cancelling ? {...schemas.cancelInvoice.parse(data), description:'', total:0, items:undefined, dueDate:undefined, packageName:undefined, packageType:undefined, totalSessions:undefined, durationMonths:undefined, startsOn:undefined, issuedOn:undefined} : schemas.updateInvoice.parse(data);
          target = await get(Invoice,d.id);
          ensure(target.status !== 'CANCELLED', 'Hóa đơn đã hủy, không thể sửa hoặc hủy lại.',409);
          ensure(!target.openingBalance,'Không sửa chứng từ chuyển số dư bằng luồng sửa hóa đơn bán mới.',409);
          ensure(target.updatedAt?.toISOString() === d.expectedUpdatedAt, 'Hóa đơn đã thay đổi. Tải lại trước khi sửa.',409);
          ensure(!target.productItems?.length,'Hóa đơn có sản phẩm cần đối soát kho bằng chức năng xóa sai sót; chưa hỗ trợ sửa/hủy từng dòng.',409);
          ensure(cancelling || !target.packageItems?.length,'Hóa đơn nhiều gói chỉ hỗ trợ sửa ngày; không sửa một gói làm lệch tổng hóa đơn.',409);
          const serviceCorrection = !target.kind || target.kind === 'SERVICE';
          ensure((serviceCorrection || target.kind === 'PACKAGE') && (serviceCorrection || (!target.performedAt && !target.appointmentId)) && !target.treatmentUseId && !target.treatmentId && !target.giftOfInvoiceId, 'Hóa đơn đã thực hiện hoặc có liên kết vận hành, không thể sửa.',409);
          ensure(!await CashCard.exists({ ...scope, sourceInvoiceId: target._id }).session(session), 'Hóa đơn đã phát hành thẻ tặng, không thể sửa.', 409);
          const family = await Invoice.find({...scope,$or:[{_id:target._id},{giftOfInvoiceId:target._id}]}).session(session);
          const ids=family.map(i=>i._id);
          for(const invoice of family) {
            ensure(!invoice.paid && !invoice.refunded && (serviceCorrection || !invoice.performedAt) && !invoice.saleCommissionAccrued,'Hóa đơn đã phát sinh giao dịch, không thể sửa.',409);
          }
          for(const model of [Payment,Allocation,CashCardUse,SaleCommission,SharedSaleCommission]) {
            ensure(!await model.exists({...scope,invoiceId:{$in:ids}}).session(session),'Hóa đơn đã có lịch sử giao dịch hoặc hoa hồng, không thể sửa.',409);
          }
          const serviceCommissions = await Commission.find({...scope,invoiceId:{$in:ids}}).session(session);
          ensure(serviceCorrection || !serviceCommissions.length, 'Hóa đơn đã có hoa hồng, không thể sửa trực tiếp.',409);
          if(cancelling) ensure(serviceCommissions.every(c=>!c.payrollId), 'Hoa hồng đã thuộc bảng lương duyệt/đã chi. Cần xử lý bảng lương trước khi hủy hóa đơn.',409);
          const plans=await Treatment.find({...scope,invoiceId:{$in:ids}}).session(session);
          ensure(target.kind==='PACKAGE' || !plans.length,'Hóa đơn có liệu trình cũ cần đối soát riêng, không thể sửa trực tiếp.',409);
          for(const plan of plans) {
            ensure(plan.status==='ACTIVE' && !(plan.usedSessions || 0) && (timedPackage(plan) || plan.remaining===plan.totalSessions),'Liệu trình đã dùng hoặc thay đổi trạng thái, không thể sửa.',409);
          }
          ensure(!await TreatmentUse.exists({...scope,treatmentId:{$in:plans.map(p=>p._id)}}).session(session),'Liệu trình đã sử dụng, không thể sửa.',409);
          ensure(!await Appointment.exists({...scope,$or:[{treatmentId:{$in:plans.map(p=>p._id)}},{treatmentIds:{$in:plans.map(p=>p._id)}}]}).session(session),'Liệu trình đã có lịch hẹn. Cần xử lý liên kết trước khi sửa.',409);
          const closed=await Day.exists({...scope,day:spaDay(target.createdAt),status:'CLOSED'}).session(session);
          ensure(!closed,'Ngày lập hóa đơn đã chốt sổ. Chủ spa cần mở lại trước khi sửa.',409);
          if(d.dueDate) dayBounds(d.dueDate);
          const correctedDate = d.issuedOn && d.issuedOn !== spaDay(target.createdAt)
            ? new Date(d.issuedOn + 'T12:00:00+07:00') : undefined;
          if(d.issuedOn) {
            dayBounds(d.issuedOn);
            ensure(d.issuedOn <= spaDay(), 'Không nhập hóa đơn ngày tương lai.');
            ensure(!await Day.exists({...scope,day:d.issuedOn,status:'CLOSED'}).session(session), 'Ngày hóa đơn mới đã chốt sổ. Chủ spa cần mở lại trước khi sửa.',409);
          }
          appointmentBefore=target.toObject();
          const plan=plans.find(p=>String(p.invoiceId)===String(target._id));
          if(cancelling) {
            appointmentBefore!.commissions=serviceCommissions.map(c=>c.toObject());
            for(const commission of serviceCommissions) {
              commission.amount=0;
              commission.cancelledAt=new Date();
              await commission.save({session});
            }
            appointmentBefore!.family=family.map(invoice=>invoice.toObject());
            appointmentBefore!.treatments=plans.map(plan=>plan.toObject());
            for(const invoice of family) {
              invoice.cancelledTotal=invoice.total;
              invoice.total=0;
              invoice.status='CANCELLED';
              invoice.cancelledAt=new Date();
              invoice.cancelledBy=actor.id;
              invoice.cancelReason=d.reason;
              await invoice.save({session});
            }
            for(const plan of plans) {
              plan.status='CANCELLED';
              await plan.save({session});
            }
            target=family.find(invoice=>String(invoice._id)===String(target._id))!;
            linkedInvoiceId=String(target._id);
            break;
          }
          if(target.kind==='PACKAGE') {
            ensure(plan && d.packageName && d.packageType,'Cần nhập đầy đủ thông tin liệu trình.');
            ensure(d.packageType==='TIME' ? !!d.durationMonths && !!d.startsOn && d.totalSessions===undefined : !!d.totalSessions && d.durationMonths===undefined && !d.startsOn,'Chọn số buổi hoặc thời gian, không nhập cả hai.');
            const snapshot={...packageSnapshot(d,d.startsOn),...(d.packageType==='SESSIONS' && !timedPackage(plan!) && plan!.expiresOn ? {expiresOn:plan!.expiresOn} : {})};
            appointmentBefore!.treatment=plan!.toObject();
            for(const field of ['totalSessions','remaining','durationMonths','startsOn','expiresOn','usedSessions']) plan!.set(field,undefined);
            plan!.set('templateId',undefined);
            Object.assign(plan!,snapshot,{name:d.packageName});
            await plan!.save({session});
          } else ensure(!d.packageType && !d.packageName && d.totalSessions===undefined && d.durationMonths===undefined && !d.startsOn,'Hóa đơn dịch vụ không có thông tin gói.');
          if(serviceCorrection) {
            ensure(d.total > 0, 'Giá dịch vụ phải lớn hơn 0; dùng Hủy hóa đơn nếu nhập nhầm.');
            if(target.serviceItems?.length) target.serviceItems=repriceInvoiceItems(target.serviceItems.map((item:any)=>item.toObject()),d.total);
          }
          if(d.items) {
            ensure(serviceCorrection, 'Chỉ sửa danh sách dịch vụ của hóa đơn dịch vụ lẻ.');
            ensure(new Set(d.items.map(item=>item.serviceId)).size === d.items.length, 'Không chọn trùng dịch vụ.');
            const items=[];
            for(const item of d.items) {
              const service=await get(Service,item.serviceId);
              ensure(service.active && item.total > 0,'Dịch vụ phải đang hoạt động và có giá lớn hơn 0.');
              // Keep the original fixed rate when the service is unchanged.
              const previous=target.serviceItems?.find((old:any)=>String(old.serviceId)===item.serviceId);
              const rate=previous?.commission ?? (String(target.serviceId)===item.serviceId ? target.commission : undefined) ?? service.commission ?? 0;
              items.push({serviceId:service._id,name:service.name,total:item.total,commission:rate});
            }
            ensure(money(items.reduce((n,item)=>n+item.total,0))===d.total,'Tổng giá từng dịch vụ không khớp hóa đơn.');
            const amount=money(items.reduce((n,item)=>n+item.commission,0),true);
            for(const commission of serviceCommissions) {
              ensure(!commission.payrollId || commission.amount===amount,'Hoa hồng đã chốt lương; không đổi dịch vụ làm thay đổi hoa hồng.',409);
              if(!commission.payrollId) {
                appointmentBefore!.commissions=serviceCommissions.map(c=>c.toObject());
                commission.amount=amount;commission.serviceName=items.map(item=>item.name).join(' + ');
                commission.serviceId=items.length===1 ? items[0].serviceId : undefined;
                await commission.save({session});
              }
            }
            target.serviceItems=items;target.serviceId=items.length===1 ? items[0].serviceId : undefined;target.commission=amount;
          }
          target.description=d.items && d.description===target.description ? target.serviceItems.map((item:any)=>item.name).join(' + ') : d.description; target.total=d.total; target.dueDate=d.dueDate; target.status=invoiceState(d.total,0);
          await target.save({session});
          if(correctedDate) {
            // Mongoose timestamps make createdAt immutable by default. This scoped
            // correction is part of the same owner-only audited transaction.
            await Invoice.updateOne({...scope,_id:target._id}, {$set:{createdAt:correctedDate,recordedAt:target.recordedAt || appointmentBefore!.createdAt}}, {session,timestamps:false,overwriteImmutable:true});
            target=await get(Invoice,String(target._id));
          }
          linkedInvoiceId=String(target._id);
          break;
        }
        case 'serviceInvoice': {
          const d = schemas.serviceInvoice.parse(data);
          await get(Customer, d.customerId);
          const performer = d.staffId ? await get(User, d.staffId) : undefined;
          ensure(!performer || (performer.active && ['OWNER', 'STAFF'].includes(performer.role)), 'Nhân viên thực hiện không hợp lệ hoặc đã ngừng hoạt động.');
          if (d.dueDate) dayBounds(d.dueDate);
          const serviceItems = [];
          // Sequential reads/writes inside this transaction preserve rollback and session semantics.
          for (const item of d.items) {
            const service = await get(Service, item.serviceId);
            ensure(service.active, 'Dịch vụ đã ngừng hoạt động.');
            const total = invoiceCharge(service.price, item.total, false);
            ensure(total > 0, 'Giá dịch vụ lẻ phải lớn hơn 0.');
            const linePerformer = item.performerId ? await get(User, item.performerId) : undefined;
            ensure(!linePerformer || (linePerformer.active && ['OWNER', 'STAFF'].includes(linePerformer.role)), 'Nhân viên thực hiện dòng không hợp lệ hoặc đã ngừng hoạt động.');
            const legacyPerformer = !d.items.some(entry => entry.performerId) ? performer : undefined;
            serviceItems.push({ serviceId: service._id, name: service.name, total, commission: (linePerformer || legacyPerformer) ? service.commission || 0 : 0, ...(linePerformer ? {performerId:linePerformer._id} : {}) });
          }
          const total = money(serviceItems.reduce((sum, item) => sum + item.total, 0));
          const commission = money(serviceItems.reduce((sum, item) => sum + item.commission, 0), true);
          target = await create(Invoice, { customerId: d.customerId, kind: 'SERVICE', serviceItems,
            ...(serviceItems.length === 1 ? { serviceId: serviceItems[0].serviceId } : {}),
            description: serviceItems.map(item => item.name).join(' + '), total, paid: 0, commission,
            ...(d.dueDate ? { dueDate: d.dueDate } : {}), ...(performer ? {performedBy: performer._id, performedAt: new Date()} : {}) });
          if (performer && d.items.every(item => !item.performerId)) await create(Commission, { staffId: performer._id, staffName: performer.name,
            ...(serviceItems.length === 1 ? { serviceId: serviceItems[0].serviceId } : {}),
            serviceName: target.description, customerId: target.customerId, invoiceId: target._id,
            sourceType: 'INVOICE', sourceId: String(target._id), amount: commission, earnedAt: target.performedAt });
          for (const item of target.serviceItems || []) if (item.performerId && item.commission) {
            const staff = await get(User, String(item.performerId));
            const lineId = item.lineId || new mongoose.Types.ObjectId();
            await create(InvoiceLineCommission, { staffId: staff._id, staffName: staff.name, serviceId: item.serviceId, serviceName: item.name, customerId: target.customerId, invoiceId: target._id, lineId, sourceType: 'INVOICE_LINE', sourceId: lineId, amount: item.commission, earnedAt: new Date() });
          }
          if(d.additionalProducts?.length){ensure(!d.cashCard,'Thẻ tiền chỉ dùng cho hóa đơn chỉ có dịch vụ lẻ.',409);await addProducts(target,d.additionalProducts);}
          if (d.cashCard) await redeemCard({ ...d.cashCard, invoiceId: String(target._id) });
          linkedInvoiceId = String(target._id);
          break;
        }
        case 'invoice': {
          const d = schemas.invoice.parse(data);
          const customer = await get(Customer, d.customerId);
          const service = await get(Service, d.serviceId);
          ensure(!d.cashCard || (!d.treatmentId && !d.treatments?.length), 'Thẻ tiền chỉ dùng cho dịch vụ lẻ.', 409);
          ensure(!(d.treatmentId && d.treatments), 'Chỉ gửi một danh sách liệu trình.');
          const selections = d.treatments || (d.treatmentId ? [{treatmentId:d.treatmentId,signature:d.signature,remainingBefore:d.remainingBefore}] : []);
          if (selections.length) {
            const invoiceSignature = commonSignature(d.signature,selections);
            ensure(new Set(selections.map(item=>item.treatmentId)).size === selections.length, 'Không chọn trùng liệu trình.');
            let combined: any;
            for (const [index,item] of selections.entries()) {
              const plan = await get(Treatment,item.treatmentId);
              const purchase = await get(Invoice,String(plan.invoiceId));
              ensure(String(plan.customerId) === d.customerId && (index > 0 || String(plan.serviceId || purchase.serviceId) === d.serviceId), 'Gói không khớp khách hoặc dịch vụ.');
              const recorded = await recordUse(schemas.use.parse({...item,signature:invoiceSignature,staffId:d.staffId}),undefined,d.staffId || actor.id,combined);
              treatmentUseId ||= String(recorded._id);
              combined = await get(Invoice,linkedInvoiceId!);
            }
            target = combined;
            await addServices(target,d.additionalServices || []);
            await addProducts(target,d.additionalProducts || []);
            if (d.description && selections.length === 1 && !d.additionalServices?.length && !d.additionalProducts?.length) target.description = d.description;
            if (d.consultantId) Object.assign(target, await consultant(customer, d.consultantId));
            await target.save({ session });
            break;
          }
          ensure(service.active, 'Dịch vụ không hoạt động.');
          ensure(!d.additionalServices?.length && !d.additionalProducts?.length,'Dịch vụ thêm chỉ dùng khi ghi buổi liệu trình.');
          ensure(!d.signature && !d.remainingBefore, 'Chỉ dùng chữ ký xác nhận khi chọn liệu trình.');
          if (d.staffId) {
            const performer = await get(User, d.staffId);
            ensure(performer.active && ['OWNER', 'STAFF'].includes(performer.role), 'Người thực hiện phải là chủ spa hoặc nhân viên đang hoạt động.');
          }
          if (d.dueDate) dayBounds(d.dueDate);
          ensure((d.total ?? service.price) > 0, 'Dịch vụ mua lẻ phải có giá lớn hơn 0.');
          const { cashCard, staffId, ...invoiceData } = d;
          target = await create(Invoice, {
            ...invoiceData,
            ...await consultant(customer, d.consultantId), kind: 'SERVICE', commission: service.commission || 0,
            description: d.description || service.name,
            total: invoiceCharge(service.price, d.total, false),
            paid: 0,
          });
          if (cashCard) await redeemCard({ ...cashCard, invoiceId: String(target._id) });
          if (staffId) await accrueCommission(target, staffId, 'INVOICE', String(target._id));
          break;
        }
        case 'sellCashCard': {
          const d = schemas.sellCashCard.parse(data);
          await get(Customer, d.customerId);
          paymentEvidence(d.method, d.receivedConfirmation, d.note);
          const entry = await receipt({ customerId: d.customerId, amount: d.amount, method: d.method, note: d.note || 'Khách mua thẻ tiền', kind: 'CARD_SALE', direction: 'IN' });
          target = await create(CashCard, { customerId: d.customerId, amount: d.amount, balance: d.amount, origin: 'PURCHASE', receiptId: entry._id, actorId: actor.id });
          break;
        }
        case 'redeemCashCard': {
          const d = schemas.redeemCashCard.parse(data);
          target = await redeemCard(d);
          linkedInvoiceId = d.invoiceId;
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
          await syncSaleCommission(invoice,'ALLOCATION',String(target._id));
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
          ensure((invoice.refunded || 0) <= invoice.paid,'Không thể đảo tiền đã hoàn cho khách.');
          await syncSaleCommission(invoice,'REVERSE_ALLOCATION',String(target._id));
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
          await syncSaleCommission(invoice,'PAYMENT',String(target._id));
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
          ensure(!['PAYROLL','REFUND','CARD_SALE'].includes(original.kind), 'Khoản lương, hoàn tiền hoặc mua thẻ không được đảo qua thu chi thông thường.');
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
            ensure((invoice.refunded || 0) <= invoice.paid,'Không thể đảo tiền đã hoàn cho khách.');
            await syncSaleCommission(invoice,'REVERSE_PAYMENT',String(payment._id));
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
          ensure(timedPackage(target) || target.remaining > 0, 'Gói không còn buổi để bảo lưu.');
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
          ensure(target.status === 'PAUSED' && (timedPackage(target) || target.remaining > 0), 'Chỉ mở lại gói đang bảo lưu và còn buổi.', 409);
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
          const existingDay = await Day.findOne({ ...scope, day: d.day }).session(session);
          ensure(!existingDay || existingDay.status === 'OPEN', 'Sổ hôm nay đã chốt. Chủ spa cần dùng Mở lại sổ, không tạo sổ mới.', 409);
          target = existingDay || await create(Day, d);
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
          const expected=target.opening + net('CASH');
          ensure(d.expectedPreview===undefined || d.expectedPreview===expected,'Thu chi đã thay đổi từ lúc xem trước. Tải lại và đối chiếu trước khi chốt.',409);
          target.expected = expected;
          target.bankNet = net('BANK_TRANSFER');
          target.counted = d.counted;
          target.difference = d.counted - target.expected;
          target.note = d.note;
          target.status = 'CLOSED';
          target.closedBy = actor.id;
          target.closedAt = new Date();
          await target.save({ session });
          await ActivityNotification.updateMany({ ...scope, kind: 'DAY_CLOSE', day: d.day, readAt: null }, { $set: { readAt: new Date(), pushState: 'SENT' } }, { session });
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
      if(action!=='checkout') for (const id of createdInvoiceIds.splice(0)) await queueInvoiceNotifications(await get(Invoice,id),session);
      const details = { ...data } as Record<string, unknown>;
      if(action==='checkout')details.checkoutKey=sha(key);
      if (appointmentBefore) {
        details.before = appointmentBefore;
        details.after = op === 'deleteInvoice' ? null : target.toObject();
        if(op === 'updateInvoice' || op === 'cancelInvoice') details.commissionsAfter = await Commission.find({...scope,invoiceId:target._id}).session(session).lean();
        if(op === 'updateInvoice') details.treatmentAfter = await Treatment.findOne({...scope,invoiceId:target._id}).session(session).lean();
      }
      if (financialBefore) {
        details.before = financialBefore;
        details.after = op === 'setServiceCommission' ? { serviceId: target._id, commission: target.commission } : op === 'setStaffSalary' ? { staffId: target._id, baseSalary: target.baseSalary } : payrollSnapshot(target);
      }
      if (replacementAppointmentId) details.replacementAppointmentId = replacementAppointmentId;
      if (linkedInvoiceId) details.invoiceId = linkedInvoiceId;
      delete details.password;
      if (Array.isArray(details.treatments)) {
        details.treatments = details.treatments.map((item: any) => ({treatmentId:item.treatmentId,remainingBefore:item.remainingBefore,...(item.signature ? {signatureDigest:sha(JSON.stringify(item.signature))} : {})}));
        details.evidenceRecorded = !!(data as any).signature || (data as any).treatments.some((item:any)=>!!item.signature);
      }
      if (treatmentUseId) details.treatmentUseId = treatmentUseId;
      if ('signature' in data && data.signature) {
        delete details.evidenceReference;
        delete details.signature;
        details.signatureDigest = sha(JSON.stringify((data as z.infer<typeof schemas.use>).signature));
        details.evidenceRecorded = true;
      }
      if (op === 'openDay' || op === 'closeDay' || op === 'reopenDay') details.daySnapshot = target.toObject();
      if (op === 'openDay') details.opening = target.opening;
      await create(Audit, { actorId: actor.id, action: op, targetId: target._id, details });
      const result = { id: String(target._id), message: op === 'deleteInvoice' ? 'Đã xóa vĩnh viễn hóa đơn nhập nhầm.' : 'Đã lưu thành công.', ...(linkedInvoiceId ? { invoiceId: linkedInvoiceId } : {}), ...(replacementAppointmentId ? { replacementAppointmentId } : {}), ...(treatmentUseId ? { treatmentUseId } : {}) };
      return result;
      };
      let result;
      if(op==='checkout'){
        const batch=schemas.checkout.parse(data);
        const results=[];
        const appointment=batch.appointmentId ? await get(Appointment,batch.appointmentId) : undefined;
        if(appointment) {
          ensure(['CONFIRMED','COMPLETED'].includes(appointment.status),'Lịch đã hủy hoặc hoãn, không thể thu ngân.',409);
          ensure(String(appointment.customerId)===batch.customerId,'Lịch không đúng khách.');
          ensure(appointment.startAt<=new Date(),'Chưa tới thời gian thực hiện lịch.');
          ensure(!await Invoice.exists({...scope,appointmentId:appointment._id}).session(session),'Lịch đã có hóa đơn. Mở hóa đơn đã liên kết.',409);
          ensure(!await TreatmentUse.exists({...scope,appointmentId:appointment._id}).session(session),'Lịch đã ghi buổi. Cần đối chiếu hóa đơn trước.',409);
          const base=batch.actions.find(line=>['invoice','serviceInvoice'].includes(line.action));
          ensure(base,'Chọn đủ dịch vụ/liệu trình đã thực hiện trong lịch.');
          const values:any=schemas[base!.action].parse({...base!.data,customerId:batch.customerId});
          const services=(values.items || values.additionalServices || (!values.treatmentId && !values.treatments?.length && values.serviceId ? [{serviceId:values.serviceId}] : [])).map((item:any)=>String(item.serviceId));
          const treatments=(values.treatments || (values.treatmentId ? [{treatmentId:values.treatmentId}] : [])).map((item:any)=>String(item.treatmentId));
          ensure(coversVisit(appointment,services,treatments),'Chọn đủ dịch vụ/liệu trình của lịch trước khi lưu.');
          ensure(!appointment.staffId || String(appointment.staffId)===values.staffId,'Nhân viên thực hiện không khớp lịch.');
          checkoutAppointmentId=String(appointment._id);
        }
        const kinds=batch.actions.map(line=>line.action==='sellPackage' ? 'package:'+String(line.data.templateId).toLowerCase() : 'base');
        ensure(new Set(kinds).size===kinds.length,'Không chọn trùng gói mới hoặc tạo lặp hóa đơn dịch vụ/sản phẩm trong giỏ.');
        groupedPackageSale=batch.actions.filter(line=>line.action==='sellPackage').length>1;
        if(groupedPackageSale) await ensureGroupedPackageIndex();
        for(const line of batch.actions){
          ensure(line.data.customerId===undefined || line.data.customerId===batch.customerId,'Mọi mục trong giỏ phải cùng khách.');
          const values=schemas[line.action].parse({...line.data,customerId:batch.customerId});
          results.push(await execute(line.action,{...values,...('issuedOn' in data && data.issuedOn?{issuedOn:data.issuedOn}:{})}));
        }
        if(packageInvoice?.giftCashCardAmount) await create(CashCard,{customerId:batch.customerId,amount:packageInvoice.giftCashCardAmount,balance:packageInvoice.giftCashCardAmount,origin:'GIFT',sourceInvoiceId:packageInvoice._id,promotion:packageInvoice.promotion,actorId:actor.id});
        const invoices=[];
        const seenInvoices=new Set<string>();
        for(const item of results){
          const invoice=await get(Invoice,item.invoiceId || item.id);
          if(seenInvoices.has(String(invoice._id))) continue;
          seenInvoices.add(String(invoice._id));
          invoices.push({id:String(invoice._id),code:invoice.code,total:invoice.total});
        }
        if(appointment) {
          const baseIndex=batch.actions.findIndex(line=>['invoice','serviceInvoice'].includes(line.action));
          const item=results[baseIndex];
          await linkVisit(appointment,await get(Invoice,item.invoiceId || item.id),'Hoàn thành lịch qua thu ngân');
        }
        const total=money(invoices.reduce((sum,item)=>sum+item.total,0),true);
        result={id:invoices[0].id,invoiceId:invoices[0].id,invoiceIds:invoices.map(item=>item.id),invoices,total,message:'Đã lưu '+invoices.length+' hóa đơn trong cùng lần thu ngân.'};
      }else result=await execute(op,data);
      if(op==='checkout') for(const id of createdInvoiceIds.splice(0)) await queueInvoiceNotifications(await get(Invoice,id),session);
      await create(Idempotency, { userId: actor.id, key, fingerprint, result });
      return result;
    },
    { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
  );
}
