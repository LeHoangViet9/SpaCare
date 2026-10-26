import { actor } from '@/lib/auth';
import { Appointment, Customer, Invoice, Service, Treatment } from '@/lib/models';
import { ensure } from '@/lib/rules';
import { failure } from '@/lib/http';
import { scheduledItems } from '@/lib/appointment-checkout';
import { z } from 'zod';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 try {
  const user=await actor();
  ensure(user.role==='OWNER' || (user.role==='STAFF' && user.cashier),'Cần quyền thu ngân.',403);
  const params=new URL(request.url).searchParams;
  const input=z.object({customerId:z.string().regex(/^[a-f\d]{24}$/i).optional(),appointmentId:z.string().regex(/^[a-f\d]{24}$/i).optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}).parse(Object.fromEntries(params));
  ensure(input.customerId || input.appointmentId,'Chọn khách hoặc lịch hẹn.');
  const scope={spaId:user.spaId};
  if(input.appointmentId) {
   const appointment=await Appointment.findOne({...scope,_id:input.appointmentId,...(input.customerId?{customerId:input.customerId}:{})}).lean();
   ensure(appointment,'Không tìm thấy lịch trong spa này.',404);
   const customer=await Customer.findOne({...scope,_id:appointment!.customerId}).select('name phone').lean();
   const ids=scheduledItems(appointment!);
   const services=await Service.find({...scope,_id:{$in:ids.services}}).lean();
   const treatments=await Treatment.find({...scope,_id:{$in:ids.treatments},customerId:appointment!.customerId}).lean();
   const purchases=await Invoice.find({...scope,_id:{$in:treatments.map(row=>row.invoiceId)}}).select('serviceId').lean();
   const preparedTreatments=treatments.map(row=>({...row,serviceId:row.serviceId || purchases.find(purchase=>String(purchase._id)===String(row.invoiceId))?.serviceId}));
   const invoice=await Invoice.findOne({...scope,appointmentId:appointment!._id}).select('_id code status').lean();
   return Response.json({appointment,customer,services,treatments:preparedTreatments,invoice},{headers:{'Cache-Control':'no-store'}});
  }
  const rows=await Appointment.find({...scope,customerId:input.customerId,status:{$in:['CONFIRMED','COMPLETED']}}).sort({startAt:-1,_id:-1}).skip((input.page-1)*20).limit(21).select('customerId staffId startAt status requestedServices serviceIds serviceId treatmentIds treatmentId').lean();
  const appointments=rows.slice(0,20);
  const invoices=await Invoice.find({...scope,appointmentId:{$in:appointments.map(row=>row._id)}}).select('appointmentId _id code').lean();
  return Response.json({appointments:appointments.map(row=>({...row,invoice:invoices.find(i=>String(i.appointmentId)===String(row._id))})),hasMore:rows.length>20},{headers:{'Cache-Control':'no-store'}});
 } catch(error){return failure(error);}
}
