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
(see origin). Because the code is typed in-page, the onboarding "join intent"
never has to survive an email hop — the user stays on the join/claim screen the
whole time, which dissolves that doc's hardest requirement.

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
  paths).
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
- **Reuse session + guard layers** — `onAuthStateChange` auto-updates `UserProvider`;
  follow `EmailConfirmation.tsx` and also `setUser`/`setIsLoggedIn` before navigate
  to avoid a navigate-before-state-settles race. Don't duplicate the
  profileless→`/complete-profile` logic.

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
- Whether the password sub-view is an in-place toggle on `/login` or a navigation to
  the existing `/login`-password/`/register` routes — pick the lower-churn option
  when editing the component.
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
- Modify: `supabase/config.toml` (confirm `otp_length`/`otp_expiry`; note resend
  `max_frequency` + `[auth.rate_limit]`; Facebook block prep for Unit 5).
- Create: `docs/ops/passwordless-auth-setup.md` (hosted-dashboard checklist —
  email template `{{ .Token }}`, custom SMTP via Resend, **enable email
  confirmations**, allow-list redirect URLs).

**Approach:**
- Local: the Magic Link template must contain `{{ .Token }}` so the typed-code flow
  works; verify codes land in Mailpit/Inbucket (`localhost:54324`). A
  `db:stop && db:start` may be needed after config changes.
- Production (hosted): document required dashboard actions — set the OTP email
  template, configure custom SMTP (default mailer is 2/hr, unusable), enable email
  confirmations (required for safe auto-linking), and add redirect URLs to the
  allow-list.

**Execution note:** Config + ops, not feature code.

**Test scenarios:**
- `Test expectation: none — config/ops.` Manual verification: a local
  `signInWithOtp` request produces a 6-digit code visible in Mailpit, and
  `verifyOtp({type:'email'})` with that code establishes a session.

**Verification:**
- Locally, requesting a code shows a numeric code (not a link) in Mailpit, and
  typing it signs in. The ops checklist enumerates every hosted-dashboard step,
  including email-confirmations-on and custom SMTP.

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
- Create (optional, if it keeps the file readable): `src/login/EmailCodeStep.tsx`
- Test: `src/login/Login.test.tsx`

**Approach:**
- Step enum `'choose' | 'code'` rendered as early-return sub-views inside one
  `LoginCard` (mirrors `Register.tsx`/`ClaimPlayer.tsx`).
- `choose`: existing Google button (kept), Facebook button placeholder wired in
  Unit 5, an "or passwordless" divider, the email input + Continue, and a small
  "prefer a password?" link that reveals the classic email+password form (reuse the
  existing password logic — additive, R6).
- `code`: a 6-digit input + Verify + a Resend control (respecting the 60s cooldown),
  calling `verifyEmailCode`; on success `setUser`/`setIsLoggedIn` then navigate
  (navigation target handled in Unit 4).
- Use `Button` `isLoading`/`loadingText`/`message`; single `message` string for
  errors per existing convention.

**Patterns to follow:** `src/login/Login.tsx` (current structure, Google button
markup), `src/login/Register.tsx` (sub-view returns), `src/login/LoginCard.tsx`,
`src/login/EmailConfirmation.tsx` (`setUser`/`setIsLoggedIn` before navigate),
`src/test/utils.tsx` `renderWithProviders({ userContext: { isLoggedIn:false, user:null }})`.

**Test scenarios:**
- Happy path: signed-out render shows Google, Facebook, the email box, and "prefer
  a password?"; entering an email + Continue calls `requestEmailCode` and advances
  to the code step.
- Happy path: entering a valid code calls `verifyEmailCode` and triggers navigation.
- Edge: invalid email format blocks submit; empty code blocks verify.
- Error path: `requestEmailCode`/`verifyEmailCode` rejection shows the error
  `message` and keeps the user on the step (no navigation).
- Happy path: "prefer a password?" reveals the password form, and the existing
  `signInWithPassword` path still works.
- Integration: a successful verify updates `UserProvider` (mock `onAuthStateChange`
  / `setUser`) so the app sees the user as logged in.

**Verification:** Signed-out user can complete email→code→signed-in entirely on one
screen; Google still works; the password form is reachable and functional.

- [ ] **Unit 4: Redirect-after-auth threading (R8 repair)**

**Goal:** Make every auth path land the user back on their intended destination,
fixing the dead `?redirect` param.

**Requirements:** R8.

**Dependencies:** Unit 3.

**Files:**
- Modify: `src/login/Login.tsx` (read `?redirect`/`?claim`; navigate to it on
  success across OTP + password paths; encode it into OAuth `redirectTo`).
- Modify: `src/components/ProtectedRoute.tsx` (write the attempted location into
  `?redirect` when bouncing to `/login`).
- Modify/Create: OAuth return handling — read `returnTo` on the landing route (a
  small `/auth-callback` handler or reading it on `/my-teams`); decision deferred
  to implementation.
- Test: `src/login/Login.redirect.test.tsx`

**Approach:**
- In-page paths (OTP, password): `const redirect = searchParams.get('redirect')`;
  `navigate(redirect ?? '/my-teams')`.
- OAuth: append the return target to `redirectTo` (the only thing that survives the
  provider round-trip) and consume it on landing.
- `ProtectedRoute`: redirect to `/login?redirect=<current location>` instead of a
  bare `/login`, so a deep link bounced through auth comes back.

**Execution note:** Characterization-first — pin the current "redirect is dropped"
behavior with a failing test, then fix.

**Patterns to follow:** `src/login/ClaimPlayer.tsx` (the existing `?redirect`
writer), `useSearchParams` usage in `Register.tsx`.

**Test scenarios:**
- Happy path: visiting `/login?redirect=/claim-player?claim=X&token=Y` and
  completing OTP navigates to that claim URL, not `/my-teams`.
- Happy path: no `redirect` param → defaults to `/my-teams`.
- Integration: an unauthenticated visit to a protected route lands on
  `/login?redirect=<that route>`, and after sign-in returns there.
- Edge: malformed/encoded `redirect` is decoded safely; external/absolute URLs are
  rejected (only same-origin paths honored) to avoid open-redirect.
- Happy path (password): the password sub-view also honors `redirect`.

**Verification:** Tapping a team join link while signed out routes through `/login`
and lands back on the join; no path hardcodes `/my-teams` when a redirect is present.

- [ ] **Unit 5: Facebook OAuth button (can lag on App Review)**

**Goal:** Add a "Continue with Facebook" one-tap path alongside Google.

**Requirements:** R3 (Facebook).

**Dependencies:** Unit 3 (button placement), Unit 4 (OAuth redirect handling).

**Files:**
- Modify: `src/login/Login.tsx` (Facebook button + `signInWithOAuth({ provider: 'facebook' })`).
- Modify: `supabase/config.toml` (enable `[auth.external.facebook]` for local;
  needs `db:stop && db:start`).
- Modify: `docs/ops/passwordless-auth-setup.md` (Facebook developer-app + App Review
  + redirect-URI steps).

**Approach:**
- Copy the Google button shape (inline SVG + `signInWithOAuth`); set `redirectTo`
  per Unit 4.
- Handle the **missing-email** edge: a phone-only Facebook account may return no
  email — the post-auth path must not crash and should route such a user to profile
  completion rather than assuming an email anchor.
- Flag clearly: public sign-in works only after Facebook App Review clears; until
  then it works for app-role/tester accounts.

**Patterns to follow:** the Google OAuth block in `src/login/Login.tsx`.

**Test scenarios:**
- Happy path: clicking Facebook calls `signInWithOAuth` with
  `{ provider: 'facebook', options: { redirectTo: <includes returnTo> } }`.
- Edge: a returned session with no email does not crash the post-auth flow.

**Verification:** Facebook button calls the provider with the correct redirect;
ops doc lists the App Review gate and setup; missing-email does not error.

- [ ] **Unit 6: Demote the password path (additive, nothing removed)**

**Goal:** Keep email+password login, register, and reset fully working, just out of
the way behind the "prefer a password?" entry.

**Requirements:** R6, R7.

**Dependencies:** Unit 3.

**Files:**
- Modify: `src/login/Login.tsx` (the "prefer a password?" affordance wired to the
  password sub-view / routes).
- Modify (light): `src/login/Register.tsx` (reachable from the password path; entry
  copy only — no behavior change).
- Verify-only: `src/navigation/NavRoutes.tsx` (`/register`, `/forgot-password`,
  `/reset-password` routes remain registered).

**Approach:**
- No deletion. Ensure the demoted password flow (login, register, forgot/reset) is
  reachable and unchanged; only its prominence moves.

**Test scenarios:**
- Happy path: "prefer a password?" exposes the password form; `signInWithPassword`
  still signs in.
- Happy path: a link from the password path reaches `/register`; the existing
  password register + claim still works.
- Edge: forgot-password/reset routes still resolve and function.

**Verification:** Every pre-existing password capability still works; only its entry
point is demoted.

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
| Production has email confirmations **off** → same-email Google/Facebook/OTP create duplicate or unlinked users (and pre-account-takeover exposure) | Unit 1 ops checklist requires enabling email confirmations + custom SMTP in the hosted project before relying on multi-provider convergence; tracked as a launch gate. |
| Default Supabase mailer = **2 emails/hour project-wide** → OTP unusable at any real volume | Unit 1 requires custom SMTP (Resend already used for invites) before launch. |
| **Facebook App Review** delays public Facebook sign-in | Unit 5 is build-and-wire now, public-live later; Google + email cover everyone meanwhile; testable with tester accounts. |
| Facebook returns **no email** (phone-only accounts) → breaks email anchor + auto-linking | Unit 5 handles missing-email without crashing; routes to profile completion. |
| Copying `EmailConfirmation.tsx`'s legacy `type: 'signup'` into the new flow | Key Decision + Unit 2 test assert `type: 'email'`. |
| `?redirect` open-redirect via attacker-supplied absolute URL | Unit 4 honors only same-origin relative paths. |
| First-ever auth tests → no established `supabase.auth` mock | Unit 2 establishes the mock pattern test-first; later units reuse it. |
| Local config changes (Facebook provider, templates) silently not applied | Run `pnpm run db:stop && pnpm run db:start` after `config.toml` edits (per project memory). |

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
