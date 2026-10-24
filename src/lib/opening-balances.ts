import { createHash } from 'node:crypto';
import { z } from 'zod';
import mongoose, { type ClientSession } from 'mongoose';
import { User, Customer, Service, Treatment, Invoice, CashCard, CashCardUse, Control, Idempotency, Audit } from './models';
import { verifyPassword } from './password';
import { DomainError, ensure, dayBounds } from './rules';
const text=z.string().trim().min(1).max(500), id=z.string().regex(/^[a-f0-9]{24}$/i);
const positive=z.number().int().min(1).max(1_000_000_000_000);
const customerInput=z.object({name:text,phone:z.preprocess(v=>v===''||v===null?undefined:v,z.string().regex(/^0[0-9]{9,10}$/).optional()),sourceStartDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  treatments:z.array(z.object({serviceName:text,benefitNote:z.string().trim().max(500).optional(),gift:z.boolean().optional(),remaining:z.number().int().min(1).max(10000),historicalPaymentStatus:z.literal('FULLY_PAID'),createNewReceipt:z.literal(false)})).max(100),
  cashCard:z.object({sourceLabel:text,remainingVnd:positive}).optional(),debt:z.object({sourceLabel:text,outstandingVnd:positive}).optional()});
export const openingInput=z.object({version:z.literal(1),targetDatabase:z.enum(['spacare_live','spacare_dev','spacare_test']),
  confirmations:z.object({treatmentsFullyPaid:z.literal(true),cosmeticsDebtSeparate:z.literal(true)}),customers:z.array(customerInput).min(1).max(1000)});
export const openingKey=(name:string)=>name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function parseOpening(raw:unknown){
  const data=openingInput.parse(raw);
  const phones=data.customers.map(c=>c.phone).filter(Boolean);
  ensure(new Set(phones).size===phones.length,'Trùng SĐT trong dữ liệu nhập.');
  const unnamedPhones=data.customers.filter(c=>!c.phone).map(c=>openingKey(c.name));
  ensure(new Set(unnamedPhones).size===unnamedPhones.length,'Khách thiếu SĐT trùng tên cần đối chiếu.');
  for(const c of data.customers){dayBounds(c.sourceStartDate);ensure(new Set(c.treatments.map(t=>openingKey(t.serviceName))).size===c.treatments.length,'Trùng dịch vụ của một khách trong file.');}
  return data;
}
export function openingSummary(data:ReturnType<typeof parseOpening>){return {customers:data.customers.length,treatments:data.customers.reduce((n,c)=>n+c.treatments.length,0),remainingSessions:data.customers.flatMap(c=>c.treatments).reduce((n,t)=>n+t.remaining,0),cards:data.customers.filter(c=>c.cashCard).length,cardBalanceVnd:data.customers.reduce((n,c)=>n+(c.cashCard?.remainingVnd||0),0),outstandingVnd:data.customers.reduce((n,c)=>n+(c.debt?.outstandingVnd||0),0)};}
export const openingMapping=z.record(z.string(),id);
export function checkOpeningTarget(uri:string,expected:string){
  ensure(!process.env.VERCEL,'Chỉ chạy công cụ nhập trên máy vận hành.');
  let database='';
  try {
    const parsed=new URL(uri);
    ensure(['mongodb:','mongodb+srv:'].includes(parsed.protocol),'MONGODB_URI phải là kết nối MongoDB.');
    ensure(!/^(cluster|your[-_]?cluster|example)\.mongodb\.net$/i.test(parsed.hostname),'MONGODB_URI còn hostname mẫu. Thay CLUSTER.mongodb.net bằng hostname Atlas thật trước khi kết nối.');
    database=decodeURIComponent(parsed.pathname.slice(1));
  } catch(error) { if(error instanceof DomainError) throw error; ensure(false,'MONGODB_URI không hợp lệ.'); }
  ensure(['spacare_live','spacare_dev','spacare_test'].includes(expected)&&database===expected,'Database không khớp mục tiêu được duyệt. Không tự chuyển URI.');
}
export async function openingOwner(identity:{phone?:string;email?:string;password:string},session:ClientSession|null=null){
  const matches=await User.find(identity.phone?{phone:identity.phone}:{email:identity.email}).select('+passwordHash').session(session);
  ensure(matches.length===1,'Không xác định duy nhất tài khoản chủ spa.',403);const owner=matches[0];
  ensure(owner.active && owner.role==='OWNER' && (!identity.email||owner.email===identity.email) && verifyPassword(identity.password,owner.passwordHash),'Tài khoản chủ spa không hợp lệ.',403);return owner;
}
export async function inspectOpening(owner:any,data:ReturnType<typeof parseOpening>,mapping:Record<string,string>={},session:ClientSession|null=null){
  const scope={spaId:owner.spaId};
  const customers=await Customer.find(scope).sort({_id:1}).session(session).lean();
  const services=await Service.find(scope).sort({_id:1}).session(session).lean();
  const treatments=await Treatment.find(scope).session(session).lean();
  const cards=await CashCard.find(scope).session(session).lean();
  const invoices=await Invoice.find(scope).session(session).lean();
  const errors:string[]=[];const resolved=data.customers.map((c,index)=>{
    const matches=c.phone ? customers.filter(v=>String(v.phone||'').replace(/[\s().-]/g,'').replace(/^\+84/,'0')===c.phone) : [];
    if(!c.phone&&customers.some(v=>openingKey(v.name||'')===openingKey(c.name)))errors.push('Khách dòng '+(index+1)+': thiếu SĐT nhưng trùng tên hồ sơ có sẵn; cần đối chiếu trước.');
    if(matches.length>1 || matches.length===1 && openingKey(matches[0].name)!==openingKey(c.name))errors.push('Khách dòng '+(index+1)+': SĐT trùng nhiều hồ sơ hoặc khác tên, cần đối chiếu.');
    const customer=matches.length===1?matches[0]:null;
    const rows=c.treatments.map(t=>{
      const explicit=mapping[t.serviceName];
      const found=services.filter(v=>explicit?String(v._id)===explicit:openingKey(v.name||'')===openingKey(t.serviceName));
      if(found.length!==1 || !found[0].active)errors.push('Dịch vụ cần ánh xạ chính xác/đang hoạt động: '+t.serviceName);
      const service=found.length===1?found[0]:null;
      if(customer&&service&&treatments.some(v=>String(v.customerId)===String(customer._id)&&String(v.serviceId)===String(service._id)))errors.push('Khách dòng '+(index+1)+': đã có liệu trình dịch vụ '+t.serviceName+', không cộng đè.');
      return {...t,serviceId:service?String(service._id):null,serviceNameMatched:service?.name||null,commission:service?.commission||0};
    });
    if(customer&&c.cashCard&&cards.some(v=>String(v.customerId)===String(customer._id)))errors.push('Khách dòng '+(index+1)+': đã có thẻ, cần đối chiếu số dư.');
    if(customer&&c.debt&&invoices.some(v=>String(v.customerId)===String(customer._id)&&v.total>v.paid))errors.push('Khách dòng '+(index+1)+': đã có công nợ, cần đối chiếu.');
    return {...c,customerId:customer?String(customer._id):null,treatments:rows};
  });
  const report={warnings:['Chưa có tổng buổi và giá mua gốc; không tái tạo lịch sử đã sử dụng hoặc tiền thu.','Chưa có hạn gốc: để trống expiresOn; gói sẽ được dùng theo số buổi còn lại. Cần chủ spa duyệt trước nhập.','Thẻ OPENING chỉ lưu số dư chuyển; amount không phải mệnh giá gốc hoặc tiền mua thẻ.'],spaId:String(owner.spaId),ownerId:String(owner._id),summary:openingSummary(data),customers:resolved,errors:[...new Set(errors)]};
  return {...report,approval:digest(report)};
}
export async function writeOpening(identity:{phone?:string;email?:string;password:string},raw:unknown,mapping:Record<string,string>,approval:string,batch:string){
  const data=parseOpening(raw);checkOpeningTarget(process.env.MONGODB_URI||'',data.targetDatabase);ensure(/^[a-zA-Z0-9-]{10,70}$/.test(batch),'Mã đợt nhập không hợp lệ.');
  const fingerprint=digest({data,mapping}),key='opening-'+batch;
  return mongoose.connection.transaction(async session=>{
    const owner=await openingOwner(identity,session),scope={spaId:owner.spaId};
    ensure(await Control.findOneAndUpdate(scope,{$inc:{revision:1}},{session,returnDocument:'after'}),'Thiếu Control; không tự chạy setup vào live.');
    const previous=await Idempotency.findOne({...scope,key}).session(session);
    if(previous){ensure(previous.fingerprint===fingerprint,'Mã đợt đã dùng cho dữ liệu khác; không ghi đè.',409);return previous.result;}
    const report=await inspectOpening(owner,data,mapping,session);ensure(!report.errors.length,'Chưa giải quyết hết lỗi đối chiếu.',409);ensure(report.approval===approval,'Dữ liệu hoặc ánh xạ đã thay đổi sau duyệt. Chạy kiểm tra lại.',409);
    const create=async(model:mongoose.Model<any>,values:Record<string,unknown>)=>(await model.create([{...scope,...values}],{session}))[0];
    const created:Record<string,string[]>={customers:[],invoices:[],treatments:[],cards:[]};
    for(const row of report.customers){
      const customer=row.customerId ? await Customer.findOne({...scope,_id:row.customerId}).session(session) : await create(Customer,{name:row.name,...(row.phone?{phone:row.phone}:{}),notes:'Chuyển dữ liệu lịch sử đã đối chiếu.'});
      ensure(customer,'Khách không còn tồn tại.',409);if(!row.customerId)created.customers.push(String(customer._id));
      for(const t of row.treatments){
        // This is a settlement placeholder, never a reconstruction of the unknown original sale price.
        const invoice=await create(Invoice,{customerId:customer._id,serviceId:t.serviceId,kind:'PACKAGE',openingBalance:true,openingDate:row.sourceStartDate,description:'Quyền lợi đã thanh toán/tặng trước chuyển đổi · '+t.serviceName+(t.benefitNote?' · '+t.benefitNote:'')+(t.gift?' · Buổi được tặng':''),total:0,paid:0,status:'PAID',createdBy:owner._id,creatorName:owner.name});
        const treatment=await create(Treatment,{customerId:customer._id,invoiceId:invoice._id,serviceId:t.serviceId,name:t.serviceName+(t.benefitNote?' · '+t.benefitNote:'')+(t.gift?' · Buổi được tặng':''),packageType:'SESSIONS',openingBalance:true,openingRemaining:t.remaining,remaining:t.remaining,usedSessions:0,startsOn:row.sourceStartDate,status:'ACTIVE'});
        created.invoices.push(String(invoice._id));created.treatments.push(String(treatment._id));
        await create(Audit,{actorId:owner._id,action:'importOpeningBalances',targetId:invoice._id,details:{batch,invoiceId:String(invoice._id),remaining:t.remaining,sourceDate:row.sourceStartDate,historicalPaid:true,gift:!!t.gift,benefitNote:t.benefitNote}});
      }
      if(row.cashCard){const card=await create(CashCard,{customerId:customer._id,amount:row.cashCard.remainingVnd,balance:row.cashCard.remainingVnd,origin:'OPENING',openingDate:row.sourceStartDate,sourceLabel:row.cashCard.sourceLabel,actorId:owner._id});created.cards.push(String(card._id));}
      if(row.debt){const invoice=await create(Invoice,{customerId:customer._id,kind:'PRODUCT',openingBalance:true,openingDate:row.sourceStartDate,description:'Công nợ đầu kỳ · '+row.debt.sourceLabel,total:row.debt.outstandingVnd,paid:0,status:'OPEN',createdBy:owner._id,creatorName:owner.name});created.invoices.push(String(invoice._id));}
    }
    const result={batch,summary:report.summary,created};
    await create(Audit,{actorId:owner._id,action:'importOpeningBalances',targetId:owner._id,details:{batch,fingerprint,approval,summary:report.summary,created,noHistoricalReceipts:true}});
    await create(Idempotency,{userId:owner._id,key,fingerprint,result});return result;
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
}
export async function checkOpeningIndexes(){
  for(const model of [Customer,Service,Treatment,Invoice,CashCard,CashCardUse,Control,Idempotency,Audit]){
    const exists=await mongoose.connection.db!.listCollections({name:model.collection.name},{nameOnly:true}).hasNext();ensure(exists,'Thiếu collection '+model.collection.name+'. Cần duyệt khởi tạo riêng trước nhập.');
  }
  const indexes=await Idempotency.collection.indexes();ensure(indexes.some(i=>i.unique&&i.key.spaId===1&&i.key.key===1&&Object.keys(i.key).length===2&&!i.partialFilterExpression&&!i.sparse),'Thiếu unique index idempotency; không nhập.');
}
