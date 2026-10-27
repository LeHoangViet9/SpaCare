import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {requestDecision,requireBypassSecret,installBypass} from './preview-bypass.mjs';
import {PREVIEW_ORIGIN} from './preview-network-policy.mjs';
const secret='OFFLINE-SYNTHETIC-NOT-A-REAL-SECRET';
const event=(url,extra={})=>({requestId:'1',request:{url,method:'GET',headers:{Accept:'text/html'}},resourceType:'Document',...extra});
test('missing/empty/header-injection secret rejected without disclosing input',()=>{
 for(const value of [undefined,'',' ','bad\r\nheader'])assert.throws(()=>requireBypassSecret({VERCEL_AUTOMATION_BYPASS_SECRET:value}),{message:'BYPASS_SECRET_REQUIRED'});
});
test('exact Preview only receives one replacement bypass header',()=>{
 const e=event(PREVIEW_ORIGIN+'/login');e.request.headers['X-Vercel-Protection-Bypass']='stale';
 const d=requestDecision(e,secret);assert.equal(d.action,'continue');
 const h=d.headers.filter(h=>h.name.toLowerCase()==='x-vercel-protection-bypass');
 assert.equal(h.length,1);assert.equal(h[0].value,secret);
});
test('foreign hosts, wrong scheme/port, credentials, API, writes and redirects never receive secret',()=>{
 const inputs=[event('https://vercel.com/sso-api'),event('https://spacare-rho.vercel.app/'),
 event('https://other.vercel.app/'),event(PREVIEW_ORIGIN+'.evil.invalid/'),event(PREVIEW_ORIGIN+':444/'),
 event(PREVIEW_ORIGIN.replace('https:','http:')+'/'),event(PREVIEW_ORIGIN.replace('https://','https://user:pass@')+'/'),
 event(PREVIEW_ORIGIN+'/api/auth/login'),event(PREVIEW_ORIGIN+'/workspace'),
 event(PREVIEW_ORIGIN+'/login',{redirectedRequestId:'previous'})];
 const post=event(PREVIEW_ORIGIN+'/login');post.request.method='POST';inputs.push(post);
 for(const e of inputs){const d=requestDecision(e,secret);assert.equal(d.action,'block');assert.equal(JSON.stringify(d).includes(secret),false);assert.equal(d.headers,undefined);}
 assert.equal(requestDecision(event(PREVIEW_ORIGIN+'/'),undefined).action,'block');
});
test('interceptor transport sends header only on allowed request and fails denied request closed',async()=>{
 const ws=new EventEmitter();ws.url='ws://127.0.0.1:12345/devtools/page/offline';const calls=[];
 const cdp={sessionId:'test',_wsConnection:ws,send:async(method,params)=>{calls.push({method,params});return {result:{}};}};
 const prior=process.env.SELENIUM_REMOTE_URL;delete process.env.SELENIUM_REMOTE_URL;
 try {
 const state=await installBypass({createCDPConnection:async()=>cdp},secret,async()=>cdp);
 for(const e of [event(PREVIEW_ORIGIN+'/login'),event('https://vercel.com/sso-api'),event(PREVIEW_ORIGIN+'/',{redirectedRequestId:'previous'})])
  await Promise.all(ws.listeners('message').map(fn=>fn(JSON.stringify({sessionId:'test',method:'Fetch.requestPaused',params:e}))));
 assert.equal(calls.filter(c=>c.method==='Fetch.continueRequest').length,1);
 assert.equal(calls.filter(c=>c.method==='Fetch.failRequest').length,2);
 assert.equal(JSON.stringify(state).includes(secret),false);assert.equal(state.redirectBlocked,true);
 ws.emit('message',JSON.stringify({sessionId:'test',method:'Network.responseReceived',params:{type:'Document',response:{status:403}}}));
 assert.equal(state.bypassRejected,true);
 } finally {if(prior!==undefined)process.env.SELENIUM_REMOTE_URL=prior;}
});

test('CDP interception failure is recorded without exposing secret',async()=>{
 const ws=new EventEmitter();ws.url='ws://127.0.0.1:12345/devtools/page/offline';
 const cdp={sessionId:'test',_wsConnection:ws,send:async(method)=>method==='Fetch.continueRequest'?{error:{message:secret}}:{result:{}}};
 const prior=process.env.SELENIUM_REMOTE_URL;delete process.env.SELENIUM_REMOTE_URL;
 try {
  const state=await installBypass({createCDPConnection:async()=>cdp},secret,async()=>cdp);
  await Promise.all(ws.listeners('message').map(fn=>fn(JSON.stringify({sessionId:'test',method:'Fetch.requestPaused',params:event(PREVIEW_ORIGIN+'/')}))));
  assert.equal(state.interceptionFailed,true);assert.equal(JSON.stringify(state).includes(secret),false);
 }finally{if(prior!==undefined)process.env.SELENIUM_REMOTE_URL=prior;}
});

test('current WebDriver target selected, not first page; missing target fails closed',async()=>{
 const {selectCurrentPage}=await import('./preview-cdp.mjs');
 const targets=[{type:'page',id:'other'},{type:'page',id:'active'}];
 assert.equal(selectCurrentPage(targets,'CDwindow-active').id,'active');
 assert.throws(()=>selectCurrentPage(targets,'absent'),{message:'CURRENT_CDP_TARGET_NOT_FOUND'});
});
test('sessionless current-page Document events attach header and record SSO 302 safely',async()=>{
 const ws=new EventEmitter();ws.url='ws://127.0.0.1:12345/devtools/page/current';const calls=[];
 const cdp={_wsConnection:ws,send:async(method,params)=>{calls.push({method,params});return {result:{}};}};
 const prior=process.env.SELENIUM_REMOTE_URL;delete process.env.SELENIUM_REMOTE_URL;
 try{
 const state=await installBypass({},secret,async()=>cdp);
 const emit=async(method,params)=>Promise.all(ws.listeners('message').map(fn=>fn(JSON.stringify({method,params}))));
 for(const route of ['/','/login']){
 state.resetNavigationTelemetry();
 await emit('Fetch.requestPaused',event(PREVIEW_ORIGIN+route));
 assert.equal(state.navigationDocumentIntercepted,true);assert.equal(state.bypassHeaderAttached,true);
 assert.equal(calls.at(-1).params.headers.some(h=>h.name==='x-vercel-protection-bypass'&&h.value===secret),true);
 await emit('Network.responseReceived',{type:'Document',response:{status:200}});
 assert.equal(state.documentResponseStatus,200);
 }
 await emit('Network.requestWillBeSent',{type:'Document',redirectResponse:{status:302},request:{url:'https://vercel.com/sso-api?private=NOT_LOGGED'}});
 assert.equal(state.documentResponseStatus,302);assert.equal(state.redirectTargetCategory,'vercel-sso');assert.equal(state.bypassRejected,true);
 assert.equal(JSON.stringify(state).includes(secret),false);assert.equal(JSON.stringify(state).includes('private'),false);
 state.resetNavigationTelemetry();
 await emit('Fetch.requestPaused',event(PREVIEW_ORIGIN+'/api/notifications'));
 assert.equal(state.bypassHeaderAttached,false);assert.equal(state.navigationDocumentIntercepted,false);assert.equal(calls.at(-1).method,'Fetch.failRequest');
 await emit('Fetch.requestPaused',event('https://other.vercel.app/'));
 assert.equal(calls.at(-1).method,'Fetch.failRequest');
 await emit('Fetch.requestPaused',event(PREVIEW_ORIGIN+'/',{redirectedRequestId:'prev'}));
 assert.equal(calls.at(-1).method,'Fetch.failRequest');assert.equal(state.bypassHeaderAttached,false);
 }finally{if(prior!==undefined)process.env.SELENIUM_REMOTE_URL=prior;}
});
