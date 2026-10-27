# Server-side web push isolation

No database connection, data migration or deployment is part of this change.

## Delivery policy

`src/lib/push-safety.ts` is the single policy used by configuration, registration, dispatcher and final network sender. VAPID credentials do not override it.

- Vercel: require VERCEL=1, VERCEL_ENV=production, NODE_ENV=production, and VERCEL_TARGET_ENV absent or production.
- Local Production: require explicit SPACARE_ENV=production and NODE_ENV=production, with no cloud identity or CI signals.
- Both: the unchanged Production Safety Guard must accept the URI and target. Only spacare_live/spacare_prod can deliver. Test, staging, demo, operations, development, unknown/missing and conflicting environment signals deny delivery. NODE_TEST_CONTEXT always denies it.
- Dispatcher also verifies an already-connected database matches the URI namespace. It never connects itself.
- Existing Vercel Production needs no new configuration variable. Current VAPID validation/encryption, endpoint allowlist, transient retry, TTL and expired-device cleanup remain active in authorized Production only.

There is no opt-in flag allowing Preview or test to send.

## Protected paths

| Entry point | Protection |
| --- | --- |
| Inbox polling / operations API / booking API `after()` | All dispatch goes through the guarded dispatcher |
| daily-close / dispatch cron APIs | Existing cron authentication plus the same dispatcher guard |
| CLI seed or direct domain operations | Notifications are queued with immutable environment provenance, no network sender called |
| Direct call to sendPush | Requires an explicit delivery context and rechecks environment/provenance immediately before fetch |
| Subscribe API | Nonproduction returns 403 before writing PushDevice; no automatic deletion of existing subscriptions |

Blocked dispatch returns before any claim, lease, attempts increment, SENT/readAt update or subscription access. If environment changes after a lease was legitimately acquired, the final guard prevents sending and SENT updates; the pending lease expires normally. The blocked guard does not repair or delete outbox records. In-app inbox reads and explicit user read/unsubscribe actions retain their existing behavior.

## Outbox provenance

Notification and ActivityNotification have an additive immutable pushEnvironment field:

- PRODUCTION: created under verified Production policy.
- QUARANTINED: created under any other policy, including unknown identity.

All current queue writers stamp the field explicitly. Schema defaults cover other Mongoose creation paths. No automatic reclassification or migration occurs. Enabling VAPID or changing environment later cannot promote a stored QUARANTINED row.

Production claims only PRODUCTION or legacy rows with no stored marker. Quarantined/malformed markers are excluded before leasing and remain visible in the inbox, pending and unsent. Final sender checks provenance again.

Legacy unmarked Production messages remain deliverable to preserve existing outbox behavior. An unmarked historical message has no recoverable creation environment: never copy legacy Staging outbox/subscriptions into Production. Retrospective classification would require a separately approved data review/migration; this patch does not inspect or rewrite data. A runtime pointed at spacare_test cannot send, even if VAPID is later configured.

## Rollout before synthetic seed

**Old Preview deployments/workers do not understand the marker or guard.** This patch must be present in every runtime sharing the Staging DB before seeding, or outbound push must remain disabled in all older runtimes (e.g. no complete VAPID configuration). Check branch/commit and external scheduler targets separately. No push or deployment was performed as part of implementation.

Do not change Production secrets or database configuration to test this patch. No index rebuild, schema migration command or collection reset is required for the additive field. Existing Production outbox remains readable/deliverable under valid Production configuration. Review large legacy backlog query performance after rollout; no index is created automatically by this change.

## Offline validation

Tests use synthetic environments, model doubles and mocked HTTP only. They cover conflicting identities, missing variables/VAPID, Preview/test/staging denial, direct sender denial, no consumption/deletion, stored quarantine after environment changes, Production legacy/current delivery, encryption, TTL, expired subscriptions, retry and Production subscribe compatibility. The synthetic seed full-plan fixture asserts every generated activity notification is QUARANTINED.

Real Vercel configuration, devices, delivery and deployment are not verified by offline tests.
