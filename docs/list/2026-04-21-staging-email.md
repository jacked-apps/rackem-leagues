---
summary: Staging sends no email, so email invites and confirmations can't be tested
kind: task
added: 2026-04-21
checked: 2026-11-04
---

Needs Ed. This is environment setup, not app code.

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
