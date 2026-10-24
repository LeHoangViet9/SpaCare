import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connect, DatabaseUnavailableError } from '../src/lib/db';
import { SeedOwnerError, seedOwnerConfig } from '../src/lib/seed-owner';
import { DomainError } from '../src/lib/rules';
import { checkOpeningTarget, parseOpening, openingSummary, openingMapping, openingOwner, inspectOpening, writeOpening, checkOpeningIndexes } from '../src/lib/opening-balances';
async function main(){
  const options=new Map<string,string>(),flags=new Set<string>();const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++){const a=args[i];if(['--check','--write','--app-ready'].includes(a)){if(flags.has(a))throw new Error('DUPLICATE_ARGUMENT');flags.add(a);}else if(['--file','--database','--mapping','--approve','--batch','--report'].includes(a)&&args[i+1]&&!args[i+1].startsWith('--')){if(options.has(a))throw new Error('DUPLICATE_ARGUMENT');options.set(a,args[++i]);}else throw new Error('INVALID_ARGUMENT');}
  const file=options.get('--file');if(!file)throw new Error('FILE_REQUIRED');
  if(fs.statSync(file).size>2*1024*1024)throw new Error('FILE_TOO_LARGE');
  const data=parseOpening(JSON.parse(fs.readFileSync(file,'utf8')));
  console.log('Đối chiếu ngoại tuyến:',openingSummary(data));
  if(!flags.has('--check')&&!flags.has('--write')){console.log('Chưa kết nối hoặc ghi database.');return;}
  const database=options.get('--database')||'';checkOpeningTarget(process.env.MONGODB_URI||'',database);
  if(data.targetDatabase!==database)throw new Error('SOURCE_TARGET_MISMATCH');
  const mapping=openingMapping.parse(options.has('--mapping')?JSON.parse(fs.readFileSync(options.get('--mapping')!,'utf8')):{});
  if(flags.has('--check')&&!flags.has('--write')) {
    const timer=setTimeout(()=>{console.error('Đối chiếu chỉ đọc hết thời gian chờ kết nối. Chưa ghi database.',{code:'READ_ONLY_CHECK_TIMEOUT'});process.exit(1);},20000);timer.unref();
  }
  const identity=seedOwnerConfig(process.env);await connect();const owner=await openingOwner(identity);await checkOpeningIndexes();
  const batch=options.get('--batch');if(!batch)throw new Error('BATCH_REQUIRED');
  if(flags.has('--write')){
    if(!flags.has('--app-ready')||!options.get('--approve'))throw new Error('APP_READY_AND_APPROVAL_REQUIRED');
    const result=await writeOpening(identity,data,mapping,options.get('--approve')!,batch);console.log('Đã nhập số dư lịch sử:',result.summary);console.log('Không ghi khoản thu hoặc hoa hồng lịch sử.');return;
  }
  const report=await inspectOpening(owner,data,mapping);const output=path.resolve(options.get('--report')||'imports/opening-live-check.json');
  const root=path.resolve('imports')+path.sep;if(!output.startsWith(root))throw new Error('REPORT_MUST_STAY_IN_IGNORED_IMPORTS');
  fs.writeFileSync(output,JSON.stringify({...report,batch},null,2)+'\n');
  console.log('Đối chiếu chỉ đọc. Lỗi cần xử lý:',report.errors);console.log('Mã duyệt:',report.approval);console.log('Bản đối chiếu đã lưu trong imports. Chưa ghi database.');
}
main().catch(error=>{if(error instanceof DomainError || error instanceof SeedOwnerError)console.error(error.message);else if(error instanceof DatabaseUnavailableError)console.error('Không kết nối được database.',{code:error.code});else console.error('Chưa nhập số dư. Kiểm tra file, tham số, tài khoản và kết nối. Không thay dữ liệu cũ.');process.exitCode=1;}).finally(()=>mongoose.disconnect());
