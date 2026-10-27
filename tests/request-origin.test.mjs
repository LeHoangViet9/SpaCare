import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertDatabaseTarget, SafetyGuardError } from '../src/lib/production-safety.mjs';
const { isTrustedRequestOrigin } = await tsImport('../src/lib/request-origin.ts', import.meta.url);
const production={VERCEL:'1',VERCEL_ENV:'production',NODE_ENV:'production',APP_ORIGIN:'https://production.example.invalid',VERCEL_URL:'production-deploy.vercel.app'};
const preview={...production,VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview',VERCEL_URL:'spacare-preview-123.vercel.app',VERCEL_BRANCH_URL:'spacare-git-feature.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'production.example.invalid'};

test('Production and local origins retain exact APP_ORIGIN trust; deployment metadata cannot broaden Production',()=>{
  assert.equal(isTrustedRequestOrigin(production.APP_ORIGIN,production),true);
  assert.equal(isTrustedRequestOrigin('https://production-deploy.vercel.app',production),false);
  assert.equal(isTrustedRequestOrigin('https://other.vercel.app',production),false);
  assert.equal(isTrustedRequestOrigin('http://localhost:3100',{APP_ORIGIN:'http://localhost:3100'}),true);
});
test('Preview accepts only exact HTTPS deployment and branch system origins despite stale APP_ORIGIN',()=>{
  assert.equal(isTrustedRequestOrigin('https://'+preview.VERCEL_URL,preview),true);
  assert.equal(isTrustedRequestOrigin('https://'+preview.VERCEL_BRANCH_URL,preview),true);
  assert.equal(isTrustedRequestOrigin(production.APP_ORIGIN,preview),false);
  assert.equal(isTrustedRequestOrigin('https://unrelated.vercel.app',preview),false);
  assert.equal(isTrustedRequestOrigin('https://'+preview.VERCEL_URL+'.evil.invalid',preview),false);
  assert.equal(isTrustedRequestOrigin('http://'+preview.VERCEL_URL,preview),false);
  assert.equal(isTrustedRequestOrigin('https://'+preview.VERCEL_URL+':8443',preview),false);
});
test('Origin remains mandatory, canonical and singular; malformed server origins fail closed',()=>{
  for(const origin of [null,'','null','https://production.example.invalid/','https://production.example.invalid/path',
    'https://production.example.invalid?x=1','https://production.example.invalid#x',
    'https://user:fake@production.example.invalid','https://production.example.invalid, https://evil.invalid']) {
    assert.equal(isTrustedRequestOrigin(origin,production),false);
  }
  for(const APP_ORIGIN of [undefined,'not-a-url','https://user:fake@production.example.invalid','https://production.example.invalid/path'])
    assert.equal(isTrustedRequestOrigin(production.APP_ORIGIN,{APP_ORIGIN}),false);
});
test('Preview metadata must be server-owned, well-formed and consistent; production URL never grants trust',()=>{
  for(const env of [{...preview,VERCEL:undefined},{...preview,VERCEL_ENV:undefined},
    {...preview,VERCEL_TARGET_ENV:'production'},
    {...preview,VERCEL_URL:undefined,VERCEL_BRANCH_URL:undefined},
    {...preview,VERCEL_URL:'spacare-preview-123.vercel.app/path',VERCEL_BRANCH_URL:undefined},
    {...preview,VERCEL_URL:'user@spacare-preview-123.vercel.app',VERCEL_BRANCH_URL:undefined},
    {...preview,VERCEL_PROJECT_PRODUCTION_URL:preview.VERCEL_URL}])
    assert.equal(isTrustedRequestOrigin('https://'+preview.VERCEL_URL,env),false);
});
test('Preview Origin acceptance does not grant access to live or other DBs when configured spacare_test',()=>{
  const env={...preview,SPACARE_ENV:'test',SPACARE_TARGET_DATABASE:'spacare_test'};
  assert.equal(isTrustedRequestOrigin('https://'+preview.VERCEL_URL,env),true);
  assert.equal(assertDatabaseTarget('mongodb://127.0.0.1:1/spacare_test',env),'spacare_test');
  for(const database of ['spacare_live','spacare_prod','spacare_dev','spacare_demo'])
    assert.throws(()=>assertDatabaseTarget('mongodb://127.0.0.1:1/'+database,env),SafetyGuardError);
});
test('login route enforces trusted origins before any database driver call, including spoofed Host headers',()=>{
  execFileSync(process.execPath,['--import','tsx','--experimental-test-module-mocks',fileURLToPath(new URL('./login-origin-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:15000});
});
