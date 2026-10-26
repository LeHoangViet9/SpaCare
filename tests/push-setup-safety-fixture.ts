import assert from 'node:assert/strict';
import { mock } from 'node:test';
let writes=0;
mock.module('node:fs',{namedExports:{
  readFileSync:()=> 'MONGODB_URI=mongodb://synthetic:do-not-log-this@127.0.0.1:1/spacare_live\nAPP_ORIGIN=http://localhost:3100\n',
  appendFileSync:()=> {writes++;},
}});
Object.assign(process.env, {NODE_ENV:'test'});
process.env.MONGODB_URI='mongodb://127.0.0.1:1/spacare_test';
await assert.rejects(import('../scripts/setup-push.mjs'),(error: any)=>error.code==='SAFETY_GUARD_BLOCKED' && !error.message.includes('do-not-log-this'));
assert.equal(writes,0,'must validate the file target as well as process env before writing config');
