import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { databaseName, assertDatabaseTarget, assertConnectedDatabase, seleniumBaseUrl, SafetyGuardError } from '../src/lib/production-safety.mjs';
const uri = name => 'mongodb://user:synthetic-password@127.0.0.1:1/' + name;
const blocked = fn => assert.throws(fn, error => error instanceof SafetyGuardError && !error.message.includes('synthetic-password'));

test('Mongo namespace parser rejects missing, encoded and overridden database paths', () => {
  assert.equal(databaseName('mongodb://a:27017,b:27018/spacare_test?replicaSet=rs0&authSource=admin'), 'spacare_test');
  assert.equal(databaseName('mongodb+srv://user:password@example.invalid/spacare_test?authSource=admin'), 'spacare_test');
  for (const value of ['', 'https://a/spacare_test', 'mongodb://a', 'mongodb://a/',
    'mongodb://a/%73pacare_test', 'mongodb://a/spacare_test/../spacare_live',
    'mongodb://a/spacare_test#fragment', 'mongodb://a/spacare_test?dbName=spacare_live',
    'mongodb://a/spacare_test?DATABASE=spacare_live', 'mongodb://a/spacare_test?db%4Eame=spacare_live']) blocked(() => databaseName(value));
});

test('dev, preview, tests and CI cannot open live/prod even with forged operator opt-in', () => {
  for (const env of [{}, {NODE_ENV:'development'}, {NODE_ENV:'test'}, {SPACARE_ENV:'test'},
    {VERCEL_ENV:'preview', NODE_ENV:'production'}, {VERCEL_ENV:'development'}, {CI:'true'},
    {NODE_TEST_CONTEXT:'child-v8'}, {SPACARE_ENV:'development'}, {SPACARE_ENV:'demo'}]) {
    for (const database of ['spacare_live','spacare_prod','production','unknown']) {
      blocked(() => assertDatabaseTarget(uri(database), env));
      if (env.NODE_ENV || env.VERCEL_ENV || env.CI || env.NODE_TEST_CONTEXT)
        blocked(() => assertDatabaseTarget(uri(database), {...env, SPACARE_ENV:'operations',SPACARE_TARGET_DATABASE:database}, 'import'));
    }
  }
});

test('existing production runtime remains compatible, contradictory declarations fail closed', () => {
  for (const database of ['spacare_live','spacare_prod','spacare']) {
    assert.equal(assertDatabaseTarget(uri(database), {VERCEL_ENV:'production',NODE_ENV:'production'}),database);
    assert.equal(assertDatabaseTarget(uri(database), {NODE_ENV:'production'}),database);
  }
  for (const env of [{VERCEL_ENV:'production',SPACARE_ENV:'test'}, {VERCEL_ENV:'preview',SPACARE_ENV:'production'},
    {NODE_ENV:'development',SPACARE_ENV:'production'}, {SPACARE_ENV:'typo'}, {VERCEL_ENV:'typo'}]) blocked(() => assertDatabaseTarget(uri('spacare_live'),env));
  assert.equal(assertDatabaseTarget(uri('spacare_dev'),{VERCEL_ENV:'preview',NODE_ENV:'production'}),'spacare_dev');
  assert.equal(assertDatabaseTarget(uri('spacare_test'),{NODE_ENV:'test'},'test'),'spacare_test');
  blocked(() => assertDatabaseTarget(uri('spacare_dev'),{},'test'));
  blocked(() => assertDatabaseTarget(uri('spacare_test'),{SPACARE_ENV:'demo'}));
});

test('operator tools require explicit local target and retain valid import workflow', () => {
  for (const purpose of ['maintenance','import','backup']) {
    for (const database of ['spacare_live','spacare_prod']) {
      const env={SPACARE_ENV:'operations',SPACARE_TARGET_DATABASE:database};
      assert.equal(assertDatabaseTarget(uri(database),env,purpose),database);
      blocked(() => assertDatabaseTarget(uri(database),{},purpose));
      blocked(() => assertDatabaseTarget(uri(database),{...env,VERCEL:'1'},purpose));
      blocked(() => assertDatabaseTarget(uri(database),{...env,VERCEL_ENV:'production'},purpose));
      blocked(() => assertDatabaseTarget(uri(database),{...env,NODE_ENV:'development'},purpose));
      blocked(() => assertDatabaseTarget(uri(database),{...env,NODE_ENV:'test'},purpose));
      blocked(() => assertDatabaseTarget(uri(database),{...env,SPACARE_TARGET_DATABASE:'spacare_dev'},purpose));
    }
    assert.equal(assertDatabaseTarget(uri('spacare_dev'),{},purpose),'spacare_dev');
  }
  assert.equal(assertDatabaseTarget(uri('spacare_demo'),{},'demo'),'spacare_demo');
  blocked(() => assertDatabaseTarget(uri('spacare_live'),{SPACARE_ENV:'operations',SPACARE_TARGET_DATABASE:'spacare_live'},'demo'));
  blocked(() => assertDatabaseTarget(uri('spacare_demo'),{VERCEL_ENV:'production'},'demo'));
  blocked(() => assertConnectedDatabase('spacare_test','spacare_live'));
  blocked(() => assertConnectedDatabase('spacare_test',undefined));
  assertConnectedDatabase('spacare_test','spacare_test');
});

test('Selenium requires a test environment and explicit local or allowlisted HTTPS origin', () => {
  const env={SELENIUM_ENV:'test'};
  for (const value of [undefined,'', 'https://spacare-rho.vercel.app', 'https://SPACARE-RHO.VERCEL.APP.:443',
    'https://child.spacare-rho.vercel.app','https://spacare-rho.vercel.app:8443',
    'https://user:synthetic-password@staging.invalid','http://staging.invalid',
    'https://staging.invalid/path','https://staging.invalid/?token=secret']) {
    blocked(() => seleniumBaseUrl({...env,SELENIUM_BASE_URL:value,SELENIUM_ALLOWED_ORIGIN:value}));
  }
  assert.equal(seleniumBaseUrl({...env,SELENIUM_BASE_URL:'http://127.0.0.1:3100'}).origin,'http://127.0.0.1:3100');
  const remote={SELENIUM_ENV:'staging',SELENIUM_BASE_URL:'https://staging.invalid',SELENIUM_ALLOWED_ORIGIN:'https://staging.invalid'};
  assert.equal(seleniumBaseUrl(remote).origin,'https://staging.invalid');
  blocked(() => seleniumBaseUrl({...remote,SELENIUM_ENV:undefined}));
  blocked(() => seleniumBaseUrl({...remote,SELENIUM_ALLOWED_ORIGIN:undefined}));
  assert.equal(seleniumBaseUrl({...remote,APP_ORIGIN:'https://staging.invalid'}).origin,remote.SELENIUM_BASE_URL);
  blocked(() => seleniumBaseUrl({...remote,SELENIUM_PRODUCTION_ORIGIN:'https://staging.invalid'}));
  blocked(() => seleniumBaseUrl({...remote,VERCEL_PROJECT_PRODUCTION_URL:'staging.invalid'}));
});

test('every DB-writing CLI declares its purpose before connect; direct test connections are guarded', () => {
  for (const file of ['setup','setup-cash-cards','setup-commission-shares','setup-invoice-codes','setup-package-invoices',
    'setup-push-db','setup-service-groups','setup-staff-phone','import-catalog','import-hair-removal','import-opening-balances','supplement-huong-lan','seed-demo']) {
    const code=readFileSync(new URL('../scripts/'+file+'.ts',import.meta.url),'utf8');
    assert.match(code,/assertDatabaseTarget\(process.env.MONGODB_URI/);
    assert.match(code,/await connect\('(maintenance|import|demo)'\)/);
  }
  for (const file of ['workbook-http.ts','workbook-ui-fixture.ts']) {
    const code=readFileSync(new URL('./'+file,import.meta.url),'utf8');
    assert.ok(code.indexOf("assertDatabaseTarget(uri, process.env, 'test')") < code.indexOf('await mongoose.connect(uri'));
    assert.match(code,/assertConnectedDatabase\('spacare_test'/);
  }
});


test('maintenance entry points reject live before connect with mocked driver', () => {
  for (const script of ['setup','setup-cash-cards','setup-commission-shares','setup-invoice-codes',
    'setup-package-invoices','setup-push-db','setup-service-groups','setup-staff-phone']) {
    execFileSync(process.execPath,['--import','tsx','--experimental-test-module-mocks',
      fileURLToPath(new URL('./safety-cli-fixture.ts',import.meta.url)),script],{stdio:'pipe',timeout:15000});
  }
});

test('Selenium entry point fails before browser creation for missing URL and production', () => {
  for(const url of ['', 'https://spacare-rho.vercel.app']) {
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('./selenium/workspace.e2e.mjs',import.meta.url))],{
      env:{...process.env,SELENIUM_ENV:'test',SELENIUM_BASE_URL:url},encoding:'utf8',timeout:10000,
    });
    assert.equal(result.status,1);
    assert.match(result.stderr,/SAFETY_GUARD_BLOCKED/);
  }
});


test('push setup refuses a live config file even when shell URI is a test DB (mock fs)', () => {
  execFileSync(process.execPath,['--import','tsx','--experimental-test-module-mocks',
    fileURLToPath(new URL('./push-setup-safety-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:15000});
});


test('misspelled NODE_ENV fails closed even with a valid operator target', () => {
  for (const NODE_ENV of ['dev', 'testing', 'Production', 'production ']) {
    blocked(() => assertDatabaseTarget(uri('spacare_live'), {
      NODE_ENV, SPACARE_ENV: 'operations', SPACARE_TARGET_DATABASE: 'spacare_live',
    }, 'import'));
    blocked(() => assertDatabaseTarget(uri('spacare_test'), {NODE_ENV}, 'test'));
  }
});


test('Vercel cloud identity is fail-closed and cannot inherit local production fallback', () => {
  const signals=['VERCEL','VERCEL_TARGET_ENV','VERCEL_URL','VERCEL_DEPLOYMENT_ID','VERCEL_PROJECT_ID','VERCEL_REGION','VERCEL_GIT_COMMIT_REF'];
  for(const signal of signals) {
    const env={NODE_ENV:'production',[signal]:signal==='VERCEL'?'1':'preview'};
    for(const purpose of ['runtime','maintenance','import','backup']) {
      blocked(()=>assertDatabaseTarget(uri('spacare_live'),env,purpose));
      blocked(()=>assertDatabaseTarget(uri('spacare_live'),{...env,SPACARE_ENV:'operations',SPACARE_TARGET_DATABASE:'spacare_live'},purpose));
    }
  }
  for(const VERCEL_ENV of ['preview','development']) {
    for(const CI of [undefined,'1']) {
      const env={VERCEL:'1',VERCEL_ENV,VERCEL_TARGET_ENV:VERCEL_ENV,NODE_ENV:'production',CI};
      blocked(()=>assertDatabaseTarget(uri('spacare_live'),env));
      assert.equal(assertDatabaseTarget(uri('spacare_test'),env),'spacare_test');
      blocked(()=>assertDatabaseTarget(uri('spacare_live'),{...env,SPACARE_ENV:'operations',SPACARE_TARGET_DATABASE:'spacare_live'},'import'));
    }
  }
  for(const env of [
    {VERCEL:'1',VERCEL_ENV:'production',VERCEL_TARGET_ENV:'preview',NODE_ENV:'production'},
    {VERCEL:'1',VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'production',NODE_ENV:'production'},
    {VERCEL:'0',VERCEL_ENV:'production',NODE_ENV:'production'},
    {CI:'1',VERCEL_ENV:'production',NODE_ENV:'production'},
  ]) blocked(()=>assertDatabaseTarget(uri('spacare_live'),env));
  const production={VERCEL:'1',VERCEL_ENV:'production',VERCEL_TARGET_ENV:'production',NODE_ENV:'production'};
  for(const CI of [undefined,'1']) assert.equal(assertDatabaseTarget(uri('spacare_live'),{...production,CI}),'spacare_live');
});

test('Selenium distinguishes HTTPS staging from explicit production domains', () => {
  const staging={SELENIUM_ENV:'staging',SELENIUM_BASE_URL:'https://stage.example.invalid',SELENIUM_ALLOWED_ORIGIN:'https://stage.example.invalid',APP_ORIGIN:'https://stage.example.invalid'};
  assert.equal(seleniumBaseUrl(staging).origin,staging.APP_ORIGIN);
  for(const production of ['https://spacare-rho.vercel.app','https://shop.example.invalid']) {
    blocked(()=>seleniumBaseUrl({...staging,SELENIUM_BASE_URL:production,SELENIUM_ALLOWED_ORIGIN:production,SELENIUM_PRODUCTION_ORIGIN:production}));
  }
  blocked(()=>seleniumBaseUrl({...staging,VERCEL_ENV:'production'}));
  blocked(()=>seleniumBaseUrl({...staging,VERCEL_TARGET_ENV:'production'}));
});
