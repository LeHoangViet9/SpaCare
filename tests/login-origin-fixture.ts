import assert from 'node:assert/strict';
import { mock } from 'node:test';
import mongoose from 'mongoose';
mock.module('next/headers',{namedExports:{cookies:async()=>({get:()=>undefined})}});
let driverCalls=0;
(mongoose as any).connect=async()=>{driverCalls++;assert.fail('No database connection is allowed');};
const {POST}=await import('../src/app/api/auth/login/route');
process.env.MONGODB_URI='';
process.env.APP_ORIGIN='https://production.example.invalid';
process.env.VERCEL='1';process.env.VERCEL_ENV='production';
for(const key of ['VERCEL_TARGET_ENV','VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL'])delete process.env[key];
async function probe(origin:string|null,status:number,headers:Record<string,string>={}){
  const response=await POST(new Request('https://internal.example.invalid/api/auth/login',{
    method:'POST',headers:{'content-type':'application/json',...(origin===null?{}:{origin}),...headers},
    body:JSON.stringify({email:'test@example.invalid',password:'synthetic-password'}),
  }));
  assert.equal(response.status,status);
  if(status===503)assert.equal((await response.json()).code,'DB_CONFIG_MISSING');
}
await probe(process.env.APP_ORIGIN,503);
await probe('https://evil.invalid',403,{host:'production.example.invalid','x-forwarded-host':'production.example.invalid'});
await probe(null,403,{host:'production.example.invalid','x-forwarded-host':'production.example.invalid'});
process.env.VERCEL_ENV='preview';process.env.VERCEL_TARGET_ENV='preview';
process.env.VERCEL_URL='spacare-preview-123.vercel.app';
process.env.VERCEL_BRANCH_URL='spacare-git-feature.vercel.app';
process.env.VERCEL_PROJECT_PRODUCTION_URL='production.example.invalid';
await probe('https://spacare-preview-123.vercel.app',503);
await probe('https://spacare-git-feature.vercel.app',503);
await probe(process.env.APP_ORIGIN,403);
await probe('https://unrelated.vercel.app',403,{host:process.env.VERCEL_URL,'x-forwarded-host':process.env.VERCEL_URL});
await probe('https://evil.invalid',403,{host:process.env.VERCEL_URL,'x-forwarded-host':process.env.VERCEL_URL,'x-forwarded-proto':'https'});
await probe(null,403,{host:process.env.VERCEL_URL,'x-forwarded-host':process.env.VERCEL_URL});
assert.equal(driverCalls,0);
