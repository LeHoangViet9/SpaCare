import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { tsImport } from 'tsx/esm/api';

const { connect, databaseErrorCode, DatabaseUnavailableError, failure } = await tsImport('./db-fixture.ts', import.meta.url);

test('database failures are classified without exposing driver credentials', async t => {
  const secret = 'mongodb://private-user:private-password@private-host/spacare';
  assert.equal(databaseErrorCode({ code: 18, message: secret }), 'DB_AUTH_FAILED');
  assert.equal(databaseErrorCode({ code: 'ETIMEOUT', message: `querySrv ${secret}` }), 'DB_DNS_FAILED');
  assert.equal(databaseErrorCode({ name: 'MongoParseError', message: secret }), 'DB_CONFIG_INVALID');
  assert.equal(databaseErrorCode(new Error(secret)), 'DB_CONNECTION_FAILED');
  const log = t.mock.method(console, 'error', () => {});
  const response = failure(new DatabaseUnavailableError('DB_DNS_FAILED'));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).code, 'DB_DNS_FAILED');
  const record = JSON.parse(log.mock.calls[0].arguments[0]);
  assert.equal(record.code, 'DB_DNS_FAILED');
  assert.equal(record.level, 'error');
  assert.equal(record.requestId, response.headers.get('x-request-id'));
  assert.ok(!JSON.stringify(record).includes(secret));
});

test('connection shares in-flight work, retries failures and reconnects after a settled promise', async t => {
  const originalUri = process.env.MONGODB_URI;
  const originalState = mongoose.connection.readyState;
  const originalName = mongoose.connection.name;
  mongoose.connection.name = 'spacare_test';
  mongoose.connection.readyState = 0;
  let release;
  const driver = t.mock.method(mongoose, 'connect', () => new Promise(resolve => { release = resolve; }));
  try {
    delete process.env.MONGODB_URI;
    await assert.rejects(connect(), e => e.code === 'DB_CONFIG_MISSING');
    assert.equal(driver.mock.callCount(), 0);
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/spacare_test';
    const first = connect(), concurrent = connect();
    assert.equal(driver.mock.callCount(), 1);
    release(mongoose);
    await Promise.all([first, concurrent]);
    // A lost connection must not reuse the previous successful attempt.
    driver.mock.mockImplementation(() => Promise.reject({ code: 18, message: 'secret-driver-message' }));
    await assert.rejects(connect(), e => e.code === 'DB_AUTH_FAILED' && !e.message.includes('secret-driver-message'));
    assert.equal(driver.mock.callCount(), 2);
    driver.mock.mockImplementation(() => Promise.resolve(mongoose));
    await connect();
    assert.equal(driver.mock.callCount(), 3);
    mongoose.connection.readyState = 1;
    await connect();
    assert.equal(driver.mock.callCount(), 3);
  } finally {
    mongoose.connection.readyState = originalState;
    mongoose.connection.name = originalName;
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  }
});

test('HTTP errors never log raw secrets and classify expected rejections', async t => {
  const errors = t.mock.method(console, 'error', () => {});
  const warnings = t.mock.method(console, 'warn', () => {});
  const secret = 'mongodb://private-user:private-password@private-host/spacare';
  const response = failure(new Error(secret));
  assert.equal(response.status, 500);
  assert.equal(JSON.parse(errors.mock.calls[0].arguments[0]).code, 'UNEXPECTED_ERROR');
  assert.ok(!JSON.stringify(errors.mock.calls).includes(secret));
  assert.ok(!(await response.text()).includes(secret));
  const duplicate = failure({ code: 11000, message: secret, keyValue: { email: secret } });
  assert.equal(duplicate.status, 409);
  assert.equal(JSON.parse(warnings.mock.calls[0].arguments[0]).code, 'DUPLICATE_KEY');
  assert.ok(!JSON.stringify(warnings.mock.calls).includes(secret));
});


test('connection guards reject wrong environments before driver and reject cached wrong namespace', async t => {
  const keys = ['MONGODB_URI','NODE_ENV','SPACARE_ENV','SPACARE_TARGET_DATABASE','VERCEL_ENV','VERCEL','CI','NODE_TEST_CONTEXT'];
  const saved = Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const state = mongoose.connection.readyState, name = mongoose.connection.name;
  const driver = t.mock.method(mongoose,'connect',()=>assert.fail('Driver must not run for rejected targets'));
  try {
    for (const key of keys) delete process.env[key];
    mongoose.connection.readyState=0;
    process.env.MONGODB_URI='mongodb://user:synthetic-password@127.0.0.1:1/spacare_live';
    for (const environment of ['development','test']) {
      process.env.NODE_ENV=environment;
      await assert.rejects(connect(),e=>e.code==='SAFETY_GUARD_BLOCKED' && !e.message.includes('synthetic-password'));
    }
    process.env.NODE_ENV='production';process.env.VERCEL_ENV='preview';
    await assert.rejects(connect(),e=>e.code==='SAFETY_GUARD_BLOCKED');
    delete process.env.VERCEL_ENV;process.env.NODE_ENV='test';
    process.env.MONGODB_URI='mongodb://127.0.0.1:1/spacare_test';
    mongoose.connection.readyState=1;mongoose.connection.name='spacare_live';
    await assert.rejects(connect('test'),e=>e.code==='SAFETY_GUARD_BLOCKED');
    assert.equal(driver.mock.callCount(),0);
  } finally {
    mongoose.connection.readyState=state;mongoose.connection.name=name;
    for (const key of keys) { if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key]; }
  }
});


test('a newly opened connection must match the validated database before it is returned', async t => {
  const savedUri = process.env.MONGODB_URI;
  const state = mongoose.connection.readyState, name = mongoose.connection.name;
  const driver = t.mock.method(mongoose, 'connect', async () => {
    mongoose.connection.name = 'spacare_live';
    return mongoose;
  });
  try {
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/spacare_test';
    mongoose.connection.readyState = 0;
    await assert.rejects(connect('test'), error => error.code === 'SAFETY_GUARD_BLOCKED');
    assert.equal(driver.mock.callCount(), 1);
  } finally {
    mongoose.connection.readyState = state;
    mongoose.connection.name = name;
    if (savedUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = savedUri;
  }
});
