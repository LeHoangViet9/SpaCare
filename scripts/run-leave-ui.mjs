// Manage only the in-memory leave fixture; no app credentials or database are used.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
await new Promise((yes,no)=>{const probe=createServer();probe.once('error',()=>no(Error('Local test port 3231 is occupied; refusing to reuse it.')));probe.listen(3231,'127.0.0.1',()=>probe.close(yes));});
let server,cli;
try {
 server=spawn(process.execPath,['scripts/test-leave-ui.mjs'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 await new Promise((yes,no)=>{
  const timer=setTimeout(()=>no(Error('Leave fixture startup timed out.')),15000);
  server.once('error',error=>{clearTimeout(timer);no(error);});
  server.once('exit',()=>{clearTimeout(timer);no(Error('Leave fixture exited before startup.'));});
  server.stdout.on('data',chunk=>{process.stdout.write(chunk);if(String(chunk).includes('in-memory only')){clearTimeout(timer);yes();}});
 });
 cli=spawn(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test','--config','playwright.leave.config.mjs'],{env:{...process.env,SPACARE_LEAVE_UI_MANAGED:'1'},windowsHide:true,stdio:'inherit'});
 const code=await new Promise((yes,no)=>{
  const timer=setTimeout(()=>{cli.kill();no(Error('Leave responsive suite exceeded its 90 second watchdog.'));},90000);
  cli.once('error',error=>{clearTimeout(timer);no(error);});cli.once('close',code=>{clearTimeout(timer);yes(code);});
 });
 process.exitCode=code ?? 1;
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {
 for(const child of [cli,server]) if(child && child.exitCode===null && child.signalCode===null){
  child.kill();await Promise.race([new Promise(yes=>child.once('close',yes)),new Promise(yes=>setTimeout(yes,3000))]);
  if(child.exitCode===null && child.signalCode===null){console.error('Owned leave test process did not exit.');process.exitCode=1;}
 }
}
