# SpaCare notifications

## Current events and recipients

| Event | Recipients | Preview |
|---|---|---|
| Online appointment | Active owner and staff in the same spa | Guest, phone, all services, Vietnam arrival date/time |
| Appointment due in ten minutes | Owners and staff for public visits; owners and assigned staff for internal visits | Customer, services and Vietnam arrival time |
| New operational invoice | Active owners | Customer, invoice contents, total, creator |
| Unclosed daily book | Active owners | Day needing review, link to daily closing |

The inbox works independently of device push permissions. Each phone/browser must explicitly enable push. Push uses the saved event text; preview length and display on a locked phone also depend on the operating system. Full content remains in the authenticated inbox.

## Deployment

1. Run `npm run push:db` against the intended application database (`.env.local` for this script) to create the ActivityNotification collection and indexes. This is additive; no operational history is removed. `npm run db:setup` also includes this collection.
2. Keep VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT configured in Vercel. Keep existing keys when subscribers already exist.
3. Add CRON_SECRET to the Vercel production environment (a random secret of at least 16 characters; the local push setup script creates one if missing). Never put its value in documentation, logs or source control.
4. Deploy to production. The daily schedule in vercel.json invokes `/api/notifications/daily-close` with Vercel's Bearer authorization.
5. Enable notifications separately on each owner's/staff's phone. On iPhone use a Home Screen web app on a supported iOS version.

Schedule: `0 15 * * *` UTC = 22:00 Vietnam time. On Vercel Hobby the request may run anywhere during 22:00-22:59. A suitable external scheduler or paid plan is required for minute-level scheduling. This endpoint accepts the same authenticated request from an external scheduler; never place the secret in the URL. See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Reminders only notify; they never close the daily book. Repeated invocations do not duplicate a day/owner event. Already closed days are skipped, and reminders queued before closing are suppressed. Invoice notifications commit in the same transaction as the invoice and are sent after commit. Only owners can read invoice and closing notifications. Staff can read public booking records but existing write/financial permissions remain enforced.

## Validation boundaries

Automated tests use model doubles to verify recipient scope, local-time boundaries, duplicate prevention, rollback, encrypted push content, authorization and stale reminder suppression. They do not prove device delivery or production cron configuration. Integration tests must use only spacare_test. Confirm actual phone delivery and the deployed scheduler after rollout.


## Appointment reminder scheduling

Use an external scheduler to call `GET /api/notifications/dispatch` once per minute with the header `Authorization: Bearer <CRON_SECRET>`. Keep the secret in the scheduler's secret/header configuration, never in the URL. This source change does not create an external account or activate such a job. Vercel Hobby does not support per-minute cron; the default vercel.json remains compatible with its once-daily limit. A suitable Vercel plan can add `{"path":"/api/notifications/dispatch","schedule":"* * * * *"}` to its crons list instead.

When no minute scheduler is configured, an open workspace's inbox polling also checks reminders, but closed-browser/background delivery at the ten-minute threshold is not guaranteed. Booking within ten minutes of arrival produces the reminder on the next check. Messages queued for canceled, postponed, completed, past or rescheduled visits are suppressed before send; push TTL is limited to arrival. No scheduler or push network guarantees zero-second delivery delay.

## Invoice codes before deployment

Run `npm run db:invoice-codes` against the intended database (.env.local for that command). It assigns missing HD000001-style metadata under a per-spa transaction, retains existing assigned codes, recovers the sequence and creates the unique code index. It does not alter ObjectIds, money, payment or commission history. New invoices allocate their codes inside their own transaction; retried requests reuse the same invoice/code. This metadata migration has not been applied to operational data by source edits.
