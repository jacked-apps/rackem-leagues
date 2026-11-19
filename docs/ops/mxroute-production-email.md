# Production sign-in email through MXroute — setup runbook

**Claude: if Jack (or Ed) opened this file, walk them through the steps below
one at a time.** Wait for a "done" before moving to the next step. They do the
clicking (MXroute panel, the domain's DNS host, the Supabase dashboard). You run
the commands. **Never ask for the mailbox password in chat or in any file.** It
goes straight into the Supabase dashboard and a password manager, nowhere else.
**No app code needs to change.** Everything code-side is already on this branch.

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

## What's already done (checked 2026-11-19)

- `pnpm run check:email-dns` showed SPF ✅ (`include:mxlogin.com`), DMARC ✅
  (`p=none`), and MX ✅ (`heracles.mxrouting.net`). **DKIM ❌**: the key was
  entered as **4 separate TXT records** instead of one, which breaks the
  signature. Step 2 fixes it.
- Templates ready to paste: `supabase/templates/magic_link.html` (sign-in code)
  and `supabase/templates/confirmation.html` (new-user code + confirm link).

## Step 0 — Look before changing anything

Production Supabase project (ref `cibboozjixxyypzchtvr`) → **Authentication →
Emails → SMTP Settings**. Write down what's there now. If custom SMTP is already
on, note the sender and host before replacing them.

## Step 1 — A dedicated sending mailbox

In the MXroute panel, create `noreply@rackemleagues.com` with a strong password
and save the password in a password manager. It's kept separate because MXroute
caps sending at **400 emails per hour per address** and suspends an address
that goes over. That way a busy night can never lock up ed@, jack@ or support@.

## Step 2 — Fix the DKIM record

1. Wherever the domain's DNS is hosted, find the TXT records named
   `x._domainkey` (there are 4). **Delete all four.**
2. In the MXroute panel (Domains → rackemleagues.com → DKIM / DNS), copy the
   **whole** DKIM value (it starts `v=DKIM1;k=rsa;p=` and is ~400 characters).
3. Add **one** TXT record: name `x._domainkey`, value = the whole thing. If the
   DNS screen rejects values over 255 characters, look for its "long TXT"
   option, or wrap the value as several quoted strings in ONE record
   (`"first 250 chars" "rest"`). Never split it into separate records.
4. Claude: run `pnpm run check:email-dns` until all four lines say PASS. DNS
   can take up to an hour to update.

## Step 3 — Point production Supabase at MXroute

**Authentication → Emails → SMTP Settings → Enable custom SMTP:**

- Sender email: `noreply@rackemleagues.com`
- Sender name: `Rack'em Leagues`
- Host: `heracles.mxrouting.net` (the MX host the check prints)
- Port: `465`
- Username: `noreply@rackemleagues.com` (the full address)
- Password: the mailbox password
- Minimum interval between emails to the same user: `60` seconds

## Step 4 — Rate limit

**Authentication → Rate Limits → emails sent per hour:** set to about `100`.
That's plenty for sign-ins and stays well under MXroute's 400/hour.

## Step 5 — Email templates (production)

**Authentication → Emails → Templates.** Paste each **whole file**; the comment
at the top is invisible in email. First save the old body somewhere, in case you
need to roll back.

| Template | Subject | Body |
|---|---|---|
| **Magic Link** | `Your Rack'em sign-in code` | `supabase/templates/magic_link.html` |
| **Confirm signup** | `Welcome to Rack'em - confirm your email` | `supabase/templates/confirmation.html` |

Brand-new users get *Confirm signup* instead of *Magic Link*, so it carries both
the code (for the sign-in screen) and a confirm button (for the password Register
flow, which lands on `/confirm`). Also check **Authentication → URL Configuration
→ Site URL** is the live site's address, since the logo and button use it.

## Step 6 — Test, in this order

1. **Ed: "Forgot password" on the live site** with his own account. The email
   should arrive from `noreply@rackemleagues.com` and not land in spam. In Gmail,
   open **⋮ → Show original**: SPF, DKIM and DMARC should all say **PASS**.
2. **Code sign-in with an existing account:** a code arrives and signing in works.
3. **Code sign-in with a brand-new email address:** the welcome email arrives
   with a code, and typing it in signs you in.
4. **Register with a password using another new address:** the welcome email's
   button confirms the account.
5. **Something fails?** Supabase → **Logs → Auth** shows SMTP errors (wrong
   password, blocked port, rejected sender).

## Step 7 — Finish

- Tick the SMTP and template boxes in `docs/ops/passwordless-auth-setup.md` and
  in the passwordless section of `PRE_LAUNCH_CHECKLIST.md`.
- Update `docs/list/2026-04-21-staging-email.md`: production sign-in email is
  done; email invites are what's left.
- Commit on this branch, push, and tell Ed. He decides about the PR.
