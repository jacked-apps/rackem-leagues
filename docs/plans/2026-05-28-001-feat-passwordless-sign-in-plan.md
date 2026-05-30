---
title: "feat: Passwordless one-door sign-in (email OTP code + Google/Facebook)"
type: feat
status: active
date: 2026-05-28
origin: docs/brainstorms/2026-05-28-passwordless-sign-in-requirements.md
---

# feat: Passwordless one-door sign-in (email OTP code + Google/Facebook)

## Overview

Replace the separate login/register screens with **one screen**: a person enters
their email, receives a **6-digit code**, types it **on the same page** (no magic
link, no leaving the app), and is signed in — account auto-created if new, found
if returning. Above the email box sit one-tap **Google** (already wired) and
**Facebook** (new) buttons. Delivery is **email only**. The existing email +
password login/register and forgot-password flows are **kept but demoted** behind
a "prefer a password?" link — nothing is removed.

This is the "build first" companion to the player-onboarding cold-start work
(its requirements doc lives on the sibling branch
`docs/player-onboarding-cold-start-brainstorm`). Because the code is typed
in-page, this **removes the auth-confirmation email hop**. The onboarding join
intent still threads through sign-in via the `?redirect` param (repaired in
Unit 4) — so **Unit 4, not the OTP change itself, is the load-bearing mechanism
for join-intent survival**. The net effect is that no fragile cross-device token
is needed.

## Problem Frame

Account creation is the #1 onboarding barrier for a non-technical user base
(operators, captains, players). Today's path — email + password → confirmation
email → click link → profile form — stalls people at every step, and the
email-link hop is what forces the onboarding cascade to carry a fragile
cross-device token. Deleting passwords from the happy path and replacing the
link-bounce with an in-page typed code removes the stumble and the fragility at
once. (See origin: `docs/brainstorms/2026-05-28-passwordless-sign-in-requirements.md`.)

## Requirements Trace

- R1. One sign-in screen replaces separate login/register on the default path;
  no "sign up vs log in" choice (create-or-find behind the scenes).
- R2. Universal path = typed one-time **code by email**, verified on the same
  screen; the user never leaves the app.
- R3. Google (existing) + Facebook (new) one-tap shortcuts above the email box;
  provider set capped at these two.
- R4. The email path is clearly labeled as the passwordless / no-password way in.
- R5. New-vs-returning auto-detected; identical UX either way.
- R6. Existing email + password login/registration preserved, demoted behind a
  "prefer a password?" link.
- R7. Forgot-password/reset remains for password users; passwordless users have
  nothing to reset (request another code).
- R8. Tapping a team join link → sign in → land back on the **join in progress**,
  not a generic home page (repair the dead `?redirect` thread across all auth
  paths). The redirect value is constrained to **same-origin relative paths**
  (open-redirect guard), and the intent must also survive the
  profileless→`/complete-profile` detour that a brand-new user hits (see Unit 4).
- R11. The public email box must be protected against code-spam / shell-account
  abuse (bot check + send throttle), without adding meaningful friction for a
  non-tech user.
- R9. New-player name/profile collection is **out of scope** (owned by the
  onboarding doc's progressive-profile work); this plan ends at "signed in."
- R10. Email is the only delivery channel; SMS is a standing exclusion.

## Scope Boundaries

- **No SMS / text codes** — standing exclusion (cost), not a deferral.
- **Do not remove the password system** — it is kept and demoted (R6/R7).
- **No new-user profile/name collection** — `ProtectedRoute` already routes a
  profileless authed user to `/complete-profile`; that seam is where onboarding's
  progressive profile plugs in. Do not duplicate it here.
- **The onboarding cascade itself** (join links, claim/approve, wizards) — its own
  plan; this one only guarantees sign-in threads the intent.
- **RLS / authorization hardening** — out of scope; separate pre-launch pass.

### Deferred to Separate Tasks

- **Facebook public availability** depends on Facebook's App Review (business
  verification, multi-day). Build + wire it here; going live for non-tester users
  happens when review clears (tracked in Unit 5).
- **Production email infrastructure** (custom SMTP + email-confirmations posture)
  is partly hosted-dashboard config; captured as Unit 1 with explicit ops steps.

## Context & Research

### Relevant Code and Patterns

- `src/login/Login.tsx` — current email+password + Google OAuth page; **plain
  `useState`** (no react-hook-form), single `message` string for errors, hardcoded
  `navigate('/my-teams')`. This is the file the one-door screen replaces.
- `src/login/EmailConfirmation.tsx` — closest precedent: calls
  `verifyOtp({ token_hash, type: 'signup' })` then `setUser`/`setIsLoggedIn` before
  navigating. New flow uses `verifyOtp({ email, token, type: 'email' })` instead
  (typed code, not link hash; `'signup'` is legacy).
- `src/login/Register.tsx` — claim-param reading (`?claim`) + step-as-early-return
  sub-view pattern to mirror for the email→code→done steps.
- `src/login/LoginCard.tsx` — shared auth card shell; reuse for every sub-view.
- `src/components/ui/button.tsx` — project Button with `isLoading`/`loadingText`
  (required on `default`/`destructive`) and `message` (red text below). Use it;
  don't hand-roll spinners.
- `src/login/ClaimPlayer.tsx` (~lines 395–412) — the **only writer** of
  `?redirect`; sends unauthenticated users to `/login?redirect=<returnUrl>`. The
  repair target for R8.
- `src/components/ProtectedRoute.tsx` — redirects unauth users to a **bare**
  `/login` (drops intended location); chains auth → role → profile-completion.
- `src/context/UserProvider.tsx` / `src/context/useUser.ts` — central session via
  `getSession()` + `onAuthStateChange`; any auth success auto-updates it. Exposes
  `setUser`/`setIsLoggedIn` for the belt-and-suspenders pattern.
- `src/navigation/NavRoutes.tsx` — `createBrowserRouter` data router; public auth
  routes (`login`, `register`, `claim-player`, `forgot-password`, `reset-password`,
  `confirm`) are bare/unwrapped.
- `src/api/mutations/members.ts` + `src/api/hooks/useMemberMutations.ts` — the
  layered `src/api` convention (note: **auth calls are currently inline** in pages,
  not layered).
- `supabase/config.toml` — already has `[auth.email] otp_length = 6`,
  `otp_expiry = 3600`, `enable_confirmations = false` (local), Inbucket/Mailpit on
  `54324`, Facebook listed (disabled) in the external-provider block.

### Institutional Learnings

- `memory-bank/PLAN-email-invites.md` — the register/claim/invite/merge flow is
  already built. **Security invariant to preserve:** claim verifies
  `userEmail === inviteEmail` (403 on mismatch) to defeat stolen links. OTP makes
  the authenticated email attacker-controllable, so this check stays load-bearing —
  do **not** weaken it. Two entry routes (`/register?claim=…` new,
  `/claim-player?claim=…&token=…` existing) must keep working.
- Project memory `feedback_new_edge_functions_need_supabase_restart` — adding the
  Facebook provider to `config.toml` is a start-time change; needs a full
  `pnpm run db:stop && pnpm run db:start` to take effect locally.
- No `docs/solutions/` directory exists; learnings live in `memory-bank/` + project
  memory. **No tests exist for any auth component** — this plan establishes the
  `supabase.auth` mock pattern.

### External References

- Supabase passwordless email login — code vs link is decided by the email
  template (`{{ .Token }}` = code, `{{ .ConfirmationURL }}` = link); same
  `signInWithOtp({ email })` call. Verify with `verifyOtp({ email, token, type: 'email' })`.
  https://supabase.com/docs/guides/auth/auth-email-passwordless
- `signInWithOtp` `shouldCreateUser` defaults **true** → create-or-find "one door"
  is automatic. (auth-js 2.71.1 types, verified locally.)
- Identity linking — Supabase **auto-links same-email identities into one user,
  only for confirmed emails**. https://supabase.com/docs/guides/auth/auth-identity-linking
- Rate limits — default built-in mailer is **2 emails/hour project-wide** (must use
  custom SMTP for prod); resend cooldown 60s; OTP 6 digits / 1h expiry.
  https://supabase.com/docs/guides/auth/rate-limits
- Facebook social login setup + **App Review** requirement for the `email`
  permission; email not guaranteed for phone-only FB accounts.
  https://supabase.com/docs/guides/auth/social-login/auth-facebook

## Key Technical Decisions

- **Typed code, `type: 'email'`** — send via `signInWithOtp({ email })`, verify via
  `verifyOtp({ email, token, type: 'email' })`. Do not copy `EmailConfirmation.tsx`'s
  legacy `type: 'signup'` / `token_hash` shape.
- **Lean on `shouldCreateUser` default (true)** for one-door create-or-find; the UI
  never branches on new-vs-returning.
- **Code-vs-link is template config**, set the Magic Link template to `{{ .Token }}`
  (Unit 1) — no JS toggles for it.
- **Thin, testable auth helpers** (`requestEmailCode` / `verifyEmailCode`) extracted
  into one module rather than fully inline. Minor deviation from the inline-auth
  convention, justified by testability (no auth tests exist yet) and reuse by both
  the one-door screen and any future in-context sign-in. Helpers still call the
  `supabase` singleton directly, matching the `src/api/mutations` style.
- **Redirect threading is net-new, not a copy** — `?redirect` must survive the
  in-page OTP path (React state/query param), the password path, and the OAuth
  full-page round-trip (encoded into `redirectTo`). `ProtectedRoute` will also be
  taught to *write* the intended location into `?redirect` when bouncing to login.
- **Auto-link safety requires confirmed emails** — production must have email
  confirmations enabled and custom SMTP configured, or Google/Facebook/email-OTP on
  the same address risk duplicate/unlinked users. Treated as a required config unit
  + a tracked risk.
- **Facebook is a can-lag unit** — built and wired now, public-live after FB App
  Review; handle the missing-email edge (phone-only accounts) without crashing.
- **Reuse session + guard layers** — `onAuthStateChange` auto-updates `UserProvider`,
  and the client's `detectSessionInUrl` default already establishes the session
  from the OAuth hash, so the OAuth landing only needs to **read `returnTo`**, not
  re-establish auth. Update context (`setUser`/`setIsLoggedIn`) on success as
  belt-and-suspenders (mirroring `EmailConfirmation.tsx`), but treat
  `onAuthStateChange` as the primary sync. Don't duplicate the
  profileless→`/complete-profile` logic.
- **Abuse control on the public email box (R11)** — because `shouldCreateUser` is
  true on an unauthenticated screen, anyone can request codes for arbitrary
  addresses (email-bombing, shell-account creation, sender-domain reputation
  damage), and raising the mail cap via custom SMTP removes the only default
  throttle. Add a low-friction bot check (e.g. Cloudflare Turnstile / hCaptcha,
  both supported by Supabase Auth) plus a sane per-email / per-IP send limit. Keep
  it as close to invisible as possible to honor the "dead simple" goal.
- **Enforceable launch gate, not just a checklist** — the safety properties below
  depend on hosted-dashboard settings no test can verify. Gate the new one-door
  behind a **feature flag / env guard** so the code cannot go live before the
  production config (email confirmations ON + custom SMTP) is in place.
- **Enabling email confirmations changes the kept password path** — turning
  confirmations on in prod (required for safe auto-linking) means the demoted
  password `signUp` no longer returns an immediately usable session, and
  `Register.tsx`'s synchronous placeholder-link after `signUp` would run against an
  unconfirmed user. So "password behavior unchanged" holds only in dev;
  Unit 6 must verify the password-register + claim-link path under confirmations-ON.
- **Carry the redirect intent as router `location.state` where possible** — the
  claim `?redirect` currently puts the invite token in the URL (history, logs,
  referrers). Prefer React Router `location.state` for the in-page intent carry to
  keep the token out of the URL; the OAuth round-trip still needs it in `redirectTo`.

## Open Questions

### Resolved During Planning

- *Code or link?* Code — set the email template to `{{ .Token }}`.
- *How does one-door tell new from returning?* It doesn't; `shouldCreateUser`
  default handles it server-side.
- *Same email via Google and email-OTP — duplicate?* No, auto-linked **if email
  confirmed** → drives the Unit 1 production-config requirement.
- *Where does redirect intent live for the typed-code path?* On the page (React
  state / query param); nothing needs to survive an email hop because there is none.
- *Layered vs inline auth calls?* Thin extracted helpers (see Key Decisions).
- *One route or two?* `/login` becomes the one-door; `/register`/`/forgot-password`/
  `/reset-password` routes remain for the demoted password path, reached via the
  "prefer a password?" link.

### Deferred to Implementation

- Exact resend cooldown / rate-limit values surface from `supabase/config.toml`
  (`max_frequency`, `[auth.rate_limit]`) and the hosted dashboard — tune at build,
  not new app code.
- Final structure of the OAuth `returnTo` carry (a dedicated callback landing route
  vs. reading `redirectTo` on `/my-teams`) — decide when wiring Unit 4 against real
  redirect behavior.
- (Resolved → Unit 3) The password sub-view is an **in-place toggle** on `/login`
  that preserves the typed email — not a navigation away. The `/register`,
  `/forgot-password`, `/reset-password` routes remain for the deeper password flows.
- Microcopy for the "or passwordless" label — validate plainness with a non-tech
  reader during build (origin R4).

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review,
> not implementation specification. The implementing agent should treat it as
> context, not code to reproduce.*

```
One-door screen (/login)  — step state: 'choose' | 'code'
┌──────────────────────────────────────────────────────────┐
│ choose:                                                    │
│   [Continue with Google]  → signInWithOAuth(google,        │
│   [Continue with Facebook]   {redirectTo: origin+/auth     │
│                               -callback?returnTo=<r>})     │
│   — or passwordless —                                      │
│   email → [Continue] → requestEmailCode(email) ──┐         │
│   "prefer a password?" → password sub-view ──────┼──► classic
│                                                  │   signInWithPassword
│ code:                                            ▼         │
│   "we emailed a code"  [_ _ _ _ _ _] [Verify]              │
│      → verifyEmailCode(email, token)                       │
│      → setUser/setIsLoggedIn → navigate(returnTo ?? /my-teams)
└──────────────────────────────────────────────────────────┘

returnTo source:  ?redirect (written by ClaimPlayer AND by ProtectedRoute)
                  in-page paths read it from useSearchParams
                  OAuth path encodes it in redirectTo, read on landing
```

## Implementation Units

- [ ] **Unit 1: Auth config — OTP-as-code template, prod email + linking posture**

**Goal:** Make `signInWithOtp` deliver a 6-digit code (not a link) and make the
multi-provider same-email convergence safe in production.

**Requirements:** R2, R5 (and the linking safety behind R1/R3).

**Dependencies:** None (do first — unblocks local OTP testing).

**Files:**
- Modify: `supabase/config.toml` (confirm `otp_length`/`otp_expiry`; set resend
  `max_frequency` toward the 60s the UI assumes; note `[auth.rate_limit]`; add a
  local Magic Link template override).
- Create: `supabase/templates/magic_link.html` (local code template containing
  `{{ .Token }}` so Mailpit shows a typed code, not a link).
- Create: `docs/ops/passwordless-auth-setup.md` (create the `docs/ops/` dir;
  hosted-dashboard checklist — see Approach).
- Add: a feature flag / env guard fronting the new one-door (see Approach).

**Approach:**
- Local code template (concrete mechanism — `config.toml` currently has no email
  template block and no `supabase/templates/`): add a
  `[auth.email.template.magic_link]` block with a `content_path` to
  `supabase/templates/magic_link.html` containing `{{ .Token }}`, so the local
  typed-code flow is reproducible in Mailpit (`localhost:54324`). Run
  `db:stop && db:start` after `config.toml` changes.
- Production (hosted, documented in the ops doc): set the Magic Link template to
  `{{ .Token }}`; configure **custom SMTP** via Resend (default mailer is 2/hr,
  unusable); **enable email confirmations** (required for safe auto-linking); list
  the **exact redirect allow-list URLs** (production `site_url`, the OAuth
  landing / `/auth-callback` route from Unit 4 — every environment needs its own
  entry); set OTP `max_frequency` + `email_sent` / `sign_in_sign_ups` rate limits
  for prod volume; register the OAuth callback in the Google and Facebook developer
  consoles.
- **Launch gate (enforceable):** front the one-door with a feature flag / env guard
  so it cannot serve real users until the above is done — a markdown checklist is
  not an enforceable gate.
- **Abuse control (R11):** enable Supabase's `[auth.captcha]` (Cloudflare
  Turnstile / hCaptcha) so the public email box is bot-checked, and set the
  per-email / per-IP send limits in `[auth.rate_limit]`. The captcha widget itself
  renders on the Unit 3 screen; keep it as invisible as the provider allows.

**Execution note:** Mostly config + ops; the feature-flag guard is the only code.

**Test scenarios:**
- `Test expectation: none for the config / template / ops parts.` Manual: a local
  `signInWithOtp` produces a 6-digit code in Mailpit, and `verifyOtp({type:'email'})`
  with it signs in.
- Happy path (flag, if implemented in code): gate OFF → old login serves; gate ON →
  one-door serves.

**Verification:**
- Locally, requesting a code shows a numeric code (not a link) in Mailpit, and
  typing it signs in. The ops checklist enumerates every hosted step (template,
  custom SMTP, email-confirmations-ON, exact redirect URLs, rate limits, console
  registration). The one-door is flag-gated until production config is verified.

- [ ] **Unit 2: Passwordless auth helpers (`requestEmailCode` / `verifyEmailCode`)**

**Goal:** A small, tested module wrapping the send + verify OTP calls.

**Requirements:** R2, R5.

**Dependencies:** Unit 1 (for end-to-end local verification; code can be written in
parallel).

**Files:**
- Create: `src/login/passwordlessAuth.ts`
- Test: `src/login/passwordlessAuth.test.ts`

**Approach:**
- `requestEmailCode(email)` → `supabase.auth.signInWithOtp({ email })` (rely on
  `shouldCreateUser` default true); surface errors as thrown `Error` (matches
  `src/api/mutations` convention).
- `verifyEmailCode(email, token)` → `supabase.auth.verifyOtp({ email, token, type: 'email' })`;
  return the session/user or throw.
- Keep redirect concerns OUT of these helpers (the screen owns navigation).

**Execution note:** Implement test-first — establishes the `supabase.auth` mock the
repo lacks.

**Patterns to follow:** `src/api/mutations/members.ts` (validate → call supabase →
throw on error); mock shape from `src/__tests__/integration/SeasonCreationWizard.smoke.test.tsx`,
extended with an `auth: { signInWithOtp, verifyOtp }` fake.

**Test scenarios:**
- Happy path: `requestEmailCode('a@b.com')` calls `signInWithOtp` with that email.
- Happy path: `verifyEmailCode('a@b.com','123456')` calls `verifyOtp` with
  `{ email, token, type: 'email' }` (assert the `type` is `'email'`, NOT `'signup'`).
- Error path: supabase returns an error → helper throws with a usable message.
- Edge: empty/blank email or code is rejected before calling supabase.

**Verification:** Tests pass; the verify call uses `type: 'email'`.

- [ ] **Unit 3: One-door sign-in screen**

**Goal:** Rebuild `/login` as the single create-or-find screen: social buttons +
labeled email→code flow + "prefer a password?" entry.

**Requirements:** R1, R2, R3 (Google), R4, R5, R6 (entry link).

**Dependencies:** Unit 2.

**Files:**
- Modify: `src/login/Login.tsx`
- Create (extract once `Login.tsx` exceeds the project's ~100-line file norm):
  `src/login/EmailCodeStep.tsx`
- Test: `src/login/Login.test.tsx`

**Approach:**
- Step enum `'choose' | 'code'` rendered as early-return sub-views inside one
  `LoginCard` (mirrors `Register.tsx`/`ClaimPlayer.tsx`).
- `choose`: Google (kept) + Facebook (Unit 5) buttons, an "or passwordless"
  divider, the email input + Continue, and a small **"prefer a password?"** link
  that reveals the classic email+password form **in place, preserving the email
  already typed** (additive, R6). Tapping a social button **disables all three
  entry paths** and shows `isLoading` on the tapped button until redirect or error.
- `code`: a single numeric code input (`inputmode="numeric"`,
  `autocomplete="one-time-code"`, explicit label "Enter the 6-digit code we sent to
  <email>", accepts paste and leading zeros) + Verify + a **Resend** control that
  disables with a visible countdown for the cooldown, then re-enables. Calls
  `verifyEmailCode`; on success update context, then navigate (target from Unit 4).
- A **"wrong email? go back"** affordance returns to `choose`. **Distinguish
  expired-code from wrong-code:** expired → message offers Resend directly; wrong →
  "that code didn't match, try again." Never surface the raw Supabase error string.
- **Already-signed-in guard:** if a signed-in user lands on `/login`, redirect to
  the `?redirect` target (or `/my-teams`) instead of starting a new OTP flow.
- Use `Button` `isLoading`/`loadingText`/`message`; single `message` string per
  existing convention.

**Patterns to follow:** `src/login/Login.tsx` (current structure, Google button
markup), `src/login/Register.tsx` (sub-view returns), `src/login/LoginCard.tsx`,
`src/login/EmailConfirmation.tsx` (context update on success; `onAuthStateChange` is
the primary sync), `src/test/utils.tsx`
`renderWithProviders({ userContext: { isLoggedIn:false, user:null }})`.

**Test scenarios:**
- Happy path: signed-out render shows Google, Facebook, the email box, "or
  passwordless", and "prefer a password?"; email + Continue calls `requestEmailCode`
  and advances to `code`.
- Happy path: a valid code calls `verifyEmailCode` and triggers navigation; the code
  input carries `inputmode="numeric"` + `autocomplete="one-time-code"`.
- Edge: invalid email blocks submit; empty/short code blocks verify; a pasted code
  with leading zeros is accepted.
- Error path: an **expired** code shows a resend-offering message; a **wrong** code
  shows a retry message; neither navigates; neither leaks the raw error.
- Happy path: Resend disables with a countdown then re-enables; "wrong email? go
  back" returns to `choose`.
- Happy path: tapping Google/Facebook disables all entry paths and shows loading on
  that button.
- Happy path: an already-signed-in visit to `/login` redirects out instead of
  showing the form.
- Happy path: "prefer a password?" reveals the password form in place with the email
  preserved, and `signInWithPassword` still works.
- Integration: a successful verify updates `UserProvider` so the app sees the user
  as logged in.

**Verification:** A signed-out user completes email→code→signed-in on one screen
with a numeric keyboard, a working resend countdown, clear expired/wrong-code
recovery, and a back path; Google works; the password form is reachable in place
with the email preserved.

- [ ] **Unit 4: Redirect-after-auth threading (R8 repair)**

**Goal:** Make every auth path land the user back on their intended destination,
fixing the dead `?redirect` param.

**Requirements:** R8.

**Dependencies:** Unit 3.

**Files:**
- Modify: `src/login/Login.tsx` (read the intent from `location.state` or
  `?redirect`; navigate to it on success across OTP + password paths; encode it
  into OAuth `redirectTo`).
- Modify: `src/components/ProtectedRoute.tsx` (add `useLocation()` and bounce to
  `/login?redirect=${encodeURIComponent(location.pathname + location.search)}` — it
  currently imports no location hook, so this is real new wiring, not a one-liner).
- Modify: the `/complete-profile` flow (preserve + forward the intent so a brand-new
  user bounced there still lands on the join afterward).
- Modify/Create: OAuth return handling — read `returnTo` on the landing route
  (`/auth-callback` or `/my-teams`); the session is already established by the
  client's `detectSessionInUrl` default, so only the param needs reading. Add the
  chosen landing URL to the redirect allow-list (Unit 1).
- Test: `src/login/Login.redirect.test.tsx`

**Approach:**
- In-page paths (OTP, password): read the intent from `location.state` when present
  (preferred — keeps the invite token out of the URL/logs) else `?redirect`; then
  `navigate(target ?? '/my-teams')`.
- **Open-redirect guard (explicit rule):** honor the target only if it is a
  same-origin **relative path** — starts with a single `/`, contains no `://`, and
  does not begin with `//` (checked after one `decodeURIComponent`). Otherwise fall
  back to `/my-teams`.
- OAuth: append the target to `redirectTo` (the only thing surviving the provider
  round-trip) and consume it on landing.
- `ProtectedRoute`: bounce to `/login?redirect=<attempted location>` via
  `useLocation()` instead of a bare `/login`.
- **New-user detour (the headline case):** a brand-new OTP user with no `members`
  row is bounced by `ProtectedRoute` to `/complete-profile`; the intent must carry
  THROUGH that step so first-timers — not just returning users — land on the join.
  Coordinate with onboarding's progressive-profile work, which owns that screen.

**Execution note:** Characterization-first — pin the current "redirect is dropped"
behavior with a failing test, then fix.

**Patterns to follow:** `src/login/ClaimPlayer.tsx` (the existing `?redirect`
writer), `useSearchParams` usage in `Register.tsx`.

**Test scenarios:**
- Happy path: visiting `/login?redirect=/claim-player?...` (or intent in
  `location.state`) and completing OTP navigates to that claim target, not
  `/my-teams`.
- Happy path: no intent → defaults to `/my-teams`.
- Integration: an unauthenticated visit to a protected route lands on
  `/login?redirect=<that route>` and returns there after sign-in.
- Integration: a brand-new user (no member row) tapping a join link signs in,
  passes through `/complete-profile`, and still lands on the join target.
- Error path (open-redirect): `//evil.com`, `https://evil.com`, `%2F%2Fevil.com`,
  and a double-encoded variant are all rejected → fall back to `/my-teams`.
- Happy path (password): the password sub-view also honors the intent.

**Verification:** Tapping a team join link while signed out — as a returning OR a
brand-new user — lands back on the join; no path hardcodes `/my-teams` when an
intent is present; external redirect targets are refused.

- [ ] **Unit 5: Facebook OAuth button (can lag on App Review)**

**Goal:** Add a "Continue with Facebook" one-tap path alongside Google.

**Requirements:** R3 (Facebook).

**Dependencies:** Unit 3 (button placement), Unit 4 (OAuth redirect handling).

**Files:**
- Modify: `src/login/Login.tsx` (Facebook button + `signInWithOAuth({ provider: 'facebook' })`).
- Modify: `supabase/config.toml` — **create** a new `[auth.external.facebook]` block
  (enabled, `client_id`, `secret = env(...)`). Today the file has only
  `[auth.external.apple]`; Facebook is merely named in a comment, so this is a
  create, not an enable. Needs `db:stop && db:start`.
- Modify: `docs/ops/passwordless-auth-setup.md` (Facebook developer-app, **App
  Review** for the `email` permission, redirect-URI + callback registration).

**Approach:**
- Copy the Google button shape (inline SVG + `signInWithOAuth`); set `redirectTo`
  per Unit 4.
- **Missing-email edge (resolve the anchor, don't just avoid a crash):** a phone-only
  Facebook account may return no email. Route such a user to profile completion and
  **collect an email there** — without one they can never satisfy the claim flow's
  `userEmail === inviteEmail` check and would be locked out of claiming an invite,
  and email-keyed auto-linking can't work for them.
- **Hide, don't disable, before review:** until Facebook App Review clears, only
  app-role/tester accounts can sign in. Show the button only to testers (or behind
  the launch flag) so end users don't tap it and hit an error.
- **Local testing reality:** Facebook OAuth cannot redirect to a bare
  `http://localhost` / `127.0.0.1` origin — test against a deployed/preview URL or an
  HTTPS tunnel (e.g. ngrok), and add that origin to the allow-list.

**Patterns to follow:** the Google OAuth block in `src/login/Login.tsx`.

**Test scenarios:**
- Happy path: clicking Facebook calls `signInWithOAuth` with
  `{ provider: 'facebook', options: { redirectTo: <includes the intent> } }`.
- Edge: a returned session with no email routes to profile completion / email
  collection rather than crashing or locking the user out.
- Happy path: the Facebook button is hidden for non-tester users until review clears
  (or behind the launch flag).

**Verification:** Facebook button calls the provider with the correct redirect; the
no-email path routes to email collection (no crash, no lockout); the ops doc lists
the App Review gate, console setup, and the local-tunnel requirement.

- [ ] **Unit 6: Verify the demoted password path (additive, nothing removed)**

**Goal:** Confirm email+password login, register, and reset still work fully — just
out of the way. The "prefer a password?" reveal is built in Unit 3; this unit is the
**verification gate**, not duplicate wiring.

**Requirements:** R6, R7.

**Dependencies:** Unit 3 (builds the in-place password reveal), Unit 1 (the
email-confirmations decision).

**Files:**
- Verify-only: `src/login/Login.tsx` (the Unit 3 reveal), `src/login/Register.tsx`,
  `src/login/ForgotPassword.tsx` / `ResetPassword.tsx`, and
  `src/navigation/NavRoutes.tsx` (`/register`, `/forgot-password`,
  `/reset-password` remain registered).
- Modify (light, only if needed): `src/login/Register.tsx` entry copy — no behavior
  change.

**Approach:**
- No deletion; only prominence moves (built in Unit 3).
- **Regression check under confirmations-ON:** because Unit 1 enables email
  confirmations in prod, re-verify the password **register** path — `signUp` no
  longer returns an immediately usable session, and `Register.tsx`'s synchronous
  placeholder-link after `signUp` now runs against an unconfirmed user. Confirm the
  claim+register flow still completes (or adjust it) under confirmations-ON, not just
  the confirmations-OFF dev default.

**Test scenarios:**
- Happy path: the Unit 3 "prefer a password?" reveal exposes the form;
  `signInWithPassword` still signs in.
- Happy path: a link from the password path reaches `/register`; password
  register + claim still works **with email confirmations ON** (the prod posture).
- Edge: forgot-password/reset routes still resolve and function.

**Verification:** Every pre-existing password capability still works (including
register+claim under confirmations-ON); only its entry point is demoted.

## System-Wide Impact

- **Interaction graph:** All auth success paths fire `onAuthStateChange`, so
  `src/context/UserProvider.tsx` updates automatically; the new screen additionally
  calls `setUser`/`setIsLoggedIn` before navigating (race-avoidance, per
  `EmailConfirmation.tsx`). `ProtectedRoute` continues to gate role + profile.
- **Error propagation:** Helper functions throw; the screen catches and renders the
  single `message` string. No silent failures.
- **State lifecycle risks:** Avoid navigate-before-session-settles; verify the
  `code` step does not double-submit on rapid taps (disable while loading).
- **API surface parity:** The `?redirect` repair must cover **all** entry paths
  (OTP, password, Google, Facebook) — partial wiring reintroduces the bug for the
  uncovered path.
- **Integration coverage:** The unauthenticated-deep-link → `/login?redirect=…` →
  back-to-intent round-trip is the cross-layer behavior unit mocks won't fully
  prove; cover it explicitly (Unit 4).
- **Security invariants (unchanged, must hold):** The claim flow's
  `userEmail === inviteEmail` 403 check stays load-bearing — OTP makes the
  authenticated email attacker-controllable, so do not weaken it. New same-origin
  check on `redirect` prevents open-redirect.
- **Unchanged invariants:** Password login/register/reset behavior; the
  profileless→`/complete-profile` routing in `ProtectedRoute`; the onboarding
  claim/invite routes. This plan changes the *front door*, not these.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Production has email confirmations **off** → same-email Google/Facebook/OTP create duplicate or unlinked users (and pre-account-takeover exposure) | Enable confirmations + custom SMTP in the hosted project (Unit 1), gated by an **enforceable feature flag / env guard** — not just a checklist — so the one-door can't go live before the config is verified. |
| Default Supabase mailer = **2 emails/hour project-wide** → OTP unusable at any real volume | Unit 1 requires custom SMTP (Resend already used for invites) before launch. |
| **Facebook App Review** delays public Facebook sign-in | Unit 5 is build-and-wire now, public-live later; Google + email cover everyone meanwhile; testable with tester accounts. |
| Facebook returns **no email** (phone-only accounts) → breaks email anchor + auto-linking, and would lock the user out of the claim email-match check | Unit 5 routes them to profile completion to **collect an email** (resolve the anchor), not just avoid a crash. |
| Public email box + `shouldCreateUser=true` → code-spam / shell accounts / sender-reputation damage (custom SMTP removes the only default throttle) | R11: low-friction bot check (Turnstile/hCaptcha) + per-email/IP send limit (Key Decisions, Unit 1). |
| Enabling email confirmations in prod changes the kept **password-register** path (no immediate session; sync placeholder-link runs against an unconfirmed user) | Unit 6 re-verifies register+claim under confirmations-ON; not assumed "unchanged." |
| Brand-new user's join intent dropped at the `/complete-profile` detour | Unit 4 forwards the intent through profile completion (coordinated with onboarding). |
| Copying `EmailConfirmation.tsx`'s legacy `type: 'signup'` into the new flow | Key Decision + Unit 2 test assert `type: 'email'`. |
| `?redirect` open-redirect via attacker-supplied absolute URL | Unit 4 honors only same-origin relative paths (explicit reject rule + tests). |
| First-ever auth tests → no established `supabase.auth` mock | Unit 2 establishes the mock pattern test-first; later units reuse it. |
| Local config changes (Facebook provider, templates) silently not applied | Run `pnpm run db:stop && pnpm run db:start` after `config.toml` edits (per project memory). |
| Local OAuth can't redirect to bare `localhost` | Test Google/Facebook against a deployed/preview URL or HTTPS tunnel; add it to the allow-list (Unit 5). |

## Documentation / Operational Notes

- `docs/ops/passwordless-auth-setup.md` (new, Unit 1) is the canonical hosted-setup
  checklist: OTP email template (`{{ .Token }}`), custom SMTP, enable email
  confirmations, redirect allow-list, and the Facebook developer-app + App Review
  steps.
- Update `TABLE_OF_CONTENTS.md` for the new plan, the new `src/login/passwordlessAuth.ts`,
  and `docs/ops/passwordless-auth-setup.md` as they are created.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-28-passwordless-sign-in-requirements.md`
- Companion: `docs/brainstorms/2026-05-28-player-onboarding-cold-start-requirements.md`
- Related code: `src/login/Login.tsx`, `src/login/EmailConfirmation.tsx`,
  `src/login/ClaimPlayer.tsx`, `src/components/ProtectedRoute.tsx`,
  `src/context/UserProvider.tsx`, `supabase/config.toml`
- Prior art: `memory-bank/PLAN-email-invites.md`
- External: Supabase Auth docs (passwordless, identity-linking, rate-limits,
  facebook social-login) — see Context & Research links.
