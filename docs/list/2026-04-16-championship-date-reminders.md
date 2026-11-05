---
summary: Email the devs when next year's BCA or APA championship dates are missing
kind: task
added: 2026-04-16
checked: 2026-11-04
---

BCA and APA national championship dates have to be entered into
`championship_date_options` each year. If they're missing, the schedule
wizard can't flag conflicts for those weeks.

## The idea

A Supabase Edge Function on a cron schedule:

1. Create `supabase/functions/check-championship-dates/index.ts`.
2. Query `championship_date_options` for the upcoming year.
3. If dates are missing, send a reminder email through Resend.
4. Run monthly, Sept–Nov for BCA and Jan–Apr for APA.

Resend is already set up. Copy the send pattern from
`supabase/functions/send-invite/index.ts`; `RESEND_API_KEY` is configured.

Recipients: an env var (`DEV_NOTIFICATION_EMAILS`) or a new
`dev_notification_recipients` table.

Effort: about 50 lines. The hardest part is the Supabase cron setup.

Full details: `memory-bank/plans/TODO-championship-date-reminders.md`.
