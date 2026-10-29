import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const cli=resolve('node_modules/@playwright/test/cli.js');
const config='playwright.per-line.config.cjs';

function run(args,timeoutMs,label){
 return new Promise((resolveRun,reject)=>{
  const child=spawn(process.execPath,[cli,...args],{stdio:'inherit',env:process.env});
  let timedOut=false;
  const timer=setTimeout(()=>{
   timedOut=true;
   console.error(`BLOCKED_PLAYWRIGHT_${label}_TIMEOUT: exceeded ${timeoutMs}ms`);
   child.kill('SIGTERM');
   setTimeout(()=>child.kill('SIGKILL'),2000).unref();
  },timeoutMs);
  child.once('error',error=>{clearTimeout(timer);reject(new Error(`BLOCKED_PLAYWRIGHT_${label}_SPAWN: ${error.code || 'UNKNOWN'}`));});
  child.once('exit',(code,signal)=>{
   clearTimeout(timer);
   if(timedOut)return reject(new Error(`BLOCKED_PLAYWRIGHT_${label}_TIMEOUT`));
   if(code!==0)return reject(new Error(`BLOCKED_PLAYWRIGHT_${label}_EXIT_${code ?? signal ?? 'UNKNOWN'}`));
   resolveRun();
  });
 });
}

// Discovery imports config/tests but cannot launch a browser. A hang blocks the run.
await run(['test',`--config=${config}`,'--list','--reporter=line'],20_000,'DISCOVERY');
// The suite has Playwright's per-test timeout plus this whole-process watchdog.
await run(['test',`--config=${config}`],300_000,'SUITE');
