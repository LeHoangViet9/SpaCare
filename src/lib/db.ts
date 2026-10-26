import mongoose from 'mongoose';
import { assertDatabaseTarget, assertConnectedDatabase, SafetyGuardError } from './production-safety.mjs';

let pending: Promise<typeof mongoose> | undefined;

export type DatabaseErrorCode = 'DB_CONFIG_MISSING' | 'DB_CONFIG_INVALID' | 'DB_AUTH_FAILED' | 'DB_DNS_FAILED' | 'DB_CONNECTION_FAILED' | 'SAFETY_GUARD_BLOCKED';

export class DatabaseUnavailableError extends Error {
  constructor(public code: DatabaseErrorCode) {
    super('Không thể kết nối cơ sở dữ liệu. Vui lòng báo chủ spa kiểm tra cấu hình máy chủ.');
    this.name = 'DatabaseUnavailableError';
  }
}

// Driver messages can contain credentials. Only expose these fixed codes.
export function databaseErrorCode(error: unknown): DatabaseErrorCode {
  const e = error as { name?: string; code?: string | number; message?: string } | null;
  if (e?.code === 18 || /AuthenticationFailed|bad auth|authentication failed/i.test(e?.message || '')) return 'DB_AUTH_FAILED';
  if (/querySrv|queryTxt|ENOTFOUND|EAI_AGAIN/i.test(`${e?.code || ''} ${e?.message || ''}`)) return 'DB_DNS_FAILED';
  if (e?.name === 'MongoParseError') return 'DB_CONFIG_INVALID';
  return 'DB_CONNECTION_FAILED';
}

export async function connect(purpose: 'runtime' | 'maintenance' | 'import' | 'demo' | 'test' = 'runtime') {
  const uri = process.env.MONGODB_URI;
  if (!uri?.trim()) throw new DatabaseUnavailableError('DB_CONFIG_MISSING');
  let expected: string;
  try {
    expected = assertDatabaseTarget(uri, process.env, purpose);
    if (mongoose.connection.readyState === 1) {
      assertConnectedDatabase(expected, mongoose.connection.name);
      return mongoose;
    }
  } catch (error) {
    if (error instanceof SafetyGuardError) throw new DatabaseUnavailableError('SAFETY_GUARD_BLOCKED');
    throw error;
  }
  pending ??= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000, autoIndex: false })
    .then(connection => {
      assertConnectedDatabase(expected, connection.connection.name);
      return connection;
    })
    .catch(e => {
      if (e instanceof SafetyGuardError) throw new DatabaseUnavailableError('SAFETY_GUARD_BLOCKED');
      throw new DatabaseUnavailableError(databaseErrorCode(e));
    })
    .finally(() => {
      // A settled promise is not proof of a live connection after a disconnect.
      pending = undefined;
    });
  const connection = await pending;
  try { assertConnectedDatabase(expected, connection.connection.name); }
  catch { throw new DatabaseUnavailableError('SAFETY_GUARD_BLOCKED'); }
  return connection;
}
