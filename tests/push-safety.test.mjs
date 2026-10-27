import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { productionPushAllowed, notificationPushEnvironment, assertPushDelivery } from '../src/lib/push-safety.ts';
const production={NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'production',MONGODB_URI:'mongodb://synthetic.invalid/spacare_live'};
test('valid Vercel Production and explicitly declared local Production keep delivery authorization',()=>{
  for(const env of [production,{...production,VERCEL_TARGET_ENV:'production',CI:'1'},{...production,SPACARE_ENV:'production',SPACARE_TARGET_DATABASE:'spacare_live'},{NODE_ENV:'production',SPACARE_ENV:'production',MONGODB_URI:production.MONGODB_URI}]) {
    assert.equal(productionPushAllowed(env),true);
    assert.equal(notificationPushEnvironment(env),'PRODUCTION');
    assert.doesNotThrow(()=>assertPushDelivery({pushEnvironment:undefined},env));
  }
});
test('Preview, Development, test, staging, CI and unknown/conflicting identities are fail-closed',()=>{
  const invalid=[{}, {NODE_ENV:'production'}, {...production,VERCEL_ENV:'preview'}, {...production,VERCEL_ENV:'development'}, {...production,NODE_ENV:'test'}, {...production,SPACARE_ENV:'test'}, {...production,SPACARE_ENV:'staging'}, {...production,SPACARE_ENV:'demo'}, {...production,SPACARE_ENV:'operations'}, {...production,VERCEL_ENV:undefined}, {...production,VERCEL:undefined}, {...production,VERCEL:'0'}, {...production,VERCEL_TARGET_ENV:'preview'}, {...production,VERCEL_TARGET_ENV:'staging'}, {...production,NODE_ENV:undefined}, {...production,NODE_TEST_CONTEXT:'child-v8'}, {...production,MONGODB_URI:undefined}, {...production,MONGODB_URI:'invalid'}, {...production,MONGODB_URI:'mongodb://synthetic.invalid/spacare_test'}, {...production,MONGODB_URI:'mongodb://synthetic.invalid/spacare_dev'}, {...production,SPACARE_TARGET_DATABASE:'spacare_test'}, {NODE_ENV:'production',SPACARE_ENV:'production',CI:'1',MONGODB_URI:production.MONGODB_URI}];
  for(const env of invalid) {
    assert.equal(productionPushAllowed(env),false);
    assert.equal(notificationPushEnvironment(env),'QUARANTINED');
    assert.throws(()=>assertPushDelivery({pushEnvironment:'PRODUCTION'},env),/PUSH_SAFETY_BLOCKED/);
  }
});
test('production cannot promote quarantined or malformed outbox origins, or send without context',()=>{
  for(const origin of ['QUARANTINED','preview','',null,1]) assert.throws(()=>assertPushDelivery({pushEnvironment:origin},production),/PUSH_SAFETY_BLOCKED/);
  assert.throws(()=>assertPushDelivery(undefined,production),/PUSH_SAFETY_BLOCKED/);
});
test('dispatcher and final sender preserve blocked outbox/subscriptions and isolate sandbox backlog (offline)',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./push-safety-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:20000});
});
