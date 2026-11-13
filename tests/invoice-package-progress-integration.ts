import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type mongoose from 'mongoose';
import {allModels,Spa,User,Control,Customer,Service,PackageTemplate,Treatment} from '../src/lib/models';
import {operate} from '../src/lib/operations';
import {invoiceExport} from '../src/lib/export-read';

export async function invoicePackageProgressIntegration(extraSpaIds:mongoose.Types.ObjectId[]) {
  const spa=await Spa.create({name:'Synthetic package print'});
  extraSpaIds.push(spa._id);
  const spaId=spa._id;
  const owner=await User.create({spaId,name:'Print owner',role:'OWNER',active:true,passwordHash:'unused synthetic hash'});
  await Control.create({spaId});
  const customer=await Customer.create({spaId,name:'Synthetic print customer'});
  const service=await Service.create({spaId,name:'Synthetic print service',price:1000,commission:100,active:true});
  const template=await PackageTemplate.create({spaId,serviceId:service._id,name:'Gói 10 buổi',price:10000,totalSessions:10,packageType:'SESSIONS',active:true});
  const actor={spaId:String(spaId),id:String(owner._id),name:owner.name,role:'OWNER' as const,cashier:true};
  const call=(action:string,data:any)=>operate(actor,action,data,randomUUID());
  const sale=await call('checkout',{customerId:String(customer._id),actions:[
    {action:'sellPackage',data:{templateId:String(template._id)}},
    {action:'sellPackage',data:{templateId:String(template._id)}},
  ]});
  const plans=await Treatment.find({spaId,invoiceId:sale.invoiceId}).sort({_id:1}).lean();
  assert.equal(plans.length,2);
  const rows=async(id:string)=>(await invoiceExport(actor,id)).tables[1].rows.map(row=>row[0]);
  assert.deepEqual(await rows(sale.invoiceId),['Gói 10 buổi\nCòn lại: 10 buổi','Gói 10 buổi\nCòn lại: 10 buổi']);
  let firstSessionId='';
  for(let number=1;number<=3;number++){
    const result=await call('use',{treatmentId:String(plans[0]._id),staffId:String(owner._id)});
    if(number===1)firstSessionId=result.invoiceId;
    assert.ok((await rows(result.invoiceId)).some(row=>row.includes(`Buổi đang thực hiện: ${number}/10\nCòn lại: ${10-number} buổi`)));
  }
  const saleRows=await rows(sale.invoiceId);
  assert.ok(saleRows.some(row=>row.includes('3/10\nCòn lại: 7 buổi')));
  assert.ok(saleRows.some(row=>row==='Gói 10 buổi\nCòn lại: 10 buổi'));
  assert.ok((await rows(firstSessionId)).some(row=>row.includes('1/10\nCòn lại: 9 buổi')));
  const combined=await call('invoice',{customerId:String(customer._id),serviceId:String(service._id),treatments:[
    {treatmentId:String(plans[0]._id),remainingBefore:7,performerId:String(owner._id)},
    {treatmentId:String(plans[1]._id),remainingBefore:10,performerId:String(owner._id)},
  ]});
  const mixedRows=await rows(combined.invoiceId||combined.id);
  assert.ok(mixedRows.some(row=>row.includes('4/10\nCòn lại: 6 buổi')));
  assert.ok(mixedRows.some(row=>row.includes('1/10\nCòn lại: 9 buổi')));
  const snapshot=async()=>{
    const state:Record<string,unknown>={};
    for(const model of allModels)if(model.schema.path('spaId'))state[model.modelName]=await model.find({spaId}).sort({_id:1}).lean();
    return JSON.stringify(state);
  };
  const before=await snapshot();
  await rows(sale.invoiceId);await rows(combined.invoiceId||combined.id);
  assert.equal(await snapshot(),before,'printing is read-only across every spa collection');
}
