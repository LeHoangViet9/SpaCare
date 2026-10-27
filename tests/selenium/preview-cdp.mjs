// Connect directly to the current WebDriver tab. No first-tab guessing or nested CDP session.
import {EventEmitter} from 'node:events';
export function selectCurrentPage(targets,handle) {
  const targetId=handle.replace(/^CDwindow-/,'');
  const target=targets.find(t=>t.type==='page'&&t.id===targetId);
  if(!target)throw Error('CURRENT_CDP_TARGET_NOT_FOUND');
  return target;
}
export async function currentPageCDP(driver) {
  const caps=await driver.getCapabilities();
  const address=caps.get('goog:chromeOptions')?.debuggerAddress;
  const endpoint=new URL('http://'+address);
  if(endpoint.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||endpoint.username||endpoint.password)
    throw Error('LOCAL_CDP_REQUIRED');
  const response=await fetch(new URL('/json/list',endpoint),{redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('CDP_TARGET_LOOKUP_FAILED');
  const targets=await response.json();
  const target=selectCurrentPage(targets,await driver.getWindowHandle());
  const url=new URL(target.webSocketDebuggerUrl);
  if(url.protocol!=='ws:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.port!==endpoint.port||url.username||url.password)
    throw Error('LOCAL_CDP_REQUIRED');
  const socket=new WebSocket(url);
  const events=new EventEmitter();events.url=url.href;
  const pending=new Map();let serial=0;
  socket.addEventListener('message',event=>{
    let message;try{message=JSON.parse(String(event.data));}catch{return;}
    const waiting=pending.get(message.id);
    if(waiting){pending.delete(message.id);clearTimeout(waiting.timer);waiting.resolve(message);}
    else events.emit('message',String(event.data));
  });
  const closed=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('CDP_CLOSED'));}pending.clear();};
  socket.addEventListener('close',closed);socket.addEventListener('error',closed);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.close();reject(Error('CDP_OPEN_TIMEOUT'));},5000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP_OPEN_FAILED'));},{once:true});
  });
  return {_wsConnection:events,close:()=>socket.close(),send:(method,params)=>new Promise((resolve,reject)=>{
    const id=++serial;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_COMMAND_TIMEOUT'));},5000);
    pending.set(id,{resolve,reject,timer});
    try{socket.send(JSON.stringify({id,method,params}));}catch{clearTimeout(timer);pending.delete(id);reject(Error('CDP_SEND_FAILED'));}
  })};
}
