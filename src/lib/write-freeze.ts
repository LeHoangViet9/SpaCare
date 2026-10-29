import { ensure } from './rules.ts';

export const WRITE_FREEZE_ENV = 'SPACARE_WRITE_FREEZE';
export const WRITE_FREEZE_ON = 'ON';
export const WRITE_FREEZE_OFF = 'OFF';

export class WriteFreezeError extends Error {
  readonly status = 503;
  constructor() {
    super('Hệ thống đang tạm dừng ghi dữ liệu để bảo trì. Vui lòng thử lại sau.');
    this.name = 'WriteFreezeError';
  }
}

export function writeFreezeMode(value = process.env[WRITE_FREEZE_ENV], environment = process.env.NODE_ENV) {
  if (environment !== 'production' && !value) return WRITE_FREEZE_OFF;
  if (value === WRITE_FREEZE_OFF) return WRITE_FREEZE_OFF;
  if (value === WRITE_FREEZE_ON) return WRITE_FREEZE_ON;
  // Production must opt into writes explicitly. Missing or malformed mode freezes.
  return WRITE_FREEZE_ON;
}

export function isWriteFrozen() {
  return writeFreezeMode() === WRITE_FREEZE_ON;
}

export function assertWritesAllowed() {
  if (isWriteFrozen()) throw new WriteFreezeError();
}

export function maintenanceResponse(requestId?: string) {
  return Response.json(
    { error: 'Hệ thống đang tạm dừng ghi dữ liệu để bảo trì.', code: 'WRITE_FREEZE' },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '120', ...(requestId ? { 'X-Request-Id': requestId } : {}) } },
  );
}

export function requireMaintenanceConfiguration() {
  ensure(process.env.NODE_ENV !== 'production' || process.env[WRITE_FREEZE_ENV] === WRITE_FREEZE_OFF || process.env[WRITE_FREEZE_ENV] === WRITE_FREEZE_ON, 'Write-freeze configuration is invalid.', 503);
}
