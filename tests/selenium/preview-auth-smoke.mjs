// Prepared only. Explicit approval is required; never invoked by public smoke.
import assert from 'node:assert/strict';
import {Builder,By} from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import http from 'node:http';import net from 'node:net';
import {PREVIEW_ORIGIN,allowedConnectTarget} from './preview-network-policy.mjs';
import {seleniumBaseUrl} from '../../src/lib/production-safety.mjs';
import {requireBypassSecret,installBypass} from './preview-bypass.mjs';
import {authConfig,createAuthDecision,assertComparisonStaff} from './preview-auth-policy.mjs';

let driver,proxy,bypass;const sockets=new Set(),results=[];
let requestPolicy;let authenticated=false,step='approval';
let diagnostic={phase:'approval',httpStatus:null,errorCode:null};
const safeErrorNames=new Set(['TimeoutError','ScriptTimeoutError','NoSuchElementError','ElementNotInteractableError','ElementClickInterceptedError','StaleElementReferenceError','JavascriptError','WebDriverError']);
function safeError(error){return safeErrorNames.has(error?.name)?error.name:'UNCLASSIFIED_ERROR';}
function diagnosticError(code){const error=new Error();error.safeCode=code;return error;}
async function visible(selector){return driver.wait(async()=>{
 for(const el of await driver.findElements(By.css(selector)))try{if(await el.isDisplayed()&&await el.isEnabled())return el;}catch(error){
  if(error?.name!=='StaleElementReferenceError')throw error;
 }
 return false;
},25000);}
async function prepareLogoutPage(){
 const current=new URL(await driver.getCurrentUrl());
 diagnostic={phase:'logout-page',httpStatus:null,errorCode:null,
  pageBeforeLogout:['/workspace','/workspace/staff','/login','/'].includes(current.pathname)?current.pathname:'other'};
 if(current.origin!==PREVIEW_ORIGIN){diagnostic.errorCode='LOGOUT_ORIGIN_BLOCKED';throw diagnosticError(diagnostic.errorCode);}
 // Direct-URL authorization leaves STAFF on a denied section without the app shell.
 // Restore an approved workspace page; do not re-login or alter the denial assertion.
 await driver.get(PREVIEW_ORIGIN+'/workspace');
 const restored=new URL(await driver.getCurrentUrl());
 if(restored.origin!==PREVIEW_ORIGIN||restored.pathname!=='/workspace'){
  diagnostic.errorCode='LOGOUT_WORKSPACE_NOT_RESTORED';throw diagnosticError(diagnostic.errorCode);
 }
 diagnostic.workspaceRestored=true;
}
async function api(route,{requireJson=true,timeoutMs=5000}={}){
 let result;
 try{result=await driver.executeAsyncScript(`const done=arguments[arguments.length-1],comparisonId=arguments[1];
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),arguments[2]);
 let status=0;
 fetch(arguments[0],{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async r=>{
 status=r.status;let d;
 try{d=await r.json();}catch(error){
 done({status,bodyFormat:'non-json',errorCode:error.name==='AbortError'?'FETCH_TIMEOUT':'BODY_JSON_PARSE_FAILED'});return;
 }
 const forbidden=['passwordHash','tokenHash','password','token'];
 function sensitive(x){return x&&typeof x==='object'&&Object.entries(x).some(([k,v])=>forbidden.includes(k)||sensitive(v));}
 const other=String(comparisonId||'').toLowerCase();
 const comparisonInSpa=Array.isArray(d?.staff)&&d.staff.some(s=>String(s._id).toLowerCase()===other&&s.role==='STAFF'&&s.active===true&&String(s._id)!==String(d?.user?.id));
 done({status,bodyFormat:'json',errorCode:null,role:d?.user?.role,id:d?.user?.id,spaId:d?.user?.spaId,comparisonInSpa,sensitive:!!sensitive(d)});
 }).catch(error=>done({status,errorCode:error.name==='AbortError'?'FETCH_TIMEOUT':'FETCH_FAILED'})).finally(()=>clearTimeout(timer));`,route,process.env.SELENIUM_OTHER_EMPLOYEE_ID,timeoutMs);
 }catch(error){result={status:0,errorCode:'SCRIPT_INTERRUPTED_OR_FAILED',errorType:safeError(error)};}
 if(requireJson&&(result.bodyFormat!=='json'||result.errorCode)){
 diagnostic={...diagnostic,httpStatus:result.status,errorCode:result.errorCode||'JSON_REQUIRED'};
 throw diagnosticError(diagnostic.errorCode);
 }
 return result;
}
async function uiLogout(){
 await prepareLogoutPage();
 diagnostic.phase='logout-button-find';
 let button;
 try{button=await visible('button[aria-label="\u0110\u0103ng xu\u1ea5t"]');}
 catch(error){diagnostic.errorCode='LOGOUT_BUTTON_NOT_AVAILABLE';throw error;}
 diagnostic.phase='logout-button-click';
 try{await button.click();}catch(error){diagnostic.errorCode='LOGOUT_BUTTON_CLICK_FAILED';throw error;}
 diagnostic.phase='logout-confirmation';
 const deadline=Date.now()+15000;
 const observed={parseErrors:0,fetchFailures:0,scriptInterruptions:0,httpMismatches:0};
 try{
  await driver.wait(async()=>{
   const remaining=deadline-Date.now();if(remaining<=0)return false;
   const probe=await api('/api/workspace',{requireJson:false,timeoutMs:Math.min(1000,remaining)});
   diagnostic.httpStatus=probe.status;diagnostic.errorCode=probe.errorCode||null;
   if(probe.errorCode==='BODY_JSON_PARSE_FAILED')observed.parseErrors++;
   if(['FETCH_FAILED','FETCH_TIMEOUT'].includes(probe.errorCode))observed.fetchFailures++;
   if(probe.errorCode==='SCRIPT_INTERRUPTED_OR_FAILED')observed.scriptInterruptions++;
   if(probe.status===401){
    // A received 401 proves revocation even if its body is not JSON.
    // An aborted/incomplete body is not mistaken for a JSON parse failure.
    if(probe.errorCode&&probe.errorCode!=='BODY_JSON_PARSE_FAILED')return false;
    return Date.now()<=deadline;
   }
   if(probe.status){observed.httpMismatches++;diagnostic.errorCode=probe.errorCode||'HTTP_STATUS_MISMATCH';}
   return false;
  },15000);
 }catch(error){
  diagnostic={...diagnostic,observed,errorCode:diagnostic.errorCode||'LOGOUT_NOT_CONFIRMED',
   timeoutCode:Date.now()>=deadline||error?.name==='TimeoutError'?'LOGOUT_TIMEOUT_15S':null};
  throw error;
 }
 diagnostic={...diagnostic,observed};authenticated=false;
}
async function logout(){
 const status=await driver.executeAsyncScript(`const done=arguments[arguments.length-1];fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'}).then(r=>done(r.status)).catch(()=>done(0));`);
 assert.equal(status,200);authenticated=false;
}
async function check(id,fn){step=id;diagnostic={phase:id,httpStatus:null,errorCode:null};await fn();if(bypass?.interceptionFailed)throw diagnosticError('INTERCEPTION_FAILED');results.push({id,status:'PASS',...(id.endsWith('-LOGOUT')?{diagnostic:{...diagnostic}}:{})});}
try {
 const accounts=authConfig(process.env); // Must fail before browser/network without approval.
 assert.equal(seleniumBaseUrl(process.env).origin,PREVIEW_ORIGIN);
 assert.ok(!process.env.SELENIUM_REMOTE_URL);
 const secret=requireBypassSecret(process.env);
 assert.ok(process.env.SELENIUM_CHROME_BINARY&&process.env.SELENIUM_DRIVER_BINARY);
 proxy=http.createServer((req,res)=>{res.writeHead(403);res.end();});
 proxy.on('connect',(req,client,head)=>{
  if(!allowedConnectTarget(req.url)){client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
  const remote=net.connect(443,new URL(PREVIEW_ORIGIN).hostname,()=>{
   client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)remote.write(head);client.pipe(remote);remote.pipe(client);
  });sockets.add(remote);remote.on('close',()=>sockets.delete(remote));
  remote.on('error',()=>client.destroy());client.on('error',()=>remote.destroy());client.on('close',()=>remote.destroy());
 });
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'spacare-auth-incognito-'));
 const options=new chrome.Options().setChromeBinaryPath(process.env.SELENIUM_CHROME_BINARY)
  .excludeSwitches('disable-popup-blocking').setUserPreferences({'credentials_enable_service':false,'profile.default_content_setting_values.notifications':2})
  .addArguments('--headless=new','--incognito','--user-data-dir='+profile,'--disable-background-networking','--disable-sync','--no-first-run','--disable-quic',
   '--proxy-server=http://127.0.0.1:'+proxy.address().port,'--proxy-bypass-list=<-loopback>');
 driver=await new Builder().forBrowser('chrome').setChromeService(new chrome.ServiceBuilder(process.env.SELENIUM_DRIVER_BINARY)).setChromeOptions(options).build();
 requestPolicy=createAuthDecision(accounts.map(a=>a.identifier.trim()));
 bypass=await installBypass(driver,secret,undefined,requestPolicy);
 await driver.manage().setTimeouts({implicit:0,pageLoad:30000,script:15000});
 await driver.get(PREVIEW_ORIGIN+'/login');
 await check('AUTH-UNAUTH-API',async()=>assert.equal((await api('/api/workspace')).status,401));
 await check('AUTH-UNAUTH-DIRECT',async()=>{
  await driver.get(PREVIEW_ORIGIN+'/workspace');await visible('#login-password');
  assert.equal(new URL(await driver.getCurrentUrl()).origin,PREVIEW_ORIGIN);
  assert.equal(new URL(await driver.getCurrentUrl()).pathname,'/login');
 });
 for(const account of accounts){
  const prefix='AUTH-'+account.role;
  await check(prefix+'-LOGIN',async()=>{
   await driver.get(PREVIEW_ORIGIN+'/login');
   await (await visible('input[autocomplete="username"]')).sendKeys(account.identifier);
   await (await visible('#login-password')).sendKeys(account.password);
   authenticated=true; // Cleanup also attempted if a successful login response is lost.
   await (await visible('button[type="submit"]')).click();
   await driver.wait(async()=>new URL(await driver.getCurrentUrl()).pathname==='/workspace',25000);
   authenticated=true;
   const result=await api('/api/workspace');assert.equal(result.status,200);assert.equal(result.role,account.role);assert.equal(result.sensitive,false);
   if(account.role==='STAFF'){
    const scoped=await api('/api/workspace?section=salary');
    assertComparisonStaff(scoped,process.env.SELENIUM_OTHER_EMPLOYEE_ID,process.env.SELENIUM_VERIFIED_SPA_ID);
    assert.equal(scoped.comparisonInSpa,true);
   }
  });
  await check(prefix+'-PERSIST',async()=>{await driver.navigate().refresh();assert.equal((await api('/api/workspace')).role,account.role);});
  await check(prefix+'-ROLE-API',async()=>assert.equal((await api('/api/workspace?section=staff')).status,account.role==='OWNER'?200:403));
  await check(prefix+'-DIRECT-STAFF',async()=>{
   await driver.get(PREVIEW_ORIGIN+'/workspace/staff');
   assert.equal(new URL(await driver.getCurrentUrl()).origin,PREVIEW_ORIGIN);
   assert.equal((await api('/api/workspace?section=staff')).status,account.role==='OWNER'?200:403);
   // API denial asserted; no claim that hidden UI alone establishes authorization.
  });
  await check(prefix+'-PAYROLL-READ',async()=>{
   const month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
   const own=await api('/api/payroll?month='+month);assert.equal(own.status,200);assert.equal(own.sensitive,false);
   if(account.role==='STAFF'){
    const other=process.env.SELENIUM_OTHER_EMPLOYEE_ID;
    assert.ok(/^[a-f0-9]{24}$/i.test(other||''),'Verified other synthetic staff ID required');
    assert.equal((await api('/api/payroll?month='+month+'&employee='+other)).status,403);
   }
  });
  await check(prefix+'-LOGOUT',uiLogout);
  await check(prefix+'-COOKIE-ABSENCE',async()=>{
   await driver.manage().deleteCookie('spacare_session');
   assert.equal((await api('/api/workspace')).status,401);
   await driver.get(PREVIEW_ORIGIN+'/workspace');await visible('#login-password');
   assert.equal(new URL(await driver.getCurrentUrl()).pathname,'/login');
  });
 }
 results.push({id:'AUTH-SERVER-EXPIRATION',status:'NOT_RUN',reason:'No server clock or session record modification permitted; logout revocation tested separately.'});
}catch(error){results.push({id:step,status:step==='approval'?'BLOCKED':'FAIL',reason:'AUTH_CHECK_BLOCKED_OR_FAILED',diagnostic:{...diagnostic,errorType:safeError(error)}});process.exitCode=1;}
finally{
 // Only revoke this browser session, never touch business records or OWNER.
 if(driver&&authenticated)try{await logout();results.push({id:'SESSION-CLEANUP',status:'PASS'});}catch{results.push({id:'SESSION-CLEANUP',status:'BLOCKED',reason:'Session may remain until 8h expiry; no token persisted for retry.'});}
 bypass?.dispose();if(driver)try{await driver.quit();}catch{}
 for(const s of sockets)s.destroy();if(proxy){proxy.closeAllConnections();proxy.close();}
 const output=path.resolve('outputs/selenium/auth-smoke-'+Date.now());await fs.mkdir(output,{recursive:true});
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify({origin:PREVIEW_ORIGIN,loginBudget:requestPolicy?.summary(),results},null,2));
 for(const row of results)console.log(row.id+': '+row.status);
}
