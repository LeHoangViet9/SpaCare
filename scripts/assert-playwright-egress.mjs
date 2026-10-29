import net from 'node:net';
import {lookup} from 'node:dns/promises';

const base=new URL(process.env.SPACARE_UI_BASE_URL || '');
if(Number(process.versions.node.split('.')[0])!==24) throw new Error('BLOCKED_NODE_RUNTIME: Node 24 is required');
if(base.protocol!=='http:' || base.hostname!=='ui-fixture' || base.port!=='3219') throw new Error('BLOCKED_INTERNAL_TARGET: invalid isolated UI target');
for(const name of Object.keys(process.env)) {
  if(/proxy|atlas|credential|password|secret|token|mongodb/i.test(name)) throw new Error(`BLOCKED: forbidden environment key ${name}`);
}
try {
  await lookup(base.hostname);
  const health=await fetch(new URL('/health',base),{signal:AbortSignal.timeout(3000)});
  if(!health.ok) throw new Error('unhealthy');
} catch {
  // Internal DNS/health failure says nothing about Internet reachability.
  throw new Error('BLOCKED_INTERNAL_TARGET: ui-fixture DNS or health is unavailable');
}
const blocked=(host,port)=>new Promise((resolve,reject)=>{
  const socket=net.connect({host,port});
  const timer=setTimeout(()=>{socket.destroy();resolve();},1500);
  socket.once('connect',()=>{clearTimeout(timer);socket.destroy();reject(new Error(`BLOCKED: outbound socket reached ${host}:${port}`));});
  socket.once('error',()=>{clearTimeout(timer);resolve();});
});
await Promise.all([blocked('1.1.1.1',443),blocked('203.0.113.1',443)]);
console.log(`PASS: Node ${process.versions.node}; internal UI healthy; negative outbound probes blocked before browser launch`);
