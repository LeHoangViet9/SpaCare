import { createHash } from 'node:crypto';
import { assertDatabaseTarget } from './production-safety.mjs';

export const SEED = 'spacare-synthetic-preview-v1';
const fail = () => { throw new Error('PREVIEW_SEED_BLOCKED'); };
export type Env = Record<string, string | undefined>;
export function previewConfig(env: Env, allowedHost: string, write = false, confirmation?: string) {
  if (Object.keys(env).some(k => k.startsWith('VERCEL') && env[k])) fail();
  if (env.NODE_ENV !== 'test' || env.SPACARE_ENV !== 'test' || env.SPACARE_TARGET_DATABASE !== 'spacare_test') fail();
  if (!/^[a-z0-9.-]+\.mongodb\.net$/i.test(allowedHost) || allowedHost !== allowedHost.trim()) fail();
  let url: URL;
  try { url = new URL(env.MONGODB_URI || ''); } catch { return fail(); }
  if (url.protocol !== 'mongodb+srv:' || url.hostname.toLowerCase() !== allowedHost.toLowerCase() || url.port || url.pathname !== '/spacare_test') fail();
  for(const [key,value] of url.searchParams) if(key.toLowerCase()==='authsource' && !['admin','spacare_test'].includes(value)) fail();
  if (assertDatabaseTarget(env.MONGODB_URI || '', env, 'maintenance') !== 'spacare_test') fail();
  if (!/^[a-f0-9]{24}$/i.test(env.PREVIEW_OWNER_ID || '')) fail();
  if (!env.PREVIEW_STAFF_PASSWORD || env.PREVIEW_STAFF_PASSWORD.length < 12 || env.PREVIEW_STAFF_PASSWORD.length > 128) fail();
  if (write && confirmation !== 'WRITE-SYNTHETIC-spacare_test') fail();
  return { ownerId: env.PREVIEW_OWNER_ID!, password: env.PREVIEW_STAFF_PASSWORD! };
}
export function assertPreviewOwner(owner: any, expectedId: string) {
  if (!owner || String(owner._id) !== expectedId || owner.role !== 'OWNER' || owner.active !== true || !owner.spaId) fail();
}
export type Ref = { ref: string; field?: string };
export type Step = { key: string; action: string; data: Record<string, any> };
export const ref = (key: string, field = 'id'): Ref => ({ ref: key, field });
export function resolve(value: any, results: Map<string, any>): any {
  if (Array.isArray(value)) return value.map(v => resolve(v, results));
  if (value && typeof value === 'object') {
    if (typeof value.ref === 'string') {
      const result = results.get(value.ref)?.[value.field || 'id'];
      if (typeof result !== 'string' || !/^[a-f0-9]{24}$/i.test(result)) fail();
      return result;
    }
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, resolve(v, results)]));
  }
  return value;
}
export function plan(day: string): Step[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day+'T00:00:00Z').toISOString().slice(0,10) !== day) fail();
  const addDay = (n: number) => new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const steps: Step[] = [];
  const add = (key: string, action: string, data: Record<string, any>) => steps.push({key,action,data});
  add('book','openDay',{day,opening:0});
  for(let i=0;i<5;i++) add('staff'+i,'user',{name:`SYNTHETIC Staff ${i+1}`,phone:`00000001${String(i).padStart(2,'0')}`,password:'$STAFF_PASSWORD',cashier:i===0});
  for(let i=0;i<20;i++) add('customer'+i,'customer',{name:`SYNTHETIC Customer ${String(i+1).padStart(2,'0')}`,phone:`00000002${String(i).padStart(2,'0')}`,notes:SEED+'; fictional identity, do not contact'});
  const groups=['Goi dau','Cham soc da','Massage','Triet long','Chuyen sau','Thu gian'].map(x=>'SYNTHETIC '+x);
  for(let i=0;i<6;i++) add('group'+i,'serviceGroup',{name:groups[i]});
  const names=['Goi dau duong sinh','Cham soc da co ban','Nan mun','Massage co vai gay','Triet long tay','Triet long chan','Cham soc da chuyen sau'];
  for(let i=0;i<20;i++) add('service'+i,'service',{name:`SYNTHETIC ${names[i%7]} ${i+1}`,category:groups[i%6],price:100000+i*10000,duration:30,commission:10000});
  for(let i=0;i<10;i++) add('template'+i,'packageTemplate',{name:`SYNTHETIC Package ${i+1}`,serviceId:ref('service'+i),price:1000000,...(i===4||i===5?{packageType:'TIME',durationMonths:36}:{packageType:'SESSIONS',totalSessions:i===0?10:5})});
  for(let i=0;i<10;i++) add('product'+i,'product',{name:`SYNTHETIC Product ${i+1}`,sku:`SYNTHETIC-PREVIEW-${i+1}`,sizeMl:100,price:50000,minStock:3,origin:'Synthetic laboratory',description:SEED});
  // Ten manual movements: eight receipts and two issues; untouched products remain empty.
  for(let i=0;i<8;i++) add('stock-in'+i,'stockMovement',{productId:ref('product'+i),direction:'IN',quantity:i===1?3:20,reason:SEED});
  for(let i=0;i<2;i++) add('stock-out'+i,'stockMovement',{productId:ref('product'+i),direction:'OUT',quantity:i===1?2:1,reason:SEED});
  for(let i=0;i<12;i++) {
    const template=i%10;
    add('package'+i,'sellPackage',{customerId:ref('customer'+(i===4?3:i)),templateId:ref('template'+template),dueDate:addDay(7),startsOn:day,participantIds:[ref('staff0'),ref('staff1')],promotion:SEED,...(i===0?{giftCashCardAmount:200000,gifts:[{serviceId:ref('service19')}]}:{})});
    if(i!==6) add('package-pay'+i,'payment',{invoiceId:ref('package'+i,'invoiceId'),amount:i===7?500000:1000000,method:i%2?'CASH':'BANK_TRANSFER',transferReference:SEED,receivedConfirmation:true,note:SEED});
  }
  for(const [pkg,count,total] of [[0,3,10],[2,5,5]]) for(let i=0;i<count;i++) add(`use-${pkg}-${i}`,'use',{treatmentId:ref('package'+pkg),remainingBefore:total-i,staffId:ref('staff2')});
  // Both treatments belong to customer 3. No forged signature is generated.
  add('mixed','invoice',{customerId:ref('customer3'),serviceId:ref('service3'),staffId:ref('staff2'),treatments:[{treatmentId:ref('package3'),remainingBefore:5},{treatmentId:ref('package4'),remainingBefore:0}],additionalServices:[{serviceId:ref('service18'),total:280000}],additionalProducts:[{productId:ref('product0'),quantity:1,unitPrice:50000}]});
  add('pause','pauseTreatment',{id:ref('package5'),holdUntil:addDay(30),reason:SEED});
  for(let i=0;i<4;i++) add('card'+i,'sellCashCard',{customerId:ref('customer'+(12+i)),amount:200000,method:'CASH',receivedConfirmation:true,note:SEED});
  for(let i=0;i<8;i++) {
    add('invoice'+i,'serviceInvoice',{customerId:ref('customer'+(12+i%4)),staffId:ref('staff3'),items:[{serviceId:ref('service0'),total:i===7?90000:100000},...(i===6?[{serviceId:ref('service1'),total:110000}]:[])]});
    if(i<2) add('card-use'+i,'redeemCashCard',{cardId:ref('card'+i),invoiceId:ref('invoice'+i),amount:100000});
    if(i===4) add('card-empty','redeemCashCard',{cardId:ref('card0'),invoiceId:ref('invoice4'),amount:100000});
    if(i===2||i===3) add('invoice-pay'+i,'payment',{invoiceId:ref('invoice'+i),amount:i===2?100000:50000,method:'CASH',receivedConfirmation:true,note:SEED});
  }
  for(let i=0;i<5;i++) add('deposit'+i,'deposit',{customerId:ref('customer'+(i===3?7:i)),amount:100000,method:'CASH',note:SEED});
  add('allocate','allocate',{depositId:ref('deposit3'),invoiceId:ref('package7','invoiceId'),amount:100000,reason:SEED});
  for(let i=0;i<25;i++) {
    add('appointment'+i,'appointment',{customerId:ref('customer'+(i===0||i===1?3:i%16)),serviceId:ref('service'+(i===0||i===1?3:i%20)),staffId:ref('staff'+i%5),startAt:addDay(i+1)+'T10:00:00+07:00',notes:SEED,...(i===0?{treatmentIds:[ref('package3'),ref('package4')]}:i===1?{treatmentIds:[ref('package3')],serviceIds:[ref('service18')]}:i===2?{serviceIds:[ref('service2'),ref('service18')]}:{})});
    if(i===23||i===24) add('appointment-status'+i,'appointmentStatus',{id:ref('appointment'+i),status:i===23?'CANCELLED':'POSTPONED',reason:SEED});
  }
  for(let i=0;i<5;i++) {
    add('salary-policy'+i,'setSalaryPolicy',{staffId:ref('staff'+i),standardDays:26,paidLeaveDays:1,mode:'DAILY'});
    add('salary'+i,'setStaffSalary',{staffId:ref('staff'+i),baseSalary:6000000});
    for(let j=0;j<3;j++) add(`work-${i}-${j}`,'recordWorkday',{staffId:ref('staff'+i),day:addDay(-j-1),period:'FULL',note:SEED});
    add('leave'+i,'recordStaffLeave',{staffId:ref('staff'+i),day:addDay(-5),period:'FULL',type:i%2?'UNPERMITTED':'PERMITTED',note:SEED});
    add('review-leave'+i,'reviewStaffLeave',{id:ref('leave'+i),status:'APPROVED',paid:i%2===0});
    add('payroll'+i,'savePayroll',{staffId:ref('staff'+i),month:day.slice(0,7),attendanceConfirmed:true,bonus:100000,deductions:50000,note:SEED+'; synthetic bonus and deduction'});
  }
  return steps;
}
export function planFingerprint(steps: Step[]) { return createHash('sha256').update(JSON.stringify(steps)).digest('hex'); }
export async function runPlan(steps: Step[], password: string, execute: (action: string, data: any, key: string) => Promise<any>, validate: (action: string, data: any) => unknown) {
  const results = new Map<string,any>();
  for(const step of steps) {
    const data=resolve(step.data,results);
    if(step.action==='user') data.password=password;
    validate(step.action,data);
    const result=await execute(step.action,data,SEED+'-'+step.key);
    results.set(step.key,result);
  }
  return results;
}

// Pure reconciliation, also used against database snapshots after a write.
export function reconcile(rows: Record<string, any[]>) {
  const list=(name:string)=>rows[name]||[];
  const eq=(a:any,b:any)=>String(a)===String(b);
  const sum=(items:any[])=>items.reduce((n,r)=>n+r.amount,0);
  for(const inv of list('Invoice')) {
    const paid=sum(list('Payment').filter(p=>eq(p.invoiceId,inv._id)&&!p.reversed))+sum(list('Allocation').filter(p=>eq(p.invoiceId,inv._id)&&!p.reversed))+sum(list('CashCardUse').filter(p=>eq(p.invoiceId,inv._id)&&!p.reversedAt));
    if(inv.serviceItems?.length && inv.total!==inv.serviceItems.reduce((n:number,line:any)=>n+line.total,0)+(inv.productItems||[]).reduce((n:number,line:any)=>n+line.total,0)) fail();
    if(inv.kind==='PACKAGE') {
      const earned=sum([...list('SaleCommission'),...list('SharedSaleCommission')].filter(c=>eq(c.invoiceId,inv._id)));
      if(earned!==Math.floor((inv.paid-(inv.refunded||0))/20)||inv.saleCommissionAccrued!==earned) fail();
    }
    if(inv.paid!==paid || paid<0 || paid>inv.total || inv.status!==(paid===inv.total?'PAID':paid?'PARTIALLY_PAID':'OPEN')) fail();
  }
  for(const card of list('CashCard')) if(card.balance!==card.amount-sum(list('CashCardUse').filter(p=>eq(p.cardId,card._id)&&!p.reversedAt))||card.balance<0) fail();
  for(const dep of list('Deposit')) if(dep.balance!==dep.amount-sum(list('Allocation').filter(p=>eq(p.depositId,dep._id)&&!p.reversed))||dep.balance<0) fail();
  for(const product of list('Product')) {
    const movements=list('StockMovement').filter(p=>eq(p.productId,product._id));
    if(product.stock<0 || product.stock!==movements.reduce((n,m)=>n+(m.direction==='IN'?m.quantity:-m.quantity),0)) fail();
    if(movements.some(m=>m.before<0||m.after<0||m.after!==m.before+(m.direction==='IN'?m.quantity:-m.quantity))) fail();
  }
  for(const p of list('Payment')) {
    if(!list('Invoice').some(i=>eq(i._id,p.invoiceId))) fail();
    const cash=list('CashEntry').find(c=>eq(c._id,p.receiptId));
    if(!cash||cash.amount!==p.amount||cash.kind!=='PAYMENT'||cash.direction!=='IN') fail();
  }
  for(const t of list('Treatment')) {
    if(!list('Invoice').some(i=>eq(i._id,t.invoiceId)&&eq(i.customerId,t.customerId))) fail();
    if(t.packageType==='TIME' && t.usedSessions!==list('TreatmentUse').filter(u=>eq(u.treatmentId,t._id)).length) fail();
    if(t.packageType!=='TIME' && t.remaining!==t.totalSessions-list('TreatmentUse').filter(u=>eq(u.treatmentId,t._id)).length) fail();
  }
  for(const cash of list('CashEntry')) {
    const source=cash.kind==='PAYMENT'?'Payment':cash.kind==='DEPOSIT'?'Deposit':cash.kind==='CARD_SALE'?'CashCard':undefined;
    if(!source||!list(source).some(r=>eq(r.receiptId,cash._id)&&r.amount===cash.amount)) fail();
  }
  for(const a of list('Appointment')) {
    if(!list('Service').some(s=>eq(s._id,a.serviceId))) fail();
    if(!list('User').some(u=>eq(u._id,a.staffId))) fail();
    for(const id of a.treatmentIds||[]) if(!list('Treatment').some(t=>eq(t._id,id)&&eq(t.customerId,a.customerId))) fail();
  }
  for(const p of list('Payroll')) if(p.total!==p.earnedBase+p.commissionTotal+p.bonus-p.deductions-p.advance || p.total<0) fail();
  for(const use of list('TreatmentUse')) if(!list('Treatment').some(t=>eq(t._id,use.treatmentId)&&(!use.customerId||eq(t.customerId,use.customerId)))) fail();
  for(const a of list('Allocation')) if(!list('Deposit').some(d=>eq(d._id,a.depositId)&&list('Invoice').some(i=>eq(i._id,a.invoiceId)&&eq(i.customerId,d.customerId)))) fail();
  for(const use of list('CashCardUse')) if(!list('CashCard').some(c=>eq(c._id,use.cardId)&&list('Invoice').some(i=>eq(i._id,use.invoiceId)&&eq(i.customerId,c.customerId)&&i.kind==='SERVICE'&&!i.productItems?.length&&!i.treatmentId))) fail();
  for(const dep of [...list('Deposit'),...list('CashCard').filter(c=>c.origin==='PURCHASE')]) {
    const cash=list('CashEntry').find(c=>eq(c._id,dep.receiptId));
    if(!cash||cash.amount!==dep.amount||cash.direction!=='IN'||!['DEPOSIT','CARD_SALE'].includes(cash.kind)) fail();
  }
  for(const card of list('CashCard').filter(c=>c.origin==='GIFT')) if(!list('Invoice').some(i=>eq(i._id,card.sourceInvoiceId)&&i.giftCashCardAmount===card.amount)) fail();
  for(const name of ['Invoice','Treatment','Appointment','CashCard','Deposit']) for(const row of list(name)) if(!list('Customer').some(c=>eq(c._id,row.customerId))) fail();
}
