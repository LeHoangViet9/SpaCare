import fs from 'node:fs';
import { confirmedHairRemovalName } from '../src/lib/hair-removal-import';
import mongoose from 'mongoose';
import { connect, DatabaseUnavailableError } from '../src/lib/db';
import { Service, Idempotency } from '../src/lib/models';
import { seedOwnerConfig } from '../src/lib/seed-owner';
import { DomainError, ensure } from '../src/lib/rules';
import { parseOpening, openingSummary, checkOpeningTarget, openingOwner, checkOpeningIndexes, inspectOpening, writeOpening, openingKey } from '../src/lib/opening-balances';
import { assertWritesAllowed } from '../src/lib/write-freeze.ts';

async function main(){
  assertWritesAllowed();
  const args=process.argv.slice(2);
  ensure(args.length<=1 && args.every(a=>['--check','--write'].includes(a)), 'Use --check or --write.');
  const data=parseOpening(JSON.parse(fs.readFileSync('imports/hair-removal.opening.json','utf8')));
  for(const customer of data.customers) customer.name=confirmedHairRemovalName(customer.name,customer.phone);
  console.log('Offline summary:',openingSummary(data));
  if(!args.length){console.log('No database connection or writes.');return;}
  checkOpeningTarget(process.env.MONGODB_URI||'', 'spacare_live');
  ensure(data.targetDatabase==='spacare_live','Unexpected source target.');
  const identity=seedOwnerConfig(process.env);
  await connect();
  const owner=await openingOwner(identity);
  await checkOpeningIndexes();
  const services=await Service.find({spaId:owner.spaId,active:true}).lean();
  const key=(s:string)=>openingKey(s).replace(/^tri\u1ec7t(?: l\u00f4ng)?\s+/u,'');
  const mapping:Record<string,string>={};
  for(const name of new Set(data.customers.flatMap(c=>c.treatments.map(t=>t.serviceName)))){
    const matches=services.filter(s=>key(s.name)===key(name));
    ensure(matches.length===1,'Service must match exactly once: '+name);
    mapping[name]=String(matches[0]._id);
  }
  const batch='hair-removal-opening-20261025';
  const previous=await Idempotency.exists({spaId:owner.spaId,key:'opening-'+batch});
  if(previous && args[0]==='--write'){
    const result=await writeOpening(identity,data,mapping,'',batch);
    console.log('Batch already imported; no duplicate writes:',result.summary);return;
  }
  const report=await inspectOpening(owner,data,mapping);
  fs.writeFileSync('imports/hair-removal.live-check.json',JSON.stringify(report,null,2)+'\n');
  console.log('Reconciliation errors:',report.errors);
  ensure(!report.errors.length,'Resolve reconciliation errors before importing.');
  if(args[0]!=='--write'){console.log('Read-only check complete. No writes.');return;}
  const result=await writeOpening(identity,data,mapping,report.approval,batch);
  console.log('Imported:',result.summary);
  console.log('No historical receipts or commissions created.');
}
const timer=setTimeout(()=>{console.error('Import timed out. Check the same batch again before retrying.');process.exit(1);},30000);timer.unref();
main().catch(error=>{
  if(error instanceof DatabaseUnavailableError)console.error('Database unavailable:',error.code);
  else if(error instanceof DomainError)console.error(error.message);
  else console.error('Import stopped. Check file, owner configuration and connection.');
  process.exitCode=1;
}).finally(async()=>{clearTimeout(timer);await mongoose.disconnect();});
