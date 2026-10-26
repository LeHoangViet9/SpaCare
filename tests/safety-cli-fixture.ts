import assert from 'node:assert/strict';
import { mock } from 'node:test';
import mongoose from 'mongoose';
const script = process.argv[2];
process.env.MONGODB_URI='mongodb://synthetic:do-not-log-this@127.0.0.1:1/spacare_live';
Object.assign(process.env, {NODE_ENV:'development'});
process.env.SEED_OWNER_PHONE='0912345678';
process.env.SEED_OWNER_PASSWORD='synthetic-owner-password';
let connections=0;
mock.module('../src/lib/db.ts',{namedExports:{
  connect:async()=>{connections++;throw Error('UNSAFE_CONNECT');},
  DatabaseUnavailableError:class extends Error {},
}});
(mongoose as any).disconnect=async()=>{};
const logs:string[]=[];
console.log=console.error=(...values:unknown[])=>logs.push(values.join(' '));
await import('../scripts/'+script+'.ts');
assert.equal(process.exitCode,1,'operator entry point must fail closed');
assert.equal(connections,0,'guard must precede even a mocked connection');
assert.ok(!logs.join(' ').includes('do-not-log-this'));
assert.ok(!logs.join(' ').includes('synthetic-owner-password'));
process.exitCode=0;
