# Passwordless Sign-In — Production Setup Checklist

Hosted-dashboard + env steps for the passwordless one-door in production. These
cannot be verified by tests or code review — they live in the Supabase dashboard
and deploy env. See also the top-level `PRE_LAUNCH_CHECKLIST.md`.

> **Status (2026-11-19):** the flag is already ON in production (PR #174, June
> 2026). It was flipped before the SMTP and template boxes below were confirmed.
> The step-by-step fix, using MXroute as the mail server, is
> `docs/ops/mxroute-production-email.md`. Staging deliberately stays on Supabase's
> built-in mailer as a sandbox.

> Local dev needs none of this: the local Magic Link template
> (`supabase/templates/magic_link.html`) already sends a typed code, and Mailpit
> (`http://localhost:54324`) captures it. The feature flag defaults ON in dev.

## Production checklist

- [ ] **OTP email template → code.** In Supabase Dashboard → Authentication → Email
  Templates → *Magic Link*, ensure the body uses `{{ .Token }}` (the 6-digit code),
  not `{{ .ConfirmationURL }}` (a link).
- [ ] **Custom SMTP.** Configure custom SMTP through **MXroute** (decided
  2026-11-19, already paid for; see `docs/ops/mxroute-production-email.md`). The
  built-in mailer only reaches Supabase team members, a few emails an hour, so it
  can't handle real sign-in volume.
- [ ] **Email confirmations ON.** Authentication → Providers → Email → "Confirm
  email" enabled. Required so same-email Google/Facebook/email-OTP accounts auto-link
  into one user instead of duplicating (and to prevent email-takeover).
- [ ] **Redirect allow-list.** Add every post-auth URL: production `site_url` and the
  OAuth landing route. One entry per environment (staging, prod). OAuth redirects to
  non-allow-listed URLs are silently rejected.
- [ ] **Rate limits + abuse control.** Set OTP `max_frequency` (~60s) and the
  `email_sent` / `sign_in_sign_ups` limits for real volume; enable a bot-check
  (Cloudflare Turnstile / hCaptcha) on the public email box.
- [ ] **Google OAuth callback** registered in the Google console for the prod origin.
- [ ] **Facebook** (when Unit 5 ships): create the Facebook developer app, pass
  **App Review** for the `email` permission, register the OAuth callback. Until
  review clears, only tester accounts can use it.
- [x] **Flip the flag.** `VITE_PASSWORDLESS_SIGN_IN=true` is set in
  `.github/workflows/deploy-production.yml` (PR #174) and in `deploy-staging.yml`.

## Local testing (already works)

1. `pnpm run db:start` (restart with `db:stop && db:start` after config.toml edits)
2. `pnpm run dev`
3. Enter your email on `/login` → open `http://localhost:54324` → read the code →
   type it in → signed in.
