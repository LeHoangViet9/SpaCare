import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIntegrationEnvironment, IntegrationSafetyError } from './integration-safety.ts';

const valid = () => ({
  NODE_ENV: 'test',
  SPACARE_ENV: 'integration',
  SPACARE_TARGET_DATABASE: 'spacare_test',
  SPACARE_INTEGRATION_ISOLATED: 'local-rs0',
  MONGODB_URI: 'mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true',
});

const rejected = (env, code) => assert.throws(
  () => assertIntegrationEnvironment(env),
  error => error instanceof IntegrationSafetyError && error.code === code && !error.message.includes('password'),
);

test('integration guard accepts only the audited local replica-set target', () => {
  const target = assertIntegrationEnvironment(valid());
  assert.deepEqual({ host: target.host, port: target.port, database: target.database, replicaSet: target.replicaSet },
    { host: '127.0.0.1', port: 27018, database: 'spacare_test', replicaSet: 'rs0' });
});

test('integration guard rejects unsafe MongoDB targets and environments', async t => {
  await t.test('Atlas/SRV URI', () => rejected({ ...valid(), MONGODB_URI: 'mongodb+srv://cluster.mongodb.net/spacare_test?replicaSet=rs0&directConnection=true' }, 'SRV_REJECTED'));
  await t.test('DNS hostname', () => rejected({ ...valid(), MONGODB_URI: 'mongodb://localhost:27018/spacare_test?replicaSet=rs0&directConnection=true' }, 'HOST_REJECTED'));
  await t.test('ecommerce port 27017', () => rejected({ ...valid(), MONGODB_URI: 'mongodb://127.0.0.1:27017/spacare_test?replicaSet=rs0&directConnection=true' }, 'PORT_REJECTED'));
  await t.test('wrong database', () => rejected({ ...valid(), MONGODB_URI: 'mongodb://127.0.0.1:27018/spacare_dev?replicaSet=rs0&directConnection=true' }, 'DATABASE_REJECTED'));
  await t.test('wrong replica set', () => rejected({ ...valid(), MONGODB_URI: 'mongodb://127.0.0.1:27018/spacare_test?replicaSet=other&directConnection=true' }, 'REPLICA_SET_REJECTED'));
  await t.test('credentials', () => rejected({ ...valid(), MONGODB_URI: 'mongodb://user:secret@127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true' }, 'CREDENTIALS_REJECTED'));
  await t.test('Production environment', () => rejected({ ...valid(), VERCEL_ENV: 'production' }, 'HOSTED_ENV_REJECTED'));
  await t.test('Preview environment', () => rejected({ ...valid(), VERCEL_ENV: 'preview' }, 'HOSTED_ENV_REJECTED'));
  await t.test('CI environment', () => rejected({ ...valid(), CI: 'true' }, 'CI_ENV_REJECTED'));
  await t.test('missing environment variable', () => { const env = valid(); delete env.SPACARE_INTEGRATION_ISOLATED; rejected(env, 'ENV_MISSING'); });
  await t.test('missing URI', () => { const env = valid(); delete env.MONGODB_URI; rejected(env, 'URI_MISSING'); });
});
