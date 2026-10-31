// No database connection or logging in this module.
export class ReadinessError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function safeError(error) {
  if (error instanceof ReadinessError && /^BLOCKED_[A-Z_]+$/.test(error.code)) return error.code;
  if (error?.code === 11000) return 'BLOCKED_DUPLICATE_KEY';
  if (error?.code === 13 || error?.code === 18) return 'BLOCKED_AUTHORIZATION';
  return 'BLOCKED_DATABASE_OPERATION';
}
export function checkConcerns(result) {
  if (result?.ok !== 1 || result?.defaultReadConcern?.level !== 'majority'
    || result?.defaultWriteConcern?.w !== 'majority' || result?.defaultWriteConcern?.j !== true)
    throw new ReadinessError('BLOCKED_RW_CONCERN');
}
export function checkPrivileges(privileges, database, apply) {
  const needs = [
    ['listCollections', database, ''],
    ['listIndexes', database, 'commissions'],
    ['listIndexes', database, 'invoicelinecommissions'],
    ['find', database, 'invoicelinecommissions'],
    ['getDefaultRWConcern', null, null],
    ...(apply ? [['createCollection', database, 'invoicelinecommissions'], ['createIndex', database, 'invoicelinecommissions']] : []),
  ];
  const granted = (action, db, collection) => Array.isArray(privileges) && privileges.some(p => {
    const r = p?.resource;
    if (!r || !Array.isArray(p.actions) || !p.actions.includes(action)) return false;
    if (db === null) return r.cluster === true && Object.keys(r).length === 1;
    return typeof r.db === 'string' && typeof r.collection === 'string'
      && Object.keys(r).every(k => k === 'db' || k === 'collection')
      && (r.db === db || r.db === '') && (r.collection === collection || r.collection === '');
  });
  if (!needs.every(([a, d, c]) => granted(a, d, c))) throw new ReadinessError('BLOCKED_PRIVILEGES');
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function indexSnapshot(indexes) {
  return JSON.stringify(indexes.map(index => ({
    key: Object.entries(index.key),
    options: canonical(Object.fromEntries(Object.entries(index).filter(([k]) => k !== 'key'))),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
export async function preserveLegacy(readIndexes, work) {
  const before = indexSnapshot(await readIndexes());
  try { return await work(); }
  finally {
    if (before !== indexSnapshot(await readIndexes())) throw new ReadinessError('BLOCKED_LEGACY_INDEX_DRIFT');
  }
}
