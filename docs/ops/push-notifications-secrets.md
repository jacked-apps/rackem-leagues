# Push Notifications — Secrets & Key Management

> **Scope:** the secrets the message push-notification pipeline needs, how to
> generate them, and where each one lives per environment. Part of the v1 Web
> Push feature — see `docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md`
> (Unit 2). **No real secret values belong in this file** — placeholders only.

## The four values

| Name | Secret? | Used by | Lives in |
|------|---------|---------|----------|
| `VITE_VAPID_PUBLIC_KEY` | **No** (public) | Client — passed as `applicationServerKey` when a device subscribes | Build env (local `.env` + each CI build env). Safe to expose. |
| `VAPID_PRIVATE_KEY` | **Yes** | Dispatcher Edge Function — signs the VAPID auth for each push | `supabase/functions/.env` (local) · Supabase secrets (staging/prod) |
| `VAPID_SUBJECT` | No (but set it) | Dispatcher — required `mailto:` contact per the VAPID spec | same as private key |
| `DISPATCH_SHARED_SECRET` | **Yes** | Auth between the DB trigger and the dispatcher (the trigger sends it as `X-Dispatch-Secret`; the function 401s on mismatch) | `supabase/functions/.env` + Supabase secrets, **and** the `push_dispatch_config` DB table (Unit 8) |

The `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are one keypair — the client needs
the public half, the server needs the private half. `DISPATCH_SHARED_SECRET` is a
separate random value that exists only to prove "this push request really came
from our own database trigger, not a random internet caller."

## Generate them

**VAPID keypair** (standard base64url VAPID keys):

```
npx web-push generate-vapid-keys --json
```

Outputs `{ "publicKey": "...", "privateKey": "..." }`. The `publicKey` is
`VITE_VAPID_PUBLIC_KEY`; the `privateKey` is `VAPID_PRIVATE_KEY`.

> **Unit 7 note:** the dispatcher uses `jsr:@negrel/webpush`. These are standard
> VAPID keys; the Unit 7 spike confirms the exact import call (convert to the
> library's expected form if needed — the key *material* is standard).

**Dispatch shared secret** (any long random string):

```
openssl rand -hex 32
```

**Subject:** a `mailto:` the push services can use to reach the sender, e.g.
`mailto:you@example.com`.

## Where each value goes, per environment

### Local development
- `.env` (gitignored): `VITE_VAPID_PUBLIC_KEY=...`
- `supabase/functions/.env` (gitignored): `VAPID_PRIVATE_KEY=...`, `VAPID_SUBJECT=...`, `DISPATCH_SHARED_SECRET=...`
- After editing `.env`, **restart the Vite dev server** — Vite only reads env at startup.

### Staging & Production
- **`VITE_VAPID_PUBLIC_KEY`** — set in each environment's **CI build env** (it is
  baked into the client bundle at build time). A missing build-time value makes
  the subscribe button fail silently with no server error, so treat it as required.
- **`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `DISPATCH_SHARED_SECRET`** —
  set as Supabase secrets, per environment. The dispatcher uses `npm:web-push`,
  which needs **both** VAPID keys (public + private), so the public key is set as a
  function secret here in addition to being a client build var:
  ```
  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com DISPATCH_SHARED_SECRET=... --project-ref <ref>
  ```
  (Locally these live in `supabase/functions/.env`.)
- **`DISPATCH_SHARED_SECRET` also goes in the DB** — Unit 8 seeds it (plus the
  dispatcher's function URL) into the `push_dispatch_config` table so the trigger
  can send it. Keep the value identical on both sides or the dispatcher 401s.

> **One keypair or per-env?** For the current single-league pre-launch phase, one
> keypair + one shared secret reused across environments is fine and simplest.
> Split per-env later if desired — no code change, just different secret values.

## Rotation runbook (VAPID keys)

Rotating the VAPID keypair **invalidates every existing push subscription** (they
are cryptographically bound to the public key they were created with). Only rotate
on compromise. To rotate:

1. Generate a new keypair; update `VITE_VAPID_PUBLIC_KEY` (build envs) and
   `VAPID_PRIVATE_KEY` (Supabase secrets) everywhere.
2. `TRUNCATE push_subscriptions;` — the old rows can no longer be pushed to.
3. `UPDATE members SET push_enabled = NULL;` — resets everyone to "never prompted"
   so the onboarding push prompt reappears and they re-subscribe with the new key.
4. Redeploy so the new public key is in the client bundle.

Rotating `DISPATCH_SHARED_SECRET` is cheaper: update it in the Supabase secret and
in `push_dispatch_config` (keep both sides equal); no subscription impact.

## Security notes

- **Never commit** `VAPID_PRIVATE_KEY` or `DISPATCH_SHARED_SECRET`. They live only
  in gitignored local files and secret stores. The public key may be committed if
  convenient, but we keep it in env for consistency.
- The trigger sends `DISPATCH_SHARED_SECRET` (a purpose-built value), **not** the
  Supabase service-role key — deliberately, so nothing sensitive lands in `pg_net`'s
  queryable request tables (see Unit 7/8).
- At launch, `push_subscriptions` needs member-scoped RLS (its rows are per-device
  push credentials) — tracked with the pre-launch RLS pass.
