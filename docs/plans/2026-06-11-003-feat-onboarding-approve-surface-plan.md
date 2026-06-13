---
title: "feat: LO/captain shared onboarding approve surface at scale"
type: feat
status: active
date: 2026-06-11
deepened: 2026-06-11
origin: docs/brainstorms/2026-06-11-lo-onboarding-approve-surface-requirements.md
---

# feat: LO/captain shared onboarding approve surface at scale

**Base branch:** #212 has since **merged into `main`** (v1.3.0) — its groundwork (the
join-request feed's `league_id`, the always-visible list, the rewritten
`JoinRequestList`/`JoinRequestCard`) is now live in `main`, so this branches straight off
`main` (no stacking needed). The doorbell-routing slice (Unit 3) shipped **separately as
PR #218** so it could merge first and unblock the LO from reaching the list.

**Status:** Unit 1 (data) + Unit 2 (card) built on `feat/lo-onboarding-approve-surface`;
Unit 3 (doorbell) shipped as PR #218.

## Overview

Make the **one shared** join-request approve surface (used by captains *and* the LO,
scoped by the server feed) **informative enough to answer the door at scale.** Today
each request card shows only the requester's name, the team·league, and a bare list of
placeholder names. An LO (or a captain overseeing several teams) answering the door for
*dozens* of teams can't tell which team's captain is still unregistered, who's already on
the roster, or which placeholder this person actually fills — and the easy "just add them"
silently creates a duplicate when a placeholder (often the captain) should have been
connected.

This plan enriches that surface — per request: the **team** (+ league/season), the
**captain** (and whether the captain spot is still a placeholder), and the team's **full
roster** (registered members as recognition context + placeholder spots as the tap-to-
connect replacement targets, captain flagged) — keeps the collapsed list scannable
(summary-first, detail on expand), guards the duplicate-add footgun, and routes the LO's
doorbell to their operator surface.

## Problem Frame

The LO is the catch-all onboarder: a captain can't accept their own join request (they
must already be the registered captain to hear the doorbell, and `teams.captain_id`
points at the placeholder until the merge), so the LO breaks the loop for every team.
At scale, the current thin card isn't enough to do that confidently — and right now the
LO can't even reach the list, which is what makes this blocking. (see origin:
docs/brainstorms/2026-06-11-lo-onboarding-approve-surface-requirements.md)

The **visibility** half is already built (PR #212 makes the list always-visible on the
Operator Dashboard + each League page). This plan adds the **information + safety +
reachability** half on top of the same shared components.

## Requirements Trace

- **R0.** One shared surface for captain + LO (scoped by the existing server feed) —
  extend the shared components, don't fork.
- **R1.** Each request shows its team context: the **team** (+ league/season), the
  **captain** + whether the captain spot is still a placeholder, and the **full roster** —
  registered members (recognition context) + placeholder spots (replacement targets),
  clearly distinguished.
- **R2.** Make the captain case obvious (flag the captain placeholder prominently).
- **R3.** Scannable at scale — summary-first card, detail on expand.
- **R4.** Guard the footgun — "just add as new" must not silently create a duplicate when
  an open placeholder (especially the captain) should be connected; connect is the guided
  default, plain-add a deliberate secondary action.
- **R5.** Doorbell routes the LO to their operator surface (not the player page) — this is
  what currently leaves the LO unable to reach the list at all.
- **R6.** Connect (merge into a placeholder) and drop (land as new) both stay supported.

## Scope Boundaries

- **Not** changing registration (universal self-service).
- **Not** removing the captain self-serve cascade — it stays the additive helper; the
  LO still sees and overrides everything.
- **Not** redoing PR #212's visibility work (build on it).

### Deferred to Separate Tasks

- **Group-by-team list layout** — the list stays a flat, newest-first stack for now
  (each card names its team). Revisit grouping only after the LO can actually use the
  surface and a real list demonstrably feels cluttered (e.g., many people joining one
  team at once). The user hasn't been able to see the live list yet, so a layout decision
  now would be blind.
- **LO-initiated invites** (LO picks a person → invites them *for a chosen team*) and a
  first-class **LO direct roster-management** surface — `TeamManagement`/`TeamEditorModal`
  partly cover this already; it's the next thread, not this plan.

## Context & Research

### Relevant Code and Patterns

- `src/onboarding/components/JoinRequestList.tsx` — the shared list (on `OperatorDashboard`
  + `MyTeams`; #212 made it always-visible + league-filterable). Stays a flat list here.
- `src/onboarding/components/JoinRequestCard.tsx` — the per-request "is this one of your
  players?" card. Currently: requester name + team·league + a bare placeholder-name list
  (`useTeamPlaceholders`) + "just add them" + decline, with a tap-to-confirm merge.
  This is the component to enrich (summary-first + roster + footgun guard).
- `src/api/queries/teamJoin.ts` — `ApproverJoinRequest` (the feed row; gained `league_id`
  in #212) + `ClaimablePlaceholder` + the RPC wrappers.
- Feed RPC `get_join_requests_for_approver` (migration `20260529000005`, re-created with
  `league_id` in #212's `20260611120000`) — authorized "captain OR org staff". Add the
  captain summary flag here.
- Placeholder RPC `get_team_placeholders_for_claim` (migration `20260529000006`) — returns
  a team's unclaimed placeholders + `has_stats`; its captain-OR-org-staff authorization
  gate is the exact pattern the new roster RPC mirrors.
- `approve_join_request` (migration `20260529000004`) — `action 'add'|'replace'|'decline'`
  (+ `claimedMemberId` for `replace`); `replace` merges via
  `merge_placeholder_into_member_v2`, which rewrites `teams.captain_id` (promotes the
  connected member to captain). **Unchanged by this plan** — only how the UI *calls* it.
- Doorbell: `src/api/hooks/usePendingJoinRequestCount.ts` (returns the shared feed's
  length) drives "Join requests (N)" in `src/components/layout/AppDrawer.tsx` +
  `src/components/layout/AppSidebar.tsx`, both linking to `/my-teams`. The drawer already
  computes operator status (`canAccessLeagueOperatorFeatures()` + `useOrganizations`) —
  but only passes it to its operator section, not the player section that renders the
  doorbell (see Unit 3).

### Domain Invariants (confirmed with the user)

- **Every team always has a captain** — a team is created *by* putting someone in the
  captain spot; captainless teams don't exist. The captain may be a **placeholder** (real
  name, not yet registered) or a registered member. So `teams.captain_id` is effectively
  always populated; the only variable is `captain_is_placeholder`. No null-captain
  handling is needed.
- **Placeholders carry real names**, not generic labels — they hold a real person's spot
  until that person registers. `member_display_name` returns the real name.

### Institutional Learnings

- `docs/solutions/` has no onboarding entries.
- Project memory: RLS off (respect the existing captain-OR-org-staff RPC authorization);
  DB tests under `src/__tests__/database/` (jsdom, sequential); dev data disposable;
  shadcn/ui; migrations full-timestamped.

### External References

- None — entirely local onboarding-cascade patterns.

## Key Technical Decisions

- **Stack on #212, not main.** This work depends on #212's feed `league_id` + rewritten
  components; building off `main` would be against stale files. (Best practice for work
  that depends on an unmerged PR — branch off that PR's branch.)
- **Enrich at two altitudes — captain summary in the feed, full roster on expand.** Add a
  per-request **captain summary** to `get_join_requests_for_approver` (the captain's real
  name + `captain_is_placeholder`), so the captain-spot-open signal shows *without*
  expanding (cheap; the feed already loads). Fetch the **full roster** only when a card is
  expanded (a new per-team RPC), so the collapsed list stays light at scale.
- **New `get_team_roster_for_approver(team_id)` RPC** (rather than overloading the
  placeholders-only claim picker): returns *every* roster member with markers —
  `is_captain`, `is_registered` (`user_id` not null), `has_stats`, and `claimable` (an
  unclaimed placeholder). This is deliberate: R1 requires showing the **registered**
  members too (recognition context), which the placeholders-only RPC can't do. Same
  captain-OR-org-staff authorization as `get_team_placeholders_for_claim`, raising/denying
  to unauthorized callers exactly as the sibling does (no roster/PII leak).
- **Summary-first, inline-expand card; flat list.** Each request shows a one-line summary
  (requester + team + league/season + a captain-status chip when the captain is still a
  placeholder); expanding reveals the full roster + connect/drop actions. The list stays a
  flat, newest-first stack (grouping deferred — see Scope Boundaries).
- **Footgun guard.** When the team has open placeholders (especially the captain), the
  "just add as new" action becomes a **deliberate, confirmed** secondary action
  ("{name} won't replace any of your placeholders — add as a brand-new player?"), with
  connecting-to-a-placeholder the primary path. **The guard never silently downgrades:** if
  the roster fetch errors while the feed says placeholders are open, "just add" stays in
  its guarded/confirmed state (or offers retry) — a network blip must not re-open the
  footgun.
- **Doorbell routing by role.** If the user is an operator, the "Join requests (N)" badge
  links to their operator surface (their org's Operator Dashboard); otherwise `/my-teams`.
  Pure visibility/navigation — no feed change.
- **No change to `approve_join_request` / the merge.** The consequential captain-promotion
  path stays exactly as-is, gated behind the existing authorized approve call; this plan
  only changes what the UI shows and which action it steers toward.

## Open Questions

### Resolved During Planning

- *Roster detail — full roster or just open spots?* — **Full roster** (registered context
  + placeholder targets), per R1 and the user's direction.
- *List layout at scale?* — **Flat, newest-first** for now; grouping deferred until the
  surface is usable and a real need is observed (user hasn't seen the live list yet).
- *Captainless teams / null captain?* — **Impossible** by domain rule; no null-captain
  handling. Only `captain_is_placeholder` matters.
- *Enrich the feed vs fetch per-card?* — Both: tiny captain summary in the feed; full
  roster on expand via the new RPC.
- *Does the nav know operator status for routing?* — Yes, but only in the parent; Unit 3
  threads it to the doorbell.

### Deferred to Implementation

- Multi-org operator doorbell target — pick a concrete fallback when wiring Unit 3
  (route to `organizations[0]`'s dashboard for a single staffed org; for 2+ orgs send to
  `/dashboard` rather than guessing a "primary").
- Exact summary-row vs expanded-row content split — settle against the live card.

## High-Level Technical Design

> *Illustrates the intended approach; directional guidance for review, not implementation
> specification.* (Legend: "PP" = placeholder — a real person holding a spot, not yet
> registered.)

```
JoinRequestList (shared; captain sees their team(s), LO sees all — server-scoped)
  └─ flat list, newest first
       JoinRequestCard  [collapsed summary row]
         "Jordan accepted the invite"  ·  The Break Room · League X · Tue 8-ball
         👑 captain spot still open            ← chip only when captain_is_placeholder
            └─ (expand) full roster:
                 👑 John     — placeholder · tap to connect (captain spot)
                    Sam      — placeholder · tap to connect
                    Alex     — registered (context, not tappable)
                 [ Just add Jordan as new ]  ← secondary; confirmed when placeholders open
                 [ Decline ]

Doorbell "Join requests (N)"  →  operator? operator-dashboard/:orgId : /my-teams
```

## Implementation Units

- [x] **Unit 1: Enrich the data — captain summary in the feed + a roster RPC**

**Goal:** Give the surface its information: a per-request captain summary in the feed, and
a full per-team roster (with markers) fetched on demand.

**Requirements:** R1, R2

**Dependencies:** PR #212 (unmerged — this branch is stacked on it)

**Files:**
- Create: `supabase/migrations/<full-timestamp>_approve_surface_roster.sql`
  (re-create `get_join_requests_for_approver` — based on **#212's** `20260611120000` body
  so `league_id` is preserved — adding `captain_name` + `captain_is_placeholder`; add
  `get_team_roster_for_approver(p_team_id)`)
- Modify: `src/api/queries/teamJoin.ts` (`ApproverJoinRequest` gains the captain fields;
  add a `TeamRosterMember` type + a `getTeamRosterForApprover` wrapper)
- Create: `src/api/hooks/useTeamRosterForApprover.ts`
- Test: `src/__tests__/database/approveSurfaceRoster.db.test.ts`
  *(first line `// @vitest-environment jsdom`)*

**Approach:**
- Feed: extend #212's function body — add `captain_name` (`member_display_name(t.captain_id)`,
  always a real name since every team has a captain) + `captain_is_placeholder` (the
  captain's `members.user_id IS NULL`). Keep `league_id` and the existing
  captain-OR-org-staff authorization verbatim.
- Roster RPC: for `p_team_id`, return each `team_players` member → `member_id`,
  `display_name`, `is_captain`, `is_registered` (`user_id` not null), `has_stats`
  (`placeholder_has_stats`), `claimable` (placeholder = `user_id` null). Authorize
  captain-OR-org-staff against the team's org, **raising/denying to unauthorized callers
  exactly as `get_team_placeholders_for_claim` does** (no empty-result leak).

**Execution note:** DB integration test first — the authorization + the marker flags are
the load-bearing contract the UI builds on.

**Patterns to follow:** `get_team_placeholders_for_claim` (migration `20260529000006`)
for the authz gate + jsonb shape; #212's `20260611120000` for the feed body to extend.

**Test scenarios:**
- Integration (feed): a request for a team whose captain is an unregistered placeholder →
  the row has `captain_name` (real name) + `captain_is_placeholder = true`; for a
  registered captain → `captain_name` set + `false`.
- Integration (roster): a captain-PP + a player-PP + a registered member team → roster
  returns 3 rows with correct `is_captain` / `is_registered` / `claimable` flags; the
  captain row has `is_captain = true` and `claimable = true` (still a placeholder).
- Integration (authz): a non-staff, non-captain caller → the roster RPC raises/denies,
  matching `get_team_placeholders_for_claim`'s exact behavior (not a silent empty array).
- Edge: a fully-registered team → roster returns rows with no `claimable` placeholders.

**Verification:** DB suite passes; the feed carries captain status; the roster RPC returns
marked rows only to authorized callers and denies others like its sibling.

---

- [x] **Unit 2: Informative, footgun-guarded request card**

**Goal:** Make `JoinRequestCard` summary-first and informative — team + league/season +
captain-status chip up top, full roster on expand with placeholders as connect targets and
the captain flagged — with connect-to-placeholder primary and a guarded "just add".

**Requirements:** R1, R2, R3, R4, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `src/onboarding/components/JoinRequestCard.tsx`
- Test: `src/onboarding/components/JoinRequestCard.test.tsx`

**Approach:**
- Collapsed summary row: requester + team + league/season + a **captain-status chip** when
  `captain_is_placeholder` ("captain spot still open"). Tap to expand.
- Expanded: the full roster (Unit 1's RPC via the new hook) — placeholders are tappable
  connect targets (the captain placeholder flagged + surfaced first); registered members
  render as non-tappable recognition context.
- Keep the existing tap-to-confirm merge (`replace` + `claimedMemberId`), including the
  has-stats vs no-stats confirm copy.
- **Footgun guard:** when `claimable` placeholders exist, "Just add as new" is a secondary
  button that opens a confirm spelling out the consequence before firing `action='add'`.
  With no open placeholders, it stays a simple single "Add to the team". **If the roster
  fetch errors while the feed indicates open placeholders, keep the guarded state (or show
  a retry) — never fall back to the bare single-add.**

**Patterns to follow:** the existing `JoinRequestCard` confirm/`AlertDialog` pattern; the
existing placeholder-marking treatment used elsewhere in onboarding (mark placeholders
distinctly from registered members rather than inventing new visual language).

**Test scenarios:**
- Happy: team with a captain PP + a player PP → collapsed card shows the "captain spot
  open" chip; expand lists both placeholders (captain flagged + first) + the registered
  member as non-tappable context; tapping the captain PP → confirm →
  `onApprove(req,'replace',captainId)`.
- Edge: no open placeholders → single "Add to the team", no roster section, no guard.
- Error path (guard): open placeholders present → tapping "Just add as new" opens the
  confirm; confirming fires `action='add'`; cancelling fires nothing.
- Error path (fetch fail): `captain_is_placeholder`/open-placeholders true but the roster
  fetch errors → "just add" stays guarded (or shows retry), never the bare single-add.
- Edge: registered roster members are shown but not tappable (no `onApprove`).

**Verification:** card test passes; the captain case is obvious from the collapsed row; a
duplicate-add can't happen without a deliberate confirm when placeholders are (or might be)
open.

---

- [x] **Unit 3: Doorbell routes the LO to their operator surface** — shipped as PR #218.

**Goal:** The "Join requests (N)" badge takes an operator to their operator surface instead
of the player page — the fix that currently leaves the LO unable to reach the list.

**Requirements:** R5

**Dependencies:** None (independent; can land first)

**Files:**
- Modify: `src/components/layout/AppDrawer.tsx`, `src/components/layout/AppSidebar.tsx`
- Test: `src/components/layout/AppDrawer.test.tsx` (extend the existing doorbell tests)

**Approach:**
- Compute the doorbell target from role: operator → their org's Operator Dashboard
  (`operator-dashboard/:orgId`); otherwise `/my-teams`. The operator flag + `organizations`
  are computed in the parent but currently only passed to the operator section — **thread
  them (or the resolved target) into the player section that renders the doorbell.** Count
  source (`usePendingJoinRequestCount`) unchanged.
- Multi-org: single staffed org → that org's dashboard; 2+ orgs → `/dashboard` (don't guess
  a "primary").

**Patterns to follow:** the existing `isOperator` / `useOrganizations` usage already in
`AppDrawer`/`AppSidebar`; the existing doorbell test cases; how `OperatorSection` already
receives `organizations`.

**Test scenarios:**
- Happy: operator with one org + N pending → "Join requests (N)" links to that org's
  operator dashboard.
- Happy: non-operator (pure captain) with N pending → link points at `/my-teams`.
- Edge: operator staffing 2+ orgs → link points at `/dashboard`.
- Edge: zero pending → no badge (unchanged behavior).

**Verification:** drawer/sidebar tests pass; operators reach their operator surface from
the doorbell (closing the "can't even see the list" gap).

## System-Wide Impact

- **Interaction graph:** two RPC reads (enriched feed + new roster) and UI in the shared
  `JoinRequestList`/`JoinRequestCard` (captain + LO) and the nav doorbell.
  `approve_join_request` + the merge are unchanged.
- **Error propagation:** roster RPC denies non-captain/non-staff (mirrors siblings); on a
  *fetch* error with open placeholders, the card keeps the footgun guard rather than
  degrading to bare add (Unit 2).
- **State lifecycle risks:** the footgun guard is the key safety — it prevents a silent
  duplicate-add (and a silently-unpromoted captain) when a placeholder should be connected.
  No new write paths.
- **API surface parity:** captain and LO use the **same** components + feed (server-scoped);
  the only role-specific branch is the doorbell target (Unit 3).
- **Integration coverage:** "feed carries captain status" and "roster returns marked rows
  only to authorized callers, denying others" are DB-level contracts (Unit 1).
- **Unchanged invariants:** `approve_join_request`, `merge_placeholder_into_member_v2`,
  the captain-OR-org-staff authorization, registration, and the captain self-serve cascade
  are all unchanged; this is additive (information + safety + reachability).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Hard dependency on **unmerged PR #212** (feed `league_id` + rewritten components) | Branch off `fix/operator-join-requests-visible`, not `main`. Mark Unit 1's dependency accordingly. If #212 merges first, rebase onto `main` |
| Re-creating `get_join_requests_for_approver` could drop #212's `league_id` | Base the new migration on #212's `20260611120000` body and only *add* the two captain fields — explicit in Unit 1, not just here |
| Roster fetch per expanded card adds reads at scale | Fetch only on expand (collapsed cards don't fetch); cache per team via the query hook |
| Footgun guard silently disabled by a roster fetch error | Unit 2 keeps the guarded state on fetch error when the feed signals open placeholders |
| Doorbell needs operator flag threaded into the player section | Unit 3 explicitly threads it (or the resolved target); covered by the multi-org edge test |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` for `src/api/hooks/useTeamRosterForApprover.ts` and the
  new migration.
- Migrations: additive (a re-created function + a new function); full-timestamped. Update
  `supabase/schema_dump.sql` if tracked.

## Sources & References

- **Origin document:** docs/brainstorms/2026-06-11-lo-onboarding-approve-surface-requirements.md
- Related code: `src/onboarding/components/JoinRequestList.tsx`,
  `src/onboarding/components/JoinRequestCard.tsx`, `src/api/queries/teamJoin.ts`,
  `src/api/hooks/usePendingJoinRequestCount.ts`, `src/components/layout/AppDrawer.tsx`,
  `src/components/layout/AppSidebar.tsx`
- Migrations: `20260529000004/5/6`, #212's `20260611120000` (the cascade + #212 RPCs)
- Related PRs: **#212** (visibility — hard dependency / base branch)
