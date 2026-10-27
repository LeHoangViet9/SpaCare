import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { resolve as pathResolve, relative, isAbsolute, basename, sep } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { previewConfig, assertPreviewOwner, plan, planFingerprint, runPlan, reconcile, SEED } from '../src/lib/preview-seed';

async function main() {
  const args=process.argv.slice(2);
  const options=new Map<string,string>();
  for(let i=0;i<args.length;i++) {
    const key=args[i];
    if(!['--check','--write','--env-file','--allow-host','--confirm'].includes(key)||options.has(key)) throw new Error();
    options.set(key,['--check','--write'].includes(key)?'true':args[++i]||'');
  }
  if(options.has('--check')===options.has('--write')) throw new Error();
  const write=options.has('--write');
  // Never let inherited deployment identity be erased by a local env file.
  if(Object.keys(process.env).some(k=>k.startsWith('VERCEL')&&process.env[k])) throw new Error();
  const file=pathResolve(options.get('--env-file')||'');
  if(['.env.local','.env.live.local'].includes(basename(file).toLowerCase())||!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink()||lstatSync(file).size>65536) throw new Error();
  const root=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
  const real=realpathSync(file), rel=relative(root,real);
  if(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep)) throw new Error(); // private configuration outside repo
  const cfg=parseEnv(readFileSync(real,'utf8'));
  const keys=['NODE_ENV','SPACARE_ENV','SPACARE_TARGET_DATABASE','MONGODB_URI','PREVIEW_OWNER_ID','PREVIEW_STAFF_PASSWORD'];
  const allowed=new Set([...keys,'SEED_OWNER_EMAIL','SEED_OWNER_PHONE','SEED_OWNER_PASSWORD','SEED_OWNER_NAME','SEED_SPA_NAME']);
  if(Object.keys(cfg).some(k=>!allowed.has(k))) throw new Error();
  const selected=Object.fromEntries(keys.map(k=>[k,cfg[k]]));
  const host=options.get('--allow-host')||'';
  const settings=previewConfig(selected,host,write,options.get('--confirm'));
  const { schemas, operate }=await import('../src/lib/operations');
  const validate=(action:string,data:any)=> {
    if(!Object.hasOwn(schemas,action)) throw new Error();
    schemas[action as keyof typeof schemas].parse(data);
  };
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'});
  // Real operation validators, placeholder IDs, no database driver calls.
  let index=0;
  await runPlan(plan(today),settings.password,async()=>{
    const id=(++index).toString(16).padStart(24,'0'); return {id,invoiceId:id};
  },validate);
  if(!write) {console.log('PASS: configuration, staging hostname, dependency graph and operation schemas. No database connection.');return;}

  for(const key of keys) delete process.env[key];
  Object.assign(process.env,selected);
  previewConfig(process.env,host,true,options.get('--confirm'));
  const mongoose=(await import('mongoose')).default;
  const models=await import('../src/lib/models');
  const {connect}=await import('../src/lib/db');
  try {
    await connect('maintenance');
    const owner=await models.User.findById(settings.ownerId).select('+passwordHash +baseSalary +salaryPolicy');
    assertPreviewOwner(owner,settings.ownerId);
    const ownerBefore=JSON.stringify(owner.toObject());
    const actor={id:String(owner._id),spaId:String(owner.spaId),name:owner.name,role:'OWNER' as const,cashier:owner.cashier};
    const scope={spaId:owner.spaId};
    const markerKey=SEED+'-manifest';
    // Manifest is an insert-only seed record, not a financial record or OWNER update.
    const manifest=await mongoose.connection.transaction(async session=>{
      const existing=await models.Idempotency.findOne({...scope,key:markerKey}).session(session);
      if(existing) return existing;
      for(const model of [models.Customer,models.Service,models.ServiceGroup,models.PackageTemplate,models.Product,models.Appointment,models.Invoice,models.Deposit,models.CashCard,models.Payroll,models.Workday,models.StaffLeave,models.Day,models.Treatment,models.TreatmentUse,models.CashEntry,models.Payment,models.Allocation,models.CashCardUse,models.StockMovement,models.ProductGroup,models.Commission,models.SaleCommission,models.SharedSaleCommission]) {
        if(await model.exists(scope).session(session)) throw new Error();
      }
      if(await models.User.exists({...scope,_id:{$ne:owner._id}}).session(session)) throw new Error();
      const foreign=await models.Idempotency.exists({...scope,key:new RegExp('^'+SEED+'-')}).session(session);
      if(foreign) throw new Error();
      return (await models.Idempotency.create([{...scope,userId:owner._id,key:markerKey,fingerprint:planFingerprint(plan(today)),result:{day:today}}],{session}))[0];
    });
    if(String(manifest.userId)!==actor.id||manifest.fingerprint!==planFingerprint(plan(manifest.result.day))) throw new Error();
    const steps=plan(manifest.result.day);
    const completeKey=SEED+'-complete';
    const completed=await models.Idempotency.exists({...scope,key:completeKey});
    if(!completed) {
      if(manifest.result.day!==today) throw new Error(); // no stale dates or implicit re-opening books
      await runPlan(steps,settings.password,async(action,data,key)=>{
        previewConfig(process.env,host,true,options.get('--confirm'));
        return operate(actor,action,data,key);
      },validate);
    }
    // Reconcile a transaction snapshot; never rewrite inconsistent records.
    await mongoose.connection.transaction(async session=>{
      const rows:Record<string,any[]>={};
      for(const name of ['Customer','Invoice','Payment','Allocation','CashCard','CashCardUse','Deposit','Product','StockMovement','CashEntry','Treatment','TreatmentUse','Appointment','User','Service','PackageTemplate','Payroll','Commission','SaleCommission','SharedSaleCommission','ServiceGroup','Workday','StaffLeave']) {
        const model=(models as any)[name];
        rows[name]=await model.find(scope).session(session).lean();
      }
      // Restrict this first version to a dedicated test spa; unrelated financial
      // histories are not guessed or repaired by the seed.
      reconcile(rows);
      if(!completed) {
        const counts:Record<string,number>={Customer:20,User:6,ServiceGroup:6,Service:20,PackageTemplate:10,Treatment:13,TreatmentUse:10,Appointment:25,Invoice:30,Product:10,StockMovement:11,CashCard:5,Deposit:5,Workday:15,StaffLeave:5,Payroll:5};
        for(const [name,count] of Object.entries(counts)) if(rows[name].length!==count) throw new Error();
      }
      const after=await models.User.findById(settings.ownerId).select('+passwordHash +baseSalary +salaryPolicy').session(session);
      if(!after||JSON.stringify(after.toObject())!==ownerBefore) throw new Error();
      if(!completed) await models.Idempotency.create([{...scope,userId:owner._id,key:completeKey,fingerprint:manifest.fingerprint,result:{synthetic:true,version:SEED}}],{session});
    });
    console.log(completed?'PASS: existing synthetic batch retained; reconciliation passed.':'PASS: synthetic batch completed; OWNER unchanged; reconciliation passed.');
  } finally {await mongoose.disconnect();}
}
main().catch(()=>{console.error('BLOCKED: preview seed failed. No secrets logged. Do not reset; investigate configuration or incomplete batch.');process.exitCode=1;});
