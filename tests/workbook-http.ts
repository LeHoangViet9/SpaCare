// Executable workbook cases. Only a dedicated app backed by spacare_test is allowed.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { allModels, Spa, User, Control, Customer, Service, Appointment, Invoice, Deposit, Allocation, Payment, CashEntry, Treatment, TreatmentUse, Day, Audit, Session, LoginAttempt } from '../src/lib/models';
import { hashPassword, hash } from '../src/lib/password';
import { spaDay } from '../src/lib/rules';

const uri = process.env.MONGODB_URI || '';
assert.equal(new URL(uri).pathname, '/spacare_test', 'Only spacare_test is allowed.');
const base = process.env.TEST_APP_ORIGIN || 'http://127.0.0.1:3100';
assert.equal(new URL(base).hostname, '127.0.0.1');
assert.equal(new URL(base).port, '3100', 'Use the dedicated app, not the operational app.');
const output = process.env.TEST_REPORT_DIRECTORY || 'outputs/test-review-20261021';
const results: any[] = [];
const password = randomBytes(24).toString('base64url');
const passwordHash = hashPassword(password);
const now = new Date();
const future = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString();
const dateTomorrow = spaDay(new Date(now.getTime() + 86400000));
const sid = (doc: any) => String(doc._id);
const count = (model: any, spaId: any) => model.countDocuments({ spaId });
const dbGet = (model: any, f: any, id: string) => model.findOne({ spaId: f.spaId, _id: id });
async function request(path: string, cookie = '', body?: any, origin = base, key = randomUUID()) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text), cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}
async function op(f: any, action: string, data: any, expected = 200, who = 'owner', key = randomUUID()) {
  const r = await request('/api/operations', f.cookies[who], { action, data }, base, key);
  assert.equal(r.status, expected, `${action}: ${r.body.error || r.status}`);
  return r.body;
}
async function fixture(opened = true) {
  const spa = await Spa.create({ name: 'WORKBOOK-' + randomUUID() });
  const f: any = { spaId: spa._id, cookies: {}, users: {}, emails: [] };
  try {
  await Control.create({ spaId: spa._id });
  for (const [role, cashier] of [['owner', true], ['staff', false], ['cashier', true], ['other', false]] as const) {
    const email = role + '-' + randomUUID() + '@example.test';
    const user = await User.create({ spaId: spa._id, name: role, email, passwordHash, role: role === 'owner' ? 'OWNER' : 'STAFF', cashier });
    f.users[role] = user; f.emails.push(email);
    const login = await request('/api/auth/login', '', { email, password });
    assert.equal(login.status, 200, 'Test account login must succeed before test mutations.');
    f.cookies[role] = login.cookie;
  }
  const workspace = await request('/api/workspace', f.cookies.owner);
  assert.equal(workspace.status, 200);
  assert.equal(workspace.body.user.spaId, String(f.spaId), 'The HTTP app must use the same spacare_test database.');
  f.customer = await Customer.create({ spaId: f.spaId, name: 'KH-A', phone: '0900000001' });
  f.otherCustomer = await Customer.create({ spaId: f.spaId, name: 'KH-B', phone: '0900000002' });
  f.service = await Service.create({ spaId: f.spaId, name: 'DV-A', price: 350000, duration: 60 });
  if (opened) await op(f, 'openDay', { day: spaDay(), opening: 1000000 });
  return f;
  } catch (error) { await cleanup(f); throw error; }
}
async function cleanup(f: any) {
  const spaIds = [f.spaId, ...(f.extraSpaIds || [])];
  for (const model of allModels) if (model.schema.path('spaId')) await model.deleteMany({ spaId: { $in: spaIds } });
  for (const email of f.emails) await LoginAttempt.deleteMany({ key: { $in: [-1,0,1].map(offset => hash(email + ':' + (Math.floor(Date.now()/900000)+offset))) } });
  await Spa.deleteMany({ _id: { $in: spaIds } });
}
async function run(id: string, fn: (f: any) => Promise<string>, opened = true) {
  let f: any;
  try {
    f = await fixture(opened);
    const actual = await fn(f);
    results.push({ id, status: 'Pass', actual, method: 'HTTP + MongoDB', time: new Date().toISOString() });
  } catch (error) {
    results.push({ id, status: 'Fail', actual: (error as Error).message, method: 'HTTP + MongoDB', time: new Date().toISOString() });
  } finally {
    if (f) await cleanup(f);
    await fs.writeFile(output + '/http-results.json', JSON.stringify(results, null, 2));
    console.log(id + ': ' + results.at(-1).status);
  }
}
const bill = async (f: any, service = f.service, customer = f.customer) => op(f, 'invoice', { customerId: sid(customer), serviceId: sid(service) });
const credit = async (f: any, amount = 500000, customer = f.customer) => op(f, 'deposit', { customerId: sid(customer), amount, method: 'CASH' });
const booking = async (f: any, hours = 24, extras: any = {}) => op(f, 'appointment', { customerId: sid(f.customer), serviceId: sid(f.service), staffId: sid(f.users.staff), startAt: future(hours), ...extras });
async function pastBooking(f: any, extras: any = {}) {
  return Appointment.create({ spaId: f.spaId, customerId: f.customer._id, serviceId: f.service._id, staffId: f.users.staff._id, startAt: new Date(now.getTime()-3600000), endAt: now, ...extras });
}
async function plan(f: any, totalSessions = 10) {
  return op(f, 'sellPackage', { customerId: sid(f.customer), serviceId: sid(f.service), name: 'Gói test', totalSessions, total: 2000000, dueDate: dateTomorrow });
}
const evidence = { signature: { version: 1, strokes: [[[0.1,0.6],[0.3,0.2],[0.8,0.7]]] } };
const receive = { method: 'CASH', receivedConfirmation: true };

await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
try {
  for (const model of allModels) { await model.createCollection(); await model.createIndexes(); }
  await run('TC-AUTH-02', async f => {
    const wrong = await request('/api/auth/login','',{ email:f.users.owner.email,password:'incorrect-test-input' });
    assert.equal(wrong.status,401); assert.equal((await request('/api/workspace')).status,401);
    return 'HTTP login sai mật khẩu=401; workspace không cookie=401.';
  });
  await run('TC-AUTH-03', async f => {
    const before = await count(CashEntry,f.spaId);
    await op(f,'cash',{direction:'IN',amount:1000,method:'CASH',note:'test'},403,'staff');
    assert.equal(await count(CashEntry,f.spaId),before);
    const data=(await request('/api/workspace',f.cookies.staff)).body;
    assert.equal(data.audit.length,0);assert.equal(data.days.length,0);
    return 'STAFF gọi cash trả HTTP 403, không thêm khoản thu; quyền đọc theo phạm vi mới, không cấm toàn bộ tài chính.';
  });
  await run('TC-CUS-01', async f => {
    const created=await op(f,'customer',{name:'Khách mới',phone:'0900000003'});
    const data=(await request('/api/workspace',f.cookies.owner)).body;
    assert.equal(data.customers.filter((c:any)=>c._id===created.id&&c.name==='Khách mới'&&c.phone==='0900000003').length,1);
    return 'HTTP tạo khách=200; GET lại workspace thấy đúng một khách với tên/SĐT đã gửi.';
  });
  await run('TC-CUS-02', async f => {
    await op(f,'customer',{name:'Duplicate',phone:'+84 900 000 001'},409);
    assert.equal(await count(Customer,f.spaId),2);return 'HTTP 409 với +84 khác định dạng; số khách giữ nguyên=2.';
  });
  await run('TC-CUS-03', async f => {
    await op(f,'updateCustomer',{id:sid(f.customer),name:'Tên mới',phone:'0900000001'});
    await op(f,'updateCustomer',{id:sid(f.customer),name:'Không lưu',phone:'0900000002'},409);
    const c=await dbGet(Customer,f,sid(f.customer));assert.equal(c.name,'Tên mới');assert.equal(c.phone,'0900000001');
    return 'Giữ số chính mình: HTTP 200; đổi sang số KH-B:409; DB giữ tên mới/SĐT cũ.';
  });
  await run('TC-STAFF-01', async f => {
    await op(f,'user',{name:'Duplicate',email:f.users.staff.email.toUpperCase(),password:randomUUID()},409);
    assert.equal(await count(User,f.spaId),4);return 'Email viết hoa của STAFF hiện hữu trả HTTP 409; không tạo tài khoản thứ hai.';
  });
  await run('TC-STAFF-02', async f => {
    await op(f,'updateUser',{id:sid(f.users.staff),name:'Đã sửa',email:f.users.staff.email,cashier:false});
    await op(f,'userStatus',{id:sid(f.users.staff),active:false});
    await op(f,'customer',{name:'Denied',phone:'0900000004'},401,'staff');
    await op(f,'userStatus',{id:sid(f.users.staff),active:true});
    await op(f,'customer',{name:'Allowed',phone:'0900000004'},200,'staff');
    assert.equal((await dbGet(User,f,sid(f.users.staff))).name,'Đã sửa');return 'Sửa/khóa/mở lại=200; phiên cũ khi khóa trả401; sau mở ghi được200.';
  });
  await run('TC-STAFF-03', async f => {
    await op(f,'userStatus',{id:sid(f.users.owner),active:false},403);
    assert.equal((await dbGet(User,f,sid(f.users.owner))).active,true);return 'Chính OWNER gọi khóa OWNER trả403; active vẫn true.';
  });
  await run('TC-SVC-01', async f => {
    const first=await bill(f); await op(f,'updateService',{id:sid(f.service),name:'DV-A',price:400000,duration:60});
    const second=await bill(f);assert.equal((await dbGet(Invoice,f,first.id)).total,350000);assert.equal((await dbGet(Invoice,f,second.id)).total,400000);
    return 'Hai invoice thực tế giữ total lần lượt350000 và400000 sau sửa giá; fixture riêng được dọn.';
  });
  await run('TC-SVC-02', async f => {
    for(const duration of [4,5,6,479,480,481]) {
      const good=duration>=5&&duration<=480;
      const r=await op(f,'service',{name:'Duration '+duration,price:350000,duration},good?200:400);
      if(good) assert.equal((await dbGet(Service,f,r.id)).duration,duration);
    }
    return 'HTTP:4/481=400;5/6/479/480=200; DB lưu đúng duration, không làm tròn.';
  });
  await run('TC-SVC-03-API', async f => {
    const i=await bill(f);await op(f,'serviceStatus',{id:sid(f.service),active:false});
    await op(f,'invoice',{customerId:sid(f.customer),serviceId:sid(f.service)},400);
    assert.ok(await dbGet(Invoice,f,i.id));assert.equal((await dbGet(Service,f,sid(f.service))).active,false);
    return 'Backend từ chối invoice dịch vụ ngừng; hóa đơn cũ còn. Phần danh sách chọn UI kiểm tra riêng.';
  });
  await run('TC-APT-01', async f => {
    const at=(t:string)=>dateTomorrow+'T'+t+':00+07:00';
    const a=await booking(f,24,{startAt:at('09:00')});
    await op(f,'appointment',{customerId:sid(f.customer),serviceId:sid(f.service),staffId:sid(f.users.staff),startAt:at('09:30')},409);
    await booking(f,24,{startAt:at('10:00')});const saved=await dbGet(Appointment,f,a.id);
    assert.equal(saved.endAt-saved.startAt,3600000);return '09:00=200,09:30=409,10:00=200; thời lượng thực tế60 phút.';
  });
  await run('TC-APT-02', async f => {
    await op(f,'appointment',{customerId:sid(f.customer),serviceId:sid(f.service),staffId:sid(f.users.staff),startAt:future(-1)},400);
    const a=await booking(f);await op(f,'completeAppointment',{id:a.id},400);
    await op(f,'appointmentStatus',{id:a.id,status:'CANCELLED'});await op(f,'appointmentStatus',{id:a.id,status:'CANCELLED'},400);
    assert.equal(await count(CashEntry,f.spaId),0);assert.equal(await count(TreatmentUse,f.spaId),0);return 'Quá khứ/hoàn thành sớm/hủy lần hai đều400; hủy đầu200; không có tiền/buổi.';
  });
  await run('TC-APT-03', async f => {
    const a=await booking(f);await op(f,'serviceStatus',{id:sid(f.service),active:false},409);await op(f,'userStatus',{id:sid(f.users.staff),active:false},409);
    assert.equal((await dbGet(Service,f,sid(f.service))).active,true);assert.equal((await dbGet(User,f,sid(f.users.staff))).active,true);
    await op(f,'appointmentStatus',{id:a.id,status:'CANCELLED'});await op(f,'serviceStatus',{id:sid(f.service),active:false});await op(f,'userStatus',{id:sid(f.users.staff),active:false});
    return 'Có lịch: ngừng dịch vụ/STAFF=409, giữ active; hủy lịch rồi ngừng=200.';
  });
  await run('TC-DAY-01', async f => {
    await op(f,'deposit',{customerId:sid(f.customer),amount:500000,method:'CASH'},400);
    assert.equal(await count(Deposit,f.spaId),0);assert.equal(await count(CashEntry,f.spaId),0);
    await op(f,'openDay',{day:spaDay(),opening:1000000});const d=await Day.findOne({spaId:f.spaId});assert.equal(d.status,'OPEN');assert.equal(d.opening,1000000);assert.equal(await count(CashEntry,f.spaId),0);
    return 'Chưa mở sổ: nhận cọc400,0 Deposit/0 CashEntry; mở sổ200 opening1000000 không sinh khoản thu.';
  },false);
  await run('TC-DAY-02', async f => {
    for(const data of [{day:spaDay(),opening:2},{day:spaDay(),opening:-1},{day:dateTomorrow,opening:1}])await op(f,'openDay',data,400);
    assert.equal(await count(Day,f.spaId),1);assert.equal((await Day.findOne({spaId:f.spaId})).opening,1000000);return 'Mở trùng/âm/ngày mai đều400; một Day, opening1000000 nguyên.';
  });
  await run('TC-DEP-01', async f => {
    const i=await bill(f),d=await credit(f);const before=await count(CashEntry,f.spaId);
    await op(f,'allocate',{depositId:d.id,invoiceId:i.id,amount:350000,reason:'Test'});
    assert.equal((await dbGet(Deposit,f,d.id)).balance,150000);assert.equal((await dbGet(Invoice,f,i.id)).paid,350000);assert.equal(await count(CashEntry,f.spaId),before);
    return 'Cọc500000 áp350000 còn150000; paid350000; chỉ một CashEntry thu500000.';
  });
  await run('TC-DEP-02', async f => {
    const i=await bill(f),d=await credit(f,150000),j=await bill(f,f.service,f.otherCustomer);
    await op(f,'payment',{invoiceId:i.id,amount:250000,...receive});
    for(const [invoiceId,amount] of [[i.id,150001],[i.id,100001],[j.id,50000]])await op(f,'allocate',{depositId:d.id,invoiceId,amount,reason:'Invalid allocation'},400);
    assert.equal((await dbGet(Deposit,f,d.id)).balance,150000);assert.equal((await dbGet(Invoice,f,i.id)).paid,250000);return 'Vượt cọc/vượt nợ/khác khách đều400; balance150000 và paid250000 không đổi.';
  });
  await run('TC-DEP-03', async f => {
    const d=await credit(f),a=await booking(f);const before=await count(CashEntry,f.spaId);await op(f,'appointmentStatus',{id:a.id,status:'CANCELLED'});
    assert.equal((await dbGet(Deposit,f,d.id)).balance,500000);assert.equal(await count(CashEntry,f.spaId),before);return 'Hủy lịch200, cọc500000 giữ nguyên, không thêm hoàn/đảo.';
  });
  await run('TC-INV-01', async f => {
    const p=await plan(f),d=await credit(f);await op(f,'allocate',{depositId:d.id,invoiceId:p.invoiceId,amount:500000,reason:'Test'});
    await op(f,'payment',{invoiceId:p.invoiceId,amount:1000000,method:'BANK_TRANSFER',receivedConfirmation:true,transferReference:'GROUP-PHOTO-TEST'});
    const i=await dbGet(Invoice,f,p.invoiceId);assert.equal(i.paid,1500000);assert.equal(i.total-i.paid,500000);
    assert.equal(await Payment.countDocuments({spaId:f.spaId,invoiceId:i._id}),1);assert.equal((await CashEntry.findOne({spaId:f.spaId,kind:'PAYMENT'})).method,'BANK_TRANSFER');return 'Hóa đơn2000000:áp500000+chuyển khoản1000000=>paid1500000,nợ500000;1 Payment.';
  });
  await run('TC-INV-02', async f => {
    const p=await plan(f);await op(f,'payment',{invoiceId:p.invoiceId,amount:1500000,...receive});const before=await count(CashEntry,f.spaId);
    for(const amount of [500001,0,-1,0.5])await op(f,'payment',{invoiceId:p.invoiceId,amount,...receive},400);
    assert.equal((await dbGet(Invoice,f,p.invoiceId)).paid,1500000);assert.equal(await count(CashEntry,f.spaId),before);return '500001/0/-1/0.5 đều HTTP400; paid1500000 và số khoản thu không đổi.';
  });
  await run('TC-TRT-01', async f => {
    const p=await plan(f);for(let n=1;n<=3;n++)await op(f,'use',{treatmentId:p.id,...evidence,remainingBefore:11-n});
    const uses=await TreatmentUse.find({spaId:f.spaId,treatmentId:p.id});assert.equal(uses.length,3);assert.equal((await dbGet(Treatment,f,p.id)).remaining,7);
    for(const u of uses){assert.ok(u.actorId);assert.ok(u.performedAt);assert.ok(u.signatureDigest);assert.equal(u.method,'DRAWN_SIGNATURE');}
    return '3 HTTP use thành công; DB có3 Use đủ actor/thời điểm/digest chữ ký;remaining7/10.';
  });
  await run('TC-TRT-02', async f => {
    const p=await plan(f);await op(f,'use',{treatmentId:p.id,method:'ALTERNATIVE',reason:'',evidenceReference:'TEST-MSG'},400);
    assert.equal((await dbGet(Treatment,f,p.id)).remaining,10);
    await op(f,'use',{treatmentId:p.id,...evidence,remainingBefore:10});
    assert.equal((await dbGet(Treatment,f,p.id)).remaining,9);return 'Client cũ không có chữ ký400/không trừ; chữ ký trên màn hình200/trừ1.';
  });
  await run('TC-SIGN-01', async f => {
    const p=await plan(f,3),payload={treatmentId:p.id,...evidence,remainingBefore:3};
    const before=await count(TreatmentUse,f.spaId);
    const r=await op(f,'use',payload,200,'staff');
    const view=await request('/api/treatment-uses/'+r.id,f.cookies.staff);
    assert.equal(view.status,200);assert.deepEqual(view.body.signature,evidence.signature);
    assert.equal(view.body.snapshot.remainingBefore,3);assert.equal(view.body.snapshot.customerId,sid(f.customer));
    assert.equal((await request('/api/treatment-uses/'+r.id,f.cookies.owner)).status,200);
    assert.equal((await request('/api/treatment-uses/'+r.id,f.cookies.other)).status,403);
    assert.equal((await request('/api/treatment-uses/'+r.id,'')).status,401);
    const list=(await request('/api/workspace',f.cookies.staff)).body;
    const row=list.uses.find((u:any)=>u._id===r.id);assert.ok(row);assert.equal(row.signature,undefined);assert.equal(row.snapshot,undefined);
    const key=randomUUID(),next={...payload,remainingBefore:2};
    const x=await op(f,'use',next,200,'staff',key),y=await op(f,'use',next,200,'staff',key);assert.equal(x.id,y.id);
    await op(f,'use',next,409,'staff');assert.equal(await count(TreatmentUse,f.spaId),before+2);
    return 'HTTP chữ ký: chính mình/OWNER200;người khác403;chưa login401;workspace không lộ nét ký;retry/stale không trừ lại.';
  });
  await run('TC-CASH-01', async f => {
    const c=await op(f,'cash',{direction:'IN',amount:100000,method:'CASH',note:'Test'});
    await op(f,'reverseCash',{id:c.id,reason:'Sai khoản'},403,'cashier');const r=await op(f,'reverseCash',{id:c.id,reason:'Sai khoản'});await op(f,'reverseCash',{id:c.id,reason:'Lặp'},400);
    const original=await dbGet(CashEntry,f,c.id),contra=await dbGet(CashEntry,f,r.id);assert.equal(original.reversed,true);assert.equal(contra.direction,'OUT');assert.equal(contra.kind,'REVERSAL');assert.equal(contra.amount,100000);
    return 'Thu ngân403; OWNER đảo200 tạo OUT/REVERSAL100000; bản gốc còn/reversed; đảo lần2=400.';
  });
  await run('TC-DAY-03', async f => {
    await op(f,'cash',{direction:'IN',amount:2000000,method:'CASH',note:'Thu'});await op(f,'cash',{direction:'OUT',amount:500000,method:'CASH',note:'Chi'});await op(f,'cash',{direction:'IN',amount:700000,method:'BANK_TRANSFER',note:'Không tăng quỹ mặt'});
    const before=await count(CashEntry,f.spaId);await op(f,'closeDay',{day:spaDay(),counted:2450000});const d=await Day.findOne({spaId:f.spaId});assert.equal(d.expected,2500000);assert.equal(d.difference,-50000);assert.equal(d.status,'CLOSED');assert.equal(await count(CashEntry,f.spaId),before);return 'Day.expected2500000,difference-50000,CLOSED; chuyển khoản không cộng quỹ mặt;không có khoản cân sổ.';
  });
  await run('TC-DAY-04', async f => {
    await op(f,'closeDay',{day:spaDay(),counted:1000000});const cash={direction:'IN',amount:1000,method:'CASH',note:'Test'};await op(f,'cash',cash,400);await op(f,'reopenDay',{day:spaDay(),reason:'Test'},403,'cashier');await op(f,'reopenDay',{day:spaDay(),reason:'Test'});await op(f,'cash',cash);
    assert.equal(await Audit.countDocuments({spaId:f.spaId,action:'reopenDay'}),1);return 'Sổ đóng ghi tiền400;thu ngân mở403;OWNER mở200 có audit;rồi ghi1000 thành công.';
  });
  await run('TC-API-01', async f => {
    const key=randomUUID(),d={customerId:sid(f.customer),amount:500000,method:'CASH'};const a=await op(f,'deposit',d,200,'owner',key),b=await op(f,'deposit',d,200,'owner',key);assert.equal(a.id,b.id);await op(f,'deposit',{...d,amount:500001},409,'owner',key);assert.equal(await count(Deposit,f.spaId),1);assert.equal(await count(CashEntry,f.spaId),1);return 'Cùng key/payload:cùng id,1 Deposit/1 CashEntry;đổi amount409.';
  });
  await run('TC-API-02', async f => {
    const body={action:'customer',data:{name:'No write',phone:'0900000099'}};assert.equal((await request('/api/operations',f.cookies.owner,body,'http://wrong.example.test')).status,403);assert.equal((await request('/api/operations','',body)).status,401);assert.equal(await count(Customer,f.spaId),2);return 'Origin sai403;đúng Origin không cookie401;không thêm khách.';
  });
  await run('TC-API-03', async f => {
    const other=await Spa.create({name:'Foreign fixture'});f.extraSpaIds=[other._id];const c=await Customer.create({spaId:other._id,name:'Foreign',phone:'0900000099'});await op(f,'invoice',{customerId:sid(c),serviceId:sid(f.service)},404);assert.equal(await count(Invoice,f.spaId),0);return 'Customer ID có thật thuộc spa B:HTTP404;spa A không có invoice mới.';
  });
  for (const n of [4,5,6,7,8,9,10,11]) await run('TC-APT-'+String(n).padStart(2,'0'),async f=>{
    const a=await booking(f,30);const move={id:a.id,staffId:sid(f.users.staff),startAt:future(34),reason:'Khách đổi giờ'};
    if(n===4){await op(f,'rescheduleAppointment',move);const s=await dbGet(Appointment,f,a.id);assert.equal(s.startAt.toISOString(),move.startAt);assert.equal(s.endAt-s.startAt,3600000);assert.equal(s.status,'CONFIRMED');}
    if(n===5){await op(f,'appointmentStatus',{id:a.id,status:'POSTPONED',reason:'Chưa chốt giờ'});await booking(f,30);assert.equal((await dbGet(Appointment,f,a.id)).status,'POSTPONED');}
    if(n===6){await op(f,'appointmentStatus',{id:a.id,status:'POSTPONED',reason:'Hoãn'});await booking(f,34);await op(f,'rescheduleAppointment',move,409);const r=await op(f,'rescheduleAppointment',{...move,startAt:future(38)});assert.notEqual(r.replacementAppointmentId,a.id);assert.equal((await dbGet(Appointment,f,a.id)).status,'POSTPONED');assert.equal((await dbGet(Appointment,f,r.replacementAppointmentId)).status,'CONFIRMED');}
    if(n===7){await op(f,'appointmentStatus',{id:a.id,status:'POSTPONED',reason:'Hoãn'});await op(f,'appointmentStatus',{id:a.id,status:'CANCELLED'});await op(f,'rescheduleAppointment',move,400);await op(f,'completeAppointment',{id:a.id},400);}
    if(n===8){await op(f,'rescheduleAppointment',move,403,'other');await op(f,'rescheduleAppointment',{...move,staffId:sid(f.users.other)},403,'staff');}
    if(n===9){await op(f,'rescheduleAppointment',{...move,startAt:future(-1)},400);await op(f,'rescheduleAppointment',{...move,reason:''},400);await op(f,'userStatus',{id:sid(f.users.other),active:false});await op(f,'rescheduleAppointment',{...move,staffId:sid(f.users.other)},400);const foreign=await Spa.create({name:'Foreign staff'});f.extraSpaIds=[foreign._id];const u=await User.create({spaId:foreign._id,name:'Foreign',email:randomUUID()+'@example.test',passwordHash,role:'STAFF'});await op(f,'rescheduleAppointment',{...move,staffId:sid(u)},404);assert.equal(await Audit.countDocuments({spaId:f.spaId,action:'rescheduleAppointment'}),0);}
    if(n===10){const i=await bill(f);await op(f,'updateService',{id:sid(f.service),name:'DV-A',price:400000,duration:90});await op(f,'rescheduleAppointment',move);const s=await dbGet(Appointment,f,a.id);assert.equal(s.endAt-s.startAt,3600000);assert.equal((await dbGet(Invoice,f,i.id)).total,350000);}
    if(n===11){const key=randomUUID();const r=await op(f,'rescheduleAppointment',move,200,'owner',key);assert.deepEqual(await op(f,'rescheduleAppointment',move,200,'owner',key),r);assert.equal(await Audit.countDocuments({spaId:f.spaId,action:'rescheduleAppointment'}),1);const c=await booking(f,45),d=await booking(f,48);const payload=(id:string)=>({...move,id,startAt:future(52)});const responses=await Promise.all([request('/api/operations',f.cookies.owner,{action:'rescheduleAppointment',data:payload(c.id)}),request('/api/operations',f.cookies.owner,{action:'rescheduleAppointment',data:payload(d.id)})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);}
    assert.equal(await count(CashEntry,f.spaId),0);return 'HTTP và DB assertions đạt cho ca '+n+';giữ thời lượng/lịch sử/quyền/slot theo tình huống;không sinh tiền.';
  });
  await run('TC-BILL-03',async f=>{const a=await pastBooking(f),key=randomUUID();const x=await op(f,'completeAppointment',{id:sid(a)},200,'owner',key),y=await op(f,'completeAppointment',{id:sid(a)},200,'owner',key),z=await op(f,'completeAppointment',{id:sid(a)});assert.equal(x.invoiceId,y.invoiceId);assert.equal(x.invoiceId,z.invoiceId);assert.equal(await count(Invoice,f.spaId),1);return 'Retry key cũ và key mới đều cùng invoiceId;DB chỉ1 invoice.';});
  await run('TC-BILL-04',async f=>{const a=await pastBooking(f),i=await bill(f);await op(f,'payment',{invoiceId:i.id,amount:100000,...receive});const before=(await dbGet(Invoice,f,i.id)).toObject();await op(f,'completeAppointment',{id:sid(a),existingInvoiceId:i.id});const after=await dbGet(Invoice,f,i.id);for(const k of ['total','paid','status','dueDate'])assert.equal(after[k],before[k]);assert.equal(String(after.appointmentId),sid(a));assert.equal(await count(Invoice,f.spaId),1);return 'Liên kết hóa đơn đã có/đã trả một phần giữ total,paid,status,hạn;không tạo invoice mới.';});
  await run('TC-BILL-05',async f=>{const a=await pastBooking(f),wrongCustomer=await bill(f,f.service,f.otherCustomer),serviceB=await Service.create({spaId:f.spaId,name:'DV-B',price:100,duration:30}),wrongService=await bill(f,serviceB),p=await plan(f),linked=await pastBooking(f);const used=await op(f,'completeAppointment',{id:sid(linked)});const foreign=await Spa.create({name:'Foreign'});f.extraSpaIds=[foreign._id];const foreignI=await Invoice.create({spaId:foreign._id,customerId:f.customer._id,total:100});for(const id of [wrongCustomer.id,wrongService.id,p.invoiceId,used.invoiceId,sid(foreignI)]){const r=await request('/api/operations',f.cookies.owner,{action:'completeAppointment',data:{id:sid(a),existingInvoiceId:id}});assert.ok([400,404,409].includes(r.status));assert.equal((await dbGet(Appointment,f,sid(a))).status,'CONFIRMED');}return 'Đã gửi5 loại invoice sai:khách/dịch vụ/gói/đã gắn lịch/khác spa;đều bị chặn,lịch không đổi.';});
  await run('TC-BILL-06',async f=>{const a=await pastBooking(f);const r=await op(f,'completeAppointment',{id:sid(a)},200,'staff');assert.ok(r.invoiceId);const other=await pastBooking(f,{staffId:f.users.other._id});await op(f,'completeAppointment',{id:sid(other)},403,'staff');for(const data of [{id:sid(a),dueDate:dateTomorrow},{id:sid(a),existingInvoiceId:r.invoiceId}])await op(f,'completeAppointment',data,403,'staff');await op(f,'payment',{invoiceId:r.invoiceId,amount:1000,...receive},200,'staff');return 'STAFF hoàn thành lịch mình200;ngoài lịch/chọn invoice/hạn403;theo rule mới STAFF phục vụ thu tiền được200.';});
  await run('TC-BILL-07',async f=>{const a=await booking(f);await op(f,'completeAppointment',{id:a.id},400);await op(f,'appointmentStatus',{id:a.id,status:'POSTPONED',reason:'Test'});await op(f,'completeAppointment',{id:a.id},400);await op(f,'appointmentStatus',{id:a.id,status:'CANCELLED'});await op(f,'completeAppointment',{id:a.id},400);assert.equal(await count(Invoice,f.spaId),0);return 'Tương lai/hoãn/hủy đều400,không invoice.';});
  await run('TC-BILL-08',async f=>{const a=await pastBooking(f);await op(f,'completeAppointment',{id:sid(a),dueDate:'2026-02-30'},400);assert.equal((await dbGet(Appointment,f,sid(a))).status,'CONFIRMED');assert.equal(await count(Invoice,f.spaId),0);return 'Ngày không tồn tại400;lịch CONFIRMED;0 invoice.';});
  await run('TC-BILL-09',async f=>{const a=await pastBooking(f),i=await op(f,'completeAppointment',{id:sid(a)});await op(f,'payment',{invoiceId:i.invoiceId,amount:1000,...receive},400);assert.equal((await dbGet(Invoice,f,i.invoiceId)).paid,0);assert.equal(await count(CashEntry,f.spaId),0);return 'Chưa mở sổ vẫn lập invoice200;thu tiền400;paid0/0 CashEntry.';},false);
  for(const n of [3,4,5,6,7,8])await run('TC-PKG-'+String(n).padStart(2,'0'),async f=>{
    const p=await plan(f,7),a=await pastBooking(f,{treatmentId:p.id}),data={id:sid(a),...evidence,remainingBefore:7};
    if(n===3){await op(f,'completeTreatmentAppointment',data,200,'staff');assert.equal((await dbGet(Treatment,f,p.id)).remaining,6);assert.equal(await count(TreatmentUse,f.spaId),1);assert.equal((await dbGet(Appointment,f,sid(a))).status,'COMPLETED');}
    if(n===4){await op(f,'completeTreatmentAppointment',{...data,signature:{version:1,strokes:[]}},400);await op(f,'completeTreatmentAppointment',{...data,signature:undefined},400);assert.equal((await dbGet(Treatment,f,p.id)).remaining,7);assert.equal((await dbGet(Appointment,f,sid(a))).status,'CONFIRMED');}
    if(n===5){const key=randomUUID(),x=await op(f,'completeTreatmentAppointment',data,200,'staff',key),y=await op(f,'completeTreatmentAppointment',data,200,'staff',key),z=await op(f,'completeTreatmentAppointment',data,200,'staff');assert.equal(x.treatmentUseId,y.treatmentUseId);assert.equal(x.treatmentUseId,z.treatmentUseId);assert.equal(await count(TreatmentUse,f.spaId),1);assert.equal((await dbGet(Treatment,f,p.id)).remaining,6);}
    if(n===6){for(let i=0;i<7;i++)await op(f,'use',{treatmentId:p.id,...evidence,remainingBefore:7-i});await op(f,'completeTreatmentAppointment',data,400);assert.equal((await dbGet(Treatment,f,p.id)).remaining,0);assert.equal((await dbGet(Appointment,f,sid(a))).status,'CONFIRMED');}
    if(n===7){await op(f,'appointment',{customerId:sid(f.otherCustomer),serviceId:sid(f.service),staffId:sid(f.users.staff),startAt:future(30),treatmentId:p.id},400);const another=await Service.create({spaId:f.spaId,name:'Other',price:1,duration:5});await op(f,'appointment',{customerId:sid(f.customer),serviceId:sid(another),staffId:sid(f.users.staff),startAt:future(30),treatmentId:p.id},400);const foreign=await Spa.create({name:'Foreign'});f.extraSpaIds=[foreign._id];const foreignPlan=await Treatment.create({spaId:foreign._id,customerId:f.customer._id,invoiceId:new mongoose.Types.ObjectId(),totalSessions:1,remaining:1});await op(f,'appointment',{customerId:sid(f.customer),serviceId:sid(f.service),staffId:sid(f.users.staff),startAt:future(30),treatmentId:sid(foreignPlan)},404);assert.equal(await count(Appointment,f.spaId),1);}
    if(n===8){await op(f,'completeTreatmentAppointment',data,403,'other');await op(f,'appointmentStatus',{id:sid(a),status:'COMPLETED'},400,'staff');assert.equal((await dbGet(Treatment,f,p.id)).remaining,7);}
    assert.equal(await count(Invoice,f.spaId),1);assert.equal(await count(CashEntry,f.spaId),0);assert.equal(await count(Payment,f.spaId),0);return 'API+MongoDB xác minh ca gói '+n+':liên kết/xác nhận/quyền/retry/số buổi;không invoice hoặc khoản thu mới.';
  });
  await run('TC-PAY-01',async f=>{const i=await bill(f);await op(f,'payment',{invoiceId:i.id,amount:100000,...receive});const d=await dbGet(Invoice,f,i.id);assert.equal(d.paid,100000);assert.equal(d.total-d.paid,250000);assert.equal(d.status,'PARTIALLY_PAID');assert.equal(await count(CashEntry,f.spaId),1);return 'Thu100000 CASH200;paid100000,nợ250000,PARTIALLY_PAID;1 CashEntry.';});
  await run('TC-PAY-03',async f=>{const i=await bill(f);await op(f,'payment',{invoiceId:i.id,amount:100000,...receive});await op(f,'payment',{invoiceId:i.id,amount:250000,method:'BANK_TRANSFER',receivedConfirmation:true,transferReference:'GROUP-TEST'});assert.equal((await dbGet(Invoice,f,i.id)).paid,350000);assert.equal((await dbGet(Invoice,f,i.id)).status,'PAID');assert.equal(await CashEntry.countDocuments({spaId:f.spaId,method:'CASH'}),1);assert.equal((await CashEntry.findOne({spaId:f.spaId,method:'BANK_TRANSFER'})).amount,250000);return 'Sau chuyển khoản250000 có tham chiếu,invoice PAID350000;tiền mặt chỉ giữ100000.';});
  await run('TC-PAY-04',async f=>{const i=await bill(f);for(const data of [{invoiceId:i.id,amount:100000,method:'CASH'},{invoiceId:i.id,amount:100000,...receive,receivedConfirmation:false}])await op(f,'payment',data,400);assert.equal((await dbGet(Invoice,f,i.id)).paid,0);assert.equal(await count(CashEntry,f.spaId),0);return 'Thiếu/false receivedConfirmation đều400;paid0;0 CashEntry.';});
  await run('TC-PAY-05',async f=>{const i=await bill(f),a=await op(f,'payment',{invoiceId:i.id,amount:100000,...receive}),b=await op(f,'payment',{invoiceId:i.id,amount:250000,...receive});assert.equal((await dbGet(Invoice,f,i.id)).status,'PAID');for(const [p,expected]of [[b,'PARTIALLY_PAID'],[a,'OPEN']]){const payment=await dbGet(Payment,f,p.id);await op(f,'reverseCash',{id:String(payment.receiptId),reason:'Test sai khoản'});assert.equal((await dbGet(Invoice,f,i.id)).status,expected);}return 'Đảo250000:PAID=>PARTIALLY_PAID;đảo100000 còn lại=>OPEN;giữ bản gốc.';});
} finally {
  await mongoose.disconnect();
  await fs.writeFile(output+'/http-done.txt',JSON.stringify({pass:results.filter(r=>r.status==='Pass').length,fail:results.filter(r=>r.status==='Fail').length}));
  if(results.some(r=>r.status==='Fail'))process.exitCode=1;
}
