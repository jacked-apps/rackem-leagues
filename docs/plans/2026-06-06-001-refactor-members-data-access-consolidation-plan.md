---
title: "refactor: Members data-access consolidation + PlayerNameLink prop cleanup (slice 1)"
type: refactor
status: active
date: 2026-06-06
---

# refactor: Members data-access consolidation + PlayerNameLink prop cleanup (slice 1)

## Overview

This is **slice 1** of a larger per-entity data-access consolidation (LIST_FOR_ED
items #1 and #2). It consolidates the **Members** entity's reads and writes onto
the canonical patterns that already exist, and cleans up the **PlayerNameLink**
prop interface. Matches is slice 2 (separate PR, out of scope). The already-clean
entities (teams/leagues/seasons/venues/orgs) are deliberately not touched.

The headline, confirmed by reading the actual source: **the foundation already
exists.** `src/types/member.ts` has a full `Member` interface; `src/api/queryKeys.ts`
already supports per-id caching (`queryKeys.members.detail(id)`); and the
member-by-id / member-by-user fetches already use `.select('*')` and return the
full record. This slice is "remove the duplication that drifted in," not "build a
new layer." It is intentionally behavior-preserving.

## Problem Frame

Over time the Members data layer accreted near-duplicate fetch functions (the same
table read several ways) and field-specific mutations (a separate function per
column changed). The cost: adding a field means touching several places, callers
issue an extra query when they need a field the narrow fetch omitted, and the
cache fragments. `PlayerNameLink` is the poster child for the prop half of the
problem — it takes a `playerName` string **and** fetches the full member record
internally, while carrying three dead callback props.

This slice also intentionally **precedes the RLS pass**. Members is the most
security-sensitive (auth-adjacent) table, so shrinking its read/write surface
first makes the upcoming RLS work smaller and easier to debug (fewer query
surfaces that can silently return zero rows under a policy).

### What the source actually shows (corrects the LIST_FOR_ED #1/#2 assumptions)

Reading `src/api/queries/members.ts`, `src/api/mutations/members.ts`, and
`src/components/PlayerNameLink.tsx` directly changed several premises:

- The full-record fetches **already** use `.select('*')`: `getCurrentMember`,
  `getMemberProfile`, `getMemberById`, `getMembersByIds`. The "9 distinct select
  lists" framing overstated it — most member-row fetches are already full-record.
- `getCurrentMember(userId)` and `getMemberProfile(userId)` are **byte-identical**
  (`select('*').eq('user_id', userId).single()`). A true duplicate.
- The genuinely narrow row-fetch is `getMemberProfanitySettings`
  (`profanity_filter_enabled, date_of_birth`) — the one to fold into the full record.
- `getOperatorId`, `getOperatorIdByUserId`, `isOperator`, `getIsCaptain` are
  **derived scalar/boolean lookups** (via `organization_staff` / `team_players`
  joins), not member-row fetches. They are a different category and are **not** a
  "return the full record" target.
- `PlayerNameLink` already fetches the full member via `useMemberById` (cached
  15 min) and derives display name, placeholder status, email, handicaps, and
  dues from it. So the #1 note's "pass the whole record and remove the internal
  fetch" is **backwards** — most call sites only hold an id (from a join) and
  could not supply a full record. The correct move is the opposite: keep the
  cached internal fetch, and make the redundant `playerName` prop optional.
- The three callback props (`onSendMessage` / `onReportUser` / `onBlockUser`) are
  passed by **no** call site → safe to delete.
- `customActions` **is** used (UnifiedScoreboard passes `swapAction`) → must stay.

## Requirements Trace

- R1. One canonical "fetch a member" path per lookup key, returning the full
  `Member` record, cached by id — no near-duplicate fetch functions.
- R2. Member writes go through one patch-style mutation (`updateMemberProfile`)
  that takes the changed fields; no per-field mutation functions.
- R3. `PlayerNameLink` has a clean prop interface: identity + real context only,
  no dead props, and the duplicated display-name piece is optional.
- R4. Behavior-preserving: no user-visible change, no breaking change to any
  surviving public function or component contract. `tsc` + lint + existing tests
  stay green.
- R5. Independently shippable as one PR; sets up the RLS pass without doing it.

## Scope Boundaries

- No behavior change. This is consolidation only — same data, same UI.
- Derived scalar/boolean lookups (`isOperator`, `getIsCaptain`, `getOperatorId`,
  `getOperatorIdByUserId`) are **kept as-is** — they are not entity fetches.
- No hook renames for aesthetics (`useMemberById` stays `useMemberById`).
- `getAllMembers` (the narrow player-picker list query) is **kept narrow** — list
  payload size is a separate concern from the detail-fetch pain; widening lists is
  a deliberate later decision, not part of this slice.
- No RLS work. Members-first is chosen *because* RLS comes next, but the policies
  themselves are a separate effort.

### Deferred to Separate Tasks

- **Matches data-access consolidation** (the most fragmented entity): slice 2, its
  own PR.
- **Inline-fetch component sweep**: the member-touching raw `.from('members')`
  callers — `src/components/InvitePlayerModal.tsx`,
  `src/components/CreatePlaceholderModal.tsx`,
  `src/components/RegisterPlayerModal.tsx`,
  `src/components/messages/NewMessageModal.tsx`,
  `src/components/AnnouncementModal.tsx` — are left on their raw queries for now;
  converting them to hooks is its own focused pass so this slice stays reviewable.
- **Teams / Leagues / Seasons / Venues / Orgs**: already mostly consolidated; not
  worth touching religiously (YAGNI).

## Context & Research

### Relevant Code and Patterns

- `src/api/queries/members.ts` — 10 member query functions (the consolidation target).
- `src/api/mutations/members.ts` — 8 member mutation functions; `updateMemberProfile`
  is already patch-style (`memberId` + `updates: Partial<...>`) and is the survivor
  pattern to fold the others into.
- `src/api/hooks/useCurrentMember.ts` — contains `useMemberById` (the canonical
  cached detail hook) and the current-user hook.
- `src/api/hooks/useMemberMutations.ts` — wraps the member mutations; invalidation
  pattern to follow when folding mutations.
- `src/api/queryKeys.ts` — `queryKeys.members` already has `all` / `detail(id)` /
  `byUser(userId)` / `current()` / `isCaptain(memberId)`. Reuse, don't add.
- `src/types/member.ts` — full `Member` interface (~48 fields) + `PartialMember` /
  `MemberForMessaging` Pick<> subsets, plus `getPlayerDisplayName` / display helpers.
- `src/components/PlayerNameLink.tsx` — 16 call-site files import it (verified;
  the earlier "38" was an over-count).

### Institutional Learnings

- No `docs/solutions/` entries touch query consolidation, TanStack caching, or
  member fetches (searched). Nearest relevant convention is the project's existing
  patch-mutation style already present in `updateMemberProfile` / `updateTeam` /
  `updateLeague`.

### External References

- None needed. TanStack Query + supabase-js are well-established in this repo with
  many direct local examples; no external research warranted.

## Key Technical Decisions

- **D1 — Consolidate onto the existing canonical fetch, don't build one.**
  `getMemberById` (by `id`) and the by-`user_id` fetch already return full records.
  Keep them; remove duplication around them.
- **D2 — Merge the `getCurrentMember` / `getMemberProfile` duplicate.** Keep one
  canonical "member by auth user id" function (retain `getMemberProfile`, the
  documented one) and repoint the current-user hook + any `getCurrentMember`
  callers to it; delete `getCurrentMember`.
- **D3 — Fold `getMemberProfanitySettings` into the full-record read.** Its two
  callers read `profanity_filter_enabled` / `date_of_birth` off the full `Member`
  (already fetched/cached elsewhere) instead of issuing a 2-field query. Delete the
  narrow function.
- **D4 — Keep derived lookups as-is.** `isOperator`, `getIsCaptain`,
  `getOperatorId`, `getOperatorIdByUserId` answer a question via a join; they are
  not "fetch the member" and stay.
- **D5 — Keep `getAllMembers` narrow.** The player-picker list does not need full
  records; widening it is a separate payload decision.
- **D6 — One patch mutation.** Fold `updateMemberNickname`, `updateProfanityFilter`,
  `updateMemberRole`, and `markProfanityOnboardingComplete` into `updateMemberProfile`;
  repoint their hook wrappers + call sites. Keep `createMember`,
  `createPlaceholderMember`, `deleteMember`.
- **D7 — PlayerNameLink: trim, don't invert.** Keep the cached internal
  `useMemberById` fetch. Make `playerName` **optional** (an instant-display hint to
  avoid a load flash; component already falls back to the fetched record). Remove
  the three dead callback props. Keep `customActions` and the invite-context props
  (`teamId` / `teamName` / `captainName` / `captainMemberId`). Explicitly reject the
  #1 note's "pass whole record / drop the fetch" because most call sites hold only
  an id.

## Open Questions

### Resolved During Planning

- *Pass the whole player record vs keep id + internal hook?* → Keep id + cached
  internal fetch; make `playerName` optional. Most call sites only have an id from
  a join, so forcing a full-record prop would just move the fetch upstream (D7).
- *Are the callback props removable?* → Yes, verified no call site passes them.
- *Are `getCurrentMember` / `getMemberProfile` really redundant?* → Yes, identical
  bodies (D2).

### Deferred to Implementation

- Exact call-site list for the folded mutations (`updateMemberNickname` et al.) —
  discovered by following the hook wrappers and compiler errors at implementation
  time; behavior is unchanged so each is a mechanical repoint.
- Whether any `getCurrentMember` caller relies on a subtly different error/throw
  shape than `getMemberProfile` — confirm at implementation (bodies are identical
  today, so expected to be none).

## Implementation Units

- [ ] **Unit 1: Consolidate member row-fetch queries**

**Goal:** One canonical fetch per lookup key; remove the duplicate and the narrow
profanity fetch.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Modify: `src/api/queries/members.ts` (delete `getCurrentMember`; delete
  `getMemberProfanitySettings`; keep `getMemberProfile` / `getMemberById` /
  `getMembersByIds` as canonical)
- Modify: `src/api/hooks/useCurrentMember.ts` (+ any hook wrapping the removed
  functions) to repoint to the survivors
- Modify: the 2 callers of `getMemberProfanitySettings` to read the fields off the
  full `Member`
- Test: `src/api/queries/__tests__/members.test.ts` (create if absent)

**Approach:**
- Delete `getCurrentMember`; repoint its callers + the current-user hook to
  `getMemberProfile` (identical query). Confirm the query key used stays
  `queryKeys.members.byUser(userId)` / `.current()` so cache behavior is unchanged.
- Delete `getMemberProfanitySettings`; its callers read `profanity_filter_enabled`
  / `date_of_birth` from the full member they already have (or via `useMemberById`).
- Leave derived lookups (`isOperator`, `getIsCaptain`, `getOperatorId`,
  `getOperatorIdByUserId`) and `getAllMembers` / `getMembersByIds` untouched.

**Patterns to follow:**
- `getMemberById` / `getMemberProfile` are the canonical full-record shape.
- `src/api/queryKeys.ts` `members` keys — reuse exactly.

**Test scenarios:**
- Happy path: `getMemberProfile(userId)` returns the full `Member` (all expected
  fields present, not a subset).
- Happy path: `getMemberById(id)` returns the full `Member`.
- Edge case: not-found lookup surfaces the same error/throw as before the merge
  (PGRST116 path unchanged).
- Integration: a component that previously called the profanity settings now reads
  those two fields off the cached full member and renders the same value.

**Verification:**
- `getCurrentMember` and `getMemberProfanitySettings` no longer exist; no remaining
  references. `tsc --noEmit -p tsconfig.app.json` clean; existing tests green.

- [ ] **Unit 2: Fold redundant single-field member mutations into the patch mutation**

**Goal:** Member writes go through `updateMemberProfile` (patch); per-field
mutations removed.

**Requirements:** R2, R4

**Dependencies:** Unit 1 (not strictly required, but lands the query side first)

**Files:**
- Modify: `src/api/mutations/members.ts` (remove `updateMemberNickname`,
  `updateProfanityFilter`, `updateMemberRole`, `markProfanityOnboardingComplete`;
  keep `updateMemberProfile`, `createMember`, `createPlaceholderMember`,
  `deleteMember`)
- Modify: `src/api/hooks/useMemberMutations.ts` (collapse the per-field mutation
  hooks; keep a single profile-update hook + invalidation)
- Modify: call sites of the removed mutations to call the patch hook with the
  changed field(s)
- Test: `src/api/mutations/__tests__/members.test.ts` (create if absent)

**Approach:**
- Each removed mutation becomes a `updateMemberProfile(memberId, { field: value })`
  call. Preserve each one's existing cache invalidation (the survivor hook must
  invalidate `queryKeys.members.detail(id)` and any list keys the old hooks did).
- `markProfanityOnboardingComplete` sets two fields — pass both in one patch.
- Watch for call sites that fire two single-field mutations back-to-back; they can
  collapse to one patch call (nice-to-have, not required).

**Patterns to follow:**
- `updateMemberProfile`'s existing `Partial<...>` signature and its
  `onSuccess` invalidation in `useMemberMutations.ts`.

**Test scenarios:**
- Happy path: patch with `{ nickname }` writes only that column; reading back shows
  the new nickname and unchanged other fields.
- Happy path: patch with `{ role }` updates role; patch with
  `{ profanity_filter_enabled }` updates the flag.
- Edge case: empty/no-op patch does not throw and does not clobber other columns.
- Integration: after a patch, `queryKeys.members.detail(id)` is invalidated so the
  UI (e.g. a profile view or PlayerNameLink popover) reflects the change without a
  manual refetch.

**Verification:**
- The four single-field mutation functions and their dedicated hooks are gone; all
  member writes route through the patch path; `tsc` clean; tests green; no stale
  data after a write in manual smoke of one profile edit.

- [ ] **Unit 3: PlayerNameLink prop cleanup**

**Goal:** Clean prop interface — drop dead props, make the duplicated display-name
piece optional, keep the cached internal fetch.

**Requirements:** R3, R4

**Dependencies:** None (independent of Units 1–2)

**Files:**
- Modify: `src/components/PlayerNameLink.tsx` (remove `onSendMessage`,
  `onReportUser`, `onBlockUser`; make `playerName` optional; keep `customActions`,
  `teamId`, `teamName`, `captainName`, `captainMemberId`, `hidePlaceholderBadge`,
  and the `useMemberById` fetch)
- Modify: only call sites that break (those passing a now-removed prop — verified
  none pass the callbacks, so likely zero changes)
- Test: `src/components/__tests__/PlayerNameLink.test.tsx` (create)

**Approach:**
- Delete the three callback props and the `if (onSendMessage) {...}` /
  `if (onReportUser) {...}` / `if (onBlockUser) {...}` early-return branches; the
  default DM / report / block behavior becomes the only path.
- Make `playerName?: string`. The existing `displayName` derivation already handles
  absent/`"Unknown"` by falling back to `memberData.nickname` / full name, so no
  logic change is needed beyond the type.
- Leave `customActions` (UnifiedScoreboard's `swapAction`) and the invite-context
  props intact.

**Patterns to follow:**
- The component's existing `displayName` fallback block (the "belt-and-suspenders"
  comment) — it already supports an absent name.

**Test scenarios:**
- Happy path: given `playerId` + `playerName`, renders the passed name immediately
  (no flash) and the placeholder badge once `useMemberById` resolves a null
  `user_id`.
- Happy path: given only `playerId` (no `playerName`), renders the fetched
  nickname/full name once the member query resolves.
- Edge case: a registered member (non-null `user_id`) shows Send Message + Block;
  a placeholder shows Register Player and hides Send Message/Block (existing
  branching preserved).
- Integration: `customActions` still render and fire (scoreboard swap action) —
  guards against accidentally dropping the prop.

**Verification:**
- No references to the removed callback props anywhere; `playerName` is optional;
  scoreboard swap action still works; `tsc` + lint clean.

## System-Wide Impact

- **Interaction graph:** Member fetches feed `PlayerNameLink`, profile pages,
  operator dashboards, messaging participant lookups, and role gating. Repointing
  the duplicate fetch + folded mutations must preserve each one's query key and
  invalidation so caches stay coherent.
- **Error propagation:** `getMemberProfile` keeps the existing not-found (PGRST116)
  throw shape that callers of `getCurrentMember` relied on — verify at the repoint.
- **State lifecycle risks:** The folded mutations must carry over every
  invalidation the per-field hooks did, or a write could leave a stale
  `members.detail(id)` cache. This is the main correctness risk.
- **API surface parity:** This is the Members instance of a pattern that Matches
  (slice 2) and the other entities will follow; keep the shape repeatable.
- **Unchanged invariants:** `getMemberById`, `getMembersByIds`, `getAllMembers`,
  the derived lookups, `createMember`/`createPlaceholderMember`/`deleteMember`,
  `updateMemberProfile`'s signature, and all PlayerNameLink behavior are unchanged.
  No UI, route, or DB change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A folded mutation drops a cache invalidation the per-field hook had → stale UI after a write | Enumerate each removed hook's `onSuccess` invalidations and replicate them on the survivor before deleting; Unit 2 integration test asserts `members.detail(id)` is invalidated. |
| A `getCurrentMember` caller depended on a subtly different behavior than `getMemberProfile` | Bodies are identical today; repoint and rely on `tsc` + existing tests; smoke one login + profile load. |
| Removing `playerName` requiredness causes a load-flash regression somewhere that relied on instant name | Keep `playerName` accepted (just optional); existing call sites keep passing it, so no flash where one was avoided before. |
| Scope creep into Matches or the inline-fetch sweep | Explicit Scope Boundaries; those are separate PRs. |

## Documentation / Operational Notes

- No schema, migration, or rollout impact. Pure refactor.
- On completion, this is the template for slice 2 (Matches) and the per-entity
  cadence; note in `LIST_FOR_ED.md` items #1/#2 that Members is done and Matches is
  next.

## Sources & References

- Related code: `src/api/queries/members.ts`, `src/api/mutations/members.ts`,
  `src/api/hooks/useCurrentMember.ts`, `src/api/hooks/useMemberMutations.ts`,
  `src/api/queryKeys.ts`, `src/types/member.ts`, `src/components/PlayerNameLink.tsx`
- Backlog origin: `LIST_FOR_ED.md` items #1 (Refactor PlayerNameLink) and #2
  (Consolidate ALL Queries — Return Full Records)
