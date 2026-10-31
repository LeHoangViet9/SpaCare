import mongoose from 'mongoose';
import { InvoiceLineCommission } from '../src/lib/models';

const EXPECTED_URI = 'mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true';
const expected = [
  { key: { spaId: 1, invoiceId: 1, lineId: 1, category: 1 }, unique: true },
  { key: { spaId: 1, sourceType: 1, sourceId: 1 }, unique: true },
  { key: { spaId: 1, staffId: 1, earnedAt: -1 }, unique: false },
] as const;

function fail(message: string): never { throw new Error(message); }
function guard() {
  if ((process.env.MONGODB_URI || '') !== EXPECTED_URI) fail('BLOCKED_TARGET: MONGODB_URI must be the approved local spacare_test URI.');
  if (process.env.ATLAS_URI || process.env.MONGODB_ATLAS_URI) fail('BLOCKED_TARGET: Atlas variables are forbidden.');
  const parsed = new URL(EXPECTED_URI);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '27018' || parsed.pathname !== '/spacare_test' || parsed.searchParams.get('replicaSet') !== 'rs0' || parsed.searchParams.get('directConnection') !== 'true') fail('BLOCKED_TARGET: URI guard failed.');
}
function keyOf(key: Record<string, number>) { return Object.entries(key).map(([name, direction]) => `${name}:${direction}`).join(','); }
function inspect(actual: mongoose.mongo.IndexDescription[]) {
  const problems: string[] = [];
  for (const wanted of expected) {
    const found = actual.find(index => keyOf(index.key as Record<string, number>) === keyOf(wanted.key));
    if (!found) problems.push(`missing ${keyOf(wanted.key)}`);
    else if (Boolean(found.unique) !== wanted.unique) problems.push(`mismatched unique option ${keyOf(wanted.key)}`);
  }
  return problems;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const approved = process.argv.includes('--approve-index-readiness');
  guard();
  if (apply && (!approved || process.env.SPACARE_INDEX_READINESS_APPROVAL !== 'LOCAL_TEST_ONLY' || process.env.SPACARE_ENV !== 'test'))
    fail('BLOCKED_APPLY: require --apply, --approve-index-readiness, SPACARE_INDEX_READINESS_APPROVAL=LOCAL_TEST_ONLY and SPACARE_ENV=test.');
  await mongoose.connect(EXPECTED_URI, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db!;
  const collectionName = InvoiceLineCommission.collection.name;
  const exists = (await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray()).length > 0;
  let indexes = exists ? await InvoiceLineCommission.collection.indexes() : [];
  let problems = inspect(indexes);
  if (apply && problems.length) {
    if (!exists) await InvoiceLineCommission.createCollection();
    for (const wanted of expected) {
      const found = indexes.find(index => keyOf(index.key as Record<string, number>) === keyOf(wanted.key));
      if (!found) await InvoiceLineCommission.collection.createIndex(wanted.key, wanted.unique ? { unique: true } : {});
    }
    indexes = await InvoiceLineCommission.collection.indexes();
    problems = inspect(indexes);
  }
  const report = { mode: apply ? 'apply' : 'dry-run', target: 'local-spacare_test', collection: collectionName, exists, problems, indexes: indexes.filter(index => index.name !== '_id_').map(index => ({ name: index.name, key: index.key, unique: Boolean(index.unique) })) };
  console.log(JSON.stringify(report, null, 2));
  if (problems.length) process.exitCode = 2;
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'INDEX_READINESS_FAILED'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
