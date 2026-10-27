import test from 'node:test';import assert from 'node:assert/strict';
import {authConfig,authDecision} from './preview-auth-policy.mjs';
import {requestDecision} from './preview-bypass.mjs';
import {PREVIEW_ORIGIN} from './preview-network-policy.mjs';
const secret='OFFLINE-ONLY';
const event=(path,method='GET',extra={})=>({request:{url:PREVIEW_ORIGIN+path,method,headers:{}},...extra});
test('auth approval and synthetic-account configuration required before execution',()=>{
 assert.throws(()=>authConfig({}),{message:'AUTH_APPROVAL_REQUIRED'});
 const env={SELENIUM_AUTH_APPROVAL:'APPROVE-AUTH-SESSION-WRITES',SELENIUM_AUTH_PREFLIGHT:'VERIFIED-STAGING-AND-PUSH-BLOCKED'};
 assert.throws(()=>authConfig(env),{message:'SYNTHETIC_ACCOUNTS_REQUIRED'});
 Object.assign(env,{SELENIUM_VERIFIED_SPA_ID:'000000000000000000000002',SELENIUM_OTHER_EMPLOYEE_ID:'000000000000000000000001',SELENIUM_OWNER_IDENTIFIER:'synthetic-owner',SELENIUM_OWNER_PASSWORD:'offline-owner',SELENIUM_STAFF_IDENTIFIER:'synthetic-staff',SELENIUM_STAFF_PASSWORD:'offline-staff'});
 assert.equal(authConfig(env).length,2);
});
test('auth-only network policy permits exact login/logout and read endpoints',()=>{
 for(const [path,method] of [['/api/auth/login','POST'],['/api/auth/logout','POST'],['/api/workspace','GET'],['/api/payroll?month=2026-10','GET']]){
 const decision=authDecision(event(path,method),secret);assert.equal(decision.action,'continue');
 assert.equal(decision.headers.filter(h=>h.name==='x-vercel-protection-bypass').length,1);
 }
 assert.equal(authDecision(event('/login','GET',{redirectedRequestId:'previous'}),secret).action,'continue');
});
test('notification, operations, all other writes, foreign hosts and SSO redirects blocked without secret',()=>{
 for(const path of ['/api/notifications','/api/operations','/api/booking','/api/staff','/api/auth/register'])
 for(const method of ['GET','POST','DELETE'])assert.deepEqual(authDecision(event(path,method),secret),{action:'block'});
 for(const url of ['https://spacare-rho.vercel.app/','https://vercel.com/sso-api','https://other.vercel.app/']){
  const e=event('/');e.request.url=url;assert.deepEqual(authDecision(e,secret),{action:'block'});
 }
 assert.deepEqual(authDecision(event('/workspace','GET',{redirectedRequestId:'previous'}),secret),{action:'block'});
 assert.deepEqual(authDecision(event('/api/auth/login','POST'),undefined),{action:'block'});
});
test('public smoke remains incapable of login even after auth extension',()=>{
 assert.deepEqual(requestDecision(event('/api/auth/login','POST'),secret),{action:'block'});
});

test('whole-run interceptor admits only two distinct configured logins, never retries',async()=>{
 const {createAuthDecision}=await import('./preview-auth-policy.mjs');
 const decide=createAuthDecision(['owner','staff']);
 const login=id=>{const e=event('/api/auth/login','POST');e.request.postData=JSON.stringify({identifier:id,password:'offline-only'});return decide(e,secret);};
 assert.equal(login('owner').action,'continue');assert.equal(login('owner').action,'block');
 assert.equal(login('staff').action,'continue');assert.equal(login('staff').action,'block');
 assert.equal(login('foreign').action,'block');assert.equal(decide.summary().loginPosts,2);
 assert.equal(decide(event('/api/auth/logout','POST'),secret).action,'continue');
});
test('comparison staff must differ from logged-in STAFF and have verified spa',async()=>{
 const {assertComparisonStaff}=await import('./preview-auth-policy.mjs');
 const user={id:'000000000000000000000001',spaId:'000000000000000000000002',role:'STAFF'};
 assert.doesNotThrow(()=>assertComparisonStaff(user,'000000000000000000000003',user.spaId));
 assert.throws(()=>assertComparisonStaff(user,user.id,user.spaId));
 assert.throws(()=>assertComparisonStaff(user,'000000000000000000000003','other-spa'));
});

test('hard cap remains two even if a caller supplies three identities',async()=>{
 const {createAuthDecision}=await import('./preview-auth-policy.mjs');
 const decide=createAuthDecision(['a','b','c']);
 const actions=['a','b','c'].map(identifier=>{
  const e=event('/api/auth/login','POST');e.request.postData=JSON.stringify({identifier});return decide(e,secret).action;
 });
 assert.deepEqual(actions,['continue','continue','block']);assert.equal(decide.summary().loginPosts,2);
});
