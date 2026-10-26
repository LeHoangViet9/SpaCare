import { assertDatabaseTarget } from '../src/lib/production-safety.mjs';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { dayBounds, ensure, invoiceState, spaDay } from '../src/lib/rules';
import { allModels, Spa, User, Control, Customer, Service, Appointment, Invoice, Deposit, Allocation, Payment, CashEntry, Treatment, TreatmentUse, Day, Audit, Idempotency } from '../src/lib/models';

// Deliberately isolated: never seed a production DB or use the application's .env.local.
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spacare_demo?replicaSet=rs0&directConnection=true';
assertDatabaseTarget(uri, process.env, 'demo');
const parsed = new URL(uri);
if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || parsed.pathname !== '/spacare_demo') {
  throw new Error('db:demo chỉ được ghi database spacare_demo. Không đổi tên database vận hành để chạy seed.');
}
process.env.MONGODB_URI = uri;
const oid = (key: string) => new mongoose.Types.ObjectId(createHash('sha256').update('spacare-demo-v1:' + key).digest('hex').slice(0, 24));
const spaId = oid('spa');
const markerKey = 'spacare-demo-v1-seed-complete';
const demoPassword = 'SpaCareDemo@2026';
const ids = (name: string, count: number) => Array.from({ length: count }, (_, i) => oid(`${name}:${i}`));

async function main() {
  const checkOnly = process.argv.includes('--check');
  let checked = 0;
  if (!checkOnly) {
    assertDatabaseTarget(process.env.MONGODB_URI || '', process.env, 'demo');
    await connect('demo');
    for (const model of allModels) { await model.createCollection(); await model.createIndexes(); }
  }
  const now = new Date();
  const today = spaDay(now);
  const yesterday = spaDay(new Date(dayBounds(today).start.getTime() - 1));
  const hours = (n: number) => new Date(now.getTime() + n * 3600000);
  const users = ids('user', 4), customers = ids('customer', 8), services = ids('service', 6);
  const appointments = ids('appointment', 13), invoices = ids('invoice', 6), cash = ids('cash', 8), packages = ids('treatment', 2);
  const customerNames = ['Nguyễn Thị Mai', 'Trần Ngọc Linh', 'Lê Hoài An', 'Phạm Minh Thu', 'Đỗ Thu Trang', 'Vũ Thị Hạnh', 'Bùi Khánh Vy', 'Hoàng Thanh Hà'];
  const serviceData = [
    { name: 'Chăm sóc da cơ bản', price: 350000, duration: 60 },
    { name: 'Massage body chuyên sâu', price: 600000, duration: 90 },
    { name: 'Gội đầu dưỡng sinh', price: 300000, duration: 45 },
    { name: 'Gói chăm sóc da 10 buổi', price: 2000000, duration: 60 },
    { name: 'Gói massage thư giãn 5 buổi', price: 1500000, duration: 60 },
    { name: 'Chăm sóc da chuyên sâu', price: 450000, duration: 75 },
  ];
  let inserted = false;
  const seed = async (session?: mongoose.ClientSession) => {
    inserted = false;
    if (!checkOnly && await Idempotency.exists({ spaId, key: markerKey }).session(session || null)) return;
    // If someone manually created colliding identifiers, fail without changing those records.
    const fixtures = new Map<string, Record<string, any>[]>();
    const write = async (model: mongoose.Model<any>, rows: Record<string, unknown>[]) => {
      const scoped = rows.map(row => ({ spaId, ...row }));
      fixtures.set(model.modelName, scoped);
      if (checkOnly) { for (const row of scoped) { await new model(row).validate(); checked += 1; } }
      else if (scoped.length) await model.create(scoped, { session, ordered: true });
    };
    const spa = { _id: spaId, name: 'SpaCare Demo — dữ liệu giả', timezone: 'Asia/Ho_Chi_Minh' };
    if (checkOnly) { await new Spa(spa).validate(); checked += 1; } else await Spa.create([spa], { session });
    await write(Control, [{ revision: 0 }]);
    await write(User, [
      { _id: users[0], name: 'Chủ spa Demo', email: 'owner@demo.spacare.test', role: 'OWNER', cashier: true },
      { _id: users[1], name: 'Nguyễn Lan — Kỹ thuật viên', email: 'lan@demo.spacare.test', role: 'STAFF', cashier: false },
      { _id: users[2], name: 'Trần Hoa — Kỹ thuật viên', email: 'hoa@demo.spacare.test', role: 'STAFF', cashier: false },
      { _id: users[3], name: 'Lê An — Thu ngân', email: 'cashier@demo.spacare.test', role: 'STAFF', cashier: true },
    ].map(row => ({ ...row, passwordHash: hashPassword(demoPassword), active: true })));
    await write(Customer, customers.map((_id, i) => ({ _id, name: customerNames[i], phone: `090100000${i + 1}`, notes: 'Dữ liệu giả để thực hành SpaCare; không liên hệ số điện thoại này.' })));
    await write(Service, serviceData.map((row, i) => ({ _id: services[i], ...row, active: true })));
    const appointment = (i: number, customer: number, service: number, staff: number, startAt: Date, status: string, extra = {}) => ({ _id: appointments[i], customerId: customers[customer], serviceId: services[service], staffId: users[staff], startAt, endAt: new Date(startAt.getTime() + serviceData[service].duration * 60000), status, notes: 'Lịch mẫu', ...extra });
    await write(Appointment, [
      appointment(0, 0, 0, 1, hours(-6), 'COMPLETED'),
      appointment(1, 1, 1, 2, hours(-4), 'COMPLETED'),
      appointment(2, 2, 2, 1, hours(-3), 'COMPLETED'),
      appointment(3, 5, 5, 2, hours(-2), 'COMPLETED'),
      appointment(4, 3, 3, 1, hours(-72), 'COMPLETED', { treatmentId: packages[0] }),
      appointment(5, 3, 3, 1, hours(-48), 'COMPLETED', { treatmentId: packages[0] }),
      appointment(6, 3, 3, 1, hours(-24), 'COMPLETED', { treatmentId: packages[0] }),
      appointment(7, 3, 3, 1, hours(2), 'CONFIRMED', { treatmentId: packages[0] }),
      appointment(8, 4, 4, 2, hours(3), 'CONFIRMED', { treatmentId: packages[1] }),
      appointment(9, 6, 0, 1, hours(4), 'CONFIRMED'),
      appointment(10, 7, 2, 2, hours(5), 'POSTPONED', { changeReason: 'Khách bận, chờ chốt giờ mới.' }),
      appointment(11, 7, 0, 1, hours(6), 'CANCELLED', { changeReason: 'Khách hủy cuộc hẹn mẫu.' }),
      appointment(12, 7, 0, 1, hours(-0.5), 'CONFIRMED', { notes: 'Có thể bấm hoàn thành ngay để thử tự tạo hóa đơn.' }),
    ]);
    const invoice = (i: number, customer: number, service: number, paid: number, appointmentIndex?: number) => ({ _id: invoices[i], customerId: customers[customer], serviceId: services[service], description: serviceData[service].name, total: serviceData[service].price, paid, status: invoiceState(serviceData[service].price, paid), dueDate: today, ...(appointmentIndex === undefined ? {} : { appointmentId: appointments[appointmentIndex] }) });
    await write(Invoice, [invoice(0, 0, 0, 350000, 0), invoice(1, 1, 1, 200000, 1), invoice(2, 2, 2, 300000, 2), invoice(3, 3, 3, 2000000), invoice(4, 4, 4, 1500000), invoice(5, 5, 5, 0, 3)]);
    const entry = (i: number, amount: number, direction: string, method: string, kind: string, note: string, customer?: number) => ({ _id: cash[i], amount, direction, method, kind, note, day: today, actorId: users[3], ...(customer === undefined ? {} : { customerId: customers[customer] }) });
    await write(CashEntry, [
      entry(0, 500000, 'IN', 'CASH', 'DEPOSIT', 'Mai cọc 500k, đã áp 350k', 0),
      entry(1, 200000, 'IN', 'CASH', 'PAYMENT', 'Linh trả trước 200k, còn nợ 400k', 1),
      entry(2, 300000, 'IN', 'BANK_TRANSFER', 'PAYMENT', 'An đã chuyển khoản đủ', 2),
      entry(3, 2000000, 'IN', 'BANK_TRANSFER', 'PAYMENT', 'Thu thanh toán gói 10 buổi', 3),
      entry(4, 1500000, 'IN', 'CASH', 'PAYMENT', 'Trang thanh toán gói 5 buổi', 4),
      entry(5, 200000, 'IN', 'BANK_TRANSFER', 'DEPOSIT', 'Hạnh cọc chưa áp vào hóa đơn', 5),
      entry(6, 150000, 'OUT', 'CASH', 'EXPENSE', 'Mua vật tư mẫu'),
      entry(7, 50000, 'IN', 'CASH', 'INCOME', 'Thu khác mẫu'),
    ]);
    await write(Deposit, [
      { _id: oid('deposit:0'), customerId: customers[0], amount: 500000, balance: 150000, receiptId: cash[0], note: 'Cọc dư giữ lần sau' },
      { _id: oid('deposit:1'), customerId: customers[5], amount: 200000, balance: 200000, receiptId: cash[5], note: 'Chưa phân bổ; có thể thử áp cọc' },
    ]);
    await write(Allocation, [{ depositId: oid('deposit:0'), invoiceId: invoices[0], amount: 350000, approvedBy: users[0], reason: 'Phân bổ cọc mẫu, không thu thêm tiền.' }]);
    await write(Payment, [1, 2, 3, 4].map(i => ({ invoiceId: invoices[i], amount: [0, 200000, 300000, 2000000, 1500000][i], receiptId: cash[i] })));
    await write(Treatment, [
      { _id: packages[0], customerId: customers[3], invoiceId: invoices[3], serviceId: services[3], name: 'Thu — chăm sóc da 10 buổi', totalSessions: 10, remaining: 7, status: 'ACTIVE' },
      { _id: packages[1], customerId: customers[4], invoiceId: invoices[4], serviceId: services[4], name: 'Trang — massage 5 buổi', totalSessions: 5, remaining: 5, status: 'ACTIVE' },
    ]);
    await write(TreatmentUse, [0, 1, 2].map(i => {
      const performedAt = hours(-72 + i * 24);
      const evidenceReference = `DEMO-PHIEU-00${i + 1}`;
      const snapshot = JSON.stringify({ treatmentId: String(packages[0]), appointmentId: String(appointments[4 + i]), customerId: String(customers[3]), name: 'Thu — chăm sóc da 10 buổi', sessionNumber: i + 1, performedAt: performedAt.toISOString(), method: 'SIGNATURE_REFERENCE', reason: '', evidenceReference });
      return { appointmentId: appointments[4 + i], treatmentId: packages[0], actorId: users[1], performedAt, method: 'SIGNATURE_REFERENCE', reason: '', evidenceReference, snapshot, digest: createHash('sha256').update(snapshot).digest('hex') };
    }));
    await write(Day, [
      { day: today, opening: 1000000, status: 'OPEN' },
      { day: yesterday, opening: 500000, expected: 500000, counted: 480000, difference: -20000, bankNet: 0, status: 'CLOSED', closedBy: users[0], closedAt: dayBounds(today).start, note: 'Chốt mẫu thiếu 20k; không tự cân sổ.' },
    ]);
    await write(Audit, [{ actorId: users[0], action: 'demo_seed', targetId: spaId, details: { fixture: 'spacare-demo-v1', synthetic: true, message: 'Tạo dữ liệu giả trong một transaction; không phải giao dịch thực tế.' } }]);
    await write(Idempotency, [{ userId: users[0], key: markerKey, fingerprint: 'spacare-demo-v1', result: { id: String(spaId), message: 'Demo fixtures initialized' } }]);
    const rows = (name: string) => fixtures.get(name) || [];
    for (const invoice of rows('Invoice')) {
      const payments = rows('Payment').filter(p => String(p.invoiceId) === String(invoice._id)).reduce((sum, p) => sum + p.amount, 0);
      const allocations = rows('Allocation').filter(a => String(a.invoiceId) === String(invoice._id)).reduce((sum, a) => sum + a.amount, 0);
      ensure(invoice.paid === payments + allocations, 'Fixture invoice không khớp Payment/Allocation.');
      ensure(invoice.status === invoiceState(invoice.total, invoice.paid), 'Fixture invoice sai trạng thái.');
    }
    for (const deposit of rows('Deposit')) {
      const applied = rows('Allocation').filter(a => String(a.depositId) === String(deposit._id)).reduce((sum, a) => sum + a.amount, 0);
      ensure(deposit.balance === deposit.amount - applied, 'Fixture cọc sai số dư.');
    }
    for (const treatment of rows('Treatment')) {
      const used = rows('TreatmentUse').filter(u => String(u.treatmentId) === String(treatment._id)).length;
      ensure(treatment.remaining === treatment.totalSessions - used, 'Fixture gói sai số buổi.');
    }
    for (const payment of rows('Payment')) {
      const receipt = rows('CashEntry').find(c => String(c._id) === String(payment.receiptId));
      ensure(receipt?.kind === 'PAYMENT' && receipt.amount === payment.amount && receipt.direction === 'IN', 'Fixture Payment không khớp khoản thu.');
    }
    inserted = true;
  };
  if (checkOnly) {
    await seed();
    console.log(`Đã kiểm tra schema ${checked} bản ghi demo; chưa kết nối hoặc ghi database, chưa kiểm chứng indexes/transaction.`);
    return;
  }
  await mongoose.connection.transaction(seed);
  console.log(inserted ? 'Đã tạo dữ liệu mẫu trong spacare_demo.' : 'Dữ liệu mẫu đã có; giữ nguyên các thao tác/mật khẩu bạn đã thay đổi, không seed lại.');
  console.log('Tài khoản mẫu: owner@demo.spacare.test | cashier@demo.spacare.test | lan@demo.spacare.test | hoa@demo.spacare.test');
  console.log('Mật khẩu demo không được ghi ra log.');
  console.log('Để mở giao diện demo: chạy npm run dev:demo, rồi truy cập http://localhost:3000.');
}

main().catch(error => {
  console.error('Không tạo được dữ liệu demo. Kiểm tra MongoDB replica set/quyền kết nối; dữ liệu seed được ghi cùng transaction.');
  // Do not log a full driver error/URI, which may contain connection credentials.
  console.error(error?.code ? `Mã lỗi: ${error.code}` : error?.name || 'UnknownError');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
