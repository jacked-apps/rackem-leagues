---
summary: Send app email through MXroute - production sign-in codes first, then email invites
kind: task
added: 2026-04-21
checked: 2026-11-23
owner: both
---

**Decided 2026-11-19:** app email goes through **MXroute**, which we already pay
for, instead of adding a paid service. Supabase Auth on **staging stays on the
built-in mailer** as a sandbox. Our own functions (invites) get the MXroute
secrets on staging too, so Ed can try invites there first.

**Part 1: production sign-in email: DONE 2026-11-23.** Jack set MXroute as
production Supabase Auth's mail server (`docs/ops/mxroute-production-email.md`).
The DNS check passes all four records. A reset email reached Gmail's inbox from
`noreply@rackemleagues.com` with SPF, DKIM and DMARC all PASS. Still to try: the
code sign-in and the new-user welcome email (runbook Step 6, items 2-4).

**Part 2: email invites: code BUILT, waiting on Jack.** `send-invite` now sends
through the same mailbox (`supabase/functions/_shared/sendMail.ts`, SMTP on port
465, which Supabase doesn't block), and only signed-in users can call it.
`send-test-email` is locked with a secret. Tested locally against Mailpit.
Jack's steps: `docs/ops/mxroute-app-email.md` (function secrets on staging and
production, then one test email each).

**After Jack's test passes (Claude):** turn on `EMAIL_INVITES_ENABLED`
(`src/config/featureFlags.ts`), gated to non-production first. Make the invite
screens say when the email didn't send (they ignore `email_sent` today). Invites
by link or QR keep working meanwhile.
