# Maintenance and write-freeze runbook

This branch adds a fail-closed application guard. It does not itself prove that Atlas has no active writer; database/operational quiescence evidence is still required before a Production backup.

## Modes

`SPACARE_WRITE_FREEZE=OFF` explicitly permits writes. `SPACARE_WRITE_FREEZE=ON` returns HTTP 503 with `code=WRITE_FREEZE` and `Retry-After: 120` for write methods. In Production, missing or malformed configuration is treated as `ON`. Test/development defaults remain writable only when the variable is absent.

The middleware covers API `POST`, `PUT`, `PATCH` and `DELETE` requests. Backend guards also cover operations, public booking, authentication session writes, notifications, cron dispatch, product image writes, catalog import and notification dispatch. The maintenance page is available at `/maintenance`; operational routing should direct users there while the freeze is active.

## Enable and drain

1. Open a change ticket with the backup owner, freeze owner, UTC window, target release and rollback owner.
2. Set `SPACARE_WRITE_FREEZE=ON` consistently in every Production deployment/runtime environment, then verify a fresh deployment is serving that value. Do not rely on one warm serverless instance.
3. Pause Vercel cron and external jobs, imports and manual scripts. Do not run `db:*` scripts against `spacare_live`.
4. Probe every write route with a harmless request and verify HTTP 503/`WRITE_FREEZE`; verify the public booking endpoint and both cron endpoints also reject writes.
5. Wait for the maximum configured request/transaction duration, then verify quiescence from Atlas operational metrics/current operations using an approved read-only account. Confirm no active transactions or write operations and record the observation time. Route blocking alone is insufficient evidence.
6. If any writer remains, keep the freeze and backup **BLOCKED**. Do not revoke application database privileges as a substitute for a controlled drain.

## Backup and reopen

After quiescence evidence is accepted, run the separately approved read-only `mongodump` procedure. Atlas M0 does not provide an oplog dump, so writes must remain frozen throughout the dump. Verify archive integrity and SHA-256 before reopening.

Set `SPACARE_WRITE_FREEZE=OFF` through a fresh deployment, verify the served configuration, probe a permitted synthetic/write health path, and re-enable cron/jobs only after the backup evidence is archived. If configuration propagation is uncertain, remain frozen.

## Rollback and incidents

If the guard deployment is unhealthy, route all traffic to the last known good version only after confirming its write mode and database target. If quiescence, archive, or hash verification fails, keep writes frozen, preserve logs and evidence, and do not retry against an unapproved target. No application rollback proves database quiescence; repeat the operational verification.

This feature does not provide an administrative toggle endpoint, because such an endpoint would itself be a write control surface. Environment changes and traffic routing require the approved deployment procedure and audit trail.
