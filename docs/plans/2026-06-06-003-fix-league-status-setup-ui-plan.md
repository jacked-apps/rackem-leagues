---
title: "fix: League status — hide setup UI when nothing to set up + Status/Overview on top"
type: fix
status: active
date: 2026-06-06
---

# fix: League status — hide setup UI when nothing to set up + Status/Overview on top

## Overview

On the operator's league detail page (`src/operator/LeagueDetail.tsx`), the setup-oriented UI sticks around after the league is fully set up and running, and the "next steps" checklist contradicts the progress bar. This plan makes the setup UI **disappear once there's nothing left to set up**, fixes the checklist/progress inconsistency, and moves **League Status + League Overview to the top two** positions. The full page reorder is intentionally deferred — the operator wants to see the corrected page before specifying the rest of the order.

## Problem Frame

Three observed issues, all setup-vs-running confusion:

1. **The 🚀 "rocket" ActionCard lingers.** `ActionCard` (`LeagueDetail.tsx`, the 🚀 block) renders "Ready to Begin?" with a CTA even when the league is fully set up with an active season in session — there's no progress to make, so the card is noise. The operator wants it gone "when there is no progress to do."

2. **Progress bar / next-steps contradiction in `LeagueStatusCard`.** `calculateProgress()` counts only 4 setup stages (season/schedule/teams/matchups, 25% each), so it shows **100%** and the badge flips to **"Ready to Play"** *before* the season is activated — while the "Next Steps" list still has an open step 5 ("Accept the schedule to activate the season"). Step 5's strikethrough condition (`activeSeason ? 'line-through' : ''`) is **dead code**: the whole list only renders when `activeSeason` is null, so step 5 can never show as done; the moment the season activates, the list is replaced by the "Season Management" bullets. Net: 100% + "Ready to Play" reads as finished while a step sits open, styled identically to a not-yet-reached step.

3. **Status + Overview aren't on top.** The operator wants League Status and League Overview as the first two cards so the page leads with "what's the state of this league" before the management cards.

## Requirements Trace

- R1. When the league is fully set up and in session (active season, no setup or next-season action pending), the setup-phase UI — the 🚀 ActionCard CTA, the setup progress bar, and the Next Steps checklist — does not render.
- R2. While setup is genuinely incomplete (or an actionable step like "activate" remains), the relevant guidance still shows, and the progress indicator and the step list agree with each other (no "100% but a step is open," no dead/never-true strikethrough).
- R3. League Status and League Overview are the top two cards on the league detail page.
- R4. Conditional cards that already self-hide (Re-up, NextSeason banner, Stats, Onboard-captains) keep working unchanged.

## Scope Boundaries

- No change to the wizard/activation flow itself, to `useFlowStageDetection`, or to how a season is activated.
- No change to the in-session "Season Management" content or the season-progress (weeks completed) bar — those stay.
- No data/query/RPC changes — this is presentation logic on already-fetched state.

### Deferred to Separate Tasks

- **Full page reorder** beyond "Status + Overview on top": the operator will specify the exact top-to-bottom order after seeing the corrected page. Captured as a follow-up, not built here.
- The two pre-existing `any` lint errors in `LeagueDetail.tsx` (season state, commit 336bfd05) — opportunistic to fix if touched, but not a goal.

## Context & Research

### Relevant Code and Patterns

- `src/components/operator/LeagueStatusCard.tsx` — owns status derivation (`getStatus` → `setup | ready | in_session`), `calculateProgress`, the badge, the progress bar, and the Next Steps / Season Management block. The `section` variant renders on the league page; the `card` variant renders on the dashboard.
- `src/components/operator/LeagueProgressBar.tsx` — the bar itself (label + nextAction + colored fill). No rocket here.
- `src/operator/LeagueDetail.tsx` — the page; `ActionCard` is defined inline (the 🚀 block + the 📅 "Create Next Season" variant). Current card order lives in the render around the `container` div.
- Conditional self-hiding pattern already in use: `LeagueReupStatusCard` returns null off-window; `OnboardCaptainsList` returns null when empty; `StatsCard` gated on active season. New hide logic should follow the same "render null, take no space" convention.

### Key state signals (already computed)

- `LeagueStatusCard`: `activeSeason` (non-null only when `status === 'active'`), `seasonCount`, `teamCount`, `scheduleExists`, `matchupsExist`, plus week-completion counts.
- `ActionCard`: `flowComplete` (`firstIncompleteStage >= 5`), `showContinueSetup`, `showStartNextSeason` (the `isNextSeasonRipe` window). The 🚀 default branch is "everything else."

## Key Technical Decisions

- **"Nothing to do" = active season in session, with no next-season prompt.** That's the precise condition under which the setup UI hides (R1). "Ready but not yet activated" still has one real action (activate), so a concise CTA remains rather than vanishing — this is the honest reading of "no progress to do."
- **Make the checklist and progress agree by treating activation as the final, explicit step**, not a hidden 5th that can never strike through. Concretely: during setup, the Next Steps list shows the current/next step as the highlighted action and completed steps struck through; once in session the list is gone entirely. Remove the dead `activeSeason ? 'line-through'` conditional on step 5.
- **Status + Overview on top is a render-order move in `LeagueDetail.tsx` only** — no component internals change for the reorder anchor. Keep the rest of the stack as-is for now (the operator reviews before the full reorder).
- **Prefer suppression over new copy.** The cleanest fix for the 🚀 card is to not render its default branch when there's no action, rather than invent a new "all good" card — keeps the page quiet when the league is just running.

## Open Questions

### Resolved During Planning

- What is "the rocket"? — The 🚀 ActionCard default branch in `LeagueDetail.tsx` ("Setup In Progress" / "Ready to Begin?").
- Should "ready but not activated" hide everything? — No; keep a single activate CTA. Only fully-set-up + in-session hides the setup UI.
- Does this need data changes? — No; all signals are already fetched.

### Deferred to Implementation

- Exact visual treatment of the "current step" highlight (e.g., bold + arrow vs. a small "Do this next" chip) — pick during implementation against the existing blue Next-Steps panel styling; keep fixed-color text on the fixed `bg-blue-50` per the dark-mode rule.
- Whether the activate CTA when "ready but not activated" lives in the ActionCard or as a slim banner — decide when wiring, based on which reads cleaner next to the Status card.

## Implementation Units

- [ ] **Unit 1: `LeagueStatusCard` — setup UI shows only during setup; checklist agrees with progress**

**Goal:** The setup progress bar + Next Steps render only while setup is incomplete; the open/next step is highlighted and completed steps struck through; the dead step-5 strikethrough is removed; the "100% + Ready to Play while a step is open" contradiction is gone. In session, the card shows Season Management + season-progress only.

**Requirements:** R1, R2, R4.

**Files:**
- Modify: `src/components/operator/LeagueStatusCard.tsx`
- Test: `src/components/operator/LeagueStatusCard.test.tsx`

**Approach:**
- Treat the three states explicitly: `setup` (incomplete) → show progress + Next Steps with the current step highlighted; `ready` (all setup stages done, not yet activated) → show a concise "activate now" affordance, not a misleading 100%/"done" with an open step; `in_session` → Season Management + season-progress bar, no setup UI.
- Remove the dead `activeSeason ? 'line-through'` conditional; drive each step's struck/active state from the real per-stage booleans already in the component.
- Keep the `card` (dashboard) variant behaving sensibly — the same state logic applies; verify it doesn't regress.

**Patterns to follow:**
- Existing `getStatus` / `calculateProgress` structure; the conditional-render "return null / omit block" convention used by sibling cards.
- `memory` dark-mode rule: fixed-color text on the `bg-blue-50` panel (no `text-foreground` there).

**Test scenarios:**
- Happy path (setup): season exists, no schedule yet → progress < 100%, Next Steps visible, "Set up the weekly schedule" highlighted as current, "Create the season" struck through.
- Edge (ready, not activated): all 4 setup stages done, `activeSeason` null → no "100% / done" contradiction; an activate affordance shows; no open un-struck step masquerading as not-reached.
- Edge (in session): `activeSeason` set → setup progress bar + Next Steps absent; Season Management bullets + season-progress (weeks) present.
- Edge (no season at all): `seasonCount === 0` → "Create your first season" is the highlighted current step.
- Regression: dashboard `card` variant renders without setup/in-session crossover bugs.

**Verification:**
- No state shows a struck-through-impossible step or a 100%/Ready label while a setup step remains open; in session, zero setup UI.

- [ ] **Unit 2: `ActionCard` (in `LeagueDetail.tsx`) — hide the 🚀 default card when there's no action**

**Goal:** The 🚀 "Ready to Begin?" default branch does not render when the league is fully set up and in session with no next-season prompt; the 📅 "Create Next Season" and the "Continue Setup" branches are unchanged.

**Requirements:** R1.

**Files:**
- Modify: `src/operator/LeagueDetail.tsx` (the inline `ActionCard`)
- Test: covered via `LeagueDetail` render test if one exists, else a focused `ActionCard` behavior test (see note)

**Approach:**
- Add a guard: when `!showContinueSetup && !showStartNextSeason && flowComplete && activeSeason` (in session, nothing to do), render nothing (return null) so the status grid collapses to just the Status card.
- Leave `showStartNextSeason` (📅) and `showContinueSetup` (Continue Setup) exactly as-is.
- Because `ActionCard` shares the row with `LeagueStatusCard` in a `lg:grid-cols-3` grid, confirm the grid still looks right when the action column is absent (Status spans 2 cols today; when the action card is gone, decide whether Status goes full-width — coordinate with Unit 3's layout).

**Test scenarios:**
- Happy path (in session, nothing to do): active season, `flowComplete`, not ripe for next season → ActionCard renders null.
- Edge (continue setup): mid-wizard → "Continue Setup" still shows.
- Edge (next season ripe): end-of-season window → 📅 "Create Next Season" still shows.
- Edge (no season yet): `seasonCount === 0` → first-season CTA still shows (there IS progress to do).

**Verification:**
- The rocket card is absent exactly when the league is set up and running; every other state keeps its CTA.

**Note:** `ActionCard` is currently an un-exported inline function. If testing it directly is awkward, assert the behavior through a `LeagueDetail`-level render test with mocked hooks, or extract `ActionCard` to its own file first (small, optional refactor) to make it unit-testable.

- [ ] **Unit 3: Reorder anchor — Status + Overview as the top two cards**

**Goal:** League Status and League Overview render first and second on the league detail page; the remaining cards keep their current relative order pending the operator's full-reorder spec.

**Requirements:** R3, R4.

**Files:**
- Modify: `src/operator/LeagueDetail.tsx`

**Approach:**
- Move `LeagueOverviewCard` up to immediately follow the Status grid (or sit beside it — decide with Unit 2's grid outcome). Keep `NextSeasonBanner`, `LeagueReupStatusCard`, `StatsCard`, Settings, Finances, Onboard-captains, Teams, Schedule, Playoffs in their current relative sequence below.
- Pure JSX reordering; no prop or data changes.

**Test scenarios:**
- Test expectation: none — pure render-order change of already-tested components. Verified visually + by the existing page render not throwing.

**Verification:**
- Status and Overview are the first two cards; all conditional cards still self-hide; page renders without layout breakage.

## System-Wide Impact

- **Interaction graph:** `LeagueStatusCard` renders in two places (league detail `section` + dashboard `card`). Unit 1 must not regress the dashboard variant.
- **State lifecycle risks:** None — presentation only; no writes, no queries changed.
- **Unchanged invariants:** Activation flow, `useFlowStageDetection`, season-progress (weeks) bar, and all self-hiding conditional cards remain as-is.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Hiding the ActionCard leaves an awkward half-width Status card in the `lg:grid-cols-3` row | Unit 2 + Unit 3 coordinate: when the action column is absent, let Status go full-width (or single-column), verified visually. |
| Dashboard `card` variant regresses from Unit 1's state changes | Explicit regression scenario in Unit 1; both variants share one state path. |
| "Ready but not activated" loses its activate affordance and the operator gets stuck | Decision is to KEEP a concise activate CTA in that state; covered by Unit 1/2 edge scenarios. |
| Full reorder churns this file again soon | Keep Unit 3 minimal (top-two only); the bigger reorder is a deliberate follow-up after visual review. |

## Sources & References

- Related code: `src/components/operator/LeagueStatusCard.tsx`, `src/components/operator/LeagueProgressBar.tsx`, `src/operator/LeagueDetail.tsx` (inline `ActionCard`)
- Follow-up: full league-detail page reorder (operator to specify order after reviewing this fix)
