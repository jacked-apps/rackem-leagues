---
title: UI Modularity Audit + Module Concept Map
date: 2026-06-03
status: Requirements — ready for planning (after Ed answers open questions)
scope: Cleanup the UI's remaining peeks at system identity (handicap_type,
  mechanism, win_condition, points_calculator, lineup_size). Same principle
  the threshold-math refactor applied to the prep path: runtime is dumb;
  the UI asks the system module what to render, never branches on which
  system this is.
not_in_scope: Team-bonus modularization (Ed's invention; deserves its own
  brainstorm), swap-recalibration cleanup (paused branch, will pick up
  after this work). Score-entry per-game stats capture beyond what
  already exists.
---

# UI Modularity Audit + Module Concept Map

## Why This Doc Exists

The threshold-math refactor (branch `feat/threshold-math-modular`) made the
match-prep pipeline system-agnostic — `useMatchPreparation` no longer
branches on `handicap_type`. The same principle hasn't been applied to the
UI yet. The audit below catalogs every remaining peek and proposes the
module shapes that would replace them.

Per CLAUDE.md principle 5: the UI trusts what the system module says.
Different systems get different rendering by the modules they're built
from, not by `if (handicap_type === ...)` in the page code.

## Audit Findings

Three parallel audits ran across lineup, scoring/scoreboard, and other UI
surfaces. Total: **43 peeks across 23 files**, organized below by category.

### By category

| Category | Peeks | Where |
|---|---|---|
| **Input shape** (widget per system) | 2 | `HandicapCell.tsx` |
| **Validation rules** (min/max bounds, required) | 5 | `HandicapCell.tsx`, `useLineupValidation.ts` |
| **Display format** (label, suffix, width) | 11 | `HandicapCell.tsx`, `HandicapSummary.tsx`, `MatchLineup.tsx`, `UnifiedScoreboard.tsx`, `TeamStats.tsx`, `MyTeams.tsx`, `LeagueOverviewCard.tsx`, `LeagueDetail.tsx` |
| **Conditional rendering** (whole panel) | 9 | `MatchLineup.tsx`, `HandicapCell.tsx`, `useFargoStartPointsNegotiation.ts`, `UnifiedScoreboard.tsx`, `TopShooters.tsx`, `SpectateMatchCard.tsx`, `LeagueDetail.tsx`, `MatchEndVerification.tsx` |
| **Available actions** (button/input enabled) | 2 | `MatchLineup.tsx`, `LeagueFinancesSection.tsx` |
| **Lookup / placeholder defaults** | 1 | `useHandicapCalculations.ts` |
| **Derived calculations** (math dispatch) | 8 | `useHandicapCalculations.ts`, `useMatchPreparation.ts`, `computePrepBlockedReason.ts` |
| **End-condition logic** (match end / tiebreaker) | 3 | `MatchEndVerification.tsx` |
| **Stats columns** (show/hide) | 2 | `TopShooters.tsx`, `SpectateMatchCard.tsx` |

### By system-identity field branched on

- **`handicap_type === 'fargo'`** — 14 peeks (dominant; reflects Fargo's
  manual-entry + negotiation surface)
- **`handicap_type === 'points'`** — 5 peeks (input widget, validation,
  team-bonus gate)
- **`handicap_type === 'percentage'`** — 3 peeks (sub placeholder, format)
- **`win_condition === 'points'`** — 9 peeks (scoreboard format,
  match-end logic)
- **`win_condition === 'games'`** — 2 peeks (threshold display, status)
- **`mechanism === 'start_points'`** — 1 peek (prep dispatch)
- **`lineup_size === 3` or `=== 5`** — 6 peeks (format labels, stats
  columns)
- **`points_calculator === ...`** — 1 peek (per-game points column)

### Notable hot spots

- **`HandicapCell.tsx`** — 6 peeks in one component (input type,
  min/max, placeholder, format). The single most concentrated leak.
- **`MatchLineup.tsx`** — 6 peeks (Fargo banner, column header text,
  manual rating widget, etc.).
- **`UnifiedScoreboard.tsx`** — 4 peeks on `winCondition` (text size,
  threshold layout).
- **`MatchEndVerification.tsx`** — 3 peeks on `winCondition`
  (completion status, result computation, tiebreaker flow).

## Module Concepts Emerging From The Audit

Each module concept below would replace one or more categories of UI
peek. Modules are described at the "what's in the bag of dials" level —
implementation details belong in the planning phase.

### 1. Handicap-entry module (the biggest)

**Replaces:** all `HandicapCell.tsx` peeks, `useHandicapCalculations`
Fargo overrides, `MatchLineup.tsx` column header / width / banner
peeks, lineup-validation Fargo branch.

**Dials:**
- `inputKind`: `'select' | 'number' | 'text'` (widget shape)
- `allowedValues`: range `{min, max, integer}` OR enum `['A','B','C']`
- `displayFormat`: format-on-render rules (suffix, prefix, width hint)
- `placeholderText`: shown in empty input
- `source`: `'manual' | 'auto-from-history' | 'api'` (where the value
  comes from)
- `apiAdapter` (optional): for API-backed sources like FargoRate

**Ed's reframing applied here:** Fargo today is "manual-entry module
with dials set to {min:100, max:1000, int, source:manual}." When the
FargoRate API access lands, the source flips to `'api'` and a Fargo-
specific adapter wires in. Same module, different dials. Same module
is also the **fallback** for LOs whose system we don't recognize:
their league configures the manual-entry module with whatever range
or enum makes sense for their world (letter grades, custom scales,
etc.).

### 2. Sub-handling modules (two of them)

**Replaces:** sub-related peeks in `MatchLineup.tsx`,
`useLineupValidation.ts`, related sentinel helpers.

**Two modules:**
- **Anonymous-sub module** — fills a slot with a "sub" placeholder;
  captain provides the handicap at the same moment.
- **Double-duty-sub module** — fills a slot with a real player who's
  already in the lineup; opposing captain resolves.

**LO setting:** each module is independently enabled/disabled per
league. Combinations: neither, anon-only, double-duty-only, both.

**Dials per module:** maximum number of subs per lineup (current
constraint: at most one per side; future: configurable).

### 3. Scoreboard display module

**Replaces:** all `UnifiedScoreboard.tsx` `winCondition` peeks, plus
the threshold trio rendering and "primary axis" emphasis.

**Dials:**
- `primaryAxis`: which value gets the big text (`'wins'`, `'points'`,
  custom)
- `thresholdRender`: how the threshold trio appears — slash format
  (`X/to_win`), "Starts +N" badge, or another shape
- `secondaryAxisLabel`: what to call the smaller-text number
- `bandFormat`: how match-progress bands render

This module gets its data from the state bag (the same one the
threshold modules write to during prep) — it just renders.

### 4. Match-end module

**Replaces:** all `MatchEndVerification.tsx` peeks on `winCondition`.

**Job:** decide when the match is over, who won (or if it's tied),
whether to enter a tiebreaker flow.

**Dials:**
- `completionRule`: `'games-target-hit' | 'points-target-hit' | 'all-games-played' | ...`
- `tieAllowed`: boolean (points-mode = no, games-mode = yes)
- `tiebreakerOnTie`: which tiebreaker flow to run (current options:
  none, single tiebreaker game, captain choice)
- `cascadeRule` (Fargo): higher-points cascades to higher-games-won

### 5. Stats-column module (or a collection of them)

**Replaces:** `TopShooters.tsx`, `SpectateMatchCard.tsx`, `TeamStats.tsx`
peeks on `lineup_size` and `points_calculator`.

**Job:** declare which player/team stat columns appear in reports,
top-shooters, spectate cards, profile pages.

**Dials per column module:**
- `key`: which bag/DB field to read
- `label`: column header
- `applyWhen`: condition under which the column renders (e.g., only
  for systems that track points)
- `sortable`, `format`, `align`

Could be one module per column with toggles, OR one module that lists
all columns. Planning decides.

### 6. Per-game stats capture modules

**Replaces:** the score-entry surface's per-system stat capture (today:
break-and-run, golden break, early 8, scratches, balls pocketed).

**One module per stat:** break-and-run, golden break, early 8,
scratches/innings, balls-pocketed counter (Fargo). Each declares:
- Where it captures (in the score-entry modal, on the scoreboard, both)
- What value it captures (boolean checkbox, number counter, etc.)
- Where it writes to the bag / DB

**LO setting:** each enabled/disabled per league.

### 7. Format-label module (or extension of Team Geometry)

**Replaces:** `LeagueOverviewCard.tsx`, `LeagueDetail.tsx` peeks that
render "3v3" / "5v5" labels.

**Note:** `lineup_size` already lives in the existing **Team Geometry**
module. The cleanest fix may be to add a `displayLabel` field to Team
Geometry rather than build a new module. Planning call.

### 8. Finance/payout module

**Replaces:** `LeagueFinancesSection.tsx` peek on `lineup_size`.

**Out of scope here** — finance/payout calculations are their own
domain. Flagged so the eventual finance modularization knows to read
geometry from the state bag rather than re-importing prefs.

## Scope Boundaries

### Out of Scope (explicit non-goals)

- **Team-bonus modularization.** Ed's invention. Modifier based on
  standings. Probably its own module with several settings. Future
  brainstorm.
- **Swap-recalibration UX cleanup.** Paused branch. Will adopt the new
  modules when it resumes.
- **Workshop UI for building scoring systems.** The Workshop is where
  LOs configure dials. Out of scope here — this branch lays the
  module ground.
- **Settings-audit dashboard.** Ed mentioned wanting a way to list and
  surface LO-configurable settings. Worth its own brainstorm once we
  have the module list stabilized — that's literally the input to
  such a dashboard.
- **Per-game scoring runtime convergence.** The score-entry runtime
  already has its own composition path (`points-system/runtime.ts`).
  Future branch unifies it with the prep-time runtime.

### Deferred to Separate Tasks

- **Per-system "default modules" definition.** Each shipping
  Scoring System (BCA 3v3, BCA 5v5%, Fargo) gets a curated module set
  — its handicap-entry module, scoreboard module, match-end module,
  enabled stats, sub options. This is the LO-facing analogue of the
  `chain: Module[]` we added to `SystemModule` in the prep refactor.

## Open Questions for Planning

1. **Module granularity for sub stats.** Should break-and-run be ONE
   module enabled per-league, or multiple variants (BCA-rules
   break-and-run vs Fargo-rules break-and-run)? Planning call after
   reading the existing capture logic.
2. **Anonymous-sub default handicap.** Today: percentage subs get
   placeholder 40. Should this be a dial on the anonymous-sub module
   (per-league)? Or a fallback rule on the handicap-entry module?
3. **Stats columns as one module or many.** Single module that lists
   all columns (config-heavy) vs. many small modules each declaring
   one column (more files, more LO toggles).
4. **Format label home.** Add to Team Geometry vs. its own tiny
   module.
5. **Per-system "default module set" shape.** A new field on
   `SystemModule` (`uiModules: { ... }`) OR a separate registry?
   Echoes the `chain: Module[]` decision we made for prep.

## Adjacent / Future Work

- **Team-bonus brainstorm** (Ed will scope when ready).
- **LO settings-audit dashboard** (the "list all configurable dials in
  one place" Ed mentioned).
- **Workshop UI** (LO-facing UI to compose scoring systems from
  modules — the long-term destination).
- **Score-entry per-game runtime unification** (the prep runtime
  + the per-game scoring runtime share infrastructure eventually).
