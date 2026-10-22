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
  assert.deepEqual(log.mock.calls[0].arguments, ['MongoDB connection failed', { code: 'DB_DNS_FAILED' }]);
});

test('connection shares in-flight work, retries failures and reconnects after a settled promise', async t => {
  const originalUri = process.env.MONGODB_URI;
  const originalState = mongoose.connection.readyState;
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
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  }
});
