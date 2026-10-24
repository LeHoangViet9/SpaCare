import assert from 'node:assert/strict';
import { seedOwnerConfig, checkSeedOwnerMatches } from '../src/lib/seed-owner';
const password = 'fixture-password-123';
const config = seedOwnerConfig({ SEED_OWNER_PHONE: '+84 912.345.678', SEED_OWNER_PASSWORD: password });
assert.equal(config.phone, '0912345678');
assert.equal(config.email, undefined);
assert.equal(config.password, password);
const legacy = seedOwnerConfig({ SEED_OWNER_EMAIL: ' Owner@Example.com ', SEED_OWNER_PASSWORD: password });
assert.equal(legacy.email, 'owner@example.com');
assert.equal(legacy.phone, undefined);
for (const env of [
  { SEED_OWNER_PHONE: 'invalid', SEED_OWNER_PASSWORD: password },
  { SEED_OWNER_EMAIL: 'invalid', SEED_OWNER_PASSWORD: password },
  { SEED_OWNER_PASSWORD: password },
  { SEED_OWNER_PHONE: '0912345678', SEED_OWNER_PASSWORD: 'short' },
  { SEED_OWNER_PHONE: '0912345678', SEED_OWNER_PASSWORD: 'x'.repeat(129) },
]) assert.throws(() => seedOwnerConfig(env));
const user = { phone: config.phone, role: 'OWNER', active: true };
assert.doesNotThrow(() => checkSeedOwnerMatches(config, [user]));
assert.doesNotThrow(() => checkSeedOwnerMatches(legacy, [{ email: legacy.email, role: 'OWNER', active: true }]));
for (const matches of [[], [user, user], [{ ...user, role: 'STAFF' }], [{ ...user, active: false }], [{ ...user, phone: '0987654321' }]])
  assert.throws(() => checkSeedOwnerMatches(config, matches));
const both = seedOwnerConfig({ SEED_OWNER_PHONE: config.phone, SEED_OWNER_EMAIL: legacy.email, SEED_OWNER_PASSWORD: password });
assert.throws(() => checkSeedOwnerMatches(both, [user]));
assert.throws(() => checkSeedOwnerMatches(both, [user, { email: legacy.email, role: 'OWNER', active: true }]));
assert.doesNotThrow(() => checkSeedOwnerMatches(both, [{ ...user, email: legacy.email }]));
