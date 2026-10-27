import { assertDatabaseTarget } from './production-safety.mjs';

type Environment = Record<string, string | undefined>;
export type PushEnvironment = 'PRODUCTION' | 'QUARANTINED';
export type PushDeliveryContext = { pushEnvironment?: unknown };

// VAPID credentials alone never authorize delivery. Pure: no driver or network I/O.
export function productionPushAllowed(env: Environment = process.env): boolean {
  if (env.NODE_ENV !== 'production' || env.NODE_TEST_CONTEXT ||
      (env.SPACARE_ENV && env.SPACARE_ENV !== 'production')) return false;
  const cloud = Object.keys(env).some(key => key.startsWith('VERCEL') && !!env[key]);
  if (cloud && (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' ||
      (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== 'production'))) return false;
  if (!cloud && (env.SPACARE_ENV !== 'production' || env.CI)) return false;
  try {
    const database = assertDatabaseTarget(env.MONGODB_URI || '', env, 'runtime');
    return database === 'spacare_live' || database === 'spacare_prod';
  } catch { return false; }
}

// Immutable at creation: enabling push later must never promote sandbox messages.
export function notificationPushEnvironment(env: Environment = process.env): PushEnvironment {
  return productionPushAllowed(env) ? 'PRODUCTION' : 'QUARANTINED';
}
export function productionOutboxOrigin(origin: unknown): boolean {
  // Only a validated Production namespace may dispatch legacy unmarked rows.
  return origin === undefined || origin === 'PRODUCTION';
}
export class PushSafetyBlockedError extends Error {
  constructor() { super('PUSH_SAFETY_BLOCKED'); this.name = 'PushSafetyBlockedError'; }
}
export function assertPushDelivery(context?: PushDeliveryContext, env: Environment = process.env) {
  if (!context || !productionPushAllowed(env) || !productionOutboxOrigin(context.pushEnvironment))
    throw new PushSafetyBlockedError();
}
