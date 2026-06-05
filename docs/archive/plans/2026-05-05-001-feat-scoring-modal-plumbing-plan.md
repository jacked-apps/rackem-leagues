---
title: Scoring Modal Plumbing — #23 Fix + Calculator-Driven Spec + UX/A11y
type: feat
status: active
date: 2026-05-05
origin: docs/brainstorms/2026-05-05-scoring-modal-rework-requirements.md
---

# Scoring Modal Plumbing — #23 Fix + Calculator-Driven Spec + UX/A11y

## Overview

Branch A of the scoring modal rework. Fixes the LIST_FOR_ED #23 data-integrity bug (silent loss of loser points on game 1 of every Fargo match), wires the modal to consume the dormant `scoringPopupFields()` calculator interface, generalizes the per-game scoring schema so it is no longer 10-7-specific, introduces an `<AdaptiveCounter>` primitive, and brings the modal up to project accessibility and shadcn standards.

Branch B (the event registry, `game_events` table, `enabled_events` preferences) is explicitly out of scope and will be planned separately. The two branches are coupled only one-directionally — Branch B consumes the spec-driven modal that Branch A produces; Branch A does not need anything from Branch B.

## Problem Frame

Three converging problems handled in one branch:

1. **#23 bug** — `src/player/ScoreMatch.tsx:805` reads only from `match.system_snapshot.points_calculator`, which is null on game 1 (snapshot is captured lazily at the first scoring event). The `UnifiedScoreboard` has the correct fallback at line 617 (`livePointsCalculator ?? null`); the modal does not.

2. **Architectural asymmetry** — calculators implement `scoringPopupFields()` correctly (verified — `accumulated_per_game.ts:135`, `linear_above_threshold.ts:149`, `accumulate_with_milestone_jumps.ts:124`) but no production consumer exists. `ScoringDialog` hardcodes a string check (`pointsCalculator === 'accumulated_per_game'`) and the loser-balls 0-7 grid.

3. **10-7-specific schema** — `match_games.loser_balls_pocketed` bakes ball-count semantics into the database. The actual concept is "per-game input value the calculator consumes" — could be points, balls, a ranged value, or anything a future calculator's params declare. The current name lies for any league that doesn't use 10-7's "1 point per ball" interpretation.

The modal also has long-standing UX cruft: raw `<input type="checkbox">` mixed with shadcn components, misleading title/button labels ("Select Game Winner" / "Select Winner" — the winner is already selected when the modal opens), and zero accessibility affordances.

## Requirements Trace

(see origin: `docs/brainstorms/2026-05-05-scoring-modal-rework-requirements.md`)

- A1. Modal renders the loser-side per-game input on game 1 of every match.
- A2. Modal resolves the active calculator from `match.system_snapshot.points_calculator`, falling back to live `leaguePrefs.points_calculator` when the snapshot is null.
- A3. `ScoringDialog` consumes the active calculator's `scoringPopupFields()` spec; removes the existing `pointsCalculator === 'accumulated_per_game'` string check.
- A4. New columns `match_games.winner_value` (integer NULL) and `match_games.loser_value` (integer NULL) hold per-game inputs whose meaning is calculator-determined.
- A5. Drop the 10-7-specific `loser_balls_pocketed` column. Migrate existing data into `loser_value` (per project policy: "all data is disposable test data" — no backfill plumbing).
- A6. New `<AdaptiveCounter>` component renders `kind: 'counter'` per-side input as a button grid for ranges ≤ 8. Slider and numeric-input modes deferred. Honors non-zero `min`; treats `min === max` as degenerate (render fixed UI).
- A7. Separation of concerns preserved: modal collects raw values into `winner_value` / `loser_value`; calculator's `compute()` runs whatever formula at read time.
- A8. Both winner-side and loser-side counters render independently when calculator declares them.
- A9. All modal inputs use shadcn components.
- A10. Modal title "Confirm Game Result" / primary button "Save Game".
- A11. Accessibility: radio semantics for mutually-exclusive groups, aria-live announcements on auto-uncheck, predictable focus order.
- A12. Attribution disclosure: inline label ("recorded as [Player Name]") near loss-cause event checkboxes.
- A13. Mobile field order: scoring inputs top, common ticks middle, modifiers bottom. 44px minimum touch targets.
- A14. Delete dead `src/components/scoring/ScoringModal.tsx`.

## Scope Boundaries

- AdaptiveCounter slider and numeric-input modes — added when a calculator declaring range > 8 actually ships.
- The 5 flat boolean columns on `match_games` (`break_and_run`, `golden_break`, `break_fouled`, `runout`, `win_by_forfeit`) are NOT touched. Branch B reworks them.
- Event registry, `game_events` table, `enabled_events` preferences, LO admin UI — Branch B.
- Calculator-side formula evolution beyond today's per-game accumulation — separate work the user refines on the calculator side.
- New event types (Early 8, Scratch on 8, etc.) — Branch B.

### Deferred to Separate Tasks

- Branch B (Event Registry + Storage + Override) — separate plan, separate PR. Will consume Branch A's spec-driven modal but adds its own surfaces (`game_events` table, `enabled_events` jsonb on `preferences`, LO admin UI, consumer migration for ~10-15 boolean-column readers). Plan to be written separately.

## Context & Research

### Relevant Code and Patterns

- **Fallback reference (A2):** `src/components/scoring/UnifiedScoreboard.tsx:614-617`. Use `snapshotValue !== undefined ? snapshotValue : (liveValue ?? null)` semantic — `!== undefined` rather than `??` so a deliberately-null snapshot value is not overwritten by a live default. Live prop is named `livePointsCalculator` to make the fallback nature explicit.
- **Calculator instance resolution (A3):** `src/systems/calculators/index.ts` exposes `getCalculator(name)` which returns the registered calculator. Self-registers on module load (this was added because the empty-registry case was the 2026-05-02 silent-zero-points bug). Caller pattern: see `types.ts:322` and `computeMatchRunningTotals.ts:181-204` (consumer narrows on `calculator.kind`).
- **scoringPopupFields() implementations (A3, A6):** `src/systems/calculators/accumulated_per_game.ts:135` returns `{ perSideInputs: { winner: { kind: 'fixed', points: 10 }, loser: { kind: 'counter', min: 0, max: 7, label: '...' } } }` for default Fargo params. `linear_above_threshold.ts:149` and `accumulate_with_milestone_jumps.ts:124` return `{ perSideInputs: null }`. Branch A's modal consumer must handle both shapes (null = winner-pick only; non-null = render per-side).
- **Migration pattern (A4, A5):** `supabase/migrations/20260501000000_matches_modular_columns.sql` is the closest precedent. Wraps drop+add in `BEGIN/COMMIT`, includes detailed plan-reference header, uses `COMMENT ON COLUMN`. Hard-rename pattern (no alias, no shim) per the modular-league-system v2 plan. Migration filename convention: `YYYYMMDDHHMMSS_snake_case_description.sql`.
- **shadcn modal reference (A9, A10):** `src/components/scoring/ManualTiebreakerDialog.tsx` (~120 lines) is the cleanest example. Uses `Dialog`, `DialogContent`, `DialogHeader/Title/Description/Footer`, `RadioGroup`/`RadioGroupItem`, `Label`, `Button`. Mutually-exclusive selection via `RadioGroup` is the exact pattern A11 requires.
- **shadcn primitives:** `Checkbox` at `src/components/ui/checkbox.tsx`; `RadioGroup` at `src/components/ui/radio-group.tsx`.
- **Adaptive UI primitive analog (A6):** `src/components/wizard/NumberStepper.tsx` (used by `SeasonLengthStep.tsx` for range 6-52, +/- buttons, mobile-friendly). Closest existing primitive but a stepper, not a grid. AdaptiveCounter is largely greenfield — the `ScoringDialog.tsx:288-303` inline 0-7 button grid is the only existing example of the grid mode.
- **Bug location (A1, A2):** `src/player/ScoreMatch.tsx:805-808`. Currently passes `pointsCalculator={(match?.system_snapshot as ...).points_calculator ?? null}` — no live-prefs fallback.
- **Live-prefs source (A2):** `src/api/hooks/useResolvedLeaguePrefs.ts` — already used at `ScoreMatch.tsx:125`. The data Branch A needs is already in the component scope (`leaguePrefs?.points_calculator`); the modal call site just needs to consume it.
- **State subscription chain:** `ScoreMatch.tsx` → `useResolvedLeaguePrefs` (`src/api/hooks/useResolvedLeaguePrefs.ts`); `match` data flows through `useSpectateMatch.ts` and related hooks. Realtime updates land in `src/realtime/useMatchRealtime.ts:233` (which forwards `loser_balls_pocketed` — that mapping must update too).
- **Calculator params source (A3):** `match.system_snapshot.points_calculator_params` (with live-prefs fallback to `leaguePrefs?.points_calculator_params`). Used by `getCalculator(name).scoringPopupFields(params)`.
- **Existing test patterns:** colocated `__tests__/` dirs. `src/components/scoring/__tests__/UnifiedScoreboard.test.tsx` is the closest model. `src/utils/match/__tests__/computeMatchRunningTotals.test.ts` and `src/utils/__tests__/fargoMatchTotals.characterization.test.ts` are characterization tests with heavy `loser_balls_pocketed` references that must be updated.

### Institutional Learnings

- **Hard-rename migration pattern** (`docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md` lines 273, 288, 296, 673): drop old column + add new column in a single consolidated migration; never alias/shim; never edit history post-merge. Precedent: `scoring_method` → `points_calculator`, `*_games_to_*` → `*_to_*`. Branch A's `loser_balls_pocketed` → `loser_value` follows the same shape.
- **Fallback `!== undefined` precedent** (origin: unified-scoreboard plan, `docs/plans/2026-05-03-001-feat-unified-scoreboard-plan.md` line 393): the `!== undefined` semantic was an explicit choice over `??` so a deliberately-null snapshot value is preserved. Branch A must mirror this exactly.
- **Calculator empty-registry bug** (silent-zero-points incident, 2026-05-02): the calculator registry now self-registers on module load. Plan should not introduce alternative lookup paths that bypass this; always go through `getCalculator(name)`.
- **`docs/solutions/` does not exist.** Institutional memory in this repo lives in plan documents, brainstorm documents, `LIST_FOR_ED.md`, and the user's auto-memory. Per learnings researcher recommendation, a `docs/solutions/` index is a future small task.
- **#23 itself is documented** at `LIST_FOR_ED.md:1404-1438` with root-cause analysis and workaround. Branch A closes that ticket.

### External References

None — codebase has strong local patterns for every Branch A concern. External research skipped.

## Key Technical Decisions

- **Mirror `UnifiedScoreboard.tsx:614-617` exactly for the #23 fallback** — including the `!== undefined` semantic, not `??`. Rationale: a deliberately-null snapshot value (e.g., a league explicitly opted out of points tracking) must not be overwritten by a live default that disagrees.
- **Calculator instance resolved at the modal level via `getCalculator(name)`**, not threaded through props as an instance. Rationale: matches how `UnifiedScoreboard` does it; keeps the prop surface minimal (modal receives `pointsCalculator: string | null` and `pointsCalculatorParams: Record<string, unknown> | null`); registry is the single source of truth for instance lookup.
- **Schema rename is a single consolidated migration**, drop + add together. Rationale: project memory `feedback_consolidate_migrations_in_pr` + "all data is disposable test data" stance allow the clean rebuild without backfill or dual-shape plumbing.
- **`<AdaptiveCounter>` ships grid-mode only this branch.** Rationale: only one calculator (`accumulated_per_game`) currently declares a counter spec, range 0-7. Building slider + numeric-input modes for hypothetical future calculators creates untested code paths that bit-rot. Add modes when real calculators with wider ranges ship.
- **Replace mutually-exclusive checkboxes with real `RadioGroup`** for B&R / Golden Break / Runout. Rationale: Radix `RadioGroup` provides correct screen-reader semantics for free; the existing checkbox-with-auto-uncheck pattern at `ScoringDialog.tsx:228-232` mimics radio semantics manually and was always a hack. Behavior change worth flagging in the PR description but functionally equivalent for sighted users.
- **Attribution disclosure inline near checkbox label**, not in a tooltip or modal-level summary. Rationale: scorer's eye is on the checkbox at the moment of decision; tooltips require hover (broken on mobile) and summaries require scroll on long modals.
- **Defer winner-side schema enforcement.** A4 adds `winner_value` as an integer column, but no current calculator writes to it (`accumulated_per_game` defaults to `winner: { kind: 'fixed' }` so no input is collected). Rationale: per the brainstorm's separation-of-concerns decision, the schema is ready for future winner-counter calculators; the calculator-side change to declare a counter is out of scope. Column is added now to avoid a second migration when the first such calculator ships.
- **`break_fouled` stays as a flat column** (Branch A does not touch it). Rationale: it does mechanical work on every modal render (drives B&R / runout role-gating). Branch B will decide whether to also record it as an event row.

## Open Questions

### Resolved During Planning

- **Where the live calculator instance is sourced.** Resolved: `getCalculator(name)` from `src/systems/calculators/index.ts`, called inside the modal with `pointsCalculator` (name) and `pointsCalculatorParams` (params) passed as props from `ScoreMatch.tsx`. No new hook needed.
- **Migration sequence.** Resolved: single consolidated migration that drops `loser_balls_pocketed`, adds `winner_value` and `loser_value`, in one transaction. No backfill (disposable test data). All consumers update in the same PR.
- **Where to put `AdaptiveCounter`.** Resolved: `src/components/scoring/AdaptiveCounter.tsx`. Colocated with the modal that consumes it; available for future use elsewhere if needed.

### Deferred to Implementation

- **Final modal copy and label phrasing for attribution disclosure.** Recommendation: "Recorded as [Player Name]" in muted text below the checkbox label when the event is loss-cause-attributed. Implementer adjusts after seeing the rendered layout — this is text fitting, not a product decision.
- **Whether `RadioGroup` should default to no-selection (matches current behavior — neither B&R nor Golden Break checked) or auto-select B&R.** Implementer decides during execution; current behavior is no-default-selection, which the implementation should preserve.
- **Min === max degenerate case in AdaptiveCounter** — render as fixed UI (no input), or render as a single-button grid? Implementer picks during execution; planning recommends fixed UI on the rationale that "you have no choice to make" deserves no input.
- **Test fixture refactor scope** for the column rename. The 69 existing references to `loser_balls_pocketed` include test fixtures. Implementer evaluates whether to regenerate characterization tests or update them in place.
- **Whether to update `src/types/database.types.ts` manually or regenerate from Supabase.** Project convention TBD; implementer follows whichever is the team norm.

## Implementation Units

Implementation units are dependency-ordered. Unit 1 ships independently as a hot fix. Units 2 and 3 can run in parallel. Units 4-6 are sequential. Unit 7 (cleanup) can ship anywhere.

```
Unit 1 (hot fix, ships first)
   └── (nothing depends on Unit 1)

Unit 2 (schema) ─┐
                 ├──> Unit 4 (spec consumption) ──> Unit 5 (UX) ──> Unit 6 (a11y)
Unit 3 (counter)─┘

Unit 7 (cleanup) — independent, ship any time
```

- [ ] **Unit 1: #23 fix — live-prefs fallback in scoring modal call site**

**Goal:** Apply the `livePointsCalculator` fallback to the `ScoringDialog` call site so game 1 of every Fargo match renders the loser-balls input. This is the smallest change in the branch and ships first as an isolated hot fix.

**Requirements:** A1, A2

**Dependencies:** None.

**Files:**
- Modify: `src/player/ScoreMatch.tsx` (the call site at line 805-808)
- Test: `src/player/__tests__/ScoreMatch.test.tsx` (new file or extend existing if present)

**Approach:**
- Replace the current `pointsCalculator={(match?.system_snapshot as ...).points_calculator ?? null}` expression with a fallback chain that mirrors `UnifiedScoreboard.tsx:614-617` exactly.
- The fallback uses `!== undefined` (not `??`) so a deliberately-null snapshot value is preserved.
- This is a true hot fix: 4-5 lines, single concern, ships independently. Do NOT thread `pointsCalculatorParams` here — that prop has no consumer until Unit 4 wires the spec consumption. Adding it now would dilute the hot-fix framing and put a dead prop into production. Unit 4 adds the params prop alongside its other modal changes.
- Modal internals stay hardcoded against the calculator name string; Unit 4 replaces that.

**Patterns to follow:**
- `src/components/scoring/UnifiedScoreboard.tsx:614-617` — fallback chain semantics.
- Keep the existing prop name `pointsCalculator` (don't rename to `livePointsCalculator`) — minimizes the diff and matches existing call-site conventions. The fallback resolution happens at the call site, not in the modal.

**Test scenarios:**
- Happy path: when `match.system_snapshot.points_calculator` is `'accumulated_per_game'`, modal opens with the loser-balls section visible. Assert the section renders.
- Edge case: when `match.system_snapshot` is `null` (game 1 case), modal still receives `pointsCalculator` = the value from `leaguePrefs.points_calculator`. Assert the section renders even with null snapshot.
- Edge case: when both snapshot and live prefs have `points_calculator` as `null`, modal receives `null` and the section is hidden (current behavior preserved).
- Edge case: when snapshot has `points_calculator` deliberately set to `null` (a league opted out of points), live prefs are NOT used as fallback — `!== undefined` semantic preserves the explicit null. Assert the section is hidden.

**Verification:**
- A new Fargo match's first scoring modal shows the loser-balls grid (manually verified in dev environment).
- Subsequent games still show it (regression check).
- A non-Fargo match (e.g., BCA 5v5) modal does not show the loser-balls grid in either game 1 or game 2 (regression check).

---

- [ ] **Unit 2: Schema generalization — drop `loser_balls_pocketed`, add `winner_value` and `loser_value`**

**Goal:** Generalize the per-game scoring storage so the schema is no longer 10-7-specific. Migrate all consumers to use the new column names.

**Requirements:** A4, A5, A7

**Dependencies:** Unit 1 (not technical — Unit 2 doesn't depend on Unit 1's code; but Unit 1 ships first so the bug fix isn't gated on schema work).

**Files:** (canonical list — verified via `grep -rln 'loser_balls_pocketed' src/ supabase/`; ~21 files, ~69 references)
- Create: `supabase/migrations/2026MMDDHHMMSS_match_games_value_columns.sql` (filename uses next available timestamp; project convention)
- Modify: `src/types/database.types.ts` (update Row/Insert/Update shapes — remove `loser_balls_pocketed`, add `winner_value`, `loser_value`. Hand-maintained per established convention; mirrors prior migrations like 20260501000000)
- Modify: `src/types/match.ts` (column-related type definitions, ~line 295)
- Modify: `src/systems/types.ts` (line 93 — type definition that references the column)
- Modify: `src/utils/match/computeMatchRunningTotals.ts` (lines 193-194 currently synthesize `winner_score: null, loser_score: g.loser_balls_pocketed`)
- Modify: `src/utils/fargoMatchTotals.ts` (~lines 82, 90)
- Modify: `src/systems/fargo5v5.ts` (lines 36, 173, 179, 211 — legacy 5v5 system reads/writes the column)
- Modify: `src/realtime/useMatchRealtime.ts` (line 233 forwards `loser_balls_pocketed` in the realtime payload mapping)
- Modify: `src/realtime/useMatchGamesRealtime.ts` (lines 148, 181 — second realtime hook, same pattern)
- Modify: `src/hooks/useSpectateMatch.ts` (lines 208-209 — derives per-player points from the column)
- Modify: `src/components/scoring/ScoringDialog.tsx` (rename prop `loserBallsPocketed` → `loserValue`, add `winnerValue` prop; minimal — Unit 4 does the deeper rework)
- Modify: `src/player/ScoreMatch.tsx` (rename state and prop pass-through; line 785 has another `loserBallsPocketed` reference beyond the line-805 call site)
- Modify: `src/hooks/useMatchScoringMutations.ts` (insert/update payloads)
- Modify: `src/api/queries/matches.ts` (any direct column references)
- Test: `src/utils/match/__tests__/computeMatchRunningTotals.test.ts` (~3 references — in-place rename)
- Test: `src/utils/__tests__/fargoMatchTotals.characterization.test.ts` (~17 references — in-place rename, do NOT regenerate; characterization intent is preserved by manual rename, not by regenerating snapshots)
- Test: `src/types/__tests__/match-scoring.characterization.test.ts:64` (single reference — update)
- Test: `src/systems/__tests__/fargo5v5.test.ts`, `buildSystemFromPreferences.test.ts`, `off_preset_combos.test.ts` (additional references discovered by grep — in-place rename)

**NOT in scope:** `src/components/scoring/EditGameDialog.tsx` is a vacate-request dialog (109 lines, no per-game input fields, no calculator-name string check, no `loser_balls_pocketed` references). Verified during planning. Out of scope for both the column rename here and the spec consumption in Unit 4.

**Approach:**
- **Land as two commits within this PR:** (1) migration + `database.types.ts` update + `match.ts` update — verifiable in isolation against schema. (2) all consumer file updates (synthesis, fargo5v5, realtime hooks, mutations, queries, modals) + test fixture renames. Keeps the migration reviewable independently of the ~12 application-layer file changes. Both commits in the same PR; PR review sees a coherent story.
- Single migration file. Supabase migrations run inside an implicit transaction by the CLI, so explicit `BEGIN/COMMIT` wrapping is not required (verified: only 2 of 58 migration files in the 2026 series use explicit wrapping). Plain DDL statements:
  - `ALTER TABLE match_games DROP COLUMN loser_balls_pocketed;`
  - `ALTER TABLE match_games ADD COLUMN winner_value integer;`
  - `ALTER TABLE match_games ADD COLUMN loser_value integer;`
  - `COMMENT ON COLUMN ...` for each new column describing it as "calculator-driven per-game input value; meaning determined by active calculator's scoringPopupFields() spec."
- TypeScript synthesis at `computeMatchRunningTotals.ts:193-194` changes from `loser_score: g.loser_balls_pocketed` to `loser_score: g.loser_value, winner_score: g.winner_value`. Calculator's `compute()` already reads from `winner_score` / `loser_score` on the in-memory shape, so the synthesis update is the only change there.
- Realtime payload mapping in `useMatchRealtime.ts:233` updated to forward `winner_value`, `loser_value`.
- All test fixture data referencing `loser_balls_pocketed` updated to `loser_value` (and where applicable, also includes `winner_value`).
- Branch A does not change calculator implementations — `accumulated_per_game.ts` continues to write to `winner: fixed` / `loser: counter`. The synthesis layer maps DB columns to calculator input shape.

**Patterns to follow:**
- `supabase/migrations/20260501000000_matches_modular_columns.sql` — header format, transaction wrapping, `COMMENT ON COLUMN`.
- `supabase/migrations/20260425000000_drop_fargo_start_points_columns.sql` — pure DROP example.
- Hard-rename precedent: see `docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md` lines 273, 288, 296.

**Test scenarios:**
- Happy path: a game record stored with `loser_value = 3` reads back through `computeMatchRunningTotals` and produces the same points value as the pre-migration `loser_balls_pocketed = 3` did. Use a regenerated characterization fixture to verify.
- Happy path: a game record stored with `winner_value = 5, loser_value = 3` reads back through `computeMatchRunningTotals` and synthesizes the correct calculator input shape (`winner_score: 5, loser_score: 3`).
- Edge case: a game record with `winner_value = null, loser_value = null` (e.g., a non-Fargo match where neither side has counter input) is handled the same as a record with no value — calculator's `compute()` defensively handles null per existing contract.
- Edge case: a row that previously had `loser_balls_pocketed = 0` (zero is a valid choice) maps to `loser_value = 0` (not null).
- Integration: realtime subscription pushing a `match_games` UPDATE payload includes `winner_value` / `loser_value` and the receiving hook decodes them correctly. (Verify via a unit test of the mapping function in `useMatchRealtime.ts`.)

**Verification:**
- Schema state after migration: `match_games.loser_balls_pocketed` does not exist; `match_games.winner_value` and `match_games.loser_value` exist as nullable integers.
- All TypeScript references to `loser_balls_pocketed` are gone (`grep -r 'loser_balls_pocketed' src/ supabase/` returns no results).
- All existing scoring-related tests pass with the renamed columns.

---

- [ ] **Unit 3: AdaptiveCounter component — grid-mode**

**Goal:** Introduce a reusable component that renders a per-side `kind: 'counter'` input. Grid-mode only this branch (slider and numeric-input modes deferred until a calculator with range > 8 ships).

**Requirements:** A6

**Dependencies:** None (independent of Unit 2 — can be built in parallel; integration in Unit 4).

**Files:**
- Create: `src/components/scoring/AdaptiveCounter.tsx`
- Test: `src/components/scoring/__tests__/AdaptiveCounter.test.tsx`

**Approach:**
- Component accepts: `min: number`, `max: number`, `label: string`, `value: number | null`, `onChange: (value: number) => void`, `disabled?: boolean`.
- Computes `range = max - min + 1` and dispatches by range size:
  - range ≤ 8 → button grid (the only mode this branch ships)
  - range ≤ 20 → throws or renders fallback (TBD by implementer; recommended: throws in dev with a clear "AdaptiveCounter slider mode not yet implemented; calculator declared range X" error so future calculator authors notice)
  - range > 20 → same fallback
- Grid mode renders one button per integer in `[min, max]`. Selected button uses `variant='default'`; others use `variant='outline'`. Mirrors the existing `ScoringDialog.tsx:288-303` pattern but parameterized.
- Honors non-zero `min`: a counter with `min=5, max=12` renders 8 buttons labeled 5 through 12.
- Degenerate case `min === max`: render as fixed-points UI — no buttons, just a label like `[label]: [min]` (not interactive). Rationale: a counter with no choice is not a counter.
- **Mobile layout:** 4-column grid that wraps to multiple rows. An 8-value range (current Fargo 0-7) renders as 4×2. Each button gets `flex-1 min-h-[44px]` so buttons fill the modal width evenly with 44px minimum height. Width-per-button is determined by container, not a hard min — at 320px viewport with typical modal padding (~32px), each button is ~70px wide which is comfortable for thumb taps. Hard `min-w-[44px]` is NOT used because 8 × 44 = 352px overflows the viewport.
- For ranges 1-4: single row, 4 columns. For ranges 5-8: 4×2 grid. Range > 8 is out of scope this branch (slider/input deferred per A6).
- **Visual states:** unselected uses shadcn `Button variant='outline'` (default border, no fill); selected uses `variant='default'` (filled). Hover, focus ring, and active states inherit from shadcn defaults — no custom overrides. Disabled state uses shadcn defaults (dimmed). On selection, no animation — instant state change to keep the modal feeling snappy.
- Label rendered above the grid via shadcn `Label`.
- No internal state: fully controlled by `value` / `onChange` from parent.

**Patterns to follow:**
- `src/components/scoring/ScoringDialog.tsx:288-303` — the existing inline 0-7 grid pattern.
- `src/components/wizard/NumberStepper.tsx` — closest existing primitive (stepper) for API style and mobile-friendliness.
- shadcn `Button` from `src/components/ui/button.tsx`; `Label` from `src/components/ui/label.tsx`.

**Test scenarios:**
- Happy path: rendering `<AdaptiveCounter min={0} max={7} value={null} ... />` shows 8 buttons labeled 0-7, none selected.
- Happy path: with `value={3}`, the "3" button has `variant='default'` styling; others have `variant='outline'`.
- Happy path: clicking a button calls `onChange` with the button's value.
- Edge case: `min=5, max=12, value=null` renders 8 buttons labeled 5 through 12, none selected.
- Edge case: `min === max` (e.g., `min=10, max=10`) renders a non-interactive label, no buttons. `onChange` is never called.
- Edge case: `value=0` (valid explicit choice in 0-N range) — assert the "0" button is selected.
- Edge case: `value=null` — assert no button is selected.
- Edge case: `disabled={true}` — buttons are not clickable; `onChange` not called on click attempt.
- Error path: `range > 8` (e.g., `min=0, max=20`) — verify the implementation's fallback behavior matches the chosen approach (throw or render fallback).

**Verification:**
- Component renders correctly for the existing Fargo 0-7 case (visual parity with the current inline grid in `ScoringDialog.tsx`).
- Tests pass for all scenarios above.
- Accessibility: keyboard navigable (Tab through buttons), Space/Enter selects.

---

- [ ] **Unit 4: ScoringDialog consumes scoringPopupFields() spec**

**Goal:** Replace the hardcoded `pointsCalculator === 'accumulated_per_game'` string check with calculator-driven rendering. The modal queries the active calculator's `scoringPopupFields(params)` spec and renders per-side counters via `<AdaptiveCounter>` when `kind: 'counter'` is declared.

**Requirements:** A3, A8

**Dependencies:** Unit 2 (column rename so prop names match storage), Unit 3 (`<AdaptiveCounter>` exists).

**Files:**
- Modify: `src/components/scoring/ScoringDialog.tsx` (the substantial rework — replace the hardcoded grid block at lines 282-306 with spec-driven rendering)
- Modify: `src/player/ScoreMatch.tsx` (pass `pointsCalculatorParams` prop alongside `pointsCalculator`)
- NOT in scope: `src/components/scoring/EditGameDialog.tsx` (verified during planning — vacate-request dialog only; no per-game input fields, no calculator-name string check)
- Test: `src/components/scoring/__tests__/ScoringDialog.test.tsx` (new file or extend existing)

**Approach:**
- Modal accepts two new props: `pointsCalculator: string | null` (already has it; keep this name to minimize diff) and `pointsCalculatorParams: Record<string, unknown> | null` (new).
- Inside the modal, resolve the calculator instance: `const calc = pointsCalculator ? getCalculator(pointsCalculator) : null;` (import from `src/systems/calculators/index.ts`).
- Resolve the spec: `const spec = calc?.scoringPopupFields(pointsCalculatorParams ?? {});` (calculator's `scoringPopupFields` already handles empty/missing params per its contract).
- Render per-side counters based on `spec?.perSideInputs`:
  - If `spec.perSideInputs` is `null` (aggregate calculator like `linear_above_threshold`) — render nothing for the per-side scoring section.
  - If `spec.perSideInputs.winner.kind === 'counter'` — render `<AdaptiveCounter>` for winner side, controlled by `winnerValue` state.
  - If `spec.perSideInputs.loser.kind === 'counter'` — render `<AdaptiveCounter>` for loser side, controlled by `loserValue` state.
  - `kind: 'fixed'` sides render nothing (no input needed).
- Submit-disabled logic: when any side declares `kind: 'counter'`, the corresponding state value must not be `null` before submit is enabled. `value === 0` is a valid explicit choice (current behavior); only `null` blocks submit.
- **Disabled-submit visual state:** the Save Game button uses shadcn `Button` default disabled styling (dimmed, no hover). Below the AdaptiveCounter (when its value is null and the calculator declares a counter for that side), render a small caption `text-xs text-muted-foreground` reading "Tap a value to continue." Caption disappears once a value is selected.
- **getCalculator() returns null (unregistered name):** modal renders no per-side scoring inputs (silent graceful degradation matching `UnifiedScoreboard`'s behavior). Submit stays enabled because there is no per-game value to collect when the calculator is unknown — the league simply doesn't get points-tracking data for that game. Console warning emitted via `console.warn('[ScoringDialog] Unknown calculator name: <name>')`. No in-modal error banner — failures during calculator resolution are operator-level concerns, not scorer-level.
- Remove the old `pointsCalculator === 'accumulated_per_game'` string check and the hardcoded 0-7 grid (lines 282-306).
- The modal's existing achievement / break-fault / forfeit logic stays untouched — Branch A only restructures the per-side scoring inputs section.
- `ScoreMatch.tsx` updates the `<ScoringDialog>` prop call to pass both the calculator name (from snapshot-with-fallback per Unit 1) and params (same fallback chain applied to `points_calculator_params`).

**Patterns to follow:**
- Calculator instance lookup: see `src/utils/match/computeMatchRunningTotals.ts:181-204` for how `getCalculator()` is consumed today.
- Discriminated union narrowing: `src/systems/calculators/types.ts:322` shows the canonical pattern.
- Spec consumption: this is the new pattern Branch A introduces. Document it in `ScoringDialog.tsx`'s `@fileoverview` so Branch B (and future modals) can mirror.

**Test scenarios:**
- Happy path: with `pointsCalculator='accumulated_per_game'` and default params, modal renders the loser-side `<AdaptiveCounter>` with range 0-7. (Verifies the spec-driven path produces the same result as the old hardcoded path for the existing Fargo case.)
- Happy path: with `pointsCalculator='accumulated_per_game'` and custom params declaring `loser: { kind: 'counter', min: 0, max: 14, label: '2 pts per ball' }`, modal renders the loser-side counter with range 0-14 and the label "2 pts per ball." Verifies arbitrary calculator-declared ranges work.
- Happy path: with `pointsCalculator='linear_above_threshold'`, modal renders no per-side scoring inputs (spec returns `{ perSideInputs: null }`).
- Happy path: with a future-shape spec declaring both winner and loser counters, modal renders both `<AdaptiveCounter>` instances side by side. (Use a mocked calculator with both sides as counters.)
- Edge case: `pointsCalculator` is `null` (no points tracking) — modal renders no per-side scoring inputs; submit-enabled logic is unaffected.
- Edge case: `pointsCalculator` is set but `getCalculator()` returns `null` (unregistered name) — modal handles gracefully (renders no per-side inputs; logs a warning).
- Edge case: spec declares `loser: { kind: 'counter', ... }` and `loserValue` is `null` — submit button is disabled.
- Edge case: spec declares `loser: { kind: 'counter', ... }` and `loserValue` is `0` — submit button is enabled (zero is a valid explicit choice).
- Integration: `ScoreMatch.tsx` passes both name and params; modal correctly resolves the calculator and renders the spec.

**Verification:**
- The string `'accumulated_per_game'` no longer appears as a calculator-name comparison in `ScoringDialog.tsx`.
- A future calculator with `winner: counter` and `loser: counter` declared in its `scoringPopupFields` returns shape can drive a fully-rendered two-counter modal without modal code changes.
- Existing Fargo behavior preserved for end users (visual parity with the pre-Unit-4 modal for `accumulated_per_game` defaults).

---

- [ ] **Unit 5: Modal UX overhaul — shadcn components, labels, mobile field order, attribution disclosure**

**Goal:** Bring the modal up to project component standards (per CLAUDE.md), update misleading title/button labels, reorder fields for mobile use, and surface attribution inline near loss-cause checkboxes.

**Requirements:** A9, A10, A12, A13

**Dependencies:** Unit 4 (modal already restructured with spec-driven rendering).

**Files:**
- Modify: `src/components/scoring/ScoringDialog.tsx` (replace raw `<input type="checkbox">` blocks at lines 90-110, 222-280; update title/button copy; reorder fields)
- Test: `src/components/scoring/__tests__/ScoringDialog.test.tsx` (extend with UX-specific tests)

**Approach:**
- **shadcn migration:** all three raw checkbox blocks (Break & Run at ~228-240, Golden Break at ~243-262, Runout at ~264-280) replaced with shadcn `Checkbox` components paired with `Label`.
- **Title:** `DialogTitle` updated from "Select Game Winner" to "Confirm Game Result." `DialogDescription` updated from "Select any special achievements for this game." to something post-tap-appropriate (e.g., "Confirm the game outcome and any special achievements." — implementer adjusts).
- **Primary button:** "Select Winner" → "Save Game". Cancel button stays "Cancel".
- **Field order (post-rework, top to bottom):**
  1. Winner name (header, "Winner: [Name]") — already at top, stays.
  2. Per-side scoring inputs (the `<AdaptiveCounter>` instances from Unit 4 — currently positioned at lines 282-306 of `ScoringDialog.tsx`, AFTER the achievement checkboxes; reordered to render BEFORE achievements).
  3. Achievement checkboxes (B&R, Golden Break, Runout — role-conditional from existing logic).
  4. State modifiers (Break-fault, Win-by-forfeit — existing `Switch` controls, moved to bottom).
- **Touch targets:** verify all interactive elements (buttons, switches, checkboxes, the AdaptiveCounter grid buttons) are ≥ 44px tall on mobile. Apply `min-h-[44px]` / `size='lg'` where needed.
- **Attribution disclosure:** below the `Win by forfeit` switch's label, when the switch is on, render muted text "Recorded as [Loser Name]" in a `<p className="text-xs text-muted-foreground mt-1">`. (This is the only loss-cause event in Branch A — Branch B will add Early 8, Scratch on 8, etc., with the same pattern.) Loser name is derived from the existing modal context (the side that didn't win — `game.loserPlayerName` if available, or computed from the winner / opponent split).
- The `getGoldenBreakLabel()` helper for game-type-specific Golden Break wording stays.

**Patterns to follow:**
- `src/components/scoring/ManualTiebreakerDialog.tsx` for shadcn modal composition.
- `src/components/ui/checkbox.tsx` for the Checkbox primitive.
- shadcn `Switch` (already used in the modal for break-fault and forfeit) for state modifiers.

**Test scenarios:**
- Happy path: modal renders with no raw `<input type="checkbox">` elements anywhere (assert via DOM query).
- Happy path: modal title text matches "Confirm Game Result"; primary button text matches "Save Game".
- Happy path: field order in DOM matches the spec (per-side scoring inputs render before achievement checkboxes, which render before state modifiers).
- Happy path: when `winByForfeit` is true, the modal shows "Recorded as [Loser Name]" text below the forfeit switch label.
- Edge case: when `winByForfeit` is false, the attribution text is not rendered.
- Edge case: when the loser name is unavailable (rare — game state inconsistent), attribution text is omitted (does not render "Recorded as undefined").
- Integration: the modal's break-fault `Switch` and forfeit `Switch` continue to function (regression check — Switches were already shadcn before this unit; Unit 6 handles the achievement-group RadioGroup conversion). Per the implementation note above, Unit 5 SKIPS converting the B&R/Golden Break/Runout group to shadcn Checkbox; that group stays as raw inputs until Unit 6 swaps it directly to RadioGroup.

**Verification:**
- Manual visual review on mobile (375px width): modal scrolls cleanly, all interactive elements meet 44px touch-target minimum, field order makes sense for thumb-tapping.
- Existing scoring flow tests still pass (regression check — UX changes should not break behavior at this point; behavior changes from the radio-semantics swap come in Unit 6).
- Attribution text visible when forfeit is checked; not visible otherwise.

---

- [ ] **Unit 6: Modal accessibility — RadioGroup for mutually-exclusive events, aria-live, focus order**

**Goal:** Replace the existing checkbox-with-clear-other-on-toggle hack with real `RadioGroup` semantics. Add aria-live region for auto-uncheck announcements. Establish predictable focus order for dynamically-visible events.

**Requirements:** A11

**Dependencies:** Unit 5 (modal already using shadcn components from Unit 5; a11y layered on top).

**Files:**
- Modify: `src/components/scoring/ScoringDialog.tsx` (Break & Run / Golden Break / Runout converted from individual checkboxes to a RadioGroup; aria-live region added; focus order audit)
- Test: `src/components/scoring/__tests__/ScoringDialog.a11y.test.tsx` (new file — accessibility-specific tests; or extend the existing test file)

**Approach:**
- **Replace mutually-exclusive group with RadioGroup:** Break & Run, Golden Break, and Runout are mutually exclusive (verified by the existing `onBreakAndRunChange` / `onGoldenBreakChange` handlers that clear-other-on-toggle). Convert these to a single `RadioGroup` with three options. RadioGroup also natively handles "no selection" (the default state when no event is checked).
  - Define a value enum: `'none' | 'break_and_run' | 'golden_break' | 'runout'`.
  - The role-conditional rendering (B&R / GB only when winner = breaker; Runout only when winner = non-breaker) becomes "the RadioGroup contains different options based on the role."
  - On change, map the radio value back to the existing per-event boolean callbacks (e.g., setting value to `'break_and_run'` calls `onBreakAndRunChange(true)` and clears the others).
  - **Behavior preservation:** the existing checkbox pattern at `ScoringDialog.tsx:222-280` allows "tap then re-tap to deselect" — verified. Radio buttons natively cannot deselect by re-tap. To preserve the deselection path for sighted users, the RadioGroup MUST include a "None" option as the first item, pre-selected on modal open. Label: "None". Visually equivalent styling to the three event options so it doesn't read as second-class. This makes the radio model functionally equivalent to the prior checkbox model: every modal opens with "None" selected; tapping an event switches to that event; tapping "None" returns to the unselected state.
- **aria-live region:** add a visually-hidden `<div role='status' aria-live='polite' className='sr-only'>` near the top of the modal body.
  - Locked announcement copy for Branch A: when toggling Forfeit ON cascades to clear a selected radio option, announce `"[Achievement Name] cleared because forfeit was selected."` (Implementer uses this exact template; Branch B reuses it for new cascade paths.)
  - Radio-to-radio switches do NOT need explicit announcement (radio semantics imply mutex to screen readers natively).
  - Toggling Forfeit OFF does NOT restore the prior radio selection; the radio stays at "None." Announce nothing on Forfeit-off.
- **Behavior change communication for sighted scorers:** in addition to the PR description note (below), the modal includes a small inline note (`text-xs text-muted-foreground`) below the achievement RadioGroup on first load: "Tap None to clear a selection." This is permanent, not a one-time toast — discoverable for any new scorer. Removed only when usage data shows scorers have adapted (future tweak).
- **Focus order:** with role-conditional events (B&R / Runout flip on break-fault), the modal's tab order must remain predictable. Ensure that when an event is hidden by a role flip:
  - Focus is not stuck on a hidden element.
  - The next visible element receives focus (or focus stays on the break-fault switch that triggered the flip — whichever feels less jumpy).
- **Behavior change PR note:** implementer adds a note in the PR description: "Mutually-exclusive achievement checkboxes (Break & Run / Golden Break / Runout) are now a RadioGroup with screen-reader-correct semantics. Functionally equivalent for sighted users; no test data should be affected."

**Patterns to follow:**
- `src/components/scoring/ManualTiebreakerDialog.tsx` — RadioGroup + RadioGroupItem composition for screen-reader-correct mutual exclusion.
- `src/components/ui/radio-group.tsx` (Radix wrapper).
- aria-live pattern is greenfield in this codebase — document the pattern in `ScoringDialog.tsx`'s `@fileoverview` so future modals mirror it.

**Test scenarios:**
- Happy path: tabbing through the modal visits Break-fault → Forfeit → RadioGroup (B&R / GB / Runout / None) → AdaptiveCounter buttons → Cancel → Save in a sensible order. (Use `userEvent.tab()` and assert focused element at each step.)
- Happy path: selecting "Break & Run" radio sends `onBreakAndRunChange(true)` and clears any Golden Break or Runout state. (Regression: same callback wiring as before.)
- Happy path: with break-fault toggled on and winner now being the actual non-breaker, the RadioGroup shows only Runout (and "(none)") — B&R and Golden Break are hidden. Tab order skips the hidden options.
- Edge case: toggling Forfeit on causes any selected radio option to clear. Assert the aria-live region's text updates to announce the auto-clear.
- Edge case: pressing Space on a focused radio option toggles it (radio button keyboard semantics).
- Edge case: `screen.getByRole('radiogroup')` returns the achievements group; `screen.getAllByRole('radio')` returns the visible options for the current state.
- Note on Unit 5/6 sequencing: Unit 5 swaps the raw `<input type="checkbox">` for shadcn primitives generically; Unit 6 then converts the mutually-exclusive achievement group specifically to `RadioGroup`. Implementer SHOULD skip the Checkbox conversion for the B&R/Golden Break/Runout group in Unit 5 and go directly to RadioGroup in Unit 6 — avoiding a wire-then-unwire sequence. Unit 5 still handles the non-mutually-exclusive shadcn migration (break-fault Switch already in place; any other raw inputs).
- Accessibility audit: run an automated a11y check (axe-core via `@axe-core/react` if the project has it; otherwise manual screen-reader test) and assert no critical violations.

**Verification:**
- Screen reader test (VoiceOver on macOS or NVDA): announces "Achievement, radio group" when entering the group; announces selected option; announces auto-clear when Forfeit cascades.
- Keyboard-only test: full modal flow completable with Tab / Shift-Tab / Space / Enter / Escape (where Escape is allowed — currently blocked; preserve the block).
- No console warnings from React about controlled-component state mismatches.

---

- [ ] **Unit 7: Delete dead code — `ScoringModal.tsx`**

**Goal:** Remove the dead `src/components/scoring/ScoringModal.tsx` file (zero imports; superseded duplicate of `ScoringDialog.tsx`). Avoids future confusion about which file is canonical.

**Requirements:** A14

**Dependencies:** None.

**Files:**
- Delete: `src/components/scoring/ScoringModal.tsx`

**Approach:**
- Verify zero imports before deleting: `grep -rn 'ScoringModal' src/` should return only the file itself and the coincidentally-named `onOpenScoringModal` callback prop in `src/hooks/useMatchScoringMutations.ts:95,184` (which is a prop name, not an import — confirm).
- Delete the file.
- No code changes elsewhere.

**Test scenarios:**
- Test expectation: none — pure deletion of dead code with no consumer impact.

**Verification:**
- After deletion: `grep -rn 'from.*ScoringModal' src/` returns no results (confirms zero import sites).
- `pnpm run build` and `pnpm run typecheck` pass without errors.

---

## System-Wide Impact

- **Interaction graph:** the call site `src/player/ScoreMatch.tsx` passes new props (`pointsCalculatorParams`) to `ScoringDialog`. `EditGameDialog` may need the same pattern if it has the same hardcoded block (verify in Unit 4). The mutation handler `src/hooks/useMatchScoringMutations.ts` writes to renamed columns (`winner_value` / `loser_value`).
- **Error propagation:** `getCalculator()` returning `null` (unregistered calculator name) is handled in the modal by rendering no per-side inputs and logging a warning — same defensive pattern as `UnifiedScoreboard`. No new error paths introduced.
- **State lifecycle risks:** the column rename is a one-shot migration. Test data is disposable, so no race condition between schema change and existing rows. Realtime subscription mappings (`useMatchRealtime.ts:233`) update in the same PR as the migration to prevent stale-payload bugs.
- **API surface parity:** `EditGameDialog` was verified during planning — it is a 109-line vacate-request dialog with no per-game input fields, no calculator-name string check, and no `loser_balls_pocketed` references. Out of scope for Branch A.
- **Integration coverage:** the spec-driven rendering path is novel in this codebase. Test scenarios in Unit 4 explicitly include the `kind: 'fixed'` (no UI) and dual-counter (winner + loser both counter) cases that mocks alone don't cover. Integration testing through `ScoreMatch.tsx` confirms the prop chain end-to-end.
- **Unchanged invariants:**
  - The 5 flat boolean columns on `match_games` (`break_and_run`, `golden_break`, `break_fouled`, `runout`, `win_by_forfeit`) are NOT touched by Branch A. They remain as-is. Branch B reworks them.
  - Calculator-side implementations (`accumulated_per_game.ts`, etc.) are NOT touched. Branch A only adds a consumer for the existing `scoringPopupFields()` interface.
  - The vacate-and-rescore flow (`useMatchScoringMutations.ts`) is unchanged — column rename is the only mutation handler change.
  - The points-tracking computation (`computeMatchRunningTotals.ts`) is unchanged in logic; only the column names it reads from change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Column rename breaks consumer not in the migration's update list. | Pre-migration grep audit (`grep -rn 'loser_balls_pocketed' src/ supabase/`) confirms all 69 references. Unit 2's file list is canonical. Verify count goes to zero post-Unit-2 before starting Unit 4. |
| RadioGroup behavior change (no deselection of selected option) breaks scorer muscle memory. | Implementer includes a "(none)" option in the RadioGroup so deselection remains possible. Behavior-change note in PR description. Manual testing on a real scoring flow (multiple games of B&R + Golden Break combinations). |
| `getCalculator(name)` returning null for an unregistered name during the rollout window of a calculator change. | Calculator registry self-registers on module load (per the 2026-05-02 silent-zero-points incident fix). No new lookup paths added; defensive `null` handling in the modal. Same pattern as `UnifiedScoreboard`. |
| `aria-live` announcements firing too aggressively or not at all (greenfield pattern). | Manual screen-reader test (VoiceOver / NVDA) before merge. Conservative announcement copy ("X unchecked because Y was selected"). Document the pattern in `ScoringDialog.tsx`'s `@fileoverview`. |
| The fallback chain change at `ScoreMatch.tsx:805` (Unit 1) could subtly re-introduce the bug if `!== undefined` is mistakenly written as `??`. | Test scenario explicitly covers the deliberately-null-snapshot case. Pattern reference (`UnifiedScoreboard.tsx:614-617`) cited in the unit. Code review checklist item. |
| Unit 2's migration on a database with active matches in flight (live data). | Per project policy, no live data exists. If circumstances change and live test data becomes valuable, a one-shot data-migration step (`UPDATE match_games SET loser_value = loser_balls_pocketed WHERE loser_balls_pocketed IS NOT NULL`) inside the same transaction is trivial — but currently unnecessary. |

## Documentation / Operational Notes

- Update `ScoringDialog.tsx` `@fileoverview` to document the calculator-driven spec consumption pattern, the RadioGroup mutex semantics, and the aria-live announcement convention. Branch B and future modal work will mirror this.
- Update `LIST_FOR_ED.md` to mark item #23 as resolved (or have the implementer do it as part of Unit 1's commit).
- The `ScoringModal.tsx` deletion (Unit 7) is dead-code cleanup and does not require user-facing changelog mention.
- Branch B's plan (when written) should reference this plan as `origin: docs/plans/2026-05-05-001-feat-scoring-modal-plumbing-plan.md` so the dependency is explicit.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-05-scoring-modal-rework-requirements.md](../brainstorms/2026-05-05-scoring-modal-rework-requirements.md)
- **Bug report:** `LIST_FOR_ED.md:1404-1438` (#23 root-cause writeup)
- **Fallback pattern reference:** `src/components/scoring/UnifiedScoreboard.tsx:614-617` and `docs/plans/2026-05-03-001-feat-unified-scoreboard-plan.md`
- **Hard-rename migration precedent:** `docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md` lines 273, 288, 296, 673
- **Calculator interface:** `src/systems/calculators/types.ts` (`scoringPopupFields` at line 256, `ScoringPopupFieldSpec` at line 143)
- **Calculator registry:** `src/systems/calculators/index.ts`
- **Calculator implementations:** `src/systems/calculators/accumulated_per_game.ts`, `linear_above_threshold.ts`, `accumulate_with_milestone_jumps.ts`
- **shadcn modal reference:** `src/components/scoring/ManualTiebreakerDialog.tsx`
- **Existing 0-7 grid pattern:** `src/components/scoring/ScoringDialog.tsx:288-303`
- **Bug location:** `src/player/ScoreMatch.tsx:805-808`
