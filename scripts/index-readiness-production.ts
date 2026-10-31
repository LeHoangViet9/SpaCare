import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { Commission, InvoiceLineCommission } from '../src/lib/models';
import manifest from './invoice-line-commission-index-manifest.json';
import { ReadinessError, safeError, checkPrivileges, checkConcerns, preserveLegacy } from './index-readiness-policy.mjs';

type IndexInfo = mongoose.mongo.IndexDescription;
const expected: Array<{ key: Record<string, 1 | -1>; unique: boolean }> = manifest.indexes.map(index => ({ key: index.key as unknown as Record<string, 1 | -1>, unique: index.unique }));
const expectedLegacy: Array<{ key: Record<string, 1 | -1>; unique: boolean }> = [
  { key: { spaId: 1, sourceType: 1, sourceId: 1 }, unique: true },
  { key: { spaId: 1, invoiceId: 1 }, unique: true },
  { key: { spaId: 1, staffId: 1, earnedAt: -1 }, unique: false },
];

function fail(message: string): never { throw new ReadinessError(message.split(':')[0]); }
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function keyOf(key: Record<string, number>) { return Object.entries(key).map(([name, direction]) => `${name}:${direction}`).join(','); }
function optionOf(value: unknown) { return value === undefined ? null : value; }
function exactOptions(index: IndexInfo, wanted: { unique: boolean }) {
  return Boolean(index.unique) === wanted.unique
    && Boolean(index.sparse) === false
    && Boolean(index.hidden) === false
    && optionOf(index.expireAfterSeconds) === null
    && JSON.stringify(optionOf(index.partialFilterExpression)) === 'null'
    && JSON.stringify(optionOf(index.collation)) === 'null';
}
function inspect(indexes: IndexInfo[], wantedIndexes = expected) {
  const problems: string[] = [];
  for (const wanted of wantedIndexes) {
    const found = indexes.find(index => keyOf(index.key as Record<string, number>) === keyOf(wanted.key));
    if (!found) problems.push(`missing ${keyOf(wanted.key)}`);
    else if (!exactOptions(found, wanted)) problems.push(`mismatched options ${keyOf(wanted.key)}`);
  }
  return problems;
}
function guardTarget(uri: string) {
  if (process.env.SPACARE_ENV !== 'production') fail('BLOCKED_TARGET: SPACARE_ENV must be production.');
  if (process.env.ATLAS_URI || process.env.MONGODB_ATLAS_URI) fail('BLOCKED_TARGET: Atlas variables are forbidden.');
  const parsed = new URL(uri);
  if (!parsed.hostname || ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) fail('BLOCKED_TARGET: localhost is not a Production target.');
  const approvedHash = (process.env.SPACARE_APPROVED_URI_SHA256 || '').toLowerCase();
  const approvedHost = process.env.SPACARE_APPROVED_HOST || '';
  const approvedDb = process.env.SPACARE_APPROVED_DB_NAME || '';
  const approvedReplicaSet = process.env.SPACARE_APPROVED_REPLICA_SET || '';
  if (!/^[a-f0-9]{64}$/.test(approvedHash) || sha256(uri) !== approvedHash) fail('BLOCKED_TARGET: URI hash does not match the approved target.');
  if (parsed.hostname !== approvedHost || parsed.pathname.slice(1) !== approvedDb || !approvedReplicaSet) fail('BLOCKED_TARGET: host, database or replica-set pin is missing.');
  return { targetHash: approvedHash, database: approvedDb, replicaSet: approvedReplicaSet };
}
async function duplicateCount(collection: mongoose.mongo.Collection) {
  const groups = [
    ['spaId', 'invoiceId', 'lineId', 'category'],
    ['spaId', 'sourceType', 'sourceId'],
  ];
  let count = 0;
  for (const fields of groups) {
    const result = await collection.aggregate([
      { $group: { _id: Object.fromEntries(fields.map(field => [field, `$${field}`])), count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'duplicates' },
    ]).toArray();
    count += Number(result[0]?.duplicates || 0);
  }
  return count;
}
async function privilegeCheck(database: string, apply: boolean) {
  const status = await mongoose.connection.db!.command({ connectionStatus: 1, showPrivileges: true });
  checkPrivileges(status.authInfo?.authenticatedUserPrivileges, database, apply);
}

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (!uri) fail('BLOCKED_TARGET: MONGODB_URI is required.');
  const target = guardTarget(uri);
  const apply = process.argv.includes('--apply');
  if (apply && (!process.argv.includes('--approve-index-readiness')
    || process.env.SPACARE_INDEX_READINESS_APPROVAL !== 'PRODUCTION_APPROVED'
    || !process.env.SPACARE_CHANGE_TICKET?.trim()
    || process.env.SPACARE_BACKUP_VERIFIED !== 'YES'
    || process.env.SPACARE_RESTORE_REHEARSAL !== 'YES')) {
    fail('BLOCKED_APPLY: explicit approval, change ticket, backup verification and restore rehearsal are required.');
  }
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db!;
  const hello = await db.command({ hello: 1 });
  if (hello.setName !== target.replicaSet || hello.isWritablePrimary !== true) fail('BLOCKED_TARGET: replica-set or writable-primary check failed.');
  await privilegeCheck(target.database, apply);
  checkConcerns(await db.admin().command({ getDefaultRWConcern: 1 }));
  const legacyIndexes = await Commission.collection.indexes();
  const legacyProblems = inspect(legacyIndexes, expectedLegacy);
  if (legacyProblems.length) fail('BLOCKED_LEGACY_INDEX: Commission legacy index manifest does not match.');
  const collection = InvoiceLineCommission.collection;
  const exists = (await db.listCollections({ name: manifest.collection }, { nameOnly: true }).toArray()).length > 0;
  let indexes = exists ? await collection.indexes() : [];
  const duplicates = exists ? await duplicateCount(collection) : 0;
  if (duplicates) fail('BLOCKED_DATA: duplicate keys exist for a required unique index.');
  let problems = inspect(indexes);
  if (apply && problems.some(problem => problem.startsWith('mismatched'))) fail('BLOCKED_INDEX: existing index options do not match the approved manifest.');
  await preserveLegacy(() => Commission.collection.indexes(), async () => {
  if (apply && problems.length) {
    if (!exists) await db.createCollection(manifest.collection);
    for (const wanted of expected) {
      const found = indexes.find(index => keyOf(index.key as Record<string, number>) === keyOf(wanted.key));
      if (!found) await collection.createIndex(wanted.key, wanted.unique ? { unique: true } : {});
    }
    indexes = await collection.indexes();
    problems = inspect(indexes);
  }
  });
  const report = { mode: apply ? 'apply' : 'dry-run', targetHash: target.targetHash, privileges: 'verified', legacyCommission: 'unchanged', duplicateGroups: duplicates, problems };
  console.log(JSON.stringify(report, null, 2));
  if (problems.length) process.exitCode = 2;
}

main().finally(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}).catch(error => { console.error(safeError(error)); process.exitCode = 1; });
