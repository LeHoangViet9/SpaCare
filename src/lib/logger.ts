import { randomUUID } from 'node:crypto';

// Fixed fields only: never serialize requests, errors, or arbitrary business data.
export type LogContext = { requestId?: string; actorId?: string; spaId?: string; action?: string; durationMs?: number; status?: number; code?: string };
const events = ['request.failed', 'operation.completed', 'auth.login.completed'] as const;
export function log(level: 'info' | 'warn' | 'error', event: typeof events[number], context: LogContext = {}) {
  const record: Record<string, unknown> = { timestamp: new Date().toISOString(), level, event };
  for (const field of ['requestId', 'actorId', 'spaId'] as const) {
    const value = context[field];
    if (typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value)) record[field] = value;
  }
  if (context.action && /^[a-zA-Z]{1,64}$/.test(context.action)) record.action = context.action;
  if (context.code && /^[A-Z0-9_]{1,64}$/.test(context.code)) record.code = context.code;
  for (const field of ['durationMs', 'status'] as const) {
    if (typeof context[field] === 'number' && Number.isFinite(context[field])) record[field] = context[field];
  }
  // Diagnostics must never turn a committed operation into a failed HTTP request.
  try { console[level](JSON.stringify(record)); } catch { /* unavailable log sink */ }
}
export function requestId() { return randomUUID(); }
