---
title: "feat: Player/captain onboarding cold-start cascade (share link → sign in → approve)"
type: feat
status: active
date: 2026-05-29
origin: docs/brainstorms/2026-05-28-player-onboarding-cold-start-requirements.md
deepened: 2026-05-29
---

# feat: Player/captain onboarding cold-start cascade

> **Rewritten 2026-05-29** after a multi-persona review + an Ed walkthrough that
> simplified the design. The spine is now **register-first**: the joiner signs in
> and fills the existing short profile form *before* they reach the approver, so
> the approver sees a **name** (not an email) and — because the joiner is a real
> account by then — "Replace" is a clean stat-transfer and "Add" needs no merge.
> This dissolved the review's worst finding (the merge engine choking on a player
> with no account yet).

## Overview

Every team has a **persistent, forwardable join link/QR** ("the address"). A
person taps it, signs in (passwordless code), fills the existing short profile
form, and lands in the approver's list as a recognizable name. The approver taps
**Add** (new) / **Replace** (this is a placeholder I already listed → transfer its
spot + record) / **Decline** ("the door"). Approved → they're on the team, looking
at tonight's match.

It's **one machine — "link a person to a team"** — used at two scopes:
- a **captain** runs it for **his one team** (his players);
- an **LO** runs it for **every team in his org** (his captains, and a backstop for
  any player on any team).

A **captain is just a person linked to a team in the captain role**; onboarding a
captain is the same flow with the captain seat as the target. Additive: the
existing per-placeholder email/QR/device-handoff flows stay untouched.

## Problem Frame

A brand-new league's cold start drops 60–70 non-tech players (and ~10 captains)
onto the right teams at once, today routed through the LO as a one-to-one "type
every email" help desk. The cascade distributes it: the LO onboards captains; each
captain self-serves their ~5–8 players with one shared link + approve taps. (See
origin: `docs/brainstorms/2026-05-28-player-onboarding-cold-start-requirements.md`.)

## Requirements Trace

- R1. **Persistent team join link/QR** — `teams.join_token`; lives all season,
  forwardable; route `/join/:token`. On open, shows the team + its spots.
- R2. **Register-first self-add (the cold-start spine)** — empty roster is normal;
  a brand-new person taps the link, signs in, fills the short profile form, and is
  submitted as a join **request** (no pre-made placeholder required).
- R3. **Claim a pre-made spot (the returning/known case)** — if the captain *did*
  list placeholders, a joiner can claim one; otherwise everyone self-adds (R2).
- R4. **Approval is the gate** — every request (in-person or remote) is pending
  until the approver taps approve; one tap; no bulk; no in-person auto-approve.
- R5. **Approve = Add / Replace / Decline** — **Add** (put the registered person on
  the roster, no merge); **Replace** (link to a placeholder → transfer its spot +
  record via merge); **Decline** (the gate). Replace is **always available when the
  team has placeholders**, with a manual picker (record-flagged) — auto-match by
  name is only a shortcut, so a misspelled placeholder never strands its record.
- R6. **Approve surface shows person + team + league** — one component; the captain
  sees his team, the LO sees all his org's teams; no hunting for which team.
- R7. **The "doorbell"** — pending-request count surfaces where the approver is
  (home card + menu count + mobile bottom-bar), only while pending, cleared when
  handled (act-now, not permanent chrome). Captain = his teams; LO = all org teams.
- R8. **Land on tonight's match** — after approval the joiner lands on their team
  with tonight's match front-and-center (reusing the existing match surfacing).
- R9. **LO captain-distribution made easy** — an "Onboard my captains" list, one
  row per team (Team · its assigned captain · Send-link), pre-paired (free, because
  a team is created *with* a captain assigned), so the right link reaches the right
  captain with no manual matching. Plus a thin first-run wizard.
- R10. **Join intent survives sign-in, server-side** — the intent is persisted
  server-side keyed to the joiner's identity (not browser-only), so it survives the
  sign-in window and any device; once submitted, the `team_join_requests` row is the
  durable record. (Honors the origin's cross-device requirement; Ed: "just make it
  seamless.")
- R11. **Additive** — existing email/QR/device-handoff + manual placeholders stay.

## Scope Boundaries

- Steady-state/returning-player onboarding (season carryover); public Find-a-League;
  LO/captain lost-player *search*; just-in-time at-the-table as a distinct flow —
  deferred follow-ons (origin Non-Goals).
- Reworking auth — done in passwordless (PR #159); this plan assumes/stacks on it.

### Deferred to Separate Tasks

- **`send-invite` caller-authz hole** (pre-existing: any authed user can fire
  invites for any team) — fix on its own small PR; do not widen it.
- **User-to-user merge** (linking a returning *registered* player, not a
  placeholder) — a separate unbuilt RPC; the "Replace" picker here links to
  **placeholders** only. A returning registered player just uses **Add** (they keep
  their own account/stats); de-duping two registered accounts is out of scope.
- **Per-token rate-limit / captcha** beyond the dedup constraint below — hardening
  fast-follow.
- **`MyMatch` full page build** — its own effort; Unit 8 only reuses existing match
  surfacing to satisfy R8.

## Context & Research

### Relevant Code and Patterns

- **Substrate (reuse, don't rebuild):** `merge_placeholder_into_member_v2` RPC
  (params `p_placeholder_member_id`, `p_target_member_id`, `p_actor_member_id`,
  `p_actor_role`, `p_organization_id`) — used by `supabase/functions/claim-placeholder/`;
  `placeholder_has_stats(member_id)` predicate; `archived_placeholders` (PII,
  deny-all RLS); `merge_placeholder_into_member_v2` rewrites `match_lineups.playerN_id`
  rows via FK discovery (the `match_lineups`→`members` FKs already exist —
  migration `20260422000003`; **not a to-do**).
- `src/api/mutations/members.ts` `createPlaceholderMember`; `src/login/ClaimPlayer.tsx`;
  `src/components/modals/PendingInvitesModal.tsx` + `usePendingInvites` /
  `get_my_pending_invites` (the "you have something waiting" auto-popup pattern to
  reuse for R8's notify-on-approval).
- **Roster:** `teams` (+ `captain_id`) + `team_players` (`UNIQUE(team_id, member_id)`;
  a placeholder = a row whose `member_id` has `user_id IS NULL`). `src/hooks/useRosterEditor.ts`,
  `src/wizards/teams-v2/steps/CaptainsTeamsStep.tsx`, `src/api/mutations/teams.ts`.
  Org chain: `team_players → teams → seasons → leagues → organization_id`.
- **Approve-surface home:** `src/player/MyTeams.tsx` (per-team accordion). LO
  all-teams view: a new operator surface (or extend an operator dashboard).
- **Doorbell:** `src/player/MyTeams.tsx` (home card), `src/components/layout/{AppDrawer,AppSidebar}.tsx`
  ("Messages (N)" via `useUnreadMessageCount`), `src/components/layout/BottomTabBar.tsx`
  (`TabItem.badge`).
- **Share/QR:** `src/components/invite/ShareLinkSection.tsx` (`QRCodeSVG`).
- **Tonight's match:** `useNextMatchForTeam` (already exported from `src/api/hooks/index.ts`)
  + `MyTeams.tsx`'s existing "Quick Score" cards (today/in_progress) → `/match/:id/lineup`
  via `useMatchPhase`/`MatchPhaseGuard`. **Reuse — do not add a parallel hook.**
- **Wizard scaffold:** `src/components/wizard/` (Wizard 2.0; plain `useState`;
  string-ID step registry; files < 100 lines; use `queryKeys.members.all` to avoid
  the wizard query-key stale-cache bug seen in `CaptainsTeamsStep`).
- **Conventions:** `src/api/{mutations,queries,hooks}` + `src/api/queryKeys.ts`;
  RPCs via `supabase.rpc`; migrations in `supabase/migrations/` (additive — **never
  `supabase db reset`**, live test data); edge functions in `supabase/functions/`
  (new ones need a full `db:stop && db:start`); vitest `unit` vs `db` projects.

### Institutional Learnings

- `memory-bank/PLAN-email-invites.md` — the email-match 403 stolen-link guard
  (per-placeholder email flow, **unchanged**). The forwardable team link trades that
  for the **approval gate**; authz must be real (Unit 4).
- `docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md` — merge is
  org-scoped; the dead **`merge_requests` table is unwired — build fresh**, don't
  revive it. `placeholder_has_stats` drives the record-flag in the Replace picker.
- `docs/brainstorms/header-mobile-rework-requirements.md` R24 — "you have mail"
  badge convention; the doorbell is its act-now refinement.
- RLS off → authz in edge functions/RPC args. Localhost links can't be tested
  cross-device — verify on staging.

### External References

- None — deep local prior art.

## Key Technical Decisions

- **Register-first spine.** The joiner completes the existing short profile form
  *before* reaching the approve list. So at approve-time they are a **registered
  member** → **Add** = add their member to the roster (no merge); **Replace** =
  `merge_placeholder_into_member_v2` (placeholder source, their registered member as
  target — the RPC fits). No pre-made placeholders needed at cold start.
- **New `team_join_requests` table** (not the dead `merge_requests`, not the
  email-gated `invite_tokens`): `id, team_id, requested_by_user_id, requested_member_id
  (the joiner's member once formed), claimed_member_id (nullable — placeholder being
  claimed), status (pending|approved|rejected|cancelled), created_at, resolved_at,
  resolved_by_member_id`. **Two partial unique indexes:** `(team_id,
  requested_by_user_id) WHERE status='pending'` (dedup — one pending request per
  person per team) and `(team_id, claimed_member_id) WHERE status='pending' AND
  claimed_member_id IS NOT NULL` (one pending claim per open spot → clean race).
- **Approve is captain-OR-LO, server-side authz.** `approve-join-request` reads
  `team_id` from the stored request row (never client input), resolves `org_id` by
  walking `team→season→league→organization_id`, and authorizes the caller as the
  team's captain **or** org staff. Handle nullable `captain_id` (bye/edge teams):
  if null, fall through to org-staff only. Re-read the request `FOR UPDATE` and
  short-circuit to a friendly "already handled" if not `pending` (the race).
- **Captain seat = a placeholder too.** A team is always created with a captain
  (placeholder or lookup), so onboarding a captain is the same Replace/claim against
  the captain seat. LO-as-own-captain needs no invite (assigned = himself).
- **`captain_approve` actor_role.** Add `'captain_approve'` to the
  `merge_placeholder_into_member_v2` `p_actor_role` whitelist (migration) so the
  approve path audits correctly (today only `'invite_accept'|'lo_initiated'`).
- **One approve surface, two scopes.** A single triage component (request list +
  Add/Replace/Decline + the record-flagged placeholder picker); a captain mounts it
  for his team, the LO mounts it across all org teams. Every item shows person +
  team + league.
- **Server-side, identity-keyed join intent (R10).** Persist the pending join
  server-side keyed to the joiner's email/identity (not browser-only) so it survives
  the sign-in window + any device; the `team_join_requests` row is the durable record
  post-submit. Reuse the `get_my_pending_invites`/`PendingInvitesModal` pull pattern
  to notify the joiner on approval.

## Open Questions

### Resolved During Planning

- *Merge engine can't fit a brand-new player* → register-first: Add (no merge) /
  Replace (merge into the now-registered member).
- *Cross-device join intent* (origin requirement) → persist server-side keyed to
  identity; the request row is durable; reuse the pending-invites pull to notify.
- *Captain onboarding* → same machine; captain seat is the target; LO scope = all
  teams; pre-paired distribution list.
- *match_lineups FK* → already present (`20260422000003`); merge rewrites lineups.
- *Revive `merge_requests`?* → No; new `team_join_requests`.

### Deferred to Implementation

- Exact `team_join_requests` columns/indexes + the `get_team_join_view` /
  `approve-join-request` signatures — finalize against the live schema.
- The precise place to stash the pre-submit pending-join (a server row keyed to
  email vs. a short-lived token) — decide when wiring Unit 3 against passwordless.
- The "tonight's match" predicate — reuse `MyTeams`'s existing definition, don't
  invent a second.

## High-Level Technical Design

> *Directional guidance for review, not implementation spec.*

```mermaid
sequenceDiagram
    participant P as Joiner (phone)
    participant J as /join/:token
    participant Auth as Passwordless (PR #159)
    participant DB as team_join_requests
    participant A as Approver (captain=1 team / LO=all teams)

    P->>J: tap shared link / scan QR
    J->>DB: get_team_join_view(token) → team + spots
    alt not signed in
        J->>Auth: sign in (code, in-page); intent persisted server-side (R10)
        Auth-->>J: back on /join (or recovered post-auth)
    end
    P->>P: fill EXISTING short profile form → now a registered member
    P->>DB: submit join request (pending) — dedup + per-spot unique guards
    Note over A: doorbell: "N waiting" (item shows name + team + league)
    A->>DB: approve — Add (no merge) | Replace (merge placeholder→member) | Decline
    DB-->>P: on the team (+ notify via pending-invites pull) → tonight's match
```

## Implementation Units

### Phase 1 — Data model + read

- [ ] **Unit 1: Schema — join token, requests table, guards, actor_role**

**Goal:** The durable spine: a per-team join token, a clean requests table with
race/dedup guards, and the approve audit role.

**Requirements:** R1, R2, R4, R5, R10.

**Dependencies:** None (first).

**Files:**
- Create: `supabase/migrations/<ts>_team_join_cascade.sql` (`teams.join_token`
  unique default `gen_random_uuid()`, backfilled; `team_join_requests` + the two
  partial unique indexes; add `'captain_approve'` to the merge RPC's actor_role
  whitelist).
- Modify: `src/types/database.types.ts` (`pnpm db:types`).
- Test: `src/__tests__/database/team-join-cascade.test.ts`.

**Approach:** Additive only (no reset). Index `(team_id,status)` for triage/doorbell.

**Test scenarios:**
- Happy: new + backfilled teams have a unique `join_token`; both request shapes
  (claim w/ `claimed_member_id`, self-add w/o) insert as `pending`.
- Edge: second pending request from the same user on the same team is rejected by
  the dedup unique index; a second pending claim on the same `claimed_member_id` is
  rejected by the per-spot index.
- Edge: `merge_placeholder_into_member_v2` now accepts `p_actor_role='captain_approve'`.
- Integration: deleting a team cascades/restricts its requests per the teams policy.

**Verification:** Migration applies on top of current schema; guards reject the
race/dup at the DB layer; types regenerate.

- [ ] **Unit 2: `get_team_join_view(token)` RPC + read hook**

**Goal:** Resolve a token to team + spots, readable pre-auth, names only.

**Requirements:** R1, R3.

**Dependencies:** Unit 1.

**Files:** Create `supabase/migrations/<ts>_get_team_join_view.sql`,
`src/api/queries/teamJoin.ts`, `src/api/hooks/useTeamJoinView.ts`; Test
`src/__tests__/database/get-team-join-view.test.ts`, `src/api/hooks/useTeamJoinView.test.ts`.

**Approach:** SECURITY DEFINER, **column-projected to names only** (no contact
info — RLS is off, so the RPC itself is the boundary). Returns `{ team_name,
league_name, spots:[{member_id, display_name, is_open}] }` + whether the
authenticated caller already has a pending/approved request here.

**Test scenarios:**
- Happy: valid token → team + open placeholders flagged `is_open`, taken ones not.
- Edge: unknown token → no team (invalid-link state); full roster → all taken.
- Edge: a caller with a pending request gets that flag (drives the "waiting" state).
- Security: response contains no email/phone columns.

**Verification:** A real token lists the roster with correct open/taken flags and
no contact info.

### Phase 2 — Join + approve (the core)

- [ ] **Unit 3: The join page + register-first submit + notify-on-approval**

**Goal:** `/join/:token`: tap → sign in → existing profile form → submit request →
"waiting"; and the joiner learns when they're approved.

**Requirements:** R2, R3, R10, R8 (landing handoff).

**Dependencies:** Unit 2; passwordless (PR #159 branch).

**Files:** Create `src/onboarding/TeamJoinPage.tsx`, `src/api/mutations/teamJoin.ts`
(`submitJoinRequest`), `src/api/hooks/useSubmitJoinRequest.ts`; Modify
`src/navigation/NavRoutes.tsx` (public `/join/:token`), the profile-form step to be
reachable in this flow, `PendingInvitesModal`/`usePendingInvites` (or a sibling) to
also surface "you're approved — go to your team"; Test
`src/onboarding/TeamJoinPage.test.tsx`, `src/api/hooks/useSubmitJoinRequest.test.ts`.

**Approach:**
- Not signed in → passwordless sign-in; persist the pending-join intent server-side
  keyed to identity so a cross-device/closed-tab return still recovers it (R10).
- Signed in, no member yet → the **existing short profile form** (name + nickname
  etc.); on completion they are a registered member.
- Submit a `team_join_request` (claim → `claimed_member_id`; self-add → none). Show
  "waiting for the captain."
- **Notify on approval:** reuse the `get_my_pending_invites`/`PendingInvitesModal`
  pull so a returning/closed-tab joiner is told they're in and routed to their team.
- Existing-state guards: already a confirmed member of this team → "you're already
  on this team"; existing pending request → show "waiting" immediately; full team →
  "this team's roster is full — contact the captain"; rejected → a clear "not added —
  ask your captain" state (not a silent dead-end).

**Execution note:** Stacks on `feat/passwordless-sign-in` (PR #159, unmerged).

**Test scenarios:**
- Happy: signed-out tap → sign-in → profile form → submit → "waiting"; request row
  created with the team.
- Happy: signed-in member with no prior request → submit → "waiting."
- Edge: unauthenticated → routed to sign-in and returned to the join (intent
  preserved across the round-trip).
- Edge: already on this team → "already on this team"; existing pending → "waiting"
  on load (no duplicate submit); full roster → "full" state.
- Error: rejected request → actionable "not added" state.
- Integration: on approval, the pull surfaces "you're in" and routes to the team.

**Verification:** A signed-out person completes tap → code → name → "waiting," and
learns when approved — even if they closed the tab.

- [ ] **Unit 4: `approve-join-request` engine (Add / Replace / Decline)**

**Goal:** The approver's one-tap decision, authz-gated, race-safe.

**Requirements:** R4, R5, R6.

**Dependencies:** Unit 1.

**Files:** Create `supabase/functions/approve-join-request/index.ts`,
`src/api/mutations/teamJoin.ts` (`approveJoinRequest`, `rejectJoinRequest`),
`src/api/hooks/useApproveJoinRequest.ts`; Test
`src/__tests__/database/approve-join-request.test.ts`.

**Approach:**
- **Server-side resolution + authz:** read `team_id` from the request row (not the
  caller); resolve `org_id` via team→season→league; authorize caller = team
  `captain_id` **or** org staff; 403 otherwise. If `captain_id IS NULL`, org-staff
  only.
- **Race:** re-read the request `FOR UPDATE`; if not `pending`, return a friendly
  "already handled" (don't let the merge RPC's raw error be the race signal).
- **Add:** insert the joiner's registered member into `team_players` (no merge).
- **Replace:** `merge_placeholder_into_member_v2(placeholder=chosen, target=joiner's
  member, actor=approver, role='captain_approve', org)`. Org-scoped.
- **Decline:** flip to `rejected`; no roster change.
- New edge function → full `db:stop && db:start` locally.

**Execution note:** Start with a failing db-project test for the captain/LO authz
gate before the Add/Replace logic.

**Patterns to follow:** `supabase/functions/claim-placeholder/index.ts` (JWT gate,
service-role client, server-side org resolution, the merge RPC call).

**Test scenarios:**
- Happy (Add): approving a self-add inserts the registered member into the roster;
  request `approved`; no merge.
- Happy (Replace): approving with a chosen placeholder merges it into the joiner's
  member (spot + record transfer); request `approved`.
- Error (authz): non-captain / non-org-staff → 403, no mutation; null captain → org
  staff still works, others 403.
- Edge (race): two pending requests, approve both → second returns "already handled,"
  not a 500.
- Edge (org-scope): cannot Replace with a placeholder outside the team's org.
- Decline: flips to `rejected`; roster unchanged.

**Verification:** Approver puts the person on the roster (Add or Replace);
non-approvers refused; double-approve is graceful; no duplicate members.

- [ ] **Unit 5: The approve surface (one component, two scopes)**

**Goal:** The request list + Add/Replace/Decline + the record-flagged placeholder
picker; captain sees his team, LO sees all org teams.

**Requirements:** R5, R6.

**Dependencies:** Unit 2, Unit 4.

**Files:** Create `src/onboarding/components/JoinRequestList.tsx` +
`PlaceholderPicker.tsx`; `src/api/hooks/useTeamJoinRequests.ts`; Modify
`src/player/MyTeams.tsx` (captain: mount for his team) + an LO all-teams surface
(operator view); Test `src/onboarding/components/JoinRequestList.test.tsx`,
`PlaceholderPicker.test.tsx`.

**Approach:**
- Each row: **person name + team + league** + **[Add] / [Replace ▾] / [Decline]**.
- **Replace** opens `PlaceholderPicker` — the team's unclaimed placeholders, each
  flagged via `placeholder_has_stats` (e.g. "Jon Smyth · 3 games"); the name-match
  (if any) pre-highlighted as a shortcut; available **whenever placeholders exist**,
  match or not (protects the misspelled record).
- Soft guardrail: tapping **Add** while unclaimed placeholders exist → a one-line
  "still have open spots — is this one of them?" nudge (non-blocking).
- Scope by data: captain query filters to his team(s); LO query spans org teams. Same
  component.

**Test scenarios:**
- Happy: a team with pending requests shows them with Add/Replace/Decline; non-approver
  sees no controls.
- Happy: Replace → picker lists unclaimed placeholders with record flags; choosing
  one calls approve-as-Replace; the row leaves "waiting."
- Edge: no placeholders → no Replace option (Add only); a name match is pre-highlighted.
- Edge (LO): the LO surface shows requests across all org teams, each labeled with its
  team + league.
- Integration: approving updates the roster without manual refresh.

**Verification:** Approver sees a recognizable name + team, can Add or hand-link to a
record-flagged placeholder; LO sees all teams in one place.

### Phase 3 — Surface, distribute, land

- [ ] **Unit 6: The doorbell**

**Goal:** Pending-request counts where the approver is, cleared when handled.

**Requirements:** R7.

**Dependencies:** Unit 1.

**Files:** Create `src/api/hooks/usePendingJoinRequestCount.ts`; Modify
`src/player/MyTeams.tsx` (home card), `src/components/layout/{AppDrawer,AppSidebar}.tsx`,
`src/components/layout/BottomTabBar.tsx`, + the LO surface; Test
`src/api/hooks/usePendingJoinRequestCount.test.ts`.

**Approach:** One hook summing pending requests for the caller's scope —
captain: requests on teams where they're `captain_id`; LO: across org teams (and an
org-staff variant, so staff approvers see it too). Joins `team_join_requests → teams`
(tolerate null `captain_id`). Renders only when count > 0; clears when handled.

**Test scenarios:**
- Happy: count > 0 → home card + menu "(N)" + bottom-bar badge; 0 → none render.
- Edge: a non-captain/non-staff never sees it; org staff with pending requests do.
- Integration: handling the last request clears all surfaces.

**Verification:** An approver with pending requests sees the doorbell where they are;
it disappears when the queue empties.

- [ ] **Unit 7: Distribution — share link + LO captain list + first-run wizard**

**Goal:** Make sharing the *right* link effortless for both captain and LO.

**Requirements:** R1, R9.

**Dependencies:** Unit 1 (the token).

**Files:** Create `src/onboarding/InviteMyTeamButton.tsx` (captain),
`src/onboarding/OnboardCaptainsList.tsx` (LO), `src/wizards/captain-onboarding-v2/`
(thin 3-card wizard); Modify `src/player/MyTeams.tsx` + the LO surface; Test
`src/onboarding/OnboardCaptainsList.test.tsx`, `captain-onboarding-v2/*.test.tsx`.

**Approach:**
- Captain: **"Invite my team"** → `ShareLinkSection` with the `/join/:token` URL +
  QR.
- LO: **"Onboard my captains"** = one row per team — **Team · assigned captain ·
  [Send/Copy link]** — pre-paired (the captain placeholder was set at team creation).
  A captain on multiple teams shows on multiple rows (or grouped "Send all"); the
  LO-as-own-captain row needs no send. If a captain's phone/email is on file, pre-fill
  the message; else copy-paste.
- Wizard (captain): 3 cards (get/copy your link → share it → approve people as they
  appear → points at the approve surface). Plain `useState`, < 100-line files,
  `queryKeys.members.all`. A seen-flag on `members` (cross-device, not localStorage).

**Test scenarios:**
- Happy: "Invite my team" shows the team's `/join/:token` link + QR.
- Happy (LO): the list shows each team with its assigned captain pre-paired to that
  team's link; a multi-team captain appears per team.
- Happy: completing/dismissing the wizard sets the `members` seen-flag (no reappear).
- Edge: non-captain sees no captain wizard.

**Verification:** A captain shares one link in two taps; an LO sends each captain the
correct team link by scrolling a pre-paired list.

- [ ] **Unit 8: Land on tonight's match (reuse, don't rebuild)**

**Goal:** A freshly-approved joiner lands on their team with tonight's match.

**Requirements:** R8.

**Dependencies:** Unit 4.

**Files:** Modify `src/player/MyTeams.tsx` (ensure the post-approval landing surfaces
the existing match card prominently); Test `src/player/MyTeams.tonightsmatch.test.tsx`.

**Approach:** **Reuse `useNextMatchForTeam` + the existing `MyTeams` "Quick Score"
card** (today/in_progress → `/match/:id/lineup`). Do **not** add a parallel
`useTonightsMatch` hook or build `MyMatch`. Handle the true cold-start case where the
schedule isn't generated yet (no matches) → land on the team page (roster/triage),
no error, no empty "tonight" card.

**Test scenarios:**
- Happy: a team with a match today/in_progress surfaces the existing Quick Score CTA.
- Edge: no schedule yet (brand-new league) → land on the team page, no error.
- Edge: player on multiple teams → each team's match shown.

**Verification:** An approved joiner lands on their team; if a match exists it's
one tap to scoring; if not, a clean team page (no broken "tonight" UI).

## System-Wide Impact

- **Interaction graph:** approve mutates `team_players` + resolves the request +
  (Replace only) runs the merge; doorbell, approve surface, and join view all read
  `team_join_requests` — invalidate together.
- **State lifecycle:** the two partial unique indexes make the dup/race a clean DB
  reject; the `FOR UPDATE` re-check makes double-approve graceful.
- **Security invariants:** the per-placeholder `userEmail===inviteEmail` 403 (email
  flow) is **unchanged**; the forwardable-link path is gated by approval +
  `approve-join-request` server-side authz; `get_team_join_view` exposes names only;
  Replace is org-scoped.
- **Unchanged invariants:** existing email/QR/device-handoff + manual placeholders +
  `invite_tokens` trigger. Additive.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Brand-new joiner has no account → merge can't run | Register-first: they're a member before approve; Add needs no merge, Replace merges into the real member. |
| Forwardable link → wrong person claims a named spot | Approval gate + recognizable **name** in the list; approver authz server-side. |
| Claim/approve race or request spam | Two partial unique indexes (per-spot, per-user) + `FOR UPDATE` re-check. |
| Misspelled placeholder strands its record | Replace always available with a manual, record-flagged picker (auto-match is just a shortcut). |
| Joiner never learns they're approved | Reuse `get_my_pending_invites`/`PendingInvitesModal` pull to notify + route. |
| Cross-device / closed-tab sign-in loses intent | Server-side identity-keyed pending-join (R10); the request row is durable post-submit. |
| Returning *registered* player dedup | Out of scope (needs user-to-user merge); they use Add and keep their own account. |
| `send-invite` authz hole | Out of scope; flagged for its own fix; don't widen. |
| Roster names exposed via the token | Accepted per design (shared within team); names only; revisit token rotation if leaks become real. |
| Can't test links cross-device locally | Verify on staging (like Facebook OAuth). |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` for new files (route, pages, hooks, edge function,
  migrations, wizard).
- Staging: the full link/QR/cross-device + join flow must be verified on staging.
- The origin brainstorm references two docs that don't exist
  (`2026-05-17-bca-pitch-strategy.md`, a `futureFeatures.md` affiliation section) —
  harmless; correct when convenient.

## Sources & References

- **Origin:** `docs/brainstorms/2026-05-28-player-onboarding-cold-start-requirements.md`
- Companion (build-first): `docs/plans/2026-05-28-001-feat-passwordless-sign-in-plan.md` (PR #159)
- Prior art: `memory-bank/PLAN-email-invites.md`, `docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md`
- Reuse: `merge_placeholder_into_member_v2`, `supabase/functions/claim-placeholder/`,
  `src/player/MyTeams.tsx`, `useNextMatchForTeam`, `src/components/invite/ShareLinkSection.tsx`,
  `src/components/modals/PendingInvitesModal.tsx`, `src/components/wizard/`
