import mongoose from 'mongoose';

let pending: Promise<typeof mongoose> | undefined;

export type DatabaseErrorCode = 'DB_CONFIG_MISSING' | 'DB_CONFIG_INVALID' | 'DB_AUTH_FAILED' | 'DB_DNS_FAILED' | 'DB_CONNECTION_FAILED';

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

export async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri?.trim()) throw new DatabaseUnavailableError('DB_CONFIG_MISSING');
  if (mongoose.connection.readyState === 1) return mongoose;
  pending ??= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000, autoIndex: false })
    .catch(e => {
      throw new DatabaseUnavailableError(databaseErrorCode(e));
    })
    .finally(() => {
      // A settled promise is not proof of a live connection after a disconnect.
      pending = undefined;
    });
  return pending;
}
