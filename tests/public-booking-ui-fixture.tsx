import React from 'react';
import { createRoot } from 'react-dom/client';
import BookingForm from '../src/components/booking-form';
const services=[{_id:'a'.repeat(24),name:'Service A',price:100000,category:'Group A'},{_id:'b'.repeat(24),name:'Service B',price:200000,category:'Group B'}];
window.fetch=(async(input:any,options:any)=>{
 if(input!=='/api/booking') throw new Error('External requests blocked');
 const body=JSON.parse(options.body);document.getElementById('saved')!.textContent=JSON.stringify(body);
 return Response.json({appointmentId:'c'.repeat(24),serviceName:'Service A + Service B',startAt:body.startAt});
}) as typeof fetch;
createRoot(document.getElementById('root')!).render(<BookingForm services={services} user={null}/>);
