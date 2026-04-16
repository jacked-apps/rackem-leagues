# TODO: Automated Championship Date Reminders

**Status:** Not started
**Discovered:** 2026-04-16

## What's needed

Send automated email reminders to devs when BCA/APA championship dates
for the upcoming year haven't been entered into the
`championship_date_options` table yet.

## Implementation plan

1. Create a new Supabase Edge Function: `check-championship-dates`
2. Function queries `championship_date_options` for the upcoming year
3. If dates are missing for either BCA or APA → call Resend API to send
   reminder emails to a list of dev addresses
4. Schedule the function via Supabase cron (suggest monthly, starting
   2-3 months before the typical announcement window)

## Suggested schedule

- **BCA** typically announces in late summer/fall for the next year
  → Check monthly Sept-Nov
- **APA** typically announces in spring for that year
  → Check monthly Jan-Apr

## Reuse existing infrastructure

- Resend is already set up (used by `send-invite` function)
- `RESEND_API_KEY` env var already configured in Supabase
- Email send pattern can be copied from `supabase/functions/send-invite/index.ts`

## Recipients

Either:
- Hardcode in env var: `DEV_NOTIFICATION_EMAILS=ed@email.com,jack@email.com`
- Or create a small `dev_notification_recipients` table

## Effort estimate

~50 lines of code for the edge function. The hardest part is configuring
the cron schedule in Supabase.
