---
title: Modular Handicap & Scoring Systems
date: 2026-04-18
status: Requirements — ready for planning
supersedes: memory-bank/PLAN-fargo-handicap-system.md (refines, does not replace)
---

# Modular Handicap & Scoring Systems

## Problem

The app currently hardcodes two handicap/scoring systems (BCA 3v3 points, BCA 5v5 percentage) and is mid-migration toward a third (Fargo). Today, `getGamesNeeded()` in `src/utils/handicap/index.ts` branches on a `handicap_type` string; threshold charts are TS files; scoring logic assumes "first to X games won" — which Fargo, as a point-accumulation system, does not fit.

The `fargo-scoring` branch has already done real groundwork: `handicap_type` is a free-form string (not an enum), `useResolvedLeaguePrefs` cascades league → org → system defaults via the `resolved_league_preferences` SQL view, and lazy migration backfills legacy leagues.

Additionally, **DB infrastructure for threshold charts already exists** (`supabase/migrations/20260410000002_threshold_charts.sql`):
- `threshold_charts` + `threshold_chart_rows` tables with entity cascade (global → organization → league)
- Four chart types seeded as global templates: `team_points`, `team_percentage`, `race_points`, `race_percentage`
- `lookup_threshold(chart_id, comp_1, comp_2)` SQL function with exact/range modes and race-chart normalization
- `preferences.threshold_chart_id` FK; `seasons.threshold_chart_id` FK
- Global-chart-modification protection triggers (operators must copy to customize)

**But the TypeScript code does not yet use the DB charts.** `getGamesNeeded()` in `src/utils/handicap/index.ts` still reads from the TS files `get3v3GamesNeeded.ts` and `get5v5GamesNeeded.ts`. The DB tables are prep work, not live plumbing.

The remaining work is a targeted refactor: introduce a composable substrate (`SystemModule`) so each shipped system owns its behavior cleanly, Fargo fits as a first-class system, and the SystemModule.threshold interface is shaped so it can later delegate to the DB-backed `lookup_threshold()` function without refactoring callers.

## Strategic Identity

This is a **"ship my leagues well, keep the door open"** refactor, not an adoption-platform bet. Primary success is correctness for the two active leagues. Operator adoption is a hypothesis to test, not a commitment to pay for up-front.

### Operating context (Fargo specifically)

BCA already ships an official Fargo scoring app. Your app runs **in parallel** with it, not as a replacement. Users consult BCA's app for authoritative Fargo ratings and enter them into yours. The differentiators of your app are:

1. **Collaborative scoring** — any player on the team can score any game (BCA's app is scorekeeper-only, single-user per team).
2. **Live visibility** — all players see who's up next, current score, and (future) other-match progress and scoreboard. BCA's app shows none of this to non-scorekeepers.
3. **Better standings and stats** — a product-quality bar above BCA's app.

### Strategic roadmap (not v1 work, context only)

- Earn operator credibility by being visibly superior on scoring + stats
- Approach BCA for FargoRate API access (removes manual rating entry)
- Solve the match-win threshold formula (see Known Gaps below)

### What this means for v1 design

- **Rating-entry trust is not a v1 concern.** Users have BCA's official app open at lineup time; any falsified rating is immediately catchable against the source. No countersign on rating entry. No rating-provenance UI.
- **Differentiator = collaborative UX + stats quality.** Not anti-sandbag rules. The BCA 3v3 anti-sandbag work from your 15-year league is shipped as fixed behavior inside `bca3v3.ts` (see Open Question 1 for rule enumeration) but is not marketed as the headline feature.

## Goals

1. **Ship 3 working systems end-to-end** — BCA 3v3 (points), BCA 5v5 (percentage), Fargo 5v5 — with existing leagues continuing to work without operator intervention.
2. **Structure the code so mix-and-match is unlockable, not speculatively enabled.** Three preset modules (`bca3v3`, `bca5v5`, `fargo5v5`) implement a shared `SystemModule` interface. The interface is designed to accommodate later decomposition (swapping one piece across presets) but v1 does not create per-axis registries, per-axis folders, or a preset-composition layer.
3. **Lock the UI to the 3 presets for v1.** Only the three preset labels are selectable. No mix-and-match UI. Unlocking a new combo later = research the math + swap module internals + expose the option in UI.
4. **Preserve the lazy-migration path already in `useResolvedLeaguePrefs`** — legacy leagues keep working, new leagues get explicit preset selection.

## Non-Goals (explicitly out of scope for v1)

- **Operator-authored new systems.** Inventing a brand-new rating formula or scoring method requires math research (Fargo took years). Not a target audience for this iteration.
- **Custom threshold-chart editor UI.** The 25-row chart editor is a separate feature with its own UX cost.
- **Custom team sizes beyond 3v3 and 5v5.** 4v4, 6v6, etc. are deferred.
- **Mid-season system changes.** A league's system is locked once the season starts. Changing mid-season is not supported.
- **Achievement/scoring dialog redesign.** Breaker-vs-racker validation and new achievement types (Runout, Loss-on-Break, Illegal Break) are a related but separable workstream. Noted in "Adjacent work," not in this requirements doc.
- **Full DB-driven config tables with copy-on-customize.** The 6-table architecture proposed in `memory-bank/PLAN-fargo-handicap-system.md` is not the v1 path. JSONB overrides or code-level presets are sufficient until real demand forces tables.

## Target Users

- **Primary:** You — the developer/operator shipping Fargo for your current league and maintaining BCA 3v3/5v5 for another active league.
- **Secondary:** Experienced league operators who may adopt the app. They pick one of the three preset cards in the league-creation wizard and can optionally tweak dials in league settings.
- **Explicit non-audience:** Non-technical operators trying to build a handicap system from scratch via UI.

## The Architecture: Preset Modules with Shared Interface

### Conceptual shape

A "system" is a self-contained module implementing the `SystemModule` interface. Three modules exist in v1 — one per shipped preset. Each module owns everything for its system: team format, rating computation, scoring rules, threshold lookup.

| Preset         | Module file              | Team format                         | Rating                | Scoring                     | Threshold              |
| -------------- | ------------------------ | ----------------------------------- | --------------------- | --------------------------- | ---------------------- |
| **BCA 3v3**    | `bca3v3.ts`              | roster 5, play 3, double round-robin | `(W-L)/weeks` → ±2    | games won + team bonus      | exact-lookup chart (25 entries) |
| **BCA 5v5**    | `bca5v5.ts`              | roster 8, play 5, single round-robin | `W/games × 100` → 0-100% | games won + team bonus   | range-lookup chart (7 ranges)    |
| **Fargo 5v5**  | `fargo5v5.ts`            | roster 8, play 5, single round-robin | manual Fargo rating 100-850 | 10-pt winner / 0-7-pt loser by balls | per-round start-points formula |

### Why modules, not a 4-axis registry

v1 ships 3 systems. The rating axis would have 3 values each used by exactly one preset; the threshold axis similarly. A per-axis registry pays a composition tax (registries + preset resolver + inter-module interface contracts) for future flexibility that isn't exercised. Shared behavior can be extracted later when real duplication appears (e.g. if a 4th preset reuses `games_won_with_team_bonus`, that function gets extracted at that point).

### The `SystemModule` interface

The interface is designed to accommodate later decomposition. Sketch (not prescriptive):

```typescript
interface SystemModule {
  key: 'bca3v3' | 'bca5v5' | 'fargo5v5';
  teamFormat: TeamFormatConstants;           // roster_size, playing_size, round_robin_mode
  rating: {
    computeFromHistory: (player, history) => RatingValue;
    displayFormat: (value) => string;
    requiresManualEntry: boolean;            // true for Fargo
  };
  scoring: {
    recordGameOutcome: (game, outcome) => GameRecord;  // BCA stores win/loss; Fargo stores winner_pts/loser_pts
    computeMatchResult: (match, overrides) => MatchResult;
  };
  threshold: {
    // Signature accepts round context; BCA modules ignore lineup and return a static chart lookup.
    // Fargo uses lineup pairings to compute per-round start points.
    computeThreshold: (handicapDiff, roundContext, overrides) => ThresholdResult;
  };
}
```

The threshold signature deliberately accepts round context so Fargo fits. BCA modules accept the same parameter and ignore it. This resolves the reviewer-flagged inconsistency between Fargo's round-contextual thresholds and BCA's static charts without fracturing the interface.

### Where module internals live (v1)

- **BCA threshold charts:** v1 continues reading from the existing TS files (`src/utils/handicap/get3v3GamesNeeded.ts`, `get5v5GamesNeeded.ts`) via the `bca3v3` / `bca5v5` modules. The DB-backed `threshold_charts` table exists but wiring it up is deferred — the TS files are the source of truth in v1. The `SystemModule.threshold.computeThreshold` interface is designed to accommodate a later DB-backed implementation (e.g. `fromChartId(preferences.threshold_chart_id)`) without changing callers.
- **Fargo start-points:** pure function inside `fargo5v5.ts`. Does not use `threshold_charts` — Fargo is formula-based, not chart-based, and takes full round context (lineup pairings) which the chart shape does not express.
- **Scoring parameters** (winner_points, loser_points_method, etc.): hardcoded defaults in the module, overridable per-league via `leagues.system_overrides` JSONB (see Storage below).

## Fargo-Specific Decisions

### Player Rating

- **Source:** Manually entered per player per match. Users reference BCA's official app for authoritative rating at lineup time.
- **Storage:** `members.fargo_rating` (last-known); per-match ratings stored on the lineup row so historical matches replay under their original values.
- **Entry UX:** Lineup page already has manual entry (commit `438b92f`). Keep as-is, with these state rules:
  - Field pre-populates from `members.fargo_rating` (last-known) if present
  - Operator can override the pre-populated value
  - Submitting an overridden value updates `members.fargo_rating` to the new value (last-known reflects most recent entry)
  - Empty state: field is blank with placeholder "Fargo rating (100-850)"
  - Lineup submission blocked if any player's rating is missing; inline error indicates which players need a rating
  - Out-of-range (< 100 or > 850): inline validation error, blocks submission

### Team Handicap (Start Points)

- **Formula source:** Match FargoRate's official league calculator (https://leaguecalc.fargorate.com/). The predecessor plan's formula sketch (`2^(rating/100)`, expected-wins, etc.) comes from secondary sources and must be validated during planning against the official calculator on known test inputs before shipping. Planning phase owns authoritative formula sourcing.
- **Validation requirement (v1 blocker):** Before shipping, the `fargo5v5` module must reproduce FargoRate's official league-calculator output within rounding tolerance on at least 10 test cases covering a range of rating diffs (0, 50, 100, 200, 300) and lineup sizes. Test cases are captured during planning by hand-running the online calculator.
- **Recalculation cadence:** Per round. Each round's lineup pairing produces its own start-points value. The `SystemModule.threshold.computeThreshold` signature accepts round context; BCA modules ignore it, Fargo uses it.
- **Caps/percentages:** Ship with no cap and handicap percentage = 100%. Exposing `handicap_percentage` as a dial is deferred until an operator asks — remove from Known Dials until demand is real.

### Scoring

- **Winner points:** Default 10 (override via `winner_points` dial).
- **Loser points:** 0–7 based on balls pocketed.
- **Balls entry UX:**
  - Ball count is directly observable at game end (count balls remaining on the table). Not a dispute-prone input — if captains can't agree on a count they can't finalize the game, which is a social problem not an app problem.
  - After winner is selected, a ball-count input appears: segmented-control buttons labeled `0`–`7` (touch-friendly, prevents invalid input).
  - Any player on either team can enter the ball count — consistent with the app's collaborative-scoring model (any-player-any-game).
  - Submit finalizes the game immediately. No pending state, no countersign state machine.
- **Database additions:** `match_games.winner_points`, `match_games.loser_points`, `match_games.loser_balls_pocketed` (nullable for games-won systems).

### Match Win Condition

- **Configurable per league.** Two options:
  - `first_to_points` — match ends when either team reaches target. Target adjusted by handicap.
  - `highest_after_all_games` — play all scheduled games; highest total wins.
- **v1 default:** `highest_after_all_games`. Avoids mid-match-termination complexity. Suits the case where users are running a full schedule regardless.
- **Tie handling:** Under `highest_after_all_games`, ties are recorded as ties. No tiebreaker game is played in v1. Standings can break ties by total points-for or other tiebreakers in the standings layer — out of scope for this doc but not deferred beyond it.

### Known Gap: Match-Win Threshold Formula

BCA's Fargo league uses some formula to determine "how many points wins a match" (for `first_to_points`) or "what threshold makes the match meaningful" as a function of team handicap diff. **You do not yet know this formula.** Planning phase options:

1. **Defer `first_to_points` support** — ship only `highest_after_all_games` in v1. Operator cannot choose the alternative. Cleanest; defers the unknown.
2. **Expose `target_points` as a per-league operator input** — operator enters the target number manually. No formula required. Caveat: operator has to know what to enter.
3. **Research + observe** — play the BCA league, collect real match targets, reverse-engineer the formula. Ship once known.

**Recommended for v1:** option 1. `highest_after_all_games` is the default; `first_to_points` is not user-selectable until the formula is known. The `match_win_condition` dial is removed from v1 Known Dials until then.

## UX Specifications (Beyond What's Already Built)

### Preset picker (league creation)

- Appears as an existing step in the Wizard 2.0 league creation flow (already implemented — see `src/wizards/league-v2/`). This doc does not change its placement.
- Three selectable cards: "Standard 3v3", "Standard 5v5", "Fargo 5v5". Labels match current `leagueFormatOptions.ts`.
- No "Custom" option in v1 (already out of scope).

### Preset display after season start (locked state)

- Once a league has any completed matches, the preset is effectively locked (per-match system snapshots mean the preset cannot affect already-scored games).
- In the league settings UI, the preset is shown as read-only text with a note: "Locked for the active season." No editable control.
- The per-league `system_overrides` JSONB remains editable even after season start for dial values that do not affect already-scored matches (planning phase to enumerate which dials are safe to change mid-season).

### Migration UX for existing leagues

- Silent. Lazy migration in `useResolvedLeaguePrefs` populates `handicap_type` if missing. No operator-facing migration banner.
- If production telemetry shows unmapped `handicap_type` values after release, address in a patch. Success Criteria 1 and 2 must hold without operator intervention.

### Dial editing (league settings)

- Only dials relevant to the active preset are shown. When preset is `points` or `percentage` (BCA), Fargo-specific dials are not rendered. When preset is `fargo`, BCA dials are not rendered. (No disabled-state clutter.)
- Defaults are shown as placeholder text; operator-set values are shown in the field.
- Validation: inline field-level. Invalid values block save.

## Scope Boundaries

### In scope

- Three working preset modules (`bca3v3`, `bca5v5`, `fargo5v5`) sharing a `SystemModule` interface
- Fargo end-to-end: manual rating entry, per-round team start-points calc, point-based scoring, `highest_after_all_games` win condition
- `leagues.system_overrides JSONB` field for the small number of known dials
- `match_games` Fargo columns (winner_points, loser_points, loser_balls_pocketed)
- `match.system_snapshot JSONB` for per-match system lock (prevents historical rescoring)
- Preservation of existing behavior for leagues on the two BCA presets (no runtime change)
- Migration continuity via `useResolvedLeaguePrefs` lazy backfill (no new column for preset routing)

### Out of scope (deferred)

- Operator UI to mix axes across presets (code supports it; UI doesn't)
- Wiring `SystemModule.threshold` to the DB-backed `threshold_charts` table (infrastructure exists; use TS files in v1, swap later)
- Custom threshold-chart editor UI (the DB tables + `lookup_threshold()` function exist but no editor is wired up yet)
- Custom team sizes (4v4, etc.)
- Race-format / individual-player-race use cases (the `race_points` / `race_percentage` DB chart types exist but are not in v1 scope; they anticipate future race/tiebreaker workflows)
- Mid-season preset changes (blocked by per-match `system_snapshot`)
- Achievement dialog redesign (see Adjacent work)
- FargoRate API integration for automatic rating fetch
- Full config-management tables with copy-on-customize

## Known Dials (v1 `system_overrides` JSONB)

Stored in `leagues.system_overrides` as a flat JSONB object. Editable via league settings UI.

### Fargo dials

- `winner_points` (default 10) — some point systems use 14 or 17
- `loser_points_method` (default `balls_pocketed`) — alternatives: `fixed`, `none`
- `loser_points_max` (default 7) — for non-8-ball variants

### BCA dials

- `team_bonus_enabled` (default true) — rare to disable, but your 15-year system may want this

### Deferred dials (NOT in v1)

- `match_win_condition` — blocked on match-win-threshold formula (see Known Gap above)
- `handicap_percentage` — deferred until an operator asks
- Anti-sandbag rules from the 15-year 3v3 system — captured in Open Question 1 (may surface additional dials)

## Adjacent Work (NOT part of this requirements doc)

These were referenced in the existing plan but should be separate requirements docs:

- **Scoring dialog redesign** — breaker-vs-racker validation for Break & Run / Golden Break / Runout, Loss-on-Break rule, Illegal Break rule, points-entry UI integration. The dialog touches scoring but is an independent piece of work.
- **Break tracking** — adding `breaker_player_id` to `match_games`, deriving breaker from rotation pattern.
- **Team-standings bonus formula configuration** — currently baked into `games_won_with_team_bonus` scoring module; surfacing as league overrides is a follow-up.
- **FargoRate API integration** — when credentials become available.

## Storage Plumbing

### Three-layer naming already exists

| Layer              | Values                                             | Lifetime                 |
| ------------------ | -------------------------------------------------- | ------------------------ |
| Wizard preset key  | `standard_3v3`, `standard_5v5`, `fargo_5v5`        | UI-layer only, ephemeral (see `src/wizards/league-v2/presetMappings.ts`) |
| DB routing key     | `preferences.handicap_type` = `points` \| `percentage` \| `fargo` | Persistent, already populated on all leagues |
| Code module name   | `bca3v3`, `bca5v5`, `fargo5v5`                     | Internal to `src/systems/` |

No new column for preset routing. `preferences.handicap_type` is the authoritative discriminator — the resolver picks the `SystemModule` from this value. The wizard keys map into `handicap_type` values via the existing `PRESET_MAPPINGS`. Lazy migration in `useResolvedLeaguePrefs` already populates `handicap_type` for legacy leagues from `team_format`.

### New columns

- **`leagues.system_overrides JSONB DEFAULT '{}'::jsonb`** — per-league dial overrides. Flat key-value shape; keys match the Known Dials list. Merged over module defaults at resolution time. No cascade to organizations in v1.
- **`match_games.winner_points INTEGER` (nullable)** — Fargo winner points (hardcoded 10 today; nullable for games-won systems).
- **`match_games.loser_points INTEGER` (nullable)** — Fargo loser points (0-7).
- **`match_games.loser_balls_pocketed INTEGER` (nullable)** — raw input driving `loser_points` calculation.

### Unmapped legacy values

If any production league has `handicap_type` outside the three known values (typo, historical, null, empty), the resolver logs a warning and falls back to `points` (the most common legacy value). Before shipping, query production to enumerate actual `handicap_type` values and confirm the fallback covers them.

### Per-match system snapshot (for mid-season lock enforcement — see below)

On match creation, snapshot the resolved preset key and any active overrides into a new `match.system_snapshot JSONB` column. Scoring reads from the snapshot, not the live league row. This makes mid-season preset changes behaviorally impossible for in-flight matches even if the league row is somehow edited.

### No changes to existing behavior

- Threshold-chart TS files stay in place (`src/utils/handicap/get3v3GamesNeeded.ts`, `get5v5GamesNeeded.ts`). The `bca3v3` and `bca5v5` modules import and call them. No logic rewrite.
- `getGamesNeeded()` in `src/utils/handicap/index.ts` becomes a thin adapter that looks up the `SystemModule` and delegates. Existing callers unchanged.

## Success Criteria

1. Your current BCA 3v3 league continues to score exactly as it does today, with no operator intervention.
2. Your current BCA 5v5 league continues to score exactly as it does today.
3. You can run a full Fargo match in the app: enter ratings on lineup page, play all games with ball-count entry per game, and arrive at a winner via `highest_after_all_games`.
4. The `fargo5v5` module's start-points calculation matches FargoRate's official league-calculator output on at least 10 captured test cases, within rounding tolerance.
5. Adding a fourth system later requires writing one new `SystemModule` — no changes to callers, no schema changes. If the new module duplicates pieces of an existing module, extract shared helpers at that point, driven by real duplication.
6. The test suite covers each preset module end-to-end.

## Open Questions (for planning phase)

1. **Anti-sandbag rules.** The 15-year 3v3 points system has evolved rules to make sandbagging expensive. Planning phase must list each rule and decide per-rule: fixed-in-module (default), surfaced-as-override (if it varies by league), or deferred. Without this list, Success Criterion 1 cannot be verified (BCA 3v3 matching "exactly as today").
2. **Team bonus formula.** Is the team-standings bonus identical across your 3v3 and 5v5 leagues, or does it differ? If differ, does it belong inside each preset's scoring module or as a shared-but-parameterized helper?
3. **Fargo start-points caching.** Per-round recalculation based on lineup pairings — compute on read, or persist per round in a new column? Persisting simplifies audit/replay; computing avoids a migration.
4. **FargoRate formula sourcing.** Confirm the authoritative formula against FargoRate's own documentation/calculator and capture the 10+ test cases required by Success Criterion 4.
5. **Match-win-threshold formula research.** Decide whether to pursue observation/reverse-engineering of BCA Fargo's threshold formula now (unblocks `first_to_points`) or defer indefinitely.
6. **Race-chart future scope.** The existing `race_points` and `race_percentage` DB charts suggest a future individual-player-race or tiebreaker use case. Confirm whether this belongs in a follow-up requirements doc or is already scoped elsewhere (`memory-bank/PLAN-wizard2.md` or similar).

---

_Refines, not replaces: `memory-bank/PLAN-fargo-handicap-system.md`. The plan's module decomposition is sound; this doc narrows scope to 3 preset modules with a shared interface, uses existing `handicap_type` as the routing key (no new routing column), acknowledges that DB-backed threshold-chart infrastructure already exists but defers wiring it up in favor of the current TS-file reads, adds targeted JSONB for overrides, and defers mix-and-match UI until real demand exists._
