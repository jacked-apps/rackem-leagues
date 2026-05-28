# Passwordless Sign-In — Production Setup Checklist

Hosted-dashboard + env steps to do **before** turning the passwordless one-door on
in production. These cannot be verified by tests or code review — they live in the
Supabase dashboard and deploy env. See also the top-level `PRE_LAUNCH_CHECKLIST.md`.

> Local dev needs none of this: the local Magic Link template
> (`supabase/templates/magic_link.html`) already sends a typed code, and Mailpit
> (`http://localhost:54324`) captures it. The feature flag defaults ON in dev.

## Required before flipping the flag in production

- [ ] **OTP email template → code.** In Supabase Dashboard → Authentication → Email
  Templates → *Magic Link*, ensure the body uses `{{ .Token }}` (the 6-digit code),
  not `{{ .ConfirmationURL }}` (a link).
- [ ] **Custom SMTP.** Configure custom SMTP (Resend — already used for invites).
  The built-in mailer is capped at ~2 emails/hour project-wide and is unusable for
  real sign-in volume.
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
- [ ] **Flip the flag.** Set `VITE_PASSWORDLESS_SIGN_IN=true` in the production
  deploy env only after all the above are verified.

## Local testing (already works)

1. `pnpm run db:start` (restart with `db:stop && db:start` after config.toml edits)
2. `pnpm run dev`
3. Enter your email on `/login` → open `http://localhost:54324` → read the code →
   type it in → signed in.
