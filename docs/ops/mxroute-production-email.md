# Production sign-in email through MXroute — setup runbook

**Claude: if Jack (or Ed) opened this file, walk them through the steps below
one at a time.** Wait for a "done" before moving to the next step. They do the
clicking (MXroute panel, the domain's DNS host, the Supabase dashboard). You can
run the DNS lookups in Step 2 yourself. **Never ask for the mailbox password in
chat or in any file.** It goes straight into the Supabase dashboard and a
password manager, nowhere else.

## Why this exists

- Passwordless sign-in (type your email, get a 6-digit code) has been **live in
  production since June 2026** (PR #174 set `VITE_PASSWORDLESS_SIGN_IN` in
  `.github/workflows/deploy-production.yml`).
- Supabase Auth sends those codes itself. Without a custom mail server, it uses
  its built-in mailer, which only reaches members of the Supabase team and sends
  a few emails an hour. Real players then get no code and have to use Google or
  "Prefer a password?" instead.
- **Decision (2026-11-19):** send through **MXroute**, which we already pay for.
  **Production only.** Staging stays on the built-in mailer (it's a sandbox; Ed
  and Jack just need to be members of the Supabase team so it can reach them).
- Email invites (`supabase/functions/send-invite`) are a separate, later job.
  They're not part of this runbook.

## Step 0 — Look before changing anything

Production Supabase project (ref `cibboozjixxyypzchtvr`) → **Authentication →
Emails → SMTP Settings**. Write down what's there now. If custom SMTP is already
on, note the sender and host. You may only need Steps 5–6.

## Step 1 — A dedicated sending mailbox

In the MXroute panel, create `noreply@rackemleagues.com` with a strong password
and save the password in a password manager. It's kept separate because MXroute
caps sending at **400 emails per hour per address** and suspends an address
that goes over. That way a busy night can never lock up ed@, jack@ or support@.

Note the **SMTP server hostname** the MXroute panel shows for the account (it
looks like `something.mxrouting.net`).

## Step 2 — DNS records on rackemleagues.com (Claude can check these)

Run the three lookups and check each result:

| Record | Lookup | Should contain |
|---|---|---|
| SPF | `nslookup -type=TXT rackemleagues.com` | exactly **one** `v=spf1 …` record that includes `include:mxroute.com` |
| DKIM | `nslookup -type=TXT x._domainkey.rackemleagues.com` | a `v=DKIM1; k=rsa; p=…` key (copy the exact record from the MXroute panel; confirm the selector there too) |
| DMARC | `nslookup -type=TXT _dmarc.rackemleagues.com` | `v=DMARC1; p=none; …` (start with `p=none`; tighten later) |

If one is missing, add it wherever the domain's DNS is hosted. DNS changes can
take up to an hour to show. Without all three, Gmail tends to spam or reject the
codes.

## Step 3 — Point production Supabase at MXroute

**Authentication → Emails → SMTP Settings → Enable custom SMTP:**

- Sender email: `noreply@rackemleagues.com`
- Sender name: `Rack'em Leagues`
- Host: the MXroute hostname from Step 1
- Port: `465`
- Username: `noreply@rackemleagues.com` (the full address)
- Password: the mailbox password
- Minimum interval between emails to the same user: `60` seconds

## Step 4 — Rate limit

**Authentication → Rate Limits → emails sent per hour:** set to about `100`.
That's plenty for sign-ins and stays well under MXroute's 400/hour.

## Step 5 — Email templates (production)

**Authentication → Emails → Templates.**

1. **Magic Link** (this is the sign-in code email):
   - Subject: `Your Rack'em sign-in code`
   - Body: paste the contents of `supabase/templates/magic_link.html` (from
     `<table` to the end; leave out the top comment). It must show
     `{{ .Token }}`, the code, and not a link.
   - The logo loads from `{{ .SiteURL }}/logo-main.png`. Check **Authentication →
     URL Configuration → Site URL** is the live site's address.
2. **Confirm signup**: leave it alone for now. Step 6.3 tells us whether it
   needs a change.

## Step 6 — Test, in this order

1. **Ed: "Forgot password" on the live site** with his own account. The email
   should arrive from `noreply@rackemleagues.com` and not land in spam. In Gmail,
   open **⋮ → Show original**: SPF, DKIM and DMARC should all say **PASS**.
2. **Code sign-in with an existing account:** a code arrives and signing in works.
3. **Code sign-in with a brand-new email address.**
   - Code arrives → done.
   - Instead you get a "Confirm your signup" email with a **link and no code** →
     that's because "Confirm email" is on, so Supabase sends brand-new users the
     *Confirm signup* template instead. Fix: **add** the code box from
     `magic_link.html` (the `{{ .Token }}` block) into the Confirm signup
     template, **keeping its existing link.** The password Register flow still
     uses that link (`/confirm`, `src/login/EmailConfirmation.tsx`). Then re-test.
4. **Something fails?** Supabase → **Logs → Auth** shows SMTP errors (wrong
   password, blocked port, rejected sender).

## Step 7 — Finish

- Tick the SMTP and template boxes in `docs/ops/passwordless-auth-setup.md` and
  in the passwordless section of `PRE_LAUNCH_CHECKLIST.md`.
- Update `docs/list/2026-04-21-staging-email.md`: production sign-in email is
  done; email invites are what's left.
- Commit on this branch, push, and tell Ed. He decides about the PR.
