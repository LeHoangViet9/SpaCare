import assert from 'node:assert/strict';
import { publicBookingInput, reservePublicBooking } from '../src/lib/public-booking';
import mongoose from 'mongoose';
import { Appointment, Audit, Control, Customer, Idempotency, Service, User, Notification } from '../src/lib/models';
import { randomUUID } from 'node:crypto';
import { spaDay } from '../src/lib/rules';

const tomorrow = spaDay(new Date(Date.now() + 86400000));
const data = { serviceId: '123456789012345678901234', name: 'Guest', phone: '+84 912 345 678', startAt: `${tomorrow}T10:00:00+07:00` };
const parsed = publicBookingInput.parse({ ...data, spaId: 'forged', staffId: 'forged' });
assert.equal(parsed.phone, '0912345678');
assert.equal('spaId' in parsed, false);
assert.equal('staffId' in parsed, false);
for (const phone of ['', 'abc', '0123']) assert.equal(publicBookingInput.safeParse({ ...data, phone }).success, false);
assert.equal(publicBookingInput.safeParse({ ...data, startAt: '2027-01-01T10:00:00' }).success, false);
await assert.rejects(reservePublicBooking(data, null, ''), (error: any) => error.status === 400);

await assert.rejects(reservePublicBooking(data, { id: 'legacy', spaId: 'spa', name: 'Legacy customer', role: 'CUSTOMER', cashier: false, customerId: 'victim' }, randomUUID()), (error: any) => error.status === 403);

// Model doubles exercise booking decisions; real race/rollback tests live in integration.test.ts.
const query = (value: unknown): any => ({ session: async () => value, sort: () => query(value) });
let writes = 0;
let staff = [{ _id: 'busy-staff', role: 'STAFF' }, { _id: 'free-staff', role: 'OWNER' }];
let previous: any = null;
let notifications = 0;
(Notification as any).create = async (rows: any[], options: any) => {
  assert.ok(options.session);
  assert.equal(rows[0].spaId, 'spa');
  assert.ok(['free-staff', 'busy-staff'].includes(rows[0].userId));
  assert.equal(rows[0].url, '/workspace/appointments?search=appointment');
  notifications++;
};
const key = randomUUID();
(mongoose as any).startSession = async () => ({ withTransaction: async (fn: any) => fn(), endSession: async () => {} });
(Service as any).findOne = () => query({ _id: data.serviceId, spaId: 'spa', duration: 60, name: 'Service' });
(Control as any).findOneAndUpdate = () => query({ revision: 1 });
(Idempotency as any).findOne = () => query(previous);
(User as any).find = () => query(staff);
(Appointment as any).exists = () => assert.fail('Arrival-only booking must not infer capacity from intervals');
(Customer as any).findOne = () => query(null);
(Customer as any).create = async () => { writes++; return [{ _id: 'customer' }]; };
(Appointment as any).create = async (rows: any[]) => {
  writes++;
  assert.equal(rows[0].staffId, 'free-staff');
  assert.equal(rows[0].endAt, undefined);
  return [{ _id: 'appointment' }];
};
(Audit as any).create = async () => { writes++; };
(Idempotency as any).create = async (rows: any[]) => { writes++; previous = rows[0]; };
const result = await reservePublicBooking(data, null, key);
assert.equal(result!.appointmentId, 'appointment');
assert.equal(writes, 4);
assert.deepEqual(await reservePublicBooking(data, null, key), result);
assert.equal(writes, 4, 'Retry must reuse the original appointment');
assert.equal(notifications, 2, 'Owner and staff each receive one booking notification even after retry');
await assert.rejects(reservePublicBooking({ ...data, name: 'Changed guest' }, null, key), (error: any) => error.status === 409);

previous = null;
await assert.rejects(reservePublicBooking({ ...data, startAt: `${tomorrow}T08:59:00+07:00` }, null, randomUUID()), (e: any) => e.status === 400);
const closing = await reservePublicBooking({ ...data, startAt: `${tomorrow}T22:00:00+07:00` }, null, randomUUID());
assert.ok(closing!.appointmentId);


// Multi-service bookings stay one visit and preserve arbitrary minute arrival times.
const secondId='abcdefabcdefabcdefabcdef';
let visitRows:any[]=[];
let lastNotification:any;
const multi={...data,serviceId:undefined,serviceIds:[data.serviceId,secondId],startAt:`${tomorrow}T14:17:00+07:00`};
const services:any[]=[{_id:data.serviceId,spaId:'spa',name:'First',active:true},{_id:secondId,spaId:'spa',name:'Second',active:true}];
(Service as any).findOne=(filter:any)=>query(services.find(row=>row._id===filter._id && row.active && (!filter.spaId || row.spaId===filter.spaId)) || null);
(Appointment as any).create=async(rows:any[])=>{visitRows.push(...rows);return [{_id:'appointment'}];};
(Notification as any).create=async(rows:any[])=>{lastNotification=rows[0];notifications++;};
previous=null;
const multiKey=randomUUID();const multiResult=await reservePublicBooking(multi,null,multiKey);
assert.equal(visitRows.length,1);assert.equal(visitRows[0].requestedServices.length,2);
assert.deepEqual(visitRows[0].requestedServices.map((item:any)=>item.serviceId),multi.serviceIds);
assert.equal(visitRows[0].startAt.toISOString(),new Date(multi.startAt).toISOString());
assert.equal(multiResult!.serviceName,'First + Second');assert.match(lastNotification.body,/First \+ Second/);
await reservePublicBooking(multi,null,multiKey);assert.equal(visitRows.length,1);
for(const serviceIds of [[],[data.serviceId,data.serviceId],Array(31).fill(data.serviceId),[data.serviceId,'invalid']]) {
 assert.equal(publicBookingInput.safeParse({...multi,serviceIds}).success,false);
}
previous=null;services[1].spaId='foreign';
await assert.rejects(reservePublicBooking(multi,null,randomUUID()),(e:any)=>e.status===404);
assert.equal(visitRows.length,1);services[1].spaId='spa';services[1].active=false;
await assert.rejects(reservePublicBooking(multi,null,randomUUID()),(e:any)=>e.status===404);
services[1].active=true;
for(const time of ['08:59','22:01']) {
 await assert.rejects(reservePublicBooking({...multi,startAt:`${tomorrow}T${time}:00+07:00`},null,randomUUID()),(e:any)=>e.status===400);
}
