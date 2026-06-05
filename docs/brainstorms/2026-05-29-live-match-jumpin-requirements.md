# Live-match jump-in — "My Match" shortcut

**Brainstorm:** 2026-05-29
**Status:** Requirements complete — plan-ready
**Branch:** `chore/safe-meantime-work` (drafted as productive zero-merge-risk work while the open-PR round merges)
**Owner:** Ed (decision-maker); brainstormed with Claude this session.

## Problem Frame

Today, to get to tonight's match a player walks the chain **My Teams → that team → Schedule → this week's row → match → lineup**. Mid-flow re-entry (writing a message and getting back to scoring) is equally tedious. Ed's words: "the most used button in the game." The existing "quick jump to" buttons on Teams + Schedule pages fall short — they're page-local, not always-visible.

The feature is a **shortcut, not a page.** Its sole job is to collapse the chain to one tap into the live (or about-to-be-live) match.

## Goals

- **One tap from anywhere** into the player's live match.
- **A quick at-a-glance list** of all matches that matter right now (live + today's), reachable via the drawer.
- **Bypass My Teams → Schedule chain entirely** for the dominant case.
- **Either useful or honest** — when the user has something current (live / today / past-due makeup), the surfaces route them there; when they don't, the dim + toast says so clearly rather than misleading them with strangers' scoreboards.

## Functional Requirements

### R1 — Bottom-nav "My Match" tab (mobile)

Repurposes the existing **Live** tab slot in `src/components/layout/BottomTabBar.tsx`.

- **Label:** "My Match" (singular). Icon: keep Radio for now (revisit if it bites).
- **State machine — four-tier ladder of YOUR matches:**
  1. *Live match exists* (`status = 'in_progress'`) → tap routes to the **lineup page** of the "most important" live match (auto-redirects to scoring once locked).
  2. *Today's scheduled match* (no live; `status = 'scheduled'` AND `scheduled_date = today`) → tap routes to that match's lineup page. The first-to-arrive case.
  3. *Past-due makeup* (no live; no today; `status = 'scheduled'` AND `scheduled_date < today`, not yet rescheduled) → tap routes to that match's lineup page. Oldest past-due wins.
  4. *Nothing of yours* → tap shows a toast ("No current matches") and does not navigate. The tab is visually dimmed to telegraph the no-op intent.
- **`/live` (spectator scoreboards) is NOT a bottom-nav destination.** Spectator scoreboards are reachable from the future Upcoming Matches page (the `/my-match` route) or via direct URL — they're not part of the "my match" affordance.
- **Live-state indication** — a small accent dot on the tab icon **only when a live match exists (Tier 1)**. Tiers 2 and 3 are still actionable (tap goes somewhere useful) but the dot is the LIVE indicator specifically; it should not fire for scheduled or makeup matches. Tier 4 visibly dims the tab so the user can read "nothing of mine" at a glance. Default treatment is an accent dot (distinct from the Messages badge's count, which uses the same icon slot for a different meaning); UI follow-up can swap to a pulse animation if the dot reads as too quiet.
- **"Most important" multi-live heuristic:** oldest-started / furthest-along (longest in-progress, most game progress). Deterministic; no tie-break ambiguity in the dominant case.
- **Mobile-only** (`lg:hidden` per the existing BottomTabBar).

### R2 — Drawer "My Match" section

Mirrors the **OperatorSection** pattern in `src/components/layout/AppDrawer.tsx`:

- **Section header:** "My Match" (uppercase muted, border-separated section, same chrome as the Operator section).
- **Items = a list of relevant matches:** `in_progress` OR (`scheduled` AND `scheduled_date = today`) OR (`scheduled` AND `scheduled_date < today` AND not yet rescheduled — **past-due makeups**). Nothing further in the future — that's the future Upcoming Matches page's job.
- **Each row:** `My Team · vs Opponent · {Live | Today | Makeup (Apr 7)}`. Opponent is essential — two of your teams may both be playing the same night, and team-name alone won't disambiguate. The Makeup label includes the original scheduled date for context.
- **Layout:** flat row when 1; list of rows when 2+ (the regular-and-makeup-on-table-2 case); section hidden entirely when 0 (same vanish behavior as the Operator section for non-operators).
- **Click a row** → its match's lineup page (which auto-redirects to scoring when locked).
- **Single-purpose rows** — no expand-for-sub-actions. The Operator section has multiple actions per org; here each match-row is one tap to one place.

### R3 — Desktop sidebar parity

`src/components/layout/AppSidebar.tsx` already has a "My Match" entry pointing at `/my-match`. Update its destination + state to match the **bottom-nav's four-tier ladder** (live → today's lineup → past-due makeup → no-current-matches toast / dimmed state). The sidebar is the desktop-shaped version of the always-visible tab; it does NOT inherit the drawer's broader picker behavior.

### R4 — Multi-live (regular + makeup on different tables)

Both surfaces handle multi-live naturally and **without a special "makeups" code path**:

- **Bottom-nav:** auto-picks the most-important match (R1's heuristic). Swap-to-the-other-live-match is deferred to the **scoring gear** added in PR #157 — natural host for "I'm on the wrong one, switch me."
- **Drawer:** lists all live + today rows; user taps the one they want.

A makeup, when being played, is just an `in_progress` match like any other — it surfaces for free.

**Drawer is the v1 disambiguation surface.** When 2+ live matches exist, the bottom-nav auto-picks silently; the user discovers the alternatives by opening the drawer, where both rows are visible. The drawer IS the multi-live picker until the scoring gear absorbs the swap UI. The bottom-nav's auto-pick can land on the "wrong" match in the rare regular-plus-makeup case; cost is two extra taps (drawer → pick) and is acceptable for the time window before the gear ships.

### R5 — Detection scope (v1)

Surface a match for the user when they're on **`team_players` of either team** in the match.

- Captains are typically rostered → covered.
- LO is **excluded** — operator tools cover backstop scenarios. An LO who plays/captains is covered via their roster row anyway.
- **Captain-not-rostered** (subbed out tonight but runs scoring) is a small edge that's deferred — revisit only if it bites in real use.

### R6 — Routing destination is always the lineup page

Both surfaces route to the match's **lineup page**, never to the scoring page directly. The lineup page already handles its own state-aware routing (auto-redirect to scoring when lineups are locked). This keeps:
- one universal "where does My Match send me?" answer,
- no per-surface destination logic,
- the lineup page as the single chokepoint where match-phase routing lives.

### R7 — Surfaces stay live as state changes

Bottom-nav state + drawer list update as matches transition (`scheduled → in_progress → completed`) without requiring a manual refresh. Reuse the existing realtime hooks (`useMatchPhase` and the live-match queries) — implementation detail, not a product question.

## Scope Boundaries

### In scope (this brainstorm)
- The bottom-nav tab behavior (R1).
- The drawer section (R2) + desktop sidebar parity (R3).
- The multi-live, detection, routing, and realtime semantics that those two surfaces need.

### Deferred to separate brainstorms / future work
- **`/my-match` PAGE** → becomes the future **Upcoming Matches** view (week-at-a-glance across all the player's teams, makeups included). Its own brainstorm. For this feature, the route is left at its current placeholder and not invoked by either surface.
- **Multi-live SWAP UI** → folded into the scoring gear (#157) workstream. The bottom-nav auto-picks; the gear is where the user switches.
- *(Past-due makeups are now IN scope — Tier 3 of the bottom-nav ladder + a `Makeup (date)` row in the drawer.)*
- **Dashboard card / sticky header banner** → killed. The bottom-nav tab is the always-visible re-entry; a second surface is redundant.
- **Captain-not-rostered detection** → revisit if real use shows it matters.

## Resolved Decisions

- **My Match is a SHORTCUT, not a page.** The shortcut's job is to skip the My Teams → Schedule chain. A landing page would just add a tap and defeat the purpose.
- **Bottom-nav over Dashboard card.** Single always-visible surface beats two competing ones. Cleaner doorbell hygiene; matches "the most used button" framing.
- **Bottom-nav is a four-tier ladder of YOUR matches, not a `/live` spectator fallback.** The tab is about your match affordance; strangers' scoreboards aren't part of that meaning. Tier 4 (nothing of yours) is an honest dim + toast, not a misleading redirect.
- **Drawer is a list of MATCHES, not a list-of-teams-then-actions.** Matches are the user's unit of intent in this feature; teams-as-scope is the upcoming-matches page's job.
- **Both surfaces use the same trigger window** — `in_progress` + today's scheduled + past-due makeups. The difference is in *surfacing*: the bottom-nav resolves the ladder to a single auto-routed destination (one tap); the drawer lists every relevant match for the user to pick. Same source data, different shapes for different intents.
- **Routing destination is always the lineup page.** Single chokepoint, no per-surface routing logic.
- **"Most important" multi-live = oldest-started / furthest-along.** Deterministic auto-pick; swap is the scoring gear's job.

## Open Questions

### Deferred to Implementation
- The exact tiebreak for "oldest-started / furthest-along" — does `match.started_at` exist as a field, or is it derived from `games_won + games_lost`? Decided when wiring against the live schema.
- Whether the BottomTabBar's existing `badge` slot can be reused for a live-indicator pulse, or whether the live-state needs a separate visual treatment (the Messages tab's unread count already uses the badge for a different meaning).
- Whether `useMatchPhase` exposes the realtime shape R7 needs, or whether a new aggregate hook is required — decided when wiring R7. (`useMatchPhase` is per-`matchId` and serves the routing-destination side; detection needs an aggregate.)

### Deferred to Separate Brainstorms
- `/my-match` page content → **Upcoming Matches** brainstorm (its own thing).
- Multi-live swap UI → scoring gear (#157) workstream.

## Context & Existing Patterns to Reuse

- `src/api/queries/matches.ts:249` — `getLiveMatchesForMember(memberId)` returns *all* live matches in any league the member has a team in (**league-scoped**; used by the spectator page). For R5, detection MUST additionally filter to matches where `home_team_id` OR `away_team_id` is in the user's `team_players` set — either a new team-scoped query or a client-side intersection on top of this helper. **Do not ship the league-scoped helper as the My Match detector.**
- `src/api/hooks/useMatchPhase.ts` — match status transition hook.
- `src/components/layout/BottomTabBar.tsx` — the tab slot being repurposed (currently 4 player tabs + Manage; the Live tab becomes "My Match").
- `src/components/layout/AppDrawer.tsx` — `OperatorSection` (lines ~173–206) is the structural model for the new "My Match" section (flat-when-1, list-when-2+, hidden-when-empty, border-separated).
- `src/components/layout/AppSidebar.tsx` — desktop counterpart; needs the same My Match treatment.
- `src/player/MatchLineup.tsx` — the routing destination. Already redirects to scoring when lineups are locked, which is why R6 lands here universally.
- `src/player/SpectateMyLiveMatches.tsx` — existence proves out the "live matches for this member" detection on the spectator side; the same plumbing applies.
- `src/player/MyMatch.tsx` — current placeholder; its future Upcoming Matches identity is acknowledged but not designed here.
- `/live` route (SpectateLiveMatches) — bottom-nav's "no live match" fallback. Unchanged by this work.

### Prior attempt noted
- "Quick jump to" buttons on Teams + Schedule pages — Ed: "fall short." Lesson: the shortcut must be **always-visible chrome**, not page-local content.

### Adjacent in-flight work
- **PR #157 (scoring participation modes + settings gear)** — the gear added there is the planned host for the future multi-live swap UI. Hard dependency from R4's deferred-swap line.

## Risks

- **Live-indicator visual on the bottom-nav** can't conflict with the existing badge slot (used for Messages unread count). Default treatment is an accent dot; UX follow-up if it doesn't read as urgent enough.
- **Past-due makeup detection requires a "not yet rescheduled" check.** A makeup that was scheduled for Apr 7, then rescheduled to next week, must drop out of Tier 3 the moment the reschedule lands. Detection should rely on the canonical "scheduled in the past + still status='scheduled' + no replacement match references it" predicate, not just `scheduled_date < today`.
- **Scoping by `team_players` only** drops the captain-not-rostered edge. Acceptable at v1; revisit trigger if real use surfaces complaints.
- **Realtime accuracy** — if the bottom-nav state lags behind reality, the user taps "My Match" and hits a stale destination (e.g., match flipped to `completed` since the last refetch). Reuse the project's existing realtime hardening; not a new problem here. If the routed match is already `completed`, the lineup-page destination should detect that and fall back to the bottom-nav's no-live-match destination (`/live`) rather than render a completed-match lineup.
- **Repurposing the Live spectator tab silently relabels a known surface.** Casual league-night users who learned "Live = spectator scoreboards" now see "My Match" first. The no-live-match fallback to `/live` preserves the destination (one tap away), so the spectator path isn't lost — but the label change is real. Acceptable cost; flag for the release note when we have one.
- **Routing-as-dispatcher trajectory.** R6 makes the lineup page the single chokepoint for match-phase routing. As phases grow (warmup, paused, vacated-and-rescoring, post-match summary), the routing logic compounds inside a screen component. Watch for the point where this graduates to a dedicated `matchPhaseDestination(match)` utility called by both the lineup page and every My Match entry — a follow-up, not a v1 ask.

## Origin & References

- Brainstorm walkthrough with Ed, 2026-05-29 (this session).
- Memory note `project_live_match_jumpin` — Ed's earlier framing of "the most used button in the game."
- Placeholder file `src/player/MyMatch.tsx` — already documents the rough future scope in its file header; this brainstorm formalizes and refines it.
- Adjacent: `project_messaging_low_priority` (the doorbell hygiene that informed the "single always-visible surface" decision).
