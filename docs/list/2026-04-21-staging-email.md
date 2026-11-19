---
summary: Send app email through MXroute - production sign-in codes first, then email invites
kind: task
added: 2026-04-21
checked: 2026-11-19
owner: both
---

**Decided 2026-11-19:** app email goes through **MXroute**, which we already pay
for, instead of adding a paid service. **Staging stays on Supabase's built-in
mailer** as a sandbox (it reaches Supabase team members, which is enough for Ed
and Jack to test). The real mail server is for **production only**.

**Part 1: production sign-in codes (Jack, with Claude).** Passwordless sign-in
has been live in production since PR #174, and Supabase Auth sends the codes. It
needs MXroute set as its mail server, plus the code email template. Runbook:
`docs/ops/mxroute-production-email.md` (on branch `feat/passwordless-prod-email`
until that merges).

**Part 2: email invites (later, Claude).** Invites are switched off everywhere
(`EMAIL_INVITES_ENABLED` in `src/config/featureFlags.ts`). The `send-invite` edge
function (`supabase/functions/send-invite/`) still sends from Resend's sandbox
address, which only delivers to the account owner. Once Part 1 works, move it to
the same MXroute mailbox. Check first whether Supabase Edge Functions can open an
outbound SMTP connection on port 465. If they can't, invites need another route.
Invites by link or QR keep working meanwhile.
