# InvoiceLineCommission index readiness

`InvoiceLineCommission` is additive. The legacy `Commission` collection and its unique `invoiceId` index are not changed by this procedure.

The checked-in manifest is [invoice-line-commission-index-manifest.json](../scripts/invoice-line-commission-index-manifest.json). It defines collection `invoicelinecommissions` and exactly three application indexes: two unique indexes and one staff/earnedAt lookup index.

## Local test only

The local script is read-only by default and accepts only:

`mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true`

Dry-run:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true'
$env:SPACARE_ENV='test'
npx.cmd tsx scripts/index-readiness.ts
```

Apply is restricted to the same local test database and requires both explicit flags:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true'
$env:SPACARE_ENV='test'; $env:SPACARE_INDEX_READINESS_APPROVAL='LOCAL_TEST_ONLY'
npx.cmd tsx scripts/index-readiness.ts --apply --approve-index-readiness
```

The local script never drops an index. A missing index is created; an existing index with mismatched uniqueness remains a hard failure. Re-running apply is idempotent. Atlas variables, other hosts, other databases, and missing approval variables fail closed.

## Production preflight and apply

Production uses a separate wrapper. The local-only script above must never be pointed at Production. [index-readiness-production.ts](../scripts/index-readiness-production.ts) is dry-run by default and does not print the URI. It requires an operator-provided SHA-256 pin of the exact URI, approved host/database values, and `SPACARE_ENV=production`.

Set these values only in the approved operations shell; do not put them in source control or logs:

```powershell
$env:SPACARE_ENV='production'
$env:MONGODB_URI='<approved target URI from the secret store>'
$env:SPACARE_APPROVED_URI_SHA256='<64 lowercase hex characters from the change ticket>'
$env:SPACARE_APPROVED_HOST='<approved production hostname>'
$env:SPACARE_APPROVED_DB_NAME='<approved production database name>'
$env:SPACARE_APPROVED_REPLICA_SET='<approved replica-set name>'
npx.cmd tsx scripts/index-readiness-production.ts
```

The dry-run is **NO-GO** unless the target hash, host, database, replica-set health, privileges, existing index definitions, and duplicate-key scan all pass. The report contains only the target hash, database name, index metadata and counts; it does not print the URI or document data.

Apply requires all of the following in addition to the dry-run evidence: a change ticket, verified backup, completed restore rehearsal, explicit approval flag and approval marker.

```powershell
$env:SPACARE_CHANGE_TICKET='<approved ticket id>'
$env:SPACARE_BACKUP_VERIFIED='YES'
$env:SPACARE_RESTORE_REHEARSAL='YES'
$env:SPACARE_INDEX_READINESS_APPROVAL='PRODUCTION_APPROVED'
npx.cmd tsx scripts/index-readiness-production.ts --apply --approve-index-readiness
```

The wrapper creates only the manifest collection/indexes, never drops or rewrites data, rejects mismatched options, and stops before apply when duplicate keys or missing privileges are found. It does not alter `Commission`.

## Production runbook

1. Confirm a current verified backup, restore rehearsal, rollback owner, maintenance window, and least-privilege database account.
2. Run the production dry-run and confirm exact target pin, replica-set health, write concern, privileges, duplicate count zero, and no conflicting index options.
3. Confirm the existing `Commission` index manifest is unchanged and archive the preflight report.
4. Obtain explicit approval, then run the guarded apply command above. Create the collection first, followed by the three manifest indexes; never drop or alter `Commission` indexes.
5. Re-run the wrapper in dry-run mode and archive postflight output. Verify every manifest option and that the legacy indexes are unchanged.
6. Deploy/route traffic only after postflight evidence is stored. The application uses `autoIndex:false`, so it cannot make index readiness automatic; without this gate it can write line commissions before unique indexes exist.
7. If apply fails, stop rollout and preserve logs, backup evidence and index definitions. If application rollback is needed, keep the additive collection/indexes and reconcile any line-ledger rows before re-enabling the new version. Never delete financial history or change the legacy `Commission` unique index as an emergency workaround.

Any missing backup verification, target verification, privilege evidence, duplicate scan, or postflight manifest match is **NO-GO**.

## Hardened checks and evidence limitations

The wrapper logs only fixed error codes, never driver messages or raw index metadata. Privileges are checked against the pinned database and each collection (including `find` for the duplicate scan); `getDefaultRWConcern` requires the cluster resource. Dry-run does not require create privileges. Unprovable privileges fail closed.

The conservative release policy requires explicit default read concern `majority` and default write concern `{w:'majority',j:true}` with a successful command result. This is an operational release gate, not an instruction to change database defaults. Missing, implicit, weaker or inaccessible defaults block rollout. Operator approval of this policy remains required.

All legacy index definitions are canonicalized before the apply block and read again afterward, including on failure. Index list order and object option order are normalized; compound key order and every returned option remain significant. Drift or a failed postflight read blocks rollout. No legacy repair is attempted. `autoCreate:false` prevents model initialization from creating collections during dry-run.

Backup flags remain operator attestations, not automated proof of a valid backup. Store backup ID, restore rehearsal evidence, target approval and privilege evidence in the change ticket. The application must not receive traffic before postflight passes.

Offline policy regressions: `node --test tests/index-readiness-policy.test.mjs`. These use synthetic objects and no database connection; they do not establish Production privileges or backup readiness.

Build evidence must be stored outside this source tree: HEAD, complete candidate list (including untracked files), SHA-256 before/after, UTC timestamps, exact command `npm run build`, its exit code and build log. Candidate now includes the policy module and regression test: 18 files rather than the previous 16. Compare all source hashes and the candidate list before accepting the log. A BUILD_ID or timestamp alone is not sufficient. Do not modify ACLs or delete `.next` to obtain this evidence.
