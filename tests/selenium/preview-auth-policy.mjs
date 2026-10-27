import {PREVIEW_ORIGIN} from './preview-network-policy.mjs';
import {requestDecision} from './preview-bypass.mjs';
export function authConfig(env) {
 if(env.SELENIUM_AUTH_APPROVAL!=='APPROVE-AUTH-SESSION-WRITES' ||
    env.SELENIUM_AUTH_PREFLIGHT!=='VERIFIED-STAGING-AND-PUSH-BLOCKED')throw Error('AUTH_APPROVAL_REQUIRED');
 const accounts=['OWNER','STAFF'].map(role=>{
  const identifier=env['SELENIUM_'+role+'_IDENTIFIER'],password=env['SELENIUM_'+role+'_PASSWORD'];
  if(!identifier||!password)throw Error('SYNTHETIC_ACCOUNTS_REQUIRED');
  return {role,identifier,password};
 });
 if(!/^[a-f0-9]{24}$/i.test(env.SELENIUM_OTHER_EMPLOYEE_ID||''))throw Error('VERIFIED_OTHER_EMPLOYEE_REQUIRED');
 if(!/^[a-f0-9]{24}$/i.test(env.SELENIUM_VERIFIED_SPA_ID||''))throw Error('VERIFIED_SPA_REQUIRED');
 if(accounts[0].identifier===accounts[1].identifier)throw Error('DISTINCT_ACCOUNTS_REQUIRED');
 return accounts;
}
export function authDecision(event,secret) {
 let u;try{u=new URL(event.request.url);}catch{return {action:'block'};}
 if(u.origin!==PREVIEW_ORIGIN||u.username||u.password||!secret)return {action:'block'};
 const method=event.request.method;
 const authPost=method==='POST'&&['/api/auth/login','/api/auth/logout'].includes(u.pathname)&&!event.redirectedRequestId;
 const apiRead=method==='GET'&&['/api/workspace','/api/payroll'].includes(u.pathname)&&!event.redirectedRequestId;
 const page=method==='GET'&&['/','/login','/workspace','/workspace/staff'].includes(u.pathname)&&
   (!event.redirectedRequestId||u.pathname==='/login');
 if(authPost||apiRead||page){
  // Reuse exact-origin header construction without broadening public-smoke policy.
  const headers=requestDecision({...event,redirectedRequestId:undefined,request:{...event.request,url:PREVIEW_ORIGIN+'/',method:'GET'}},secret).headers;
  return {action:'continue',headers};
 }
 return requestDecision(event,secret);
}

// One closure per entire browser run. Consume budget before awaiting CDP.
export function createAuthDecision(identifiers) {
 let loginPosts=0,limitBlocked=false;const attempted=new Set();
 const decide=(event,secret)=>{
  const decision=authDecision(event,secret);
  if(decision.action!=='continue')return decision;
  const url=new URL(event.request.url);
  if(event.request.method==='POST'&&url.pathname==='/api/auth/login') {
   let identifier;try{identifier=JSON.parse(event.request.postData).identifier;}catch{return {action:'block'};}
   if(typeof identifier!=='string'||!identifiers.includes(identifier)||attempted.has(identifier)||loginPosts>=2){limitBlocked=true;return {action:'block'};}
   attempted.add(identifier);loginPosts++;
  }
  return decision;
 };
 Object.defineProperty(decide,'summary',{value:()=>({loginPosts,limitBlocked})});
 return decide;
}
export function assertComparisonStaff(user,otherId,otherSpaId) {
 if(!user||user.role!=='STAFF'||!user.id||!user.spaId||
    !/^[a-f0-9]{24}$/i.test(otherId||'')||String(user.id).toLowerCase()===String(otherId).toLowerCase()||
    String(user.spaId).toLowerCase()!==String(otherSpaId).toLowerCase())throw Error('COMPARISON_STAFF_BLOCKED');
}
