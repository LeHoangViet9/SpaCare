import test from 'node:test';
import assert from 'node:assert/strict';
import { INTEGRATION_ENV, assertConnectedServerIdentity, assertIntegrationEnvironment, IntegrationSafetyError } from './integration-safety.ts';

const valid = () => ({ ...INTEGRATION_ENV });

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
  await t.test('missing directConnection', () => rejected({ ...valid(), MONGODB_URI: 'mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0' }, 'DIRECT_CONNECTION_REQUIRED'));
  await t.test('directConnection false', () => rejected({ ...valid(), MONGODB_URI: 'mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=false' }, 'DIRECT_CONNECTION_REQUIRED'));
  await t.test('credentials', () => rejected({ ...valid(), MONGODB_URI: 'mongodb://user:secret@127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true' }, 'CREDENTIALS_REJECTED'));
  await t.test('Production environment', () => rejected({ ...valid(), VERCEL_ENV: 'production' }, 'HOSTED_ENV_REJECTED'));
  await t.test('Preview environment', () => rejected({ ...valid(), VERCEL_ENV: 'preview' }, 'HOSTED_ENV_REJECTED'));
  await t.test('CI environment', () => rejected({ ...valid(), CI: 'true' }, 'CI_ENV_REJECTED'));
  await t.test('missing environment variable', () => { const env = valid(); delete env.SPACARE_INTEGRATION_ISOLATED; rejected(env, 'ENV_MISSING'); });
  await t.test('missing URI', () => { const env = valid(); delete env.MONGODB_URI; rejected(env, 'URI_MISSING'); });
});

test('connected-server guard rejects wrong host, port, database, replica set or non-primary', async () => {
  const target = assertIntegrationEnvironment(valid());
  const connection = (changes = {}, hello = {setName:'rs0',isWritablePrimary:true}) => ({host:'127.0.0.1',port:27018,db:{databaseName:'spacare_test',admin:()=>({command:async()=>hello})},...changes});
  assert.equal((await assertConnectedServerIdentity(connection(),target)).writablePrimary,true);
  for (const wrong of [{host:'remote'},{port:27017},{db:{databaseName:'spacare_demo'}}])
    await assert.rejects(assertConnectedServerIdentity(connection(wrong),target),error=>error.code==='CONNECTED_TARGET_MISMATCH');
  await assert.rejects(assertConnectedServerIdentity(connection({}, {setName:'other',isWritablePrimary:true}),target),error=>error.code==='CONNECTED_REPLICA_SET_MISMATCH');
  await assert.rejects(assertConnectedServerIdentity(connection({}, {setName:'rs0',isWritablePrimary:false}),target),error=>error.code==='PRIMARY_REQUIRED');
});
