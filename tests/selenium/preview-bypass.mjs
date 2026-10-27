import {currentPageCDP} from './preview-cdp.mjs';
import {PREVIEW_ORIGIN} from './preview-network-policy.mjs';
const HEADER='x-vercel-protection-bypass';
export function requireBypassSecret(env) {
  const value=env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if(typeof value!=='string'||!value.trim()||/[\r\n]/.test(value))
    throw new Error('BYPASS_SECRET_REQUIRED');
  return value;
}
export function requestDecision(event,secret) {
  let url;try{url=new URL(event.request.url);}catch{return {action:'block'};}
  // Fail closed on every redirect, including same-origin redirects.
  if(event.redirectedRequestId || url.origin!==PREVIEW_ORIGIN || url.username || url.password ||
    event.request.method!=='GET' || url.pathname.startsWith('/api/') ||
    !(url.pathname==='/'||url.pathname==='/login'||url.pathname.startsWith('/_next/static/')||
      url.pathname==='/favicon.ico'||/\.(?:png|svg|webp|jpg|jpeg|ico|woff2?)$/i.test(url.pathname)))
    return {action:'block'};
  if(!secret) return {action:'block'};
  const headers=Object.entries(event.request.headers||{})
    .filter(([name])=>name.toLowerCase()!==HEADER)
    .map(([name,value])=>({name,value:String(value)}));
  headers.push({name:HEADER,value:secret});
  return {action:'continue',headers};
}
// Secret travels only over the local CDP socket, then inside verified HTTPS.
// It is never configured as a global browser/proxy header.
export async function installBypass(driver,secret,connect=currentPageCDP,decide=requestDecision) {
  if(process.env.SELENIUM_REMOTE_URL)throw new Error('LOCAL_BROWSER_REQUIRED');
  const cdp=await connect(driver);
  const socketUrl=new URL(cdp._wsConnection.url);
  if(socketUrl.protocol!=='ws:'||!['127.0.0.1','localhost','[::1]'].includes(socketUrl.hostname))throw new Error('LOCAL_CDP_REQUIRED');
  const state={interceptionFailed:false,bypassRejected:false,redirectBlocked:false,
    navigationDocumentIntercepted:false,bypassHeaderAttached:false,
    documentResponseStatus:null,redirectTargetCategory:'none'};
  Object.defineProperty(state,'dispose',{value:()=>cdp.close?.()});
  Object.defineProperty(state,'resetNavigationTelemetry',{value:()=>{
    state.navigationDocumentIntercepted=false;state.bypassHeaderAttached=false;
    state.documentResponseStatus=null;state.redirectTargetCategory='none';
  }});
  const category=value=>{
    try{const u=new URL(value);return u.origin===PREVIEW_ORIGIN?'same-preview':u.hostname==='vercel.com'&&u.pathname.startsWith('/sso-api')?'vercel-sso':'outside-allowlist';}
    catch{return 'invalid-url';}
  };
  const documentRequest=p=>p.resourceType==='Document' &&
    (()=>{try{const u=new URL(p.request.url);return u.origin===PREVIEW_ORIGIN&&['/','/login'].includes(u.pathname);}catch{return false;}})();
  async function send(method,params) {
    const reply=await cdp.send(method,params);
    if(reply.error)throw new Error('BYPASS_INTERCEPTION_FAILED');
  }
  cdp._wsConnection.on('message',async raw=>{
    let event;try{event=JSON.parse(raw.toString());}catch{return;}
    if(event.sessionId!==cdp.sessionId)return;
    if(event.method==='Network.requestWillBeSent'&&event.params.type==='Document'&&event.params.redirectResponse){
      state.documentResponseStatus=event.params.redirectResponse.status;
      state.redirectTargetCategory=category(event.params.request.url);
      state.redirectBlocked=true;
      if(state.redirectTargetCategory==='vercel-sso')state.bypassRejected=true;
    }
    if(event.method==='Network.responseReceived'&&event.params.type==='Document')state.documentResponseStatus=event.params.response.status;
    if(event.method==='Network.responseReceived' && event.params.type==='Document' &&
      [401,403].includes(event.params.response.status))state.bypassRejected=true;
    if(event.method!=='Fetch.requestPaused')return;
    const paused=event.params;
    const navigation=documentRequest(paused);
    if(navigation)state.navigationDocumentIntercepted=true;
    try {
      const decision=decide(paused,secret);
      if(decision.action==='block') {
        if(paused.redirectedRequestId)state.redirectBlocked=true;
        await send('Fetch.failRequest',{requestId:paused.requestId,errorReason:'BlockedByClient'});
      }else {
        await send('Fetch.continueRequest',{requestId:paused.requestId,headers:decision.headers});
        if(navigation)state.bypassHeaderAttached=true;
      }
    }catch {
      state.interceptionFailed=true;
      try{await send('Fetch.failRequest',{requestId:paused.requestId,errorReason:'BlockedByClient'});}catch{}
    }
  });
  await send('Network.enable',{});
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  return state;
}
