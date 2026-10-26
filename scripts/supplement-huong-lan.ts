import { readSupplementInput } from '../src/lib/supplement-input';
import { assertDatabaseTarget } from '../src/lib/production-safety.mjs';
import mongoose from 'mongoose';
import { connect, DatabaseUnavailableError } from '../src/lib/db';
import { Customer, Service, Treatment, Invoice, Control, Audit, Idempotency } from '../src/lib/models';
import { seedOwnerConfig } from '../src/lib/seed-owner';
import { openingOwner, checkOpeningTarget, openingKey, digest } from '../src/lib/opening-balances';
import { ensureGroupedPackageIndex } from '../src/lib/package-invoice-indexes';
import { DomainError, ensure } from '../src/lib/rules';

const timeout=setTimeout(()=>{console.error('Kết nối quá thời gian. Chưa xác nhận được kết quả; chạy --check trước khi thử ghi lại.');process.exit(1);},30000);
let source: ReturnType<typeof readSupplementInput>['source'];
let batch: string, key: string, fingerprint: string;
const mode=process.argv[2];
async function inspect(owner:any,session:mongoose.ClientSession|null=null){
 const scope={spaId:owner.spaId};
 const customers=await Customer.find({...scope,phone:source.phone}).session(session);
 ensure(customers.length===1 && openingKey(customers[0].name)===openingKey(source.name),'Không xác định đúng một hồ sơ theo file đầu vào; dừng để đối chiếu.');
 const customer=customers[0],existing=await Treatment.find({...scope,customerId:customer._id}).session(session);
 const catalog=await Service.find({...scope,active:true}).session(session);
 const missing=[];
 const conflicts:string[]=[];
 for(const name of source.services){
  const matches=catalog.filter(s=>openingKey(s.name)===openingKey(name));ensure(matches.length===1,'Cần đúng một dịch vụ đang hoạt động: '+name);
  const service=matches[0],plans=existing.filter(t=>t.status!=='CANCELLED' && String(t.serviceId)===String(service._id));
  if(plans.length>1){conflicts.push('Đã có nhiều liệu trình '+name+'; cần đối soát.');continue;}
  if(plans.length){const plan=plans[0];if(!(plan.startsOn===source.startsOn && plan.expiresOn===source.expiresOn && plan.packageType==='TIME' && plan.status==='ACTIVE'))conflicts.push('Liệu trình đã có nhưng khác ngày/trạng thái: '+name);}
  else missing.push(service);
 }
 return {customer,missing,existing,conflicts};
}
try{
 ensure(process.argv.length===5 && ['--check','--write'].includes(mode) && process.argv[3]==='--file','Chỉ dùng --check hoặc --write --file imports/tệp-riêng.json.');
 const input=readSupplementInput(process.argv[4]);
 source=input.source;batch=input.batch;key='opening-'+batch;fingerprint=digest(source);
 checkOpeningTarget(process.env.MONGODB_URI || '','spacare_live');assertDatabaseTarget(process.env.MONGODB_URI || '', process.env, 'import');
  await connect('import');
 const identity=seedOwnerConfig(process.env),owner=await openingOwner(identity);
 const plan=await inspect(owner);
 console.log(JSON.stringify({existingCount:plan.existing.length,missingCount:plan.missing.length,conflictCount:plan.conflicts.length,newReceipts:0,newRevenue:0}));
 ensure(!plan.conflicts.length,'Có dữ liệu không khớp như báo cáo trên. Chưa ghi thay đổi; cần đối chiếu trước khi bổ sung.',409);
 if(mode==='--write'){
  const result=await mongoose.connection.transaction(async session=>{
   const currentOwner=await openingOwner(identity,session),scope={spaId:currentOwner.spaId};
   ensure(await Control.findOneAndUpdate(scope,{$inc:{revision:1}},{session,returnDocument:'after'}),'Thiếu Control.');
   const previous=await Idempotency.findOne({...scope,key}).session(session);
   if(previous){ensure(previous.fingerprint===fingerprint,'Nội dung đợt nhập thay đổi.',409);return previous.result;}
   const {customer,missing,conflicts}=await inspect(currentOwner,session);
   ensure(!conflicts.length,conflicts.join('; '),409);
   if(!missing.length)return {created:0,message:'Đã đủ quyền lợi, không tạo trùng.'};
   if(missing.length>1)await ensureGroupedPackageIndex();
   const create=async(model:mongoose.Model<any>,values:Record<string,unknown>)=>(await model.create([{...scope,...values}],{session}))[0];
   const invoice=await create(Invoice,{customerId:customer._id,kind:'PACKAGE',openingBalance:true,openingDate:source.startsOn,description:'Bổ sung quyền lợi đã thanh toán · '+missing.map(s=>s.name).join(' + '),total:0,paid:0,status:'PAID',createdBy:currentOwner._id,creatorName:currentOwner.name});
   const treatments=[];
   for(const service of missing){
    const treatment=await create(Treatment,{customerId:customer._id,invoiceId:invoice._id,serviceId:service._id,name:service.name,packageType:'TIME',durationMonths:36,startsOn:source.startsOn,expiresOn:source.expiresOn,openingBalance:true,usedSessions:0,status:'ACTIVE'});
    treatments.push(treatment);
   }
   invoice.packageItems=treatments.map(t=>({treatmentId:t._id,serviceId:t.serviceId,name:t.name,total:0}));await invoice.save({session});
   const result={created:treatments.length,invoiceId:String(invoice._id),treatmentIds:treatments.map(t=>String(t._id)),noHistoricalReceipts:true};
   await create(Audit,{actorId:currentOwner._id,action:'supplementOpeningTreatments',targetId:invoice._id,details:{batch,fingerprint,reason:'Chủ spa xác nhận bổ sung quyền lợi đã thanh toán theo file riêng.',historicalPaid:true,sourceDate:source.startsOn,expiresOn:source.expiresOn,...result}});
   await create(Idempotency,{userId:currentOwner._id,key,fingerprint,result});return result;
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
  console.log('Kết quả:',JSON.stringify(result));
 }else console.log('Chỉ kiểm tra, chưa ghi dữ liệu.');
}catch(error){console.error(error instanceof DatabaseUnavailableError ? error.code : error instanceof DomainError ? error.message : 'Không bổ sung được dữ liệu. Không xóa hoặc ghi đè hồ sơ.');process.exitCode=1;}
finally{clearTimeout(timeout);await mongoose.disconnect();}
