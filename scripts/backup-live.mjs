import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
let temporary;
try {
 const exe=process.argv[2], uri=process.env.MONGODB_URI||'';
 const target=new URL(uri);
 if(!exe||!fs.existsSync(exe)||!['mongodb:','mongodb+srv:'].includes(target.protocol)||target.pathname!=='/spacare_live'||process.env.VERCEL) throw Error();
 const folder=path.resolve('outputs/backups'); fs.mkdirSync(folder,{recursive:true});
 const archive=path.join(folder,`spacare_live-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}.archive.gz`);
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'spacare-backup-'));
 if(process.platform==='win32') {
  const account=process.env.USERDOMAIN+'\\'+process.env.USERNAME;
  const acl=spawnSync('icacls.exe',[temporary,'/inheritance:r','/grant:r',account+':(OI)(CI)F'],{stdio:'ignore'});
  if(acl.status!==0) throw Error();
 } else fs.chmodSync(temporary,0o700);
 const config=path.join(temporary,'config.yml');
 fs.writeFileSync(config,'uri: '+JSON.stringify(uri)+'\n',{flag:'wx',mode:0o600});
 console.log('Dang sao luu chi doc spacare_live. Khong nhap/sua du lieu trong luc nay.');
 const result=spawnSync(exe,['--config',config,'--db','spacare_live','--gzip','--archive='+archive],{stdio:'ignore'});
 if(result.status!==0) throw Error();
 const data=fs.readFileSync(archive);
 if(data.length<20||data[0]!==31||data[1]!==139) throw Error();
 fs.writeFileSync(archive+'.json',JSON.stringify({database:'spacare_live',createdAt:new Date().toISOString(),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),restoreTested:false},null,2),{flag:'wx'});
 console.log('Sao luu thanh cong:',archive);
 console.log('Da tao SHA256. Chua thu khoi phuc.');
} catch {
 console.error('Sao luu KHONG thanh cong. Khong dung file chua hoan tat. Kiem tra cong cu, ket noi, quyen va cau hinh spacare_live; khong gui URI/mat khau len chat.');
 process.exitCode=1;
} finally {
 if(temporary) fs.rmSync(temporary,{recursive:true,force:true});
}
