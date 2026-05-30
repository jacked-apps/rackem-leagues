---
date: 2026-05-28
topic: passwordless-sign-in
---

# Passwordless Sign-In — One-Door, Code-Based Login Requirements

> **Date:** 2026-05-28
> **Status:** Brainstorm complete; ready for planning
> **Origin:** Committed companion to
> `docs/brainstorms/2026-05-28-player-onboarding-cold-start-requirements.md`.
> Sequenced to be **built first** because it removes the single biggest non-tech
> stumble (account creation) and shrinks that doc's hardest requirement (the join
> token surviving an email round-trip / device switch).

---

## Problem Frame

The thing standing between a tech-phobic player and "on my team" is **making an
account.** Today, signing up is a multi-step ordeal: enter email + password →
wait for a confirmation email → click the link → fill a profile form → land in
the app. Every step is a place a non-tech user stalls or drops, and the
email-link hop is exactly what forces the onboarding cascade to carry a fragile
"remember where I was going" token across devices.

Everyone in this product is non-technical — operators, captains, and players
alike — so the sign-in experience is the make-or-break front door. The fix is to
**delete passwords from the happy path** and replace the bounce-out-to-email flow
with a **code the person types without ever leaving the page.** Because the user
stays put, the join intent has nowhere to get lost.

This is **additive**: the existing password login/register stays, demoted behind
a small link. Nothing that works today is removed.

**Who is affected:** every new and returning user (LO, captain, player). **What
changes:** the front door becomes a single code-based screen with social
shortcuts; passwords leave the default path. **Why it matters:** account creation
is the #1 onboarding barrier and the spear tip of the CSI/BCA pitch.

## The Front Door (visual)

```
            Sign in to Rack'em
   ┌────────────────────────────────┐
   │  [   Continue with Google    ]  │  ← one tap if you have it
   │  [  Continue with Facebook   ]  │  ← one tap if you have it
   │                                  │
   │  ────────  or passwordless  ──── │  ← labeled so they know what email is for
   │                                  │
   │   Enter your email               │
   │   [__________________________]   │
   │   [          Continue         ]  │
   │                                  │
   │   Prefer a password? ›           │  ← existing login/register, tucked here
   └────────────────────────────────┘

   Step 2:  "We emailed you a 6-digit code — type it:"
            [ _ _ _ _ _ _ ]      (stay on this screen; no leaving)
```

One screen for **new and returning** alike — no "am I signing up or logging in?"
decision. Type email → get a code → type it → in. The system silently
creates-or-finds the account.

## Requirements

**Front door (the default path)**
- R1. A **single sign-in screen replaces the separate login and register
  screens** on the default path. A user never chooses "sign up vs log in"; they
  enter a contact and the system creates-or-finds the account behind the scenes.
- R2. The **universal path is a typed one-time code delivered by email**: enter
  email → receive a short numeric code → type it on the **same screen** → signed
  in. The user **never leaves the app** to an inbox link.
- R3. **Social one-tap shortcuts sit above the email box:** **Google** (already
  built) and **Facebook** (to be added). These cover people for whom "go check
  your email" is the hard part. Provider set is **capped at these two** to keep
  the screen uncluttered.
- R4. The email path is **clearly labeled as the passwordless / no-password way
  in** (e.g., an "or passwordless" divider) so the user understands *why* they
  are typing an email and what will happen next. (Exact microcopy is a
  build-time polish; the word "passwordless" is the chosen intent.)
- R5. New-vs-returning is **auto-detected**; both experiences are identical from
  the user's point of view.

**Keep what works (additive, not destructive)**
- R6. The existing **email + password login and registration are preserved**,
  reachable from an unobtrusive **"prefer a password?"** link on the new screen.
  They are demoted, not deleted.
- R7. The existing **forgot-password / reset** flow remains available for anyone
  who uses the password path. On the passwordless path there is **nothing to
  reset** — a locked-out user simply requests another code.

**Onboarding integration (why this is built first)**
- R8. When an unauthenticated person opens a **team join link**, the one-door
  sign-in appears **in context**, and after the code they return to the **join
  in progress** — never a generic home page. Because R2 keeps them on the page,
  the onboarding "join token survives the round-trip" problem is **largely
  dissolved**, not merely mitigated.
- R9. Collecting a brand-new player's **name / profile is out of scope here** —
  it happens *after* authentication and is owned by the onboarding doc's
  "progressive profile" requirement. This doc ends at "the person is signed in."

**Delivery channel**
- R10. **Email is the only delivery channel.** Text/SMS is a standing exclusion
  (see Scope Boundaries), not a near-term deferral. Google/Facebook absorb the
  email-averse.

## Success Criteria

- A brand-new, tech-phobic player gets from "tapped the link" to "signed in"
  with **no password created and without leaving the page** — email, code, done
  (or one tap via Google/Facebook).
- There is **no "sign up vs log in" decision** anywhere on the default path.
- A returning user signs back in the same way, with **nothing to remember**.
- Tapping a team join link and signing in **lands the person back on that join**,
  not a generic home page.
- Everything that worked before (password login/register, reset) **still works**,
  just out of the way.

## Scope Boundaries

- **Text / SMS codes** — excluded. Texting costs money per message and needs a
  paid provider plus US carrier registration; treated as a standing decision, not
  "coming soon."
- **Removing the password system** — explicitly *not* done; it is kept and
  demoted.
- **Profile / name collection** for new users — owned by the onboarding doc, not
  here.
- **The onboarding cascade itself** (join links, claim/approve, wizards) — its
  own doc; this one only guarantees sign-in threads its intent.
- **RLS / authorization hardening** — out of scope; a separate pre-launch pass.

## Key Decisions

- **Code, not magic link** — a typed code keeps the user in the app; a link
  bounces them to their inbox and back (the "where was I going?" failure). This
  in-app property is what makes onboarding work, so it outweighs the cost of
  typing six digits.
- **One door (merge login + register)** — removes the "am I new or returning /
  which button?" confusion that trips up non-tech first-timers.
- **Email-only channel** — texting's per-message cost + carrier-registration
  overhead make it a no, likely permanently; Google/Facebook cover the people for
  whom email is the weak spot.
- **Additive, passwords demoted not deleted** — mirrors the onboarding doc's
  "nothing that works today is removed." No users to migrate, but keeping the
  password path on the back burner costs nothing and removes risk.
- **Cap social providers at Google + Facebook** — every extra button adds
  choice-weight; two recognizable on-ramps over one email box is the familiar,
  uncluttered pattern. Facebook specifically matches the older/casual league
  demographic that lives there.

## Dependencies / Assumptions

- **Supabase Auth** is the provider and already supports the needed pieces:
  email one-time-code (`signInWithOtp` / `verifyOtp` — the codebase already uses
  `verifyOtp` for signup confirmation in `src/login/EmailConfirmation.tsx`) and
  **Facebook** as a social provider (Google OAuth is already wired in
  `src/login/Login.tsx` / `src/login/Register.tsx`).
- **Pre-launch, no real users, disposable data** — no migration concerns.
- Current surfaces this work touches/reuses: `src/login/Login.tsx`,
  `src/login/Register.tsx`, `src/login/EmailConfirmation.tsx`,
  `src/login/ForgotPassword.tsx` / `ResetPassword.tsx`, the session layer
  `src/context/UserProvider.tsx`, route guard `src/components/ProtectedRoute.tsx`
  (note: `ClaimPlayer` builds a `?redirect=` that `Login` does **not** currently
  consume — wiring that is part of R8), and the claim/invite flow under
  `src/login/ClaimPlayer.tsx` + `src/components/invite/`.
- **Sequencing:** build this **before or alongside** the onboarding cascade, so
  the cascade can be planned against the simpler post-passwordless sign-in.

## Outstanding Questions

### Resolve Before Planning
- (none — product behavior is fully resolved.)

### Deferred to Planning
- [Affects R1][Technical] Fold `/login` + `/register` into one route/screen vs.
  keep both routes alive behind the "prefer a password?" link — pick the
  least-disruptive structure during planning.
- [Affects R2][Technical] Code mechanics defaults: length (6), expiry, resend
  cadence, and rate-limiting to prevent code-spam to arbitrary emails.
- [Affects R3][Technical] Facebook setup: developer app + Facebook's email-
  permission review (more involved than Google's switch-flip).
- [Affects R8][Technical] Exactly how the in-progress join intent is carried
  through `signInWithOtp` and the social-OAuth redirect so the person returns to
  the claim/join (reuse/repair the existing `?redirect=` / `?claim=` params).
- [Affects R4][Needs research] Validate the "passwordless" label wording with
  non-tech users; pick the plainest phrase that still tells them what the email
  is for.

## Next Steps

`-> /ce:plan` for structured implementation planning. Build first / alongside the
onboarding cascade.

## Appendix / References

- `docs/brainstorms/2026-05-28-player-onboarding-cold-start-requirements.md` —
  the companion this greases; see its "Land-on-role through signup" requirement
  and "Passwordless — committed; build first" resolved decision.
- `docs/brainstorms/2026-05-17-bca-pitch-strategy.md` — account creation is where
  CSI loses operators; this is the spear tip.
