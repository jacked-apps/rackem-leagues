# ⚠️ PRE-LAUNCH CHECKLIST — DO BEFORE TURNING PRODUCTION ON

> **Status (2026-05-28):** Production Supabase is **PAUSED** (non-use); staging is
> active. While pre-launch, RLS is intentionally **disabled** and some auth settings
> are dev-tuned to keep coding smooth — so there is **no danger right now**. The
> point of this file is to make sure none of that ships to real users by accident.
>
> **This is the single source of truth for "must do before production go-live."**
> Add any new go-live blocker here the moment it surfaces, so nothing gets lost.

---

## 🚨 Hard blockers (must be done/verified before production is live)

- [ ] **RLS pass.** All Row-Level Security is currently **OFF** — turned off
  deliberately so coding goes smoother (no real users yet, avoids RLS rabbit holes).
  Before any real users: do a dedicated RLS pass scoped to what's been built —
  enable policies and test them. RLS-off must **not** reach production.
  - **Onboarding cascade (`feat/onboarding-cascade`):** the new `team_join_requests`
    table needs policies, and direct-table access to `teams.join_token` should be
    locked to the join flow. The cascade's authorization already lives in
    `SECURITY DEFINER` RPCs (they derive the actor from `auth.uid()`, resolve
    team/org server-side, and gate on captain-or-org-staff), so those are a
    ready-made **spec for the policies to write**: `get_team_join_view` (names-only
    public read), `request_team_join` (own JWT only), `approve_join_request` +
    `get_join_requests_for_approver` + `get_team_placeholders_for_claim` +
    `rotate_team_join_token` + `get_org_teams_for_onboarding` (captain-or-staff),
    `get_my_approved_join_requests` + `acknowledge_join_request` (own row only).
    Verify direct table reads/writes match what these RPCs enforce.
  - **Tournament Bracket tool (`feat/tournament-bracket-free-tier`):** the three
    tables (`brackets`, `bracket_participants`, `bracket_matches`) need policies.
    Concrete spec for what to enforce:
    - **Writes** must require `created_by = the calling member` — not merely
      "authenticated". Today, with RLS off, ANY logged-in user can advance/close
      ANY bracket. The write RPCs (`start_bracket`, `advance_bracket_winner`,
      `sweep_stale_brackets`) are already `SECURITY DEFINER` + `authenticated`-only
      (anon revoked), but they do NOT yet check ownership — add that check (in the
      RPC or via RLS) so only the organizer mutates their bracket. (`sweep_stale_brackets`
      is a global janitor by design — decide whether to keep it global or scope it.)
    - **Public read** stays a names-only projection: `get_bracket_share` is
      `SECURITY DEFINER` granted to `anon`, returns display names + structure only
      (no `created_by`, no `member_id`). Keep direct table SELECT locked so the
      RPC remains the only anon read path.
    - `share_token` has no independent TTL — a failed close/sweep leaves a bracket
      readable at its URL until the next sweep. Acceptable for disposable v1;
      revisit if brackets ever carry PII (paid tier).

- [ ] **Auth: email confirmations ON.** Verify the **production** Supabase project
  has *Authentication → Providers → Email → "Confirm email"* **enabled**. This is
  the anti-duplicate / anti-account-takeover protection: Supabase only auto-links
  same-email accounts (Google / Facebook / email-OTP for one person) when the email
  is confirmed. Local `config.toml` has `enable_confirmations = false` **for dev
  only** — that must not be the production posture. (Likely already on, since the app
  has a built email-confirmation + resend-verification flow — but verify it.)

---

## 🔐 Passwordless sign-in go-live (when that feature ships)

See `docs/plans/2026-05-28-001-feat-passwordless-sign-in-plan.md`. The plan gates the
new one-door behind a **feature flag / env guard**; do NOT flip it on until:

- [ ] **Custom SMTP** configured (Resend) — the default Supabase mailer is only
  2 emails/hour, unusable for real sign-in volume.
- [ ] **OTP email template** set to send a **code** (`{{ .Token }}`), not a magic link.
- [ ] **Redirect allow-list** — exact URLs added (production `site_url` + the OAuth
  landing route), one entry per environment.
- [ ] **Abuse control** — bot-check (Turnstile/hCaptcha) + per-email/IP send limits
  enabled on the public email box.
- [ ] **Facebook** — App Review cleared before exposing the button to non-tester
  users (Google + email cover everyone meanwhile).
- [ ] **Flip the feature flag ON** only after all of the above are verified.

---

## How to use this file

- Treat the **Hard blockers** as gates: production does not go live until every box
  is checked.
- When a new "can't ship without this" item appears, add it here immediately rather
  than trusting memory.
- Claude also keeps these in persistent memory and will proactively raise them
  whenever you mention going live / launching / un-pausing production.
