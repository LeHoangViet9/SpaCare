import assert from 'node:assert/strict';
import type mongoose from 'mongoose';
import type { Model } from 'mongoose';

const EXPECTED = {
  host: '127.0.0.1',
  port: 27018,
  database: 'spacare_test',
  replicaSet: 'rs0',
} as const;

const REQUIRED_ENV = {
  NODE_ENV: 'test',
  SPACARE_ENV: 'integration',
  SPACARE_TARGET_DATABASE: EXPECTED.database,
  SPACARE_INTEGRATION_ISOLATED: 'local-rs0',
} as const;

export class IntegrationSafetyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntegrationSafetyError';
  }
}

function blocked(code: string, message: string): never {
  throw new IntegrationSafetyError(code, `BLOCKED: ${message}`);
}

function isTruthy(value: string | undefined) {
  return !!value && !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

export type IntegrationTarget = {
  uri: string;
  host: typeof EXPECTED.host;
  port: typeof EXPECTED.port;
  database: typeof EXPECTED.database;
  replicaSet: typeof EXPECTED.replicaSet;
};

export function assertIntegrationEnvironment(env: NodeJS.ProcessEnv): IntegrationTarget {
  for (const [name, expected] of Object.entries(REQUIRED_ENV)) {
    if (!env[name]) blocked('ENV_MISSING', `${name} is required.`);
    if (env[name] !== expected) blocked('ENV_INVALID', `${name} is not the audited integration value.`);
  }
  if (env.VERCEL_ENV || env.VERCEL) blocked('HOSTED_ENV_REJECTED', 'Vercel environments are not allowed.');
  if (isTruthy(env.CI)) blocked('CI_ENV_REJECTED', 'CI is not an audited isolated environment.');

  const raw = env.MONGODB_URI?.trim();
  if (!raw) blocked('URI_MISSING', 'MONGODB_URI is required.');
  if (/^mongodb\+srv:/i.test(raw)) blocked('SRV_REJECTED', 'SRV/Atlas-style URIs are not allowed.');
  if (!/^mongodb:\/\//i.test(raw)) blocked('SCHEME_REJECTED', 'Only a direct mongodb:// URI is allowed.');

  let uri: URL;
  try { uri = new URL(raw); }
  catch { blocked('URI_INVALID', 'MONGODB_URI is invalid.'); }
  if (uri.username || uri.password) blocked('CREDENTIALS_REJECTED', 'Credentials are not allowed in the integration URI.');
  if (uri.hostname !== EXPECTED.host) blocked('HOST_REJECTED', 'Only the audited IPv4 loopback host is allowed.');
  if (uri.port !== String(EXPECTED.port)) blocked('PORT_REJECTED', 'Only port 27018 is allowed.');
  if (decodeURIComponent(uri.pathname) !== `/${EXPECTED.database}`) blocked('DATABASE_REJECTED', 'Only spacare_test is allowed.');
  if (uri.searchParams.getAll('replicaSet').length !== 1 || uri.searchParams.get('replicaSet') !== EXPECTED.replicaSet)
    blocked('REPLICA_SET_REJECTED', 'replicaSet must be rs0.');
  if (uri.searchParams.getAll('directConnection').length !== 1 || uri.searchParams.get('directConnection') !== 'true')
    blocked('DIRECT_CONNECTION_REQUIRED', 'directConnection=true is required for the audited local topology.');
  const allowedParameters = new Set(['replicaSet', 'directConnection']);
  for (const key of uri.searchParams.keys()) if (!allowedParameters.has(key))
    blocked('URI_PARAMETER_REJECTED', `MongoDB URI parameter ${key} is not audited.`);

  return { uri: raw, ...EXPECTED };
}

export type ServerIdentity = {
  host: string;
  port: number;
  database: string;
  replicaSet: string;
  writablePrimary: boolean;
};

export async function assertConnectedServerIdentity(
  connection: mongoose.Connection,
  target: IntegrationTarget,
): Promise<ServerIdentity> {
  const database = connection.db?.databaseName;
  const port = Number(connection.port);
  if (connection.host !== target.host || port !== target.port || database !== target.database)
    blocked('CONNECTED_TARGET_MISMATCH', 'The driver connected to a server outside the audited target.');
  const hello = await connection.db!.admin().command({ hello: 1 });
  if (hello.setName !== target.replicaSet) blocked('CONNECTED_REPLICA_SET_MISMATCH', 'hello did not report rs0.');
  if (hello.isWritablePrimary !== true) blocked('PRIMARY_REQUIRED', 'The audited test server is not the writable primary.');
  return {
    host: connection.host,
    port,
    database,
    replicaSet: hello.setName,
    writablePrimary: true,
  };
}

type IndexDocument = { key?: Record<string, unknown>; unique?: boolean; sparse?: boolean; expireAfterSeconds?: number; partialFilterExpression?: unknown };

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameKeys(actual: IndexDocument, expected: Record<string, unknown>) {
  // Compound index key order is semantically significant; do not sort it.
  return JSON.stringify(actual.key) === JSON.stringify(expected);
}

function matchesIndex(actual: IndexDocument, keys: Record<string, unknown>, options: Record<string, unknown>) {
  if (!sameKeys(actual, keys)) return false;
  for (const option of ['unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression'] as const) {
    if (option in options && stable(actual[option]) !== stable(options[option])) return false;
    if (!(option in options) && option === 'unique' && actual.unique === true) return false;
  }
  return true;
}

export type SchemaPreflight = { collectionCount: number; indexRequirementCount: number };

export async function inspectIntegrationSchema(
  connection: mongoose.Connection,
  models: Model<unknown>[],
): Promise<SchemaPreflight> {
  const existing = new Set((await connection.db!.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  const issues: string[] = [];
  let indexRequirementCount = 0;

  for (const model of models) {
    const collection = model.collection.name;
    if (!existing.has(collection)) {
      issues.push(`${collection}: collection missing`);
      continue;
    }
    const actual = await model.collection.listIndexes().toArray() as IndexDocument[];
    for (const [keys, options] of model.schema.indexes()) {
      indexRequirementCount += 1;
      if (!actual.some(index => matchesIndex(index, keys, options)))
        issues.push(`${collection}: missing index ${stable(keys)} options ${stable(options)}`);
    }
    if (model.modelName === 'User' && actual.some(index =>
      sameKeys(index, { email: 1 }) && index.unique === true && !index.partialFilterExpression && !index.sparse))
      issues.push(`${collection}: forbidden legacy all-document unique email index`);
    if (model.modelName === 'Treatment' && actual.some(index =>
      sameKeys(index, { spaId: 1, invoiceId: 1 }) && index.unique === true))
      issues.push(`${collection}: forbidden legacy unique spaId/invoiceId index`);
  }

  if (issues.length) blocked('SCHEMA_PREFLIGHT_FAILED', `read-only schema preflight failed:\n${issues.join('\n')}`);
  assert.ok(existing.size >= models.length);
  return { collectionCount: models.length, indexRequirementCount };
}
