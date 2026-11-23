# App email (invites) through MXroute — setup runbook, Part 2

Part 1 (`docs/ops/mxroute-production-email.md`) made **Supabase Auth** send
sign-in and password emails through MXroute. That's done and verified
(2026-11-23: a reset email from `noreply@rackemleagues.com` landed in Gmail's
inbox with SPF, DKIM and DMARC all PASS).

Part 2 is email **our own code** sends: team invites today, other app emails
later. It uses the **same mailbox** (`noreply@rackemleagues.com`), but our code
runs in Supabase **Edge Functions**, which don't see Auth's SMTP settings. They
need the settings again, as **function secrets**.

## What the code does (already built, branch `feat/passwordless-prod-email`)

- `supabase/functions/_shared/sendMail.ts` sends through MXroute over SMTP on
  **port 465**. Supabase blocks outgoing ports 25 and 587 from Edge Functions,
  but not 465 ([Supabase limits](https://supabase.com/docs/guides/functions/limits)).
  Step 3 proves it really works from Supabase's servers.
- `send-invite` (the team invite email) now uses it instead of Resend's sandbox,
  and only signed-in users can call it.
- `send-test-email` sends one test email. It's locked with a secret, so only
  someone who knows `EMAIL_TEST_SECRET` can use it. Without that lock, anyone
  could send mail from our domain, and MXroute suspends a mailbox that goes
  over 400 emails an hour.
- Invites stay **switched off in the app** (`EMAIL_INVITES_ENABLED`) until Step 3
  passes. Then Claude turns them on, staging first.

## Step 1 — Make a test secret

Make a random string of about 40 characters. A password manager's generator
works, or `openssl rand -hex 20` in a terminal. Save it in the password manager
as "Rack'em EMAIL_TEST_SECRET". It only unlocks the test email, but don't paste
it in chat or commit it.

## Step 2 — Add the function secrets (staging AND production)

Do this in **both** projects. Staging needs them too so Ed can try invites
there before they go live. Both use the same mailbox, and they share its
400-an-hour limit, which is far more than we'll send.

- Staging: project ref `eahlgydddmjebcfiskmz`
- Production: project ref `cibboozjixxyypzchtvr`

In the Supabase dashboard: **Edge Functions → Secrets** (sometimes under
Project Settings → Edge Functions). Add:

| Name | Value |
|---|---|
| `SMTP_HOST` | `heracles.mxrouting.net` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `noreply@rackemleagues.com` |
| `SMTP_PASS` | the noreply mailbox password (the same one in Auth's SMTP settings) |
| `EMAIL_TEST_SECRET` | the string from Step 1 |

Optional: `SMTP_FROM_NAME` if the sender should be something other than
"Rack'em Leagues".

If an old `RESEND_API_KEY` secret is there, you can delete it. Nothing uses it
any more.

## Step 3 — Deploy and send a test email

Functions deploy by themselves: **staging** when this branch merges to main,
**production** on the next release. You don't need to deploy by hand. To test
before that, run
`supabase functions deploy send-test-email send-invite --project-ref <ref>`.

Once it's deployed, send yourself a test (staging first, then production):

```
curl -X POST https://<ref>.supabase.co/functions/v1/send-test-email \
  -H "Content-Type: application/json" \
  -H "X-Email-Test-Secret: <EMAIL_TEST_SECRET>" \
  -d '{"to": "you@gmail.com"}'
```

What the answer means:

| Answer | Meaning | Fix |
|---|---|---|
| `{"sent":true}` | It worked. Check the inbox: from `noreply@rackemleagues.com`, not in spam. | — |
| `"error":"Not allowed"` | The secret didn't match. | Check the header value and the `EMAIL_TEST_SECRET` secret. |
| `"SMTP secrets not set ..."` | A secret is missing or misspelled. | Re-check Step 2 in that project. |
| `Invalid login` / `535` | Wrong mailbox password. | Re-enter `SMTP_PASS`. |
| `timeout` / `ETIMEDOUT` / `ECONNREFUSED` | Supabase isn't letting port 465 out. | Tell Ed and Claude: invites need another route, and the code isn't the problem. |

If an email arrives, Gmail **⋮ → Show original** should show SPF, DKIM and
DMARC all PASS, the same as Part 1.

## Step 4 — Tell Ed

Say which projects passed. Claude then turns invites on in the app: staging
first for Ed to try, then production when he says so.
