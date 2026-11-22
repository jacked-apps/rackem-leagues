---
summary: Set up a verified sending address so email invites work (all environments)
kind: task
added: 2026-04-21
checked: 2026-11-19
---

Needs Ed. This is environment setup, not app code.

**Re-checked 2026-11-02: bigger than staging.** Email invites are switched off on every environment (`EMAIL_INVITES_ENABLED` in `src/config/featureFlags.ts`), because the invite function still sends from Resend's sandbox address, which only delivers to the account owner. The real task is a verified sending address for invites, everywhere. Invites by link or QR still work meanwhile.

Found 2026-04-21 during the first real-player staging test. The staging
Supabase environment sends no email. A captain's email invite for a
placeholder player silently goes nowhere. Only Device Handoff and Share Link /
QR work on staging. No email-confirmation tests can run there either.

The `send-invite` edge function (`supabase/functions/send-invite/`) uses
Resend and degrades quietly when `RESEND_API_KEY` is unset.

Fix direction:

- Configure staging with a real SMTP provider (Resend, SendGrid, Postmark,
  Supabase's built-in SMTP), or route staging mail through a capture inbox
  like Mailtrap or Inbucket so the flow can be tested end to end.
- Decide on purpose whether staging sends real mail or only captures it.
  Capturing is usually safer.
- Document the setup in memory-bank so future environments inherit it.

**2026-11-19: the same setup unlocks passwordless sign-in.** Jack pays for
an email service that can do this; Ed is asking him to set it up or grant
access. Supabase needs its SMTP details: server + port, username + password
(or API key), and a sending address on a verified domain — entered in the
Supabase dashboard (Authentication → Emails → SMTP), once per environment,
never pasted into chat or code. Once it works, the rest of the passwordless
go-live list in `PRE_LAUNCH_CHECKLIST.md` follows (code template, redirect
allow-list, bot check, send limits, flip the flag). At that point also send
"Create account" (Home and the Sign-in-first pop-up) to the one-door sign-in
instead of the password Register page, keeping `?redirect`.
