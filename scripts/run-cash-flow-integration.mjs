// Creates a fresh local test replica set; never reuses an existing server/data path.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { access, mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { allModels } from '../src/lib/models.ts';
import { assertIntegrationEnvironment, assertConnectedServerIdentity, inspectIntegrationSchema } from '../tests/integration-safety.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const uri='mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true';
const env={NODE_ENV:'test',SPACARE_ENV:'integration',SPACARE_TARGET_DATABASE:'spacare_test',SPACARE_INTEGRATION_ISOLATED:'local-rs0',SPACARE_WRITE_FREEZE:'OFF',MONGODB_URI:uri};
let mongod, admin, sandbox;
async function waitFor(check) {
  const deadline=Date.now()+30000;
  while(Date.now()<deadline) {
    if(mongod.exitCode!==null) throw new Error('BLOCKED: temporary mongod exited');
    try { if(await check()) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('BLOCKED: temporary MongoDB readiness timeout');
}
try {
  if(process.env.MONGODB_URI && process.env.MONGODB_URI!==uri) throw new Error('BLOCKED: conflicting MongoDB target');
  Object.assign(process.env,env);
  const target=assertIntegrationEnvironment(process.env);
  const binary=process.env.SPACARE_TEST_MONGOD || path.join(root,'outputs','mongo-bin','mongod-x64-win32-8.0.16.exe');
  await access(binary);
  await new Promise((resolve,reject)=>{
    const server=createServer(); server.once('error',()=>reject(new Error('BLOCKED: port 27018 occupied; refusing to reuse server')));
    server.listen(27018,'127.0.0.1',()=>server.close(error=>error?reject(error):resolve()));
  });
  const outputs=path.join(root,'outputs'); await mkdir(outputs,{recursive:true});
  sandbox=await mkdtemp(path.join(outputs,'cash-flow-test-'));
  mongod=spawn(binary,['--bind_ip','127.0.0.1','--port','27018','--replSet','rs0','--dbpath',sandbox,'--quiet'],{cwd:root,stdio:'ignore',windowsHide:true});
  mongod.once('error',()=>{process.exitCode=1;});
  console.log('OWN_TEMP_MONGODB',JSON.stringify({pid:mongod.pid,database:'spacare_test',path:sandbox}));
  await waitFor(async()=>{
    admin=await mongoose.createConnection('mongodb://127.0.0.1:27018/admin?directConnection=true',{serverSelectionTimeoutMS:500}).asPromise(); return true;
  });
  const hello=await admin.db.admin().command({hello:1});
  if(hello.setName) throw new Error('BLOCKED: unexpected existing replica set');
  await admin.db.admin().command({replSetInitiate:{_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]}});
  await waitFor(async()=>{const h=await admin.db.admin().command({hello:1});return h.setName==='rs0'&&h.isWritablePrimary===true;});
  await admin.close();admin=undefined;
  await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000});
  const identity=await assertConnectedServerIdentity(mongoose.connection,target);
  for(const model of allModels) {await model.createCollection();await model.createIndexes();}
  const schema=await inspectIntegrationSchema(mongoose.connection,allModels);
  console.log('TEST_PREFLIGHT_PASS',JSON.stringify({identity,schema,freshDatabase:true}));
  await mongoose.disconnect();
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--import','tsx','--test','tests/integration.test.ts'],{cwd:root,env:{...process.env,...env},stdio:'inherit',windowsHide:true});
    child.once('error',reject);child.once('close',resolve);
  });
  if(code!==0) throw new Error('Integration suite exit '+code);
  console.log('Cash-flow MongoDB integration: PASS');
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {
  await mongoose.disconnect();if(admin) await admin.close();
  if(mongod && mongod.exitCode===null && mongod.signalCode===null) {
    mongod.kill();
    await Promise.race([new Promise(resolve=>mongod.once('close',resolve)),new Promise(resolve=>setTimeout(resolve,5000))]);
    if(mongod.exitCode===null && mongod.signalCode===null) {console.error('BLOCKED: temporary mongod cleanup incomplete');process.exitCode=1;}
  }
  // Retain the isolated synthetic data directory for diagnostics; no recursive deletion.
  console.log('TEST_RUNNER_EXIT',process.exitCode || 0);
}
