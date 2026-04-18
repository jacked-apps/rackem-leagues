---
title: Refactor handicap & scoring into modular SystemModule with Fargo 5v5
type: refactor
status: active
date: 2026-04-18
origin: docs/brainstorms/modular-handicap-scoring-requirements.md
---

# Refactor handicap & scoring into modular SystemModule with Fargo 5v5

## Overview

Replace the current `handicap_type`-branching if/else scattered across `src/utils/handicap/`, `src/utils/calculatePlayerHandicap.ts`, `src/hooks/lineup/*`, and scoring code with a `SystemModule` abstraction — one module per shipped preset (`bca3v3`, `bca5v5`, `fargo5v5`) — so the three live systems (2 BCA + Fargo) ship cleanly and a 4th system can be added later by writing a single module.

v1 locks the UI to the three presets; code accepts any future axis combo but no mix-and-match UI is exposed. Threshold-chart DB infrastructure already exists (`supabase/migrations/20260410000002_threshold_charts.sql`); this plan does not wire TypeScript to it in v1 — BCA continues reading from the existing TS chart files; Fargo uses a pure formula.

## Operator Clarifications (2026-04-18 — READ FIRST)

> **Note to CE / future planner:** Operator reviewed this plan with a junior engineer walkthrough and corrected several assumptions about the existing data model. These clarifications **supersede** the original plan wording in the sections that follow. Downstream text has been updated inline where it was wrong; this section captures the reasoning so it's not re-litigated.

### 1. `home_points_earned` is a generic tally, not a BCA-specific field

The original plan treated `home_points_earned` as BCA-only and warned that writing Fargo totals to it would "silently corrupt standings." **This was wrong.**

The column is a generic "points earned this match" tally. Each scoring system fills it with values meaningful to its own system:

- **BCA 3v3 / 5v5**: margin (`games_won - threshold`); can be decimal (5v5) or negative
- **Fargo 5v5**: raw match total (e.g., 145)
- **Future systems**: whatever their formula produces

Leagues do **not** mix scoring systems within a season's standings. `standings.ts` sums `home_points_earned + away_points_earned` per team within a single league, so values are always internally consistent with that league's system. There is no cross-contamination to worry about.

Data type `numeric(4,1)` holds up to 999.9 — Fargo match totals (typical max ~300) fit comfortably.

### 2. Standings ranking is already a cascade that works for any system

Per operator's real-league experience, standings rank by:

1. **Match wins** (primary; counted from `winner_team_id`)
2. **Points earned** (tiebreaker when match wins are equal)
3. **Games won** (tiebreaker when points are equal)
4. Otherwise: recorded tie

This is already what `standings.ts` computes. It works for **any** scoring system as long as that system fills the three columns with meaningful values. No preset-aware standings path is needed.

### 3. Required plan changes (applied inline below)

- **Unit 12** (match completion): Fargo writes its match total to `home_points_earned`/`away_points_earned` instead of NULL.
- **Scope Boundaries → Deferred to Separate Tasks**: "Fargo-specific season standings aggregation" is REMOVED. Standings work out of the box.
- **Context & Research → Match completion**: ⚠️ landmine warning is REMOVED. Writing Fargo totals there is the intended behavior.
- **Risks table**: "Fargo totals accidentally written to home_points_earned" risk is REMOVED.

### 4. Minor: the plan's prior description of `home_points_earned` was inaccurate

The plan described it as "BCA-style standings points (0–2 per match typical)." Actual semantics per `database/migrations/add_match_results_tracking.sql:33` are `games_won - (games_to_tie ?? games_to_win)` — a margin, which can be negative. This is a documentation error, not a design problem. The column's purpose (generic points-earned tally) is sound.

## Problem Frame

The app currently supports 2 hardcoded handicap/scoring systems (BCA 3v3 points, BCA 5v5 percentage) via string-matching branches. Adding Fargo as a third system surfaces the limit: Fargo needs point-accumulation scoring (not games-won), a single match-level team-handicap calculation based on lineup ratings, and a different rating model (externally-sourced Fargo ratings, not computed from history).

Without a substrate, the third system would add a third branch everywhere the first two are mentioned. With the right abstraction, each system owns its behavior in one place.

Primary operator goal: ship a pool-league app demonstrably superior to BCA's official app (collaborative scoring, live visibility, better stats) that handles both BCA league formats + Fargo without code sprawl. (See origin: `docs/brainstorms/modular-handicap-scoring-requirements.md`.)

## Requirements Trace

- **R1.** BCA 3v3 league continues to score identically with no operator intervention (origin success criterion 1)
- **R2.** BCA 5v5 league continues to score identically with no operator intervention (origin success criterion 2)
- **R3.** Fargo 5v5 match runs end-to-end: ratings entered on lineup, all games played with ball-count entry, winner determined via `highest_after_all_games` (origin success criterion 3)
- **R4.** `fargo5v5` start-points output is within ±1 point of FargoRate's official league calculator on at least 10 captured test cases — serves as a useful default. Captains can override the computed value at lineup lock and countersign per the standard confirm flow; the stored value is the final agreed-upon number, not necessarily the computed one. (Origin success criterion 4, loosened by operator decision to support parallel-app operation.)
- **R5.** Adding a 4th system later requires writing one new `SystemModule` — no changes to callers, minimal schema change (origin success criterion 5)
- **R6.** Test suite covers each preset module end-to-end (origin success criterion 6)

## Scope Boundaries

- **Lock UI to the 3 shipped presets.** No mix-and-match selector. No "Custom" preset.
- **No `first_to_points` win condition.** Research (2026-04-18) found BCAPL point-scoring format is always "play all games, highest wins" — same as our `highest_after_all_games`. The `first_to_points` alternative isn't a documented BCA Fargo pattern. BCAPL Nationals uses a games-based race format ("race to 13 games"), which is a separate preset concern, not a Fargo point-scoring variant. `first_to_points` de-scoped entirely unless a non-BCA operator surfaces a real use case.
- **No new team sizes.** 4v4 / 6v6 / etc. not in v1.
- **No DB-backed threshold-chart wiring in TypeScript.** Tables exist but `bca3v3` / `bca5v5` continue reading from the TS chart files. A working chart-editor system (4 chart types, CRUD UI, ownership model, lookup_threshold() SQL function, seeded defaults) lives on the `lo-manual-scoring` branch and will be integrated in a focused follow-up PR **after** Fargo ships. The system is functional — further polish and improvements are expected during integration, not required as a precondition. Fargo is orthogonal to this work — it's formula-based and doesn't need charts.
- **No FargoRate API integration.** Ratings are manually entered.
- **No operator UI to author new systems from scratch.**
- **Does not change:** Wizard 2.0 preset selection (already wired), lineup Fargo entry UI (already exists per commit 438b92f), existing BCA scoring behavior, threshold_charts DB schema.

### Deferred to Separate Tasks

- **Scoring dialog redesign** — full field-configurable modal driven by resolved preferences (breaker/racker validation, Runout, Loss-on-Break, Illegal Break, and whatever future achievements/fields are added). Separate requirements doc. Unit 11 adds the Fargo points field using this configurable shape so the eventual redesign extends what's there rather than replacing it.
- **Break tracking** — `breaker_player_id` on `match_games`: separate task, prerequisite for the scoring dialog redesign.
- **FargoRate API integration** — when credentials/partnership secured.
- **Wiring DB threshold-chart lookup into TypeScript modules** — SCHEDULED follow-up. The `lo-manual-scoring` branch (15 commits ahead of main) has a working chart-editor system covering both team-sum and individual-race lookup patterns. Post-Fargo, a focused PR cherry-picks those commits, migrates `bca3v3` / `bca5v5` to read from the DB substrate, and polishes the editor as needed. Race-format charts (`race_points`, `race_percentage`) are part of that same follow-up.

## Context & Research

### Relevant Code and Patterns

- **Resolver pattern:** `src/api/hooks/useResolvedLeaguePrefs.ts` — reads from the `resolved_league_preferences` SQL view, lazy-migrates legacy leagues. Mirror this pattern for SystemModule resolution.
- **Wizard preset mapping:** `src/wizards/league-v2/presetMappings.ts` — maps UI preset keys (`standard_3v3`, `standard_5v5`, `fargo_5v5`) to `handicap_type` DB values (`points`, `percentage`, `fargo`). This is already shipped; plan uses `handicap_type` as the SystemModule routing key.
- **Current handicap entry:** `src/utils/handicap/index.ts` (`getGamesNeeded` branches on `handicapType` string). `bca3v3` / `bca5v5` modules wrap the existing `get3v3GamesNeeded.ts` / `get5v5GamesNeeded.ts` TS-file charts.
- **Lineup Fargo UX:** `src/components/lineup/HandicapCell.tsx` — already handles Fargo manual entry (commit 438b92f), double-duty (TBD), anonymous sub with type-aware input (commit 36c4d09).
- **Lineup validation:** `src/hooks/lineup/useLineupValidation.ts` — already branches on `handicapType`. Plan adds Fargo-specific validation (100–850 range, all-ratings-present-to-submit).
- **Match scoring:** `src/hooks/useMatchScoring.ts` + `src/hooks/useMatchScoringMutations.ts`; per-game modal `src/components/scoring/ScoringModal.tsx`; scoreboards `src/components/scoring/{ThreeVThreeScoreboard,FiveVFiveScoreboard,TiebreakerScoreboard}.tsx`.
- **Match completion:** `src/api/queries/matches.ts` (lines 500–559) writes `winner_team_id`, `match_result`, `home_team_score`, `home_games_won`, `home_points_earned`, `completed_at`, `status='completed'`. `home_points_earned` is a generic points-earned tally — each scoring system fills it with values meaningful to that system (BCA: `games_won - threshold` margin; Fargo: raw match total). Data type `numeric(4,1)` holds up to 999.9, so Fargo totals fit. Standings (`src/api/queries/standings.ts`) rank by matches won → points → games won → tie, which works for any system since each league's values are internally consistent.
- **Preferences types:** `src/types/preferences.ts` + `src/api/mutations/preferenceTypes.ts` — pattern for defining `SystemModule` types.
- **Settings UI:** `src/operator/LeagueSettings.tsx` + `src/components/operator/PreferencesCard.tsx` + `src/components/operator/preferences/*Section.tsx` — pattern to follow for a new `SystemOverridesSection`.
- **Existing tie convention:** `match_result='tie'` is ALREADY used for BCA tiebreaker triggering (`src/player/MatchLineup.tsx:260`, `src/player/ScoreMatch.tsx:618`). Fargo must not reuse this value; final tie shape is pending operator research.
- **Migration conventions:** `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Operator applies through the 3-environment (dev/staging/prod) pipeline with PR review; no manual mobile-app coordination needed (there is no mobile app).
- **Testing:** Vitest (`vitest.config.ts`). `src/__tests__/unit/`, `src/__tests__/integration/`. No existing handicap tests.

### Institutional Learnings

- `docs/solutions/` does not exist in this repo. No prior solutions recorded. (Consider starting one after this refactor lands.)

### External References

- FargoRate league calculator (https://leaguecalc.fargorate.com/) — authoritative formula source; must be hand-walked during Unit 9 to capture test cases.
- `memory-bank/PLAN-fargo-handicap-system.md` — predecessor plan (this plan refines and narrows it).
- `memory-bank/plans/PLAN-wizard2.md` — Wizard 2.0 work that laid the preferences infrastructure used here.

## Key Technical Decisions

- **`SystemModule` interface over per-axis registry.** Three modules (`bca3v3`, `bca5v5`, `fargo5v5`) each own rating + scoring + threshold behavior. No `src/systems/axes/` folder, no per-axis registries, no preset composition layer. (See origin: Goal 2.) Rationale: three systems share only 2 distinct scoring methods and 2 team formats; per-axis decomposition pays composition tax for flexibility that isn't exercised in v1.
- **DB routing via existing `preferences.handicap_type`.** No new preset_key column. Values (`points`/`percentage`/`fargo`) map 1:1 to `SystemModule` implementations. Lazy migration in `useResolvedLeaguePrefs` already populates legacy leagues.
- **`leagues.system_overrides JSONB` for per-league dials.** Flat key-value. Module defaults overridden at resolution time. No cascade to org in v1.
- **Threshold interface is signature-per-preset, not one-size-fits-all.** BCA modules take `(handicapDiff, overrides)` and return games thresholds. Fargo takes `(homeLineupRatings, awayLineupRatings, overrides)` and returns a single start-points integer. Each preset's signature matches what it actually needs.
- **Fargo start-points are match-level, set once, operator-verifiable.** Computed at match start from lineup pairings as a **default**. Captains confirm or override the number via the same propose/confirm flow the scoring modal uses — we run in parallel to BCA's official FargoRate app and the official app's number is authoritative when captains decide. Stored in `matches.fargo_start_points INTEGER` as the final agreed-upon value (which may or may not equal our computed default). Lineup amendments mid-match do NOT retroactively change the deficit.
- **Mutability hierarchy — four tiers, enforced at the DB/mutation layer.** Not operator discipline. Implemented by Units 6, 7, and 8.
  - **Tier 1 — League-immutable.** `preferences.handicap_type`, `preferences.lineup_size`. Cannot change after league creation. Enforced by DB trigger rejecting UPDATE. Philosophy: "want different? Start a new league."
  - **Tier 2 — Season-immutable.** `leagues.system_overrides` (scoring dials), `preferences.threshold_chart_id` (chart selection). Editable between seasons. Locked once the season is active (first match started, or season status moved to `active`). Enforced by application guard + UI disable during active season.
  - **Tier 3 — Match-immutable (snapshot).** All gameplay-relevant dials (tier 2 values + `fargo_start_points`) are snapshotted onto the `matches` record when the match transitions from `scheduled` to `in_progress`. In-flight matches are immune to dial changes even if a mid-season edit somehow bypassed tier 2. Threshold-chart edits that land mid-season apply forward-only: only unstarted matches see the change; matches already started or completed keep their snapshotted values. Per-game points (`match_games.winner_points` etc.) are already per-row frozen on scoring — the match-level snapshot extends that protection to dials that don't have per-game storage.
  - **Tier 4 — Always editable.** No gameplay impact (`roster_size`, team names, venue info, etc.). No guards.
- **Completed matches are never retroactively recomputed.** The only post-finalization mutation path is LO/admin manual correction via the existing EditGameDialog — for fixing data-entry mistakes, not for applying new rules. Retroactive recompute is not a feature and never will be.
- **BCA threshold charts stay in TS files for v1.** DB infrastructure (`threshold_charts` table, `lookup_threshold` SQL function) is prep work; wiring it to TS modules is a follow-up.
- **The BCA 3v3 chart is operator-defined, not BCAPL-official.** BCAPL's standard team format is 5v5 SRR 25-game; the 3v3 double-round-robin 18-game format is the operator's own 15-year-evolved league variant. Unit 3 characterization tests capture this chart's actual current behavior — it's the authoritative source for that league's rules, with no external spec to cross-check against.
- **Fargo scoring UX:** winner selection uses the existing BCA confirm flow; ball-count entry is a single-player segmented 0–7 input that appears after mutual confirmation. Two-step model in one modal.

## Open Questions

### Resolved During Planning

- **Naming collision** (origin Open Question 3): use existing `preferences.handicap_type` as the routing key; no new column. Wizard keys (`standard_3v3`/`standard_5v5`/`fargo_5v5`) stay UI-only. Module code names (`bca3v3`/`bca5v5`/`fargo5v5`) stay internal.
- **Threshold interface shape**: signature-per-preset. BCA and Fargo have different parameter lists on `module.threshold.computeThreshold`; no shared nullable roundContext.
- **Handicap_percentage dial** (origin Open Question 5): omit from v1 JSONB. Speculative; not a known-varying knob.
- **Per-round vs per-match start-points** (originally Open Question 2 under per-round assumption): RESOLVED — operator clarified start-points are set once at match start in his league. Lineup amendments don't retroactively change them.
- **Snapshot timing / drift warning** (originally Open Questions 6 and 7): RESOLVED — no snapshot mechanism exists in v1. Per-game points are stored frozen on `match_games` at scoring time, so mid-season dial changes can't retroactively corrupt already-scored games. Operator discipline handles mid-match-night edits.

### Resolve Before Implementation Starts

These are blocking gaps. Implementation MUST NOT start until each is resolved by the operator (you). Each has a recommended default.

1. **Anonymous / double-duty sub Fargo rating** (flow gap #3) — RESOLVED BY OPERATOR.
   - **Anonymous sub (Fargo):** manual rating entry, same as a named Fargo player. HandicapCell already does type-aware input per commit 36c4d09.
   - **Double-duty sub (Fargo):** TBD display is fine, same as BCA. Double-duty resolves **by reference** — when the TBD slot gets a player assigned, that player's already-entered rating elsewhere in the lineup carries over automatically. No re-entry, no "using Team A's rating" label in the TBD cell.
   - **Validation at submit time:** every *named* Fargo slot must have a rating (100–850). *TBD* slots are allowed to be null at submit; they get their rating when the TBD resolves to an actual player.
2. **Scoring modal shape for Fargo** (flow gap #5) — RESOLVED BY OPERATOR.
   - Fargo uses the **same single-step confirm modal** as BCA. No two-step "confirm winner, then enter points" flow.
   - The existing modal gains a **points** field (winner points + loser balls pocketed) alongside the existing Break & Run / Golden Break checkboxes. All fields submit together in one confirm action. Same scorer-picks / opponent-confirms audit.
   - **Architectural direction (not a full v1 deliverable):** the modal becomes field-configurable per league via resolved preferences. The shown fields = union of what this league tracks (break & run, golden break, loss on break, illegal break, points, ball count, etc.). One modal, many configurations.
   - **v1 scope:** add the points field to the existing modal with show/hide wired to Fargo's preferences. Follow the configurable shape so nothing gets thrown away when the full "all fields configurable" redesign lands later (still Deferred).
3. **`EditGameDialog` for Fargo games** (flow gap #7) — RESOLVED automatically by the same configurable-modal direction. Edits go through the same confirm flow, same scorer/confirmer audit, regardless of system.
4. **Tie state** (flow gap #11) — RESOLVED BY OPERATOR (2026-04-18).
   - Fargo league tiebreaker rule: **games-won**. If two teams have equal points, the team with more games won wins the match.
   - **Fargo 5v5 (25 games) cannot tie** after this cascade — odd game total means games-won is always decisive. Points might tie; games-won always breaks it.
   - **Implementation:** Unit 12's `computeMatchResult` uses `higher_points → higher_games_won` cascade. Writes `winner_team_id` + `match_result='home_win'|'away_win'` + `status='completed'`. **No `fargo_tie_pending` sentinel. No Fargo use of `match_result='tie'`.** BCA tiebreaker semantics (`match_result='tie' + status='in_progress'`) untouched.
   - **Collision warning preserved:** `match_result='tie'` is still load-bearing for BCA tiebreakers (see `src/player/MatchLineup.tsx:260`, `src/player/ScoreMatch.tsx:618`). Unit 12 MUST NOT write 'tie' for Fargo matches.
   - **Other Fargo formats (future 3v3 18-game, 4v4 16-game)**: may produce games-won ties. Deferred — operator will define the next tiebreaker when those formats arrive.

### Deferred to Implementation

- Exact method signatures on `SystemModule` (shaped in Unit 1, refined in Units 2–4 as callers migrate).
- Transaction boundaries for `match_games` insert + match-total update (shaped in Unit 11).
- Dial UI layout details (shaped in Unit 13).

## Output Structure

```
src/
├── systems/                                    (new)
│   ├── types.ts                                 # SystemModule interface + shared types
│   ├── resolver.ts                              # routes handicap_type → SystemModule
│   ├── bca3v3.ts                                # BCA 3v3 module
│   ├── bca5v5.ts                                # BCA 5v5 module
│   ├── fargo5v5.ts                              # Fargo 5v5 module
│   └── __tests__/
│       ├── bca3v3.test.ts
│       ├── bca5v5.test.ts
│       ├── fargo5v5.test.ts
│       └── resolver.test.ts
├── components/
│   ├── operator/preferences/
│   │   └── SystemOverridesSection.tsx           (new)
│   └── scoring/
│       (Fargo ball-count entry is a field INSIDE ScoringModal, not a separate component)
└── types/
    └── systemOverrides.ts                       (new)

supabase/migrations/
├── 20260418000000_add_leagues_system_overrides.sql        (new — Unit 4)
├── 20260418000001_add_fargo_match_columns.sql             (new — Unit 5, bundles fargo_start_points + match_games Fargo columns)
├── 20260418000002_lock_tier1_preferences.sql              (new — Unit 6, BEFORE UPDATE trigger on preferences)
└── 20260418000003_add_matches_system_snapshot.sql         (new — Unit 7, matches.system_snapshot JSONB column)
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### SystemModule interface (directional)

```typescript
// src/systems/types.ts — directional sketch, not final
interface SystemModule {
  key: 'bca3v3' | 'bca5v5' | 'fargo5v5';

  teamFormat: {
    lineupSize: number;
    maxRosterSize: number;
    gameGeneration: 'double_round_robin' | 'single_round_robin';
  };

  rating: {
    requiresManualEntry: boolean;                    // true for Fargo
    computeFromHistory?: (playerId, context) => RatingValue;
    displayFormat: (value: RatingValue) => string;
    validate: (value: unknown) => { ok: true; value: RatingValue } | { ok: false; message: string };
  };

  scoring: {
    method: 'games_won_with_team_bonus' | 'points_accumulated';
    recordGameOutcome: (game, outcome, overrides) => GameRecord;
    computeMatchResult: (match, games, overrides) => MatchResult;   // returns winner or 'tie'
  };

  threshold: BCAThreshold | FargoThreshold;
}

interface BCAThreshold {
  mode: 'games_to_win';
  compute: (handicapDiff: number, overrides: SystemOverrides)
    => { win: number; tie: number | null; lose: number };
}

interface FargoThreshold {
  mode: 'start_points';
  compute: (homeRatings: number[], awayRatings: number[], overrides: SystemOverrides)
    => { startPointsForWeakerTeam: number; weakerTeam: 'home' | 'away' | 'tie' };
}
```

### Resolution flow

```
useResolvedLeaguePrefs(leagueId)                   // existing hook
  → resolved.handicap_type                         // 'points' | 'percentage' | 'fargo'
      → resolver.pickModule(handicap_type)         // new
          → SystemModule                           // bca3v3 | bca5v5 | fargo5v5
              → module.scoring.*                   // at scoring time
              → module.threshold.*                 // at threshold calc time
              → module.rating.*                    // at lineup time
```

### Dial resolution (system_overrides)

```
At call sites: module behaves per (module defaults) overridden by (leagues.system_overrides)
Per-game points written to match_games at scoring time = frozen storage
No snapshot, no drift warning — once a game is scored, its points don't re-read from dials
```

## Implementation Units

### Phase 1 — Foundation (no behavior change)

- [ ] **Unit 1: Define SystemModule interface and shared types**

**Goal:** Create the type surface for the abstraction. No runtime behavior yet.

**Requirements:** R5, R6.

**Dependencies:** None.

**Files:**
- Create: `src/systems/types.ts`
- Create: `src/types/systemOverrides.ts`
- Modify: `src/types/index.ts` (barrel export)

**Approach:**
- `SystemModule` interface per directional sketch in High-Level Technical Design
- `SystemOverrides` JSONB shape (flat, string keys matching dial names in origin's Known Dials)
- Discriminated-union threshold type: `BCAThreshold | FargoThreshold`
- Supporting types: `RatingValue`, `GameRecord`, `MatchResult`
- No implementations yet

**Patterns to follow:**
- Type organization: colocated by domain per `src/types/preferences.ts`
- Naming: match existing conventions (PascalCase interfaces, camelCase fields)

**Test scenarios:** Test expectation: none — pure type definitions, no runtime behavior.

**Verification:**
- Types compile (`pnpm run typecheck`)
- Types are barrel-exported
- `SystemModule` fields cover all behaviors the resolver currently branches on (rating, scoring, threshold)

---

- [ ] **Unit 2: Create resolver**

**Goal:** Map `handicap_type` string → `SystemModule` instance. No module implementations yet — placeholders/throws.

**Requirements:** R1, R2, R5.

**Dependencies:** Unit 1.

**Files:**
- Create: `src/systems/resolver.ts`
- Create: `src/systems/__tests__/resolver.test.ts`

**Approach:**
- `resolver.pickModule(handicapType: string)` returns a `SystemModule`
- Mapping: `'points'` → bca3v3, `'percentage'` → bca5v5, `'fargo'` → fargo5v5
- Unmapped values: log warning, fall back to `bca5v5`. This is defense-in-depth only — `handicap_type` is always chosen from shipped presets in the wizard UI (never user-typed), so unmapped values should only occur on legacy leagues pre-lazy-migration. Fallback matches current `getGamesNeeded` default routing (`'points' → 3v3 chart, everything else → 5v5 chart`) to avoid changing behavior on any edge case that does surface.

**Patterns to follow:**
- Lookup map shape: similar to `PRESET_MAPPINGS` in `src/wizards/league-v2/presetMappings.ts`

**Test scenarios:**
- Happy path: `pickModule('points')` returns module with `key: 'bca3v3'`
- Happy path: `pickModule('percentage')` returns module with `key: 'bca5v5'`
- Happy path: `pickModule('fargo')` returns module with `key: 'fargo5v5'`
- Edge case: `pickModule('unmapped_string')` logs warning and returns bca5v5 fallback
- Edge case: `pickModule(null as any)` logs warning and returns bca5v5 fallback
- Edge case: `pickModule('')` logs warning and returns bca5v5 fallback

**Verification:**
- All mapped strings route to the correct module
- Unmapped/null/empty values fall back without throwing
- Warning logged on fallback

---

- [ ] **Unit 3: Extract BCA behavior into bca3v3 and bca5v5 modules**

**Goal:** Wrap existing BCA logic in `SystemModule` implementations. Route callers through resolver instead of direct imports.

**Requirements:** R1, R2, R5.

**Dependencies:** Unit 2.

**Files:**
- Create: `src/systems/bca3v3.ts`
- Create: `src/systems/bca5v5.ts`
- Create: `src/systems/__tests__/bca3v3.test.ts`
- Create: `src/systems/__tests__/bca5v5.test.ts`
- Modify: `src/utils/handicap/index.ts` (becomes thin adapter that delegates to resolver)
- Modify: `src/utils/calculatePlayerHandicap.ts` (delegates to module.rating.computeFromHistory)

**Approach:**
- `bca3v3.ts`: imports `get3v3GamesNeeded` from existing TS file, wires `threshold.compute` to call it. Wires `rating.computeFromHistory` to existing `(W-L)/weeks` logic. Wires `scoring` to current games-won-plus-team-bonus behavior.
- `bca5v5.ts`: same pattern with `get5v5GamesNeeded` and percentage-based rating.
- `getGamesNeeded()` in `src/utils/handicap/index.ts` becomes: `resolver.pickModule(handicapType).threshold.compute(diff, {})`.
- Field names in returned threshold object should match existing `HandicapThresholds` shape (`{ games_to_win, games_to_tie, games_to_lose }`) to avoid caller changes.

**Execution note:** Characterization-first. Before refactoring `getGamesNeeded`, add a test that RECORDS the current output (by calling the existing function) for diffs −12 to +12 (3v3) and boundary diffs (0, 14, 15, 40, 41, 66, 67, 92, 93, 118, 119, 144, 145) for 5v5. Save the recorded values. The test reads the current output and asserts the refactored output matches it. Do NOT encode expected values in the plan — record them from actual code output.

**Patterns to follow:**
- Adapter pattern visible in the existing `useResolvedLeaguePrefs` (thin resolver over richer internals).
- No change to consumer contracts; only internals move.

**Test scenarios:**
- Characterization (runs against current code BEFORE refactor): record `getGamesNeeded(diff, 'points')` output for diffs −12 through +12; assert refactored output matches every recorded value
- Characterization: record `getGamesNeeded(diff, 'percentage')` output for boundary diffs; assert match
- Happy path: `bca3v3.threshold.compute(5, {})` returns a result matching the recorded diff=5 value
- Edge case: `bca3v3.threshold.compute(-12, {})` returns the lowest chart entry
- Edge case: `bca5v5.threshold.compute(1000, {})` (out-of-range) clamps to the highest range
- Happy path: `bca3v3.rating.computeFromHistory(playerContext)` matches current output for a known history
- Integration: `getGamesNeeded(5, 'points')` output is identical before and after the refactor for all characterization inputs

**Verification:**
- All characterization snapshots pass after the refactor
- No consumer of `getGamesNeeded()` requires changes
- `pnpm run typecheck` and `pnpm run build` succeed
- Manual smoke: open a BCA 3v3 match and confirm threshold display + scoring are unchanged

---

### Phase 2 — Schema additions

- [ ] **Unit 4: Add `leagues.system_overrides` JSONB column**

**Goal:** Per-league dial storage. Column exists and defaults to `'{}'::jsonb`; resolver merges at read time.

**Requirements:** R1, R2 (defaults preserve current behavior), v1 dial support.

**Dependencies:** Unit 3.

**Files:**
- Create: `supabase/migrations/20260418000000_add_leagues_system_overrides.sql`
- Modify: `src/systems/resolver.ts` (accept overrides; merge module defaults with overrides)
- Modify: `src/systems/__tests__/resolver.test.ts`

**Approach:**
- Migration: `ALTER TABLE leagues ADD COLUMN IF NOT EXISTS system_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;`
- Resolver accepts overrides object and passes into module methods via the `overrides` parameter
- `useResolvedLeaguePrefs` reads `leagues.system_overrides` and surfaces it

**Patterns to follow:**
- Migration structure: `supabase/migrations/20260410000000_extend_preferences_modular.sql`

**Test scenarios:**
- Happy path: resolver receives `{}` overrides; module uses its defaults
- Happy path: resolver receives `{ winner_points: 14 }`; Fargo module's scoring uses 14 instead of 10
- Edge case: unknown override key → module ignores silently
- Integration: updating `leagues.system_overrides` via mutation propagates through `useResolvedLeaguePrefs`

**Verification:**
- Migration applies cleanly
- Reading `leagues.system_overrides` returns `{}` for all existing rows
- `pnpm run build` succeeds

---

- [ ] **Unit 5: Add Fargo columns to matches and match_games**

**Goal:** Storage for Fargo start-points (match-level, set once) and per-game points (frozen per game).

**Requirements:** R3.

**Dependencies:** None.

**Files:**
- Create: `supabase/migrations/20260418000001_add_fargo_match_columns.sql`
- Modify: `src/types/match.ts` (extend types with new nullable fields)
- Modify: `src/api/mutations/*` that touch `match_games` (accept new fields)

**Approach:**
- Migration adds:
  - `matches.fargo_start_points INTEGER` (nullable; set at Fargo match start, NULL for BCA matches)
  - `match_games.winner_points INTEGER` (Fargo winner points; default 10 override-able; NULL for BCA)
  - `match_games.loser_points INTEGER` (Fargo loser points; 0–7; NULL for BCA)
  - `match_games.loser_balls_pocketed INTEGER` (raw input; NULL for BCA)
- No CHECK constraints on ranges — TypeScript validation is enforced at the single write path (the scoring modal). Keeps the schema flexible for future Fargo variants without a migration.

**Patterns to follow:**
- Migration structure per Unit 4

**Test scenarios:**
- Happy path: insert match_games row with Fargo fields → persists
- Happy path: insert match_games row with all Fargo fields NULL → persists (BCA case)
- Happy path: update matches.fargo_start_points at Fargo match start → persists
- Edge case: existing match_games rows after migration → all new columns NULL (no backfill)

**Verification:**
- Migration applies cleanly
- Existing BCA scoring continues to work (NULL columns are fine)
- `pnpm run build` succeeds

---

- [ ] **Unit 6: Tier 1 immutability enforcement (handicap_type, lineup_size)**

**Goal:** DB-level guarantee that `preferences.handicap_type` and `preferences.lineup_size` cannot change after a league is created. Tier 1 per the mutability hierarchy.

**Requirements:** Mutability hierarchy (Key Technical Decisions).

**Dependencies:** None.

**Files:**
- Create: `supabase/migrations/20260418000002_lock_tier1_preferences.sql`
- Modify: `src/api/mutations/preferences.ts` (surface clear error when attempting tier 1 update; don't rely on DB error alone)

**Approach:**
- Migration adds a BEFORE UPDATE trigger on `preferences` that raises an exception if `handicap_type` or `lineup_size` has changed AND the row represents a league (`entity_type = 'league'` and the league has at least one recorded match — or more conservatively, always after initial insert for a league entity).
- Application layer catches the DB error and surfaces a clear message ("handicap type and lineup size are locked at league creation; create a new league to change").
- Initial INSERT of a preferences row for a league is allowed; subsequent UPDATE of these fields is not.
- Organization-level and system-default preferences rows are NOT subject to this trigger (they're templates; modifications cascade only to new leagues).

**Patterns to follow:**
- Global-chart-modification protection in `supabase/migrations/20260410000002_threshold_charts.sql` (`prevent_global_chart_modification` trigger function). Mirror that shape.

**Test scenarios:**
- Happy path: creating a new league → INSERT into preferences with handicap_type='fargo' → succeeds
- Happy path: updating a league's `team_bonus_enabled` override on the preferences row → succeeds (not a tier 1 field)
- Error path: attempting UPDATE preferences SET handicap_type='points' WHERE entity_id=<league_id> → trigger raises, mutation returns the clear error
- Error path: attempting UPDATE preferences SET lineup_size=5 WHERE entity_id=<league_id> → trigger raises
- Edge case: UPDATE touching other fields but leaving handicap_type unchanged → succeeds (trigger compares OLD/NEW values)
- Edge case: organization-level preferences row (entity_type='organization') → handicap_type IS updatable (template for new leagues)

**Verification:**
- Trigger exists and fires only for `entity_type='league'` rows
- Direct SQL attempts to modify tier 1 league fields fail
- Application mutation surfaces the clear error message

---

- [ ] **Unit 7: Tier 3 match-start snapshot (`matches.system_snapshot`)**

**Goal:** When a match transitions from `scheduled` to `in_progress`, freeze the current tier 2/tier 3 dial values onto the match record. Scoring reads from the snapshot, not live league data. In-flight matches are immune to dial changes.

**Requirements:** Mutability hierarchy tier 3.

**Dependencies:** Unit 4 (system_overrides exists), Unit 5 (matches Fargo columns).

**Files:**
- Create: `supabase/migrations/20260418000003_add_matches_system_snapshot.sql`
- Modify: `src/hooks/useMatchScoringMutations.ts` (populate snapshot at scheduled → in_progress transition if not already set)
- Modify: `src/systems/resolver.ts` (when called with a match context that has a snapshot, resolve from snapshot; fall back to live only if snapshot is null — e.g., legacy matches pre-migration)
- Modify: `src/systems/__tests__/resolver.test.ts`

**Approach:**
- Migration: `ALTER TABLE matches ADD COLUMN IF NOT EXISTS system_snapshot JSONB;`
- Snapshot shape: `{ overrides: { ...tier2 dial values... }, threshold_chart_id: <uuid>, snapshot_at: <timestamptz> }`.
- Snapshot is populated atomically as part of the mutation that transitions `status='scheduled'` → `status='in_progress'`. Triggered from the first scoring event OR from an explicit "start match" action — whichever comes first.
- Resolver: given a match whose `system_snapshot IS NOT NULL`, use the snapshotted values. Given `system_snapshot IS NULL` (pre-migration legacy), fall back to live league values (documented caveat).
- Threshold-chart edits mid-season: because each match freezes its chart_id at transition time, an edit after this point only affects matches still in `scheduled` status. Matches already `in_progress` or `completed` keep their snapshotted chart_id.

**Execution note:** Integration test the freeze behavior end-to-end. This is where tier 3 is proven.

**Patterns to follow:**
- `seasons.threshold_chart_id` is already snapshotted at season creation per `supabase/migrations/20260410000002_threshold_charts.sql`. Mirror the mental model — per-match snapshot is the finer-grained extension.

**Test scenarios:**
- Happy path: scheduled match has `system_snapshot IS NULL`; first scoring mutation transitions to `in_progress` AND populates snapshot with current league values
- Happy path: subsequent scoring mutations do NOT overwrite the snapshot
- Happy path: changing `leagues.system_overrides` after snapshot is taken → in-flight match continues using snapshotted values; newly-scheduled matches use the new live values at their own transition
- Happy path: threshold chart edited mid-season → matches still `scheduled` will snapshot the new chart at their transition; matches already `in_progress` or `completed` keep their original chart_id
- Edge case: legacy match with `system_snapshot IS NULL` that started before this migration → resolver falls back to live league values with a logged warning
- Edge case: snapshot JSONB malformed → resolver logs error and falls back to live; match flagged for manual review
- Error path: transition mutation fails mid-write → match does NOT advance to in_progress; scoring mutation aborts cleanly

**Verification:**
- Migration applies cleanly
- Snapshot populated on first scoring event for a scheduled match
- Editing a league dial during an in-flight match does not change that match's scoring behavior
- Integration test proves forward-only propagation of chart edits

---

- [ ] **Unit 8: Tier 2 season-active lock**

**Goal:** When a season is active (first match has started, or season status is `active`), block edits to tier 2 settings (`leagues.system_overrides`, `preferences.threshold_chart_id`). Editing is allowed between seasons.

**Requirements:** Mutability hierarchy tier 2.

**Dependencies:** Unit 7 (to detect "has a match started?" or define season-active state).

**Files:**
- Modify: `src/api/mutations/preferences.ts` (guard tier 2 fields against update when season is active)
- Modify: `src/api/mutations/leagues.ts` (guard `system_overrides` updates against active season)
- Modify: `src/operator/LeagueSettings.tsx` (surface read-only state in UI during active season with clear messaging)
- Modify: `src/components/operator/preferences/SystemOverridesSection.tsx` (disable inputs when season active — this Unit runs before Unit 13 creates the section, so Unit 13 builds it aware of this state)

**Approach:**
- Define "season is active" = there exists at least one `matches` row for this league's current season with `status IN ('in_progress', 'completed')`.
- Application-layer guard in the mutation: before writing, query the active state. If active, reject with a clear error: "This setting is locked while the season is active. Wait until the season ends to change it."
- UI reads the same state and renders inputs as disabled with an inline explanation.
- Between-season window: after the season's last match completes AND before the next season's first match starts, tier 2 edits are allowed.

**Patterns to follow:**
- Existing mutation-guard patterns if present; otherwise introduce the pattern here.

**Test scenarios:**
- Happy path: league has a season but no matches started yet → tier 2 edits allowed; UI inputs enabled
- Happy path: league's first match is `in_progress` → tier 2 edits blocked; UI inputs disabled with explanation
- Happy path: league's season has ended (all matches `completed`) and a new season not yet scheduled → tier 2 edits allowed again
- Edge case: direct SQL update attempting to bypass app guard → allowed at DB level (this is app-layer enforcement; DB trigger is Tier 1 only). Document the limitation.
- Error path: user attempts save during active season → mutation returns clear error; form state preserved so user doesn't lose typed values

**Verification:**
- Tier 2 edits succeed during between-season window
- Tier 2 edits blocked during active season with clear user-facing error
- UI matches the guard state

---

### Phase 3 — Fargo

- [ ] **Unit 9: Capture FargoRate formula test cases (planning-phase research — substantially done)**

**Status update (2026-04-18):** core formula captured in `docs/research/fargorate-formula.md`. One real test case captured from a played match:
- Home [567, 458, 493, 486, 574] vs Away [447, 394, 452, 322, 374], 10-point system, 25 games → official calculator gave **56 start-points** to away.
- Our formula computed **55** for this case (within ±1 tolerance). Formula validated.

Remaining work: gather 5-10 more cases over time from played matches or hand-walked calculator runs. Not blocking Unit 10 implementation — Unit 10 starts with Case 1 as the seed assertion; additional cases are added as they accumulate. With the override-at-lineup-lock flow (Unit 11), any formula error is captured and corrected at confirm time by captains.

**Goal:** Before writing Fargo math code, capture the authoritative formula and at least 10 test cases from FargoRate's official calculator. This is research, not code.

**Requirements:** R4.

**Dependencies:** None.

**Files:**
- Create: `docs/research/fargorate-formula.md` — formula prose, source citations, 10+ test cases (inputs → expected outputs)

**Approach:**
- Hand-walk the FargoRate calculator at https://leaguecalc.fargorate.com/ for rosters covering:
  - Even matchup (both teams same average rating)
  - Small gap (~50 rating diff)
  - Moderate gap (~100 rating diff)
  - Large gap (~200 rating diff)
  - Extreme gap (~300+ rating diff)
  - Edge: one team near rating floor, other near ceiling
- Capture: input rosters (5 ratings per team) + format params → output start points
- Cite every formula component with URL + quote
- If formula isn't fully documented publicly, note which parts are inferred from observed calculator behavior

**Execution note:** Produces a document, not code. Do not proceed to Unit 10 until this document has been reviewed and validated against the operator's own league experience.

**Fallback if formula can't be fully captured:** Ship Unit 10 with an empirically-matched lookup/formula that matches the 10 captured test cases within tolerance. Document the limitation. R4 relaxes to "matches these 10 captured cases" rather than "matches the full formula surface."

**Test scenarios:** Test expectation: none — this unit produces a research document. The 10+ captured test cases BECOME the test inputs for Unit 10's tests.

**Verification:**
- Document exists with at least 10 worked test cases
- Each test case has input rosters + expected start-points output from the official calculator
- Operator has read and validated the captured formula matches their own league experience

---

- [ ] **Unit 10: Implement fargo5v5 SystemModule**

**Goal:** Fargo rating, scoring, and match-level start-points logic behind the `SystemModule` interface.

**Requirements:** R3, R4.

**Dependencies:** Unit 1, Unit 2, Unit 4, Unit 5, Unit 9 (formula captured).

**Files:**
- Create: `src/systems/fargo5v5.ts`
- Create: `src/systems/__tests__/fargo5v5.test.ts`
- Modify: `src/systems/resolver.ts` (wire 'fargo' → fargo5v5)

**Approach:**
- `rating.requiresManualEntry: true`. `rating.validate` enforces 100–850 integer range.
- `rating.computeFromHistory` returns null/undefined (manual-only).
- `threshold.compute(homeRatings, awayRatings, overrides)`: single call, returns start-points for the weaker team per the formula from Unit 9.
- `scoring.method: 'points_accumulated'`. `recordGameOutcome` writes `winner_points` (from `overrides.winner_points ?? 10`) and `loser_points` (from `loser_balls_pocketed`).
- `scoring.computeMatchResult`: sums home vs away points across all games + `matches.fargo_start_points` awarded to the weaker team; applies `highest_after_all_games`; returns winner or 'tie'.
- Hardcoded defaults: `winner_points: 10`, `loser_points_method: 'balls_pocketed'`, `loser_points_max: 7`. All override-able via `system_overrides`.

**Execution note:** Test-first. Use the 10+ test cases from Unit 9 as the initial test inputs; implement until all pass within rounding tolerance.

**Patterns to follow:**
- Module shape: mirrors `bca3v3.ts` / `bca5v5.ts` structure from Unit 3
- Pure-function test style: `src/__tests__/unit/` pattern

**Test scenarios:**
- Happy path: all 10+ captured FargoRate test cases — input rosters → expected start-points within rounding tolerance
- Happy path: `scoring.recordGameOutcome({ winnerTeam: 'home', loserBallsPocketed: 3 }, {})` returns `{ winner_points: 10, loser_points: 3, loser_balls_pocketed: 3 }`
- Happy path: with override `{ winner_points: 14 }`, same call returns `winner_points: 14`
- Happy path: `computeMatchResult` with home totaling 145 + away 140 + start_points=8 to away → winner is home (145 vs 148, home loses); flipping to home=150 → home wins (150 vs 148)
- Happy path: `computeMatchResult` with equal totals after applying start_points returns `'tie'`
- Edge case: `rating.validate(99)` returns ok: false (below range)
- Edge case: `rating.validate(851)` returns ok: false (above range)
- Edge case: `rating.validate(500.5)` returns ok: false (must be integer)
- Edge case: `rating.validate(null)` returns ok: false
- Edge case: `threshold.compute` with ratings arrays of different lengths errors cleanly (defense in depth — Unit 11 validates upstream)
- Edge case: `threshold.compute` with a null/undefined rating in the array errors cleanly
- Integration: score a full 25-game Fargo match via all three module methods; assert final score matches hand-computed expected value including start_points
- Integration: `overrides.loser_points_method = 'none'` → all games credit 0 to loser regardless of ball count

**Verification:**
- All Unit 9 captured test cases pass within tolerance
- Rating validation catches out-of-range/non-integer/nil inputs
- Resolver correctly routes `'fargo'` to `fargo5v5`
- Manual: run through a full match using test ratings; match formula output against official calculator

---

- [ ] **Unit 11: Fargo lineup integration and scoring-modal points field**

**Goal:** User-facing Fargo scoring flow. Lineup submission computes + stores start-points. The existing single-step scoring modal gains a points field (winner points + loser balls pocketed) shown conditionally for Fargo matches, alongside existing Break & Run / Golden Break checkboxes.

**Requirements:** R3.

**Dependencies:** Unit 5, Unit 10, Resolve Before Implementation #1 and #2.

**Files:**
- Modify: `src/components/scoring/ScoringModal.tsx` — add a points field (winner-points input + loser-balls-pocketed 0–7 segmented control) rendered conditionally based on resolved preset. Submit is still a single confirm action that writes all fields together.
- Modify: `src/hooks/useMatchScoringMutations.ts` (accept the new fields; write to match_games Fargo columns in the same mutation as winner + achievement flags)
- Modify: `src/hooks/lineup/useLineupPersistence.ts` (on Fargo lineup lock, compute + persist `matches.fargo_start_points`; also handle TBD-slot rating propagation)
- Modify: `src/hooks/lineup/useLineupValidation.ts` (Fargo-specific: rating required 100–850 per *named* slot at submit; TBD slots allowed to be null)
- No new standalone `BallCountInput.tsx` component — the ball-count segmented control lives inside ScoringModal as a field, not as a separate step component.

**Approach:**
- **Single-step confirm modal.** Fargo does NOT add a post-confirm step. The existing modal adds points as another field. User picks winner + fills applicable fields (achievement checkboxes, points if Fargo) → one Submit → one DB write of winner + `winner_points` + `loser_points` + `loser_balls_pocketed` + any achievements. Opponent-confirm audit flow is unchanged.
- **Configurable-field shape.** Which fields render is driven by resolved preferences. For v1, the rule is simple: `handicap_type === 'fargo'` shows the points field; BCA shows existing checkboxes only. Layout is built so future preferences can toggle each field independently (break_and_run_tracked, golden_break_counts_as_win, points_tracked, etc.) without another redesign.
- **Points field UX:** winner-points as a plain number input defaulting to resolved `winner_points` (10 default, override-able). Loser-balls-pocketed as a shadcn ToggleGroup 0–7, touch-friendly. Loser-points is computed from the selected ball count on submit. Submit disabled until ball count is selected.
- **Lineup persistence for Fargo (with override + confirm flow):** when both teams have locked lineups with all *named* slots rated, compute `fargo5v5.threshold.compute(homeRatings, awayRatings, overrides)` — this is the **default** start-points value. Display it in the lineup confirmation UI alongside an edit control. Flow:
  1. Home captain sees the computed number. Can accept it or override with a different value (if BCA's official calculator produced a different number).
  2. Home captain submits their accepted/overridden value → enters "pending away confirmation" state.
  3. Away captain sees the proposed number + whether it matches the computed default. Confirms or disputes.
  4. On mutual confirmation, the agreed value writes to `matches.fargo_start_points`. Single write per match.
  5. On dispute, captains discuss offline; one re-submits, other re-confirms. Same back-and-forth pattern the scoring modal uses.
- The stored value in `matches.fargo_start_points` is the **final agreed-upon number** (possibly overridden), not necessarily the computed default. This is intentional — the app runs in parallel to BCA's official FargoRate app, and the official app's number is authoritative when captains decide.
- If TBD slots remain null at compute time, follow Unit 9 formula research for defined behavior on unknown ratings.
- **TBD resolution:** HandicapCell continues to render "TBD" for double-duty. When TBD resolves to a named player, that player's existing rating propagates by reference into the slot's persisted rating.
- **EditGameDialog:** same modal, same fields, same submit + confirm flow. For Fargo games, fields re-open pre-filled with the stored values.
- Concurrency: rely on DB atomic writes; last-writer-wins for simultaneous same-game edits. Document in code comment.

**Execution note:** Start with an integration test driving the full flow (lineup lock with ratings → start-points written → open scoring modal → pick winner → select ball count → submit → opponent confirms → match_games row written with all Fargo fields). This is where R3 is proven end-to-end.

**Patterns to follow:**
- Existing scoring modal structure: `src/components/scoring/ScoringModal.tsx` (current Break & Run / Golden Break layout is the template for the new points field)
- Segmented control: look at other uses of ToggleGroup in `src/components/ui/`
- Mutation pattern: `handleConfirmScore` in `src/hooks/useMatchScoringMutations.ts`

**Test scenarios:**
- Happy path: both teams lock Fargo lineup with all *named* slots rated → computed start-points shown in UI; home captain accepts → away captain confirms → `matches.fargo_start_points` populated with the computed value
- Happy path: home captain overrides the computed value (e.g., computed shows 5, BCA app shows 6, captain enters 6) → away captain confirms 6 → `matches.fargo_start_points` = 6 (overridden value stored, not computed)
- Happy path: away captain disputes the proposed value → home captain re-submits with corrected value → away re-confirms → final agreed value stored
- Edge case: home captain submits the computed default unchanged → away captain confirms → stored value equals computed value (common path)
- Happy path: open modal on a Fargo game → winner select + ball count "3" + submit → `match_games` row has `winner_points: 10, loser_points: 3, loser_balls_pocketed: 3`; opponent confirms; row finalizes
- Happy path: override `winner_points: 14` set on league → submit produces `winner_points: 14`
- Happy path: BCA match opens modal with NO points field rendered (checkboxes only)
- Happy path: Fargo match opens modal with points field rendered ALONGSIDE existing achievement checkboxes
- Edge case: ball count segmented control opens with NO button highlighted; Submit disabled until tap
- Edge case: tap 0 → submit produces `loser_points: 0` (0 is a valid score)
- Edge case: tap 7 → submit produces `loser_points: 7`
- Edge case: Fargo game's `EditGameDialog` re-opens with original ball count + winner_points pre-filled
- Edge case: lineup submission blocked if any *named* Fargo slot is missing its rating
- Edge case: TBD Fargo slot with no rating is allowed at lineup submit (resolves later)
- Edge case: Fargo rating out-of-range (<100 or >850) → inline validation error, blocks lineup submit
- Edge case: TBD slot resolves → that player's existing rating propagates into the slot's persisted rating
- Error path: DB write fails during scoring submit → UI shows error toast; `match_games` row not partially written
- Integration: two players on same team tap different winners within 1 second → DB records last write; UI reflects final state
- Integration: after submit + confirm, running totals on scoreboard update (including `fargo_start_points` credit to weaker team)

**Verification:**
- Full Fargo match runs end-to-end in dev environment
- BCA match scoring behavior unchanged (modal renders as before, no points field appears)
- Manual: run a mixed BCA+Fargo league locally; confirm modal correctly shows/hides the points field per match

---

- [ ] **Unit 12: Fargo match completion**

**Goal:** When all scheduled games are confirmed on a Fargo match, auto-complete with winner (or tie-pending sentinel).

**Requirements:** R3, Open Question 4 resolved for final tie shape (in follow-up).

**Dependencies:** Unit 10, Unit 11.

**Files:**
- Modify: `src/api/queries/matches.ts` (match completion logic — branch on preset)
- Modify: `src/hooks/useMatchScoringMutations.ts` (trigger completion check on final game)
- Modify: `src/components/scoring/FiveVFiveScoreboard.tsx` (surface Fargo totals in UI)

**Approach:**
- On every game confirmation: check whether all scheduled games are confirmed AND preset is Fargo.
- If yes: call `fargo5v5.scoring.computeMatchResult` → returns `{ winner: 'home' | 'away', home_points: N, away_points: M, home_games: G, away_games: G }` (totals INCLUDE `matches.fargo_start_points` credited to the weaker team). Winner is determined by `higher_points → higher_games_won` cascade. In Fargo 5v5 this always resolves; no tie return value.
- Write to `matches`: `winner_team_id`, `match_result` ('home_win' | 'away_win'), `home_team_score` (Fargo point total including start-points), `away_team_score` (Fargo point total including start-points), `home_points_earned` (Fargo match total for standings — same value as home_team_score), `away_points_earned` (same, for away), `home_games_won` (count of games home won), `away_games_won`, `completed_at: now()`, `status: 'completed'`.
- `home_points_earned` / `away_points_earned` are the generic "points earned" tally — every system fills these with values meaningful to that system. Standings (matches-won → points → games-won cascade) works for any system since values are internally consistent within a league's season.
- TIE outcomes: Fargo 5v5 resolves points-ties via games-won tiebreaker (Open Question 4, resolved). 25-game odd total means games-won is always decisive — Fargo 5v5 matches never end in a true tie. No `match_result='tie'` write; no pending placeholder.

**Patterns to follow:**
- Match completion: existing logic at `src/api/queries/matches.ts:500-559`. Extend with preset-aware branching.
- `match_result` values: current CHECK constraint already allows 'tie' (used for BCA tiebreaker trigger). Fargo 5v5 never writes 'tie' — games-won cascade always produces a decisive winner.

**Test scenarios:**
- Happy path: final Fargo game confirmed, home wins on points → match auto-completes with correct `winner_team_id`, `home_team_score` = total points + start-points credit; `home_points_earned` = Fargo match total; `home_games_won` = count of individual games home won
- Happy path: final Fargo game confirmed, teams tied on points but home has more games won → match completes with home as winner (games-won tiebreaker)
- Edge case: in Fargo 5v5 (25 games), games-won can never tie at 12.5/12.5 so the cascade always resolves. Confirmed by the 25-game odd-total arithmetic.
- Happy path: BCA match completion behavior unchanged (uses existing games-won path)
- Edge case: mid-match, not all games confirmed → match stays 'in_progress'
- Edge case: one game vacated while others scored → completion check waits for resolution
- Integration: score a full Fargo match to home-team win → `matches` row has correct values; all standings-contributing columns populated
- Integration: querying `standings.ts` on a Fargo league returns correct standings ordered by matches-won → points → games-won cascade

**Verification:**
- Fargo match win completion writes correct values
- BCA match completion is unchanged (characterization test from Unit 3 still passes)
- Scoreboard UI displays Fargo totals clearly

---

### Phase 4 — Settings

- [ ] **Unit 13: League settings UI for `system_overrides` dials**

**Goal:** Operator can edit the handful of known dials per league, subject to the tier 2 season-active lock. Only dials relevant to the active preset are shown.

**Requirements:** R3 (Fargo dials editable), v1 dial support. Honors tier 2 mutability per Unit 8.

**Dependencies:** Unit 4, Unit 8 (season-active lock logic).

**Files:**
- Create: `src/components/operator/preferences/SystemOverridesSection.tsx`
- Modify: `src/components/operator/PreferencesCard.tsx` (include new section)
- Create: `src/components/operator/preferences/__tests__/SystemOverridesSection.test.tsx`

**Approach:**
- Section renders conditional on resolved `handicap_type`:
  - Fargo: renders `winner_points` (number input, default 10), `loser_points_method` (select: balls_pocketed | fixed | none, default balls_pocketed), `loser_points_max` (number input, default 7)
  - BCA: renders `team_bonus_enabled` (checkbox, default true)
- Inline validation: positive integers; `loser_points_max` ≤ 15
- Save writes to `leagues.system_overrides` via mutation
- **Tier 2 season-lock behavior (per Unit 8):** when the current season is active (has at least one match with `status IN ('in_progress', 'completed')`), inputs render as disabled with an inline explanation: "These settings are locked while the season is active. They will become editable once the season ends." When no active season, inputs are editable.
- Edits take effect on future scheduled matches via their scheduled→in_progress snapshot (per Unit 7); matches already in-flight or completed keep their snapshotted values. No drift-warning UI needed because the tier hierarchy makes drift impossible in-flight.

**Patterns to follow:**
- Section shape: `src/components/operator/preferences/HandicapSettingsSection.tsx`
- shadcn components only per CLAUDE.md: `Input`, `Select`, `Label`, `Checkbox`, `Card`
- Mutation pattern: `src/api/mutations/preferences.ts`

**Test scenarios:**
- Happy path: Fargo league with no active season → section shows 3 Fargo dials enabled with defaults
- Happy path: BCA league with no active season → section shows 1 BCA dial enabled with default
- Happy path: edit `winner_points` 10→14 (no active season) → save → `leagues.system_overrides` contains `{ winner_points: 14 }`
- Happy path: values matching defaults remain absent from `system_overrides` (don't bloat JSONB)
- Happy path: league with an in-progress match → all dials render DISABLED with the lock explanation
- Happy path: season ends (all matches completed AND no new season started) → dials become enabled again
- Edge case: enter `winner_points: -5` → inline validation error, save disabled
- Edge case: enter `winner_points: 3.14` → inline validation error
- Edge case: enter `loser_points_max: 20` → inline validation error
- Edge case: user attempts save via developer tools bypassing disabled state during active season → mutation guard (Unit 8) rejects with clear error
- Integration: save change (no active season) → `useResolvedLeaguePrefs` picks it up; scheduled matches use new value at their transition
- Integration: save change while season active is blocked at mutation layer → UI error toast
- Error path: save fails (network) → UI shows error toast; values remain in the form

**Verification:**
- All dial edits persist correctly when season is not active
- Dials are correctly disabled when season is active, with inline explanation
- Irrelevant dials are hidden per-preset (no disabled clutter)
- Visual review: section matches the shadcn look of other `*Section.tsx` components

---

### Phase 5 — LO manual match entry

- [ ] **Unit 14: LO manual match bulk entry**

**Goal:** League Operator (admin) can capture an entire match's results after the fact — e.g., app was down, players kept score on paper. Writes completed `matches` + `match_games` rows directly, bypassing the live collaborative scoring flow. Separate entry surface, not a modification of the player-facing ScoringModal.

**Requirements:** Real-world continuity requirement — operator cannot lose a match because the app wasn't available. Not a Fargo-specific requirement; applies to all systems.

**Dependencies:** Unit 7 (match-start snapshot logic — the snapshot column still needs to be populated even on manual entry, using whatever preset/dials were live at the time the match would have started per operator-entered date), Unit 11 (Fargo field layout reused), Unit 12 (completion logic reused).

**Files:**
- Create: `src/operator/ManualMatchEntry.tsx` — operator-only page, accessed from LeagueSettings or an admin menu
- Create: `src/operator/__tests__/ManualMatchEntry.test.tsx`
- Create: `src/api/mutations/manualMatch.ts` — single transactional mutation that writes matches row + all match_games rows + populates system_snapshot + sets status='completed' + sets all scoring totals
- Modify: `src/operator/LeagueSettings.tsx` or the operator navigation — surface a "Record Match (Paper Scores)" entry point gated on operator role

**Approach:**
- **Flow:**
  1. Operator picks the match from a list of `scheduled` matches (or creates one on the fly if it wasn't scheduled)
  2. Operator picks each game's winner + achievement flags + (for Fargo) winner points + loser balls
  3. On submit: single transactional write that creates/updates the `matches` row with `system_snapshot` populated from current resolved prefs (operator is asserting "these are the rules this match used"), writes all `match_games` rows, calls `computeMatchResult` from the resolved SystemModule, sets the match to `completed` with correct totals.
- **Reuse:** the per-game entry form uses the same field-configurable shape as the live ScoringModal (Unit 11). Rendering is driven by the resolved system's scoring module — BCA matches show Break & Run / Golden Break checkboxes; Fargo matches show the points field.
- **Audit:** both `scorer_user_id` and `confirmer_user_id` set to the operator's user_id. An `entry_source` flag on `match_games` distinguishes manual-entry from live-scored for later reporting (nullable — NULL means live).
- **EditGameDialog unchanged:** post-entry corrections use the existing edit flow, same as a live-scored match.
- **Not for applying new rules:** manual entry is for capturing what actually happened, not for retroactive re-rating. If operator picks a past date, snapshot uses current dials (operator responsibility to confirm those match reality).

**Execution note:** Integration test drives a full paper-score entry end-to-end: operator picks a scheduled match → fills all games → submits → match is completed with correct totals and snapshot populated.

**Patterns to follow:**
- Operator-only page structure: mirror `src/operator/LeagueSettings.tsx`
- Transactional mutation: existing pattern in `src/api/mutations/matches.ts` / `src/api/queries/matches.ts` match completion
- Field-configurable layout: reuse the scoring-modal layout from Unit 11

**Test scenarios:**
- Happy path: operator opens manual-entry for a scheduled BCA 3v3 match, fills all 18 games, submits → match completes with correct `home_team_score`, `home_games_won`, `home_points_earned`, `winner_team_id`, `status='completed'`, `system_snapshot` populated
- Happy path: operator opens manual-entry for a scheduled Fargo 5v5 match, fills all 25 games with points + ball counts, submits → match completes with correct Fargo totals
- Happy path: operator opens manual-entry for a match that was never scheduled (bye became a real match unexpectedly) → operator creates the match record then fills
- Edge case: operator fills 24 of 25 games → save is disabled with "game 25 not yet recorded" inline error
- Edge case: operator submits mid-fill → abort / save-as-draft? (v1: require all games filled before submit; drafting is a follow-up)
- Edge case: match already has live-scored games when operator opens manual entry → operator sees those games pre-filled and can edit individually through EditGameDialog (not re-enter wholesale)
- Edge case: operator is not the LO for this league → page 403s or hides
- Error path: transactional write fails partway → no partial state; UI shows error; operator retries
- Integration: after manual entry, match appears in standings with correct values; `entry_source` flagged

**Verification:**
- Full manual-entry flow works for BCA 3v3, BCA 5v5, and Fargo 5v5
- Matches entered manually appear identical to live-scored matches in standings and reports
- Only users with operator role can access the page
- `entry_source` is queryable for later auditing

---

## System-Wide Impact

- **Interaction graph:**
  - `useResolvedLeaguePrefs` is the upstream entry point. Resolver addition is additive.
  - `getGamesNeeded` becomes a thin adapter (Unit 3).
  - `useMatchScoringMutations` gains Fargo-aware game insert (Unit 11) and scheduled→in_progress snapshot population (Unit 7).
  - `useLineupPersistence` gains Fargo start-points computation at lock time (Unit 11).
  - `useLineupValidation` already branches on `handicapType`; Fargo-specific rules added in Unit 11.

- **Error propagation:**
  - Resolver fallback (`unmapped → bca5v5`) logs but does not throw.
  - Fargo threshold with missing/invalid ratings raises a typed error — do NOT silently fall back.
  - DB write failures during scoring must be atomic or cleanly retryable.

- **State lifecycle:**
  - Per-game points: stored per-row at scoring time. Frozen.
  - Match-level Fargo start-points: stored once at lineup lock. Not recomputed for mid-match lineup amendments (simpler model; matches user's league's actual practice).
  - No snapshot, no drift-warning, no mid-season protection infrastructure.

- **API surface parity:**
  - No external API changes.
  - Types gain `SystemModule`, `SystemOverrides`. `match_games` gains optional Fargo fields. `matches` gains `fargo_start_points`.

- **Integration coverage:**
  - Full match flow per preset requires integration tests.
  - Wizard-to-resolver: creating a league via Wizard 2.0 → `handicap_type` written → resolver routes to correct module.

- **Unchanged invariants:**
  - `resolved_league_preferences` view is not modified.
  - Wizard 2.0 preset selection flow unchanged.
  - Existing BCA threshold TS files unchanged.
  - `threshold_charts` and `threshold_chart_rows` tables not touched.
  - Standings aggregation unchanged — the matches-won → points → games-won ranking cascade works for any system because every league's values are internally consistent. Fargo matches fully participate.
  - Existing `match_result='tie'` BCA tiebreaker semantics preserved.

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Unit 9 FargoRate formula capture reveals the official formula is substantially different from the predecessor plan's sketch | Medium | High — Unit 10 reworks | Unit 9 gates Unit 10. Do not commit to formula details until Unit 9 is reviewed |
| Unit 9 cannot fully document the official formula | High | High — R4 at risk | Fallback: ship Unit 10 with empirically-matched formula on 10+ captured test cases. R4 relaxes to "matches the captured cases" |
| BCA characterization tests miss a current-behavior edge case | Low | Critical — breaks R1/R2 | Record from actual code output, not assumed values. Manual smoke test of a live BCA match after Phase 1 |
| Concurrent scoring by multiple teammates produces races on `match_games` | Low | Low — last-writer-wins acceptable for collaborative model | Document in Unit 11 code comment. Rely on DB atomic writes |
| Operator changes a dial mid-match night | Low | Low — upcoming games use new value, scored games keep stored values | No infrastructure mitigation; operator discipline. If this ever becomes a real problem, add snapshot mechanism then |

## Phased Delivery

### Phase 1: Foundation (Units 1-3)
Deliverable: `SystemModule` abstraction exists, BCA behavior runs through it unchanged. No user-visible change.
Gate: BCA characterization tests pass; manual smoke on a live BCA match shows no regression.

### Phase 2: Schema + mutability enforcement (Units 4-8)
Deliverable: `leagues.system_overrides` JSONB + Fargo columns on `matches` and `match_games` + tier 1 DB trigger (immutable handicap_type/lineup_size) + `matches.system_snapshot` with scheduled→in_progress population + tier 2 season-active lock. BCA behavior unchanged.
Gate: Migrations apply; existing scoring continues to work; new columns NULL for BCA rows; attempting to update tier 1 fields on an existing league fails; a test match demonstrates snapshot freezes at transition.

### Phase 3: Fargo (Units 9-12)
Deliverable: Fargo 5v5 plays end-to-end; matches complete correctly with points → games-won cascade tiebreaker (no tie placeholder needed).
Gate: Unit 9 formula artifact reviewed and operator-approved. Unit 10 tests pass on captured FargoRate test cases (start with 1 real case, add more as available). A full Fargo match runs to completion locally.

### Phase 4: Settings (Unit 13)
Deliverable: Operator can edit tier 2 dials between seasons. Inputs disabled during active season with clear explanation.
Gate: Dial edits persist between seasons; UI correctly disables during active season.

### Phase 5: LO manual match entry (Unit 14)
Deliverable: Operator can bulk-enter a completed match's results after the fact (paper-scores recovery path). Works for all three presets.
Gate: Paper-score entry for a BCA 3v3 and a Fargo 5v5 match each produces a `completed` match with correct totals and populated `system_snapshot`.

## Documentation Plan

- Update `TABLE_OF_CONTENTS.md` with every new file (per CLAUDE.md requirement) — one update per phase is fine.
- Update `memory-bank/activeContext.md` to reflect the refactor in progress.
- `docs/research/fargorate-formula.md` (Unit 9) becomes a durable artifact referenced by Fargo-related code.
- `memory-bank/PLAN-fargo-handicap-system.md` is superseded by this plan; add a header pointer.

## Operational / Rollout Notes

- **No feature flag needed** — the refactor is additive.
- **Local dev first** — operator applies migrations through the 3-environment pipeline (dev → staging → prod) with PR review. No mobile-app coordination.
- **Production telemetry:** log line in `resolver.ts` when unmapped-handicap-type fallback fires. If it fires in production, open an issue to enumerate actual values.
- **Rollback path:** each migration uses `IF NOT EXISTS`. Reverting requires new migrations (no-destructive-change pattern). Phase 1 is reversible by reverting `src/systems/` and the adapter edit to `src/utils/handicap/index.ts`.
- **Migration numbering — known future reconciliation:** the `lo-manual-scoring` branch has chart-editor migrations currently dated `20260410*` that are planned to be renumbered to `20260119*` (earlier in the timeline) when that work integrates post-Fargo. Fargo migrations added by this plan use `20260418*` dates, which do not collide with either number set. When the chart-editor follow-up PR lands, applying its renumbered `20260119*` migrations before this plan's `20260418*` migrations on a fresh DB is the correct ordering (chart infrastructure first, then Fargo columns). On already-migrated DBs, the `IF NOT EXISTS` guards make ordering irrelevant.

## Sources & References

- **Origin document:** `docs/brainstorms/modular-handicap-scoring-requirements.md`
- **Predecessor plan:** `memory-bank/PLAN-fargo-handicap-system.md` (superseded by origin + this plan)
- **Related plan:** `memory-bank/plans/PLAN-wizard2.md` (Wizard 2.0)
- **Existing migrations referenced:**
  - `supabase/migrations/20260410000000_extend_preferences_modular.sql`
  - `supabase/migrations/20260410000002_threshold_charts.sql`
  - `supabase/migrations/20260417000000_add_modular_to_resolved_view.sql`
- **External:** FargoRate league calculator (https://leaguecalc.fargorate.com/) — to be hand-walked during Unit 9
- **Key code references:**
  - `src/utils/handicap/index.ts` (current `getGamesNeeded`)
  - `src/api/hooks/useResolvedLeaguePrefs.ts` (resolver pattern)
  - `src/wizards/league-v2/presetMappings.ts` (preset keys)
  - `src/components/lineup/HandicapCell.tsx` (existing Fargo rating entry)
  - `src/hooks/useMatchScoringMutations.ts` (scoring mutation seam)
  - `src/api/queries/matches.ts:500-559` (match completion pattern)
  - `src/player/MatchLineup.tsx:260`, `src/player/ScoreMatch.tsx:618` (existing `match_result='tie'` BCA tiebreaker semantics — DO NOT REUSE for Fargo)
