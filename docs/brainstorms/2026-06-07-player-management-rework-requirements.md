# Player Management Rework — Requirements

**Created:** 2026-06-07
**Status:** brainstorm captured; onboarding spine solid, other interaction types in-scope but design-deferred
**Related:** the new onboarding cascade (`docs/brainstorms/2026-05-28-player-onboarding-cold-start-requirements.md`, plan `docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md`, PRs #165/#159/#190) — this is a NEW, distinct brainstorm about the operator **Player Management** surface around that system.

## Problem Frame

`src/operator/PlayerManagement.tsx` (`/manage-players/:orgId`, ~9 cards) still surfaces the **old** onboarding system (placeholder + `invite_tokens` + claim flow → the "Organization Invites" card). Meanwhile the **new** join-link cascade (the go-forward onboarding) is fully built and its operator tools live elsewhere — the join-request approve inbox on the Operator Dashboard, the captain link-distribution list on the league page (#190). So:

- Two competing "someone wants to join a team" inboxes (old Invites card vs new dashboard approvals).
- The old Invites card fills with **stale tokens nobody acts on** (placeholder-create still mints them).
- The LO's actual player hub (Player Management) is **not wired into the new cascade at all**.

## Users

- **Primary:** the League Operator (LO). May have **admins / helpers** — not always solo.
- The LO is **often co-present (in person or on the phone)** with the people being onboarded, talking them through it.

## What Player Management Should BE

The LO's **"everything I have to touch about players" hub** — the catch-all for every LO↔player interaction: onboarding, reports (players being reported *and* reports they file), complaints, suggestions, dues/status, handicaps. The **most-used** function, by far, is **recruitment + onboarding**.

## Key Decisions

- **Onboarding is TRANSIENT.** A placeholder exists → the real person registers → the two get connected/merged → *the task completes and disappears.* It is not a permanent record. (This is why the old, never-clearing Invites card feels wrong, and why the new cascade — approve → gone; captain list self-clears — fits the LO's mental model.)
- **Keep EVERY onboarding path until the new one is grandma-proof.** (Corrected from an earlier draft that said "retire the old system" — Ed overrode this.) Do NOT throw out any working way to get a player in: different people understand different methods, and a redundant path that helps even a few is worth keeping. The new cascade is the **primary / go-forward** path, but the old methods stay available — email invite, device-handoff, share/claim link, QR, create-placeholder. **Retirement bar:** a method is only removed once the new cascade is so slick a non-technical user (the "90-year-old grandma") can self-onboard unaided. Until then, more doors in = better.
  - **Distinct from the above — the clutter is a *surfacing* problem, not a *path* problem.** The two-competing-inboxes / stale-`invite_tokens` mess (see Problem Frame) was caused by how onboarding is *shown*, not by the old path existing. So: **keep all the doors (methods), fix the clutter (surfacing)** — e.g. don't auto-mint tokens that will never be used, and don't make the operator stare at two rival inboxes. **RESOLVED (Ed): "keep all paths, fix the clutter."** The old methods stay; the surfacing gets de-cluttered (quiet the stale-token pile, don't show competing inboxes) rather than kept loud.
  - **Only genuine deletion:** `RegisterPlayerModal.tsx` — not a usable path, just dead code (no imports). Safe to remove regardless.
- **~90% of onboarding self-handles** via the captain cascade — *as long as someone capable on the team drives it.* Usually true: even if the captain isn't tech-savvy, there's typically a teammate (even just a player) who can run it on a phone.
- **The LO is the backstop / step-in helper, not an automation engine.** The need is **TOOLS, not "do it all for them remotely."** When the LO does step in, they're usually right there talking the person through it. The two tools the LO needs, reachable **when they go looking for them**:
  1. **See the join LINK** for any team they're helping (to hand it over, or pull it up on their own device).
  2. **See + hit the APPROVE button on a captain's behalf**, here on the management page.
- **Those tools already exist — they're just on the wrong page.** The captain **link list** (`OnboardCaptainsList`, on the league page via #190) and the **join-request approve inbox** (`JoinRequestList`, on the Operator Dashboard) are built and working. The rework is largely **bringing them onto Player Management**, framed as *"help a team get onboarded,"* so they're in reach where the LO's head says "this is where I deal with players."
- **Manual placeholder→registered merge becomes mop-up.** In the new world the connect/merge step is increasingly self-serve (the player claims their own placeholder spot from the join link; the LO/captain just approves → Replace-on-approval merges it). So the LO's manual "connect the two and merge" (`OrgPlaceholdersCard` Attach) shrinks to **handling the cases where the automatic connection didn't happen** — complementary, not the primary path.

## Scope Boundaries / Non-Goals

- **Not** rebuilding the captain-driven cascade — reuse it; the LO assists.
- **Not** a "fully automate onboarding for low-tech teams" machine — the rare fully-low-tech team is handled by the LO (with help/admins, usually in person) using the step-in tools, not by software magic.
- **Keep** the still-useful orthogonal pieces already on the page: handicaps / starting-handicap authorization, dues/membership status, player stats + search, and the placeholder merge/archive/unmerge surface.

## Smoothing the Join Flow (Ed: "not broken, just jagged") — player's-eye seams

The cascade direction is liked; these are rough edges to smooth, not a redesign:

- **No double sign-in.** If the person is already signed into the app, opening `/join/:token` should recognize them and skip straight ahead — a forced second login is a seam to fix/verify, not a designed step.
- **Re-examine the short-profile hurdle for known placeholders.** What can feel like "logging in again" is actually the post-sign-in short-profile step. Question: if we already hold a placeholder's name, does that person still need to fill the short profile before joining, or can it be pre-filled / skipped?
- **No mystery codes.** There is no separate "join code" — the only code is the passwordless email code (Google sign-in skips even that). Make sure the UI never makes a player hunt for a code that doesn't exist.
- **Make "you're in line, the captain will approve" crystal clear.** After the one tap to join, the player isn't instantly on the team — a request is pending a captain approve. That waiting state must be obvious so nobody wonders "did it work?"

## Discovery / "Find My Team" — the PULL path (new requirement)

Everything today is **push** (captain hands you a link). Add the **pull** complement: a player who knows they're on a team but has **no link** can **find it themselves**. Three search routes:
1. by **captain's name**, 2. by **team name**, 3. by **their own name matching a placeholder** on a team.

When they find the placeholder with their name, tapping it is the **same** "claim a spot → captain approves" machinery as the link flow — **a second door into the system already liked, not a new system.** Directly solves the "I'm a placeholder and don't even know it" case. **Placement:** on the **player-facing team page** (where a person with no team lands asking "where's my team?"). This is the previously-deferred "lost-player search," now pulled in.

## Other LO↔Player Interactions (in scope, design deferred)

The page is also the LO's home for: **reports** (received + filed), **complaints**, **suggestions**. Acknowledged as belonging here; not yet designed in this brainstorm. To be detailed in a follow-up pass once the onboarding spine + instructions are settled.

## Critical Dependency / Likely First Step — Onboarding Instructions

The cascade can be flawless and still stall if people don't know what to do (captain must forward the link; player must tap "add me"; LO must know how to step in). **Explicit onboarding instructions — for LO, captain, and player — are what make the "90% self-handles" actually happen.** Flagged in-conversation as possibly the *first* thing to build. Treated as its own closely-related effort (next).

## Issues / Work Queue (tackle one at a time)

Concrete items surfaced; to be sequenced and addressed individually.

**Join-flow seams (smoothing):**

- **(A) Placeholder must MERGE, not get bypassed — protect game history. [TOP PRIORITY]** A returning player's game history lives on their placeholder member row. At the join step, tapping "add me" instead of claiming their placeholder spot creates a **duplicate member**, **orphans** the placeholder, and **strands the history** on it (recoverable by a later merge, but truly lost if a history-bearing placeholder is ever deleted). Protect two ways: **(1) flow-side** — make *"which of these is you?"* the obvious default, before/over "add me," and keep the captain's "are you sure they're new?" guard when an Add happens while unclaimed placeholders remain; **(2) mop-up** — LO can see orphaned placeholders and Attach them (`OrgPlaceholdersCard`), and history-bearing placeholders never get hard-deleted.
- **(B) Fill personal-info at most ONCE — zero for a placeholder claimer.** A new person fills the short profile once; a placeholder claimer should have it **pre-filled / skipped** (the placeholder already holds name/nickname/city/state).
- **Unifying fix for A + B:** reorder the placeholder case so **"which of these is you?" (claim) comes *before* the generic profile form** — claiming-first makes the merge the default (A) and lets the profile pre-fill from the placeholder so they barely type (B). One reorder, both problems.

- **(C) Post-profile hard-reload jank.** After the short profile submits, `useShortProfileSubmission.ts:138` does `window.location.href = …` — a **full browser reload** (white flash, re-downloads the app) instead of a smooth in-app transition. It's a **workaround** ("force a full reload so UserProvider refetches the new member") — i.e. a sledgehammer because the proper cache refresh isn't trusted. Hits **all** registration (join flow + normal `/my-teams`). **Local fix:** drop the reload; **invalidate the member query** (`queryKeys.members.byUser`) + in-app navigate, with a short "setting up…" beat so the profile form doesn't flash back before the refetch lands.
  - **Symptom of a SYSTEMIC issue — "stale after write" (= LIST_FOR_ED #2).** Across the app, mutations inconsistently refresh the cache: some don't invalidate, some hit the wrong key, and the **same entity is cached under several keys/shapes** (the #183 consolidation is the structural fix) — so invalidating one copy leaves others stale. The hard-reload is one of many sledgehammer workarounds. **Discipline to adopt app-wide:** every mutation either invalidates its related keys (default) or optimistically updates (instant-feedback spots). The local fix here is the **model**; the whole-app sweep is its own effort (LIST_FOR_ED #2 + the per-entity consolidation).
- ~~Double sign-in~~ — **investigated end-to-end; NOT a real bug.** Auth state = `user` (Supabase session, re-hydrated via `getSession()` on each load, persists across reloads — `src/context/UserProvider.tsx:20`) + `member` (members row by `user_id`, null=PGRST116 — `src/api/hooks/useUserProfile.ts:79`). `TeamJoinPage` routes: not-logged-in → sign-in (`:98`); logged-in + no member → profile form (`:121`); logged-in + member → Join/claim (`:126`). Sign-in is **in-place** (no reload — `JoinSignInStep.tsx:68`), `signInWithOtp` **creates the account for a new email** (`shouldCreateUser` default true — `passwordlessAuth.ts:35`), and the **only** hard reload is *after* the profile form (`window.location.href` — `useShortProfileSubmission.ts:138`), across which the session survives. So a person signs in **at most once** per environment. **Ben's "register again"** = either **(a) cross-env** (staging account, prod link → separate auth DB → genuinely new on prod — most likely) or **(b) half-registered** (account made, profile never finished → link sends him to the profile form). Real fix target that fell out: the jarring post-profile hard-reload — NOT a double-login bug. (Cross-env "register again" is real but **NOT worth addressing** — Ed: it's a *tester* problem, not a real-user one; only insiders know staging exists. Optional ops nicety only: a visible "STAGING" badge so testers don't confuse environments. Not an onboarding-list item.)

**Half-registered is a SAFEGUARD, not a problem (Ed corrected this).** The profile form is all-or-nothing (single Zod-validated submit — `useShortProfileSubmission.ts`); bailing saves **zero** partial data — only the bare auth account (email + login) persists, which holds no "broken player." So a half-finished signup correctly leaves NO broken member data, and the app correctly blocks the person until they finish the profile. Forcing them back to complete it is the *right* behavior, not a trap. **Only optional residual:** cosmetic wording — a returning half-finished person sees a "Register"-looking form ("register *again*?"); relabel to "Finish setting up your profile" + show the one remaining step. Wording only, no behavior change. NOT a fix-list item.
- "You're in line, captain will approve" — make the pending state unmistakable.
- No phantom code — UI must never imply a join code that doesn't exist.

**New onboarding capability:**
5. "Find my team" search (PULL path) — by captain name / team name / own-name→placeholder; on the player team page; reuses claim→approve.
6. Onboarding instructions — for LO, captain, player (makes the ~90% self-handle).

**Player Management (operator hub) rework:**
7. Bring the LO step-in tools onto the page — join-link list + approve inbox ("help a team get onboarded").
8. Declutter old surfacing — quiet stale-token pile / no rival inboxes (keep all methods).
9. Delete dead `RegisterPlayerModal`.

**Deferred (named, not now):**
10. Reports / complaints / suggestions sections.
11. `OrgPlaceholdersCard` Attach/merge vs new Replace-on-approval consolidation.

## Open Questions (deferred to planning)

- **Scope of the approve inbox + link list on Player Management** — org-wide (all teams across the LO's leagues, could be long) vs league/team-filtered. Note the existing surfaces are org-wide (dashboard) and league-scoped (league page).
- **How much of reports / complaints / suggestions** to build in the first rework vs later.
- **Relationship of `OrgPlaceholdersCard` Attach/merge** to the new Replace-on-approval merge — keep both (complementary) or consolidate.
- Whether onboarding instructions live **in-app on this page** (contextual help) vs a standalone guide — informs the instructions effort.
