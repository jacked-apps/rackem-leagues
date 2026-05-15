---
date: 2026-05-05
deepened: 2026-05-05
topic: scoring-modal-rework
---

# Scoring Modal Rework — Calculator-Driven Scoring + Modular Event Registry

## Problem Frame

The "select winner" modal — the dialog opened when a scorer taps a winner on the live scoring page — has three converging problems:

1. **Bug (LIST_FOR_ED #23):** On the very first game of every Fargo points-mode match, the modal opens without the loser-balls-pocketed selector. The modal reads `match.system_snapshot.points_calculator` directly (`src/player/ScoreMatch.tsx:805`), but `system_snapshot` is captured lazily at the first scoring event — so on game 1 it's null and the calculator-aware section is hidden. Game 2 onward works. Result: silent loss of loser points on game 1 of every Fargo match unless the scorer manually edits afterward.

2. **Architectural asymmetry:** The unified-scoreboard branch wired calculators to declare display behavior via `displayHints` and the scoreboard consumes it. The modal does NOT do the same — it hardcodes a string check (`pointsCalculator === 'accumulated_per_game'`) and the loser-balls 0-7 grid. The interface `scoringPopupFields()` is fully implemented by every calculator and tested, but has zero production consumers. It is a beautifully-designed dock with no boat tied to it.

3. **Schema is 10-7-specific.** Today's `match_games.loser_balls_pocketed` column bakes ball-count semantics into the database. The actual concept is "per-game input value the calculator consumes" — could be a ball count, a points spread, a fixed value, or something a future calculator computes a formula against. The current name lies for any league that doesn't use 10-7's "1 point per ball" interpretation.

4. **Limited per-game tracking.** The modal currently tracks 5 boolean events (`break_and_run`, `golden_break`, `break_fouled`, `runout`, `win_by_forfeit`) plus the Fargo loser-balls counter. Real pool league tracking — per APA / BCA / FargoRate scoresheets — wants more events: Early 8, Scratch on 8, 8 in Wrong Pocket, etc. Each is a per-game stat tick attributed to a specific player. Adding events today means editing a column on `match_games`, editing the modal, editing every consumer.

**The work splits into two branches** because the bug fix's data-integrity pressure should not wait on architectural work, and bundling creates a single failure mode where any reviewer concern on the larger architectural piece holds the urgent fix hostage:

- **Branch A — Modal Plumbing.** Ships #23, consumes the dormant `scoringPopupFields()` interface, generalizes the per-game scoring storage so the schema is no longer 10-7-specific, and cleans up modal UX. Zero new tables; one column rename, one new column.
- **Branch B — Event Registry.** Introduces a modular event-tracking system (new `game_events` table, registry of trackable events, org/league override mechanism), drops 4 flat boolean columns, and migrates ~10-15 consumers to read events from the new table. Includes the LO admin UI for toggling events.

Branch A can ship in days. Branch B has its own planning timeline.

## Branch A — Modal Plumbing

### Requirements

**Item #23 fix**

- A1. Modal renders the loser-side per-game input on game 1 of every match (and all subsequent games).
- A2. Modal resolves the active calculator from `match.system_snapshot.points_calculator`, falling back to the live `leaguePrefs.points_calculator` when the snapshot is null. Mirrors the pattern in `src/components/scoring/UnifiedScoreboard.tsx` (line 617).

**Calculator-driven per-side scoring**

- A3. `ScoringDialog` consumes the active calculator's `scoringPopupFields()` spec instead of checking the calculator name as a string. The spec drives whether each side renders a `fixed` (no input shown) or `counter` (input shown) UI. Removes the existing `pointsCalculator === 'accumulated_per_game'` string check.

- A4. **Generic per-game input columns.** Two new columns on `match_games`: `winner_value integer NULL` and `loser_value integer NULL`. Each holds the per-game input collected by the modal for the corresponding side. Meaning is determined by the active calculator's spec — could be points, balls, a ranged value, anything the league configures. The modal does not interpret these values; the calculator's `compute()` function does.

- A5. **Drop the 10-7-specific `loser_balls_pocketed` column.** Migrated to `loser_value`. Per "all data is disposable test data" stance, no backfill plumbing required. Consumers of the old column (TypeScript synthesis at `src/utils/match/computeMatchRunningTotals.ts:193-194`, modal prop names, edit-game dialog) updated to use the new column.

- A6. **Adaptive counter primitive — grid-mode only this branch.** A single `<AdaptiveCounter>` component renders any `kind: 'counter'` per-side input as a button grid for the current Fargo 0-7 use case. Slider and numeric-input modes deferred until a calculator with a wider range actually ships. The grid mode honors non-zero `min` (renders `[min..max]`) and treats `min === max` as a degenerate case that should render fixed-points UI instead.

- A7. **Separation of concerns: modal handles inputs, calculator handles calculations.** The modal's job ends at writing `winner_value` / `loser_value` to the row. The calculator's `compute()` runs whatever formula the league configured (e.g., a future `winner_earned = (winner_value - loser_value) * 2`) at read time. The modal does not interpret values; the calculator does not care how inputs were entered.

- A8. **Both winner-side and loser-side counters render independently.** A future calculator with `winner: { kind: 'counter', min: 5, max: 15 }` and `loser: { kind: 'counter', min: 0, max: 8 }` works via spec consumption alone — both sides render grid inputs, both write to their respective `winner_value` / `loser_value` columns — without modal code changes.

**Modal UX cleanup**

- A9. All modal inputs use shadcn components (`Switch`, `Checkbox`, `Button`, `Label`). Raw `<input type="checkbox">` elements at `src/components/scoring/ScoringDialog.tsx` lines 90-110 and 222-280 are replaced.

- A10. Modal title and primary button updated to reflect post-tap state. Recommended: title "Confirm Game Result," primary button "Save Game." Currently "Select Game Winner" / "Select Winner" — misleading because the winner is already chosen when the modal opens.

- A11. **Accessibility.** Mutually-exclusive event groups use radio semantics (aria-role='radio' within a group) rather than checkbox semantics — the screen-reader UX for "choose at most one" requires this. Auto-uncheck on mutual-exclusion conflict announces via an aria-live region. Focus order through dynamic-visibility events is sequentially predictable (top-to-bottom), and focus moves to the next visible event when the current event is hidden by a role-eligibility flip.

- A12. **Attribution disclosure.** When an event is checked that attributes a stat to a specific player (loss-cause events attributed to the loser, breaker-attributed events to the breaker), the modal surfaces the attribution inline near the checkbox label (e.g., "Loss by Early 8 — recorded as [Loser Name]"). Scorers should not have to infer which player a checkbox accuses.

- A13. Mobile field order: per-side scoring inputs (the `loser_value` grid; future winner-side counter when applicable) render at the top of the modal body. Common ticks below. Rare modifiers (break-fault, forfeit) at the bottom. Mobile touch targets meet a 44px minimum.

- A14. **Delete dead code:** `src/components/scoring/ScoringModal.tsx` (zero imports; superseded duplicate of `ScoringDialog.tsx`).

### Branch A success criteria

- Item #23 stops recurring — game 1 of every Fargo match shows the loser input.
- `ScoringDialog` no longer contains the `pointsCalculator === 'accumulated_per_game'` string check.
- A future calculator declaring per-side counters with arbitrary ranges works via spec consumption alone, without modal code changes.
- `loser_balls_pocketed` column does not exist in the schema; `winner_value` / `loser_value` do.
- Modal accessibility: scorer using a screen reader hears mutual-exclusion auto-uncheck announcements; modal navigable by keyboard with predictable focus order.
- Modal attribution disclosure: scorer sees the player name being attributed when a loss-cause event is checked.
- `ScoringModal.tsx` (the dead duplicate) is deleted.

### Branch A scope boundaries

- AdaptiveCounter slider and numeric-input modes deferred until a calculator with range > 8 ships.
- The 5 flat boolean columns (`break_and_run`, `golden_break`, `break_fouled`, `runout`, `win_by_forfeit`) are NOT touched. They stay as columns. Branch B reworks them.
- Event tracking expansion (Early 8, Scratch on 8, etc.) is NOT in Branch A. Branch B.
- Calculator-side formula evolution (e.g., supporting `compute` formulas beyond today's per-game accumulation) is out of scope. Modal stores raw inputs; calculator-side formula work is the "other side" the user refines separately.

## Branch B — Event Registry

### Requirements

**Event registry**

- B1. New TypeScript event registry at `src/systems/game-events/` (or similar) declares each tracked event with: stable `name` (snake_case), display `label`, optional `abbreviation`, applicable `gameTypes`, optional `winnerRequired` ('breaker' | 'non-breaker' — gates whether the event's checkbox renders based on the winner's role), `attributedTo` ('winner' | 'loser' | 'breaker' | 'non-breaker' | 'scheduled-breaker'), `mutuallyExclusiveWith`, and `enabledByDefault` per game type.

- B2. Seed events the registry includes on launch: `break_and_run`, `golden_break`, `runout`, `early_8`, `scratch_on_8`, `eight_wrong_pocket`, `win_by_forfeit`, `break_fouled`. (9-ball / 10-ball events `nine_on_snap`, `ten_on_break`, `three_consecutive_fouls` deferred to first 9-ball or 10-ball league activation — registry can grow as the audience expands. Exact `enabledByDefault` per game type resolved during planning against APA / BCA / FargoRate scoresheets.)

- B3. Modal renders the set of events whose `gameTypes` include the active game type AND whose `winnerRequired` (if set) matches the actual breaker (post break-fault flip), AND whose name is in the league's resolved enabled-events set.

- B4. Mutual exclusion is enforced declaratively (registry's `mutuallyExclusiveWith`) and at modal runtime. When checking one event would conflict with multiple already-checked events, all conflicts are unchecked atomically in a single state transition. Auto-uncheck announces via aria-live region (per A11).

- B5. **Forfeit (and other "no game played" loss-causes) suppress role-conditional rendering.** When checked, role-gated events (B&R, runout) are unchecked AND hidden — a forfeited game has no actual breaker, so role-gating is meaningless. The registry expresses this via a `suppressesRoleConditionalEvents: true` flag (or equivalent).

- B6. **`scheduled-breaker` is a distinct attribution target from `breaker`.** Used by `break_fouled` — the offender is whoever was scheduled to break before the foul, not the post-flip actual breaker. Registry must support both as distinct attribution targets.

**Event storage**

- B7. New `game_events` table: `(id uuid PRIMARY KEY, game_id uuid REFERENCES match_games ON DELETE CASCADE, event_name text NOT NULL, attributed_player_id uuid REFERENCES members, value integer NULL, created_at, updated_at)`. `value` is null for boolean events; reserved for future counter events stored via the registry path.

- B8. **Drop 4 flat boolean columns from `match_games`:** `break_and_run`, `golden_break`, `runout`, `win_by_forfeit`. Existing data is disposable test data per project policy; no backfill plumbing required.

- B9. **Keep `break_fouled` as a flat column.** It serves as a state-modifier — every modal render reads it synchronously to drive role-gating for B&R and runout. Joining `game_events` on every render adds latency for a load-bearing read. The flat column is the source of truth for state; a row is also written to `game_events` for stat attribution. Two layers of the same fact, different access patterns.

- B10. **Vacate cascade.** When a game is vacated (existing flow at `src/hooks/useMatchScoringMutations.ts`), all `game_events` rows for that `game_id` are deleted as part of accepting the vacate. The vacate handler's existing column-reset flow extends to delete event rows. The FK uses `ON DELETE CASCADE` for the deletion case where the match_games row is itself deleted (rare); explicit DELETE in the vacate-accept path covers the common case.

- B11. **Realtime subscription extension.** UI surfaces currently subscribing to `match_games` row updates (`src/components/scoring/UnifiedScoreboard.tsx`, `src/components/scoring/GamesList.tsx`, `src/components/scoring/GameButtonRow.tsx`, `src/player/ScoreMatch.tsx`'s confirmation queue) read the dropped boolean columns today. After Branch B, those surfaces add a `game_events` channel filtered by match_id, OR consume a derived view. Without this, B&R / runout / golden-break indicators stop updating live until manual page refresh.

**Org/league override of event tracking**

- B12. New `enabled_events jsonb` column on the existing `preferences` table. Stores a partial map `{ event_name: boolean }`. Absent keys mean "inherit."

- B13. The `resolved_league_preferences` view is extended: `org_prefs.enabled_events || league_prefs.enabled_events` (jsonb concat; league wins per event). The merged map is layered over the registry's `enabledByDefault` per-game-type defaults at the resolver layer.

- B14. **LO admin UI for toggling events ships in Branch B.** A section in the existing operator preferences page renders the registry, with switches per event showing the resolved state and an explicit "inherit / enable / disable" tri-state per scope (org or league). Without this, B12/B13 are unusable except via direct SQL — the data plumbing must ship with its consumer.

**Consumer migration**

- B15. The following surfaces currently read the 4 dropped columns and must be migrated to read from `game_events` (or a derived view) as part of Branch B:
  - `src/utils/featsStats.ts` + `src/pages/FeatsOfExcellence.tsx` (queries `match_games.break_and_run`, `match_games.golden_break` directly)
  - `src/realtime/useMatchRealtime.ts` (~4 mapping sites)
  - `src/realtime/useMatchGamesRealtime.ts` (~8 mapping sites)
  - `src/hooks/useMatchScoringMutations.ts` (read + insert + update paths)
  - `src/api/queries/matches.ts`
  - `src/components/scoring/ConfirmationDialog.tsx`
  - `src/utils/fargoMatchTotals.ts`
  - Characterization tests under `src/__tests__/`

### Branch B success criteria

- Adding a new boolean event to the registry requires: one new registry entry. Zero schema migrations, zero modal code changes.
- LOs can toggle events on/off per league via the operator preferences UI, without code changes or SQL.
- Stats queries read `game_events` directly: `SELECT event_name, COUNT(*) FROM game_events WHERE attributed_player_id = ? GROUP BY event_name`.
- Multi-event leaderboards: `WHERE event_name IN (...)`.
- Vacating a game removes its `game_events` rows; live-scoreboard and confirmation queue continue to update via realtime when events fire.
- The 4 dropped columns are removed from the schema; all listed consumers are migrated to event-row reads.

## Scope Boundaries

**Out of scope across both branches (deferred with reasons):**

- **Season-scope on `preferences`.** Existing pattern is org → league. Adding `'season'` is one extra `entity_type` value plus one extra view JOIN. Defer until needed.
- **Counter event types beyond per-game scoring.** APA-style defensive-shot tracking (per-shot +/- counter) and innings counters require a new UI primitive. No APA leagues currently exist. Future brainstorm.
- **Loss-cause as alternative entry path on the live scoring page.** Single-flow + attribution rules + B5's forfeit-suppresses-role-events handle it without changing live-page entry.
- **Double break-foul cascade.** Edge case where opponent breaks → break-fouls → I break → break-foul → opponent breaks again. Cannot be expressed in a single boolean. Per-rack break-foul history is a different shape (probably belongs in the live game-state machine). Documented as known limitation.
- **House Rules system coupling.** The existing `house_rules` table stores prose documentation. Linking a registry event to its documenting rule is a future small follow-up.
- **Stats page build-out.** Personal stats / leaderboards have their own brainstorm. Branch B ships clean queryable data so stats has a stable read surface when it is built.
- **AdaptiveCounter slider and numeric-input modes.** Add when a calculator declaring range > 8 actually ships.
- **Calculator-side formula evolution.** Supporting compute formulas beyond today's per-game accumulation is the "other side" the user refines separately. Branch A makes the modal correctly store raw inputs so calculator-side work has clean data to consume.

## Key Decisions

- **Two branches, not one.** The bug fix's data-integrity pressure should not wait on architectural work. Reviewer consensus (4 of 6 reviewers independently recommended split). Branch A ships in days; Branch B has its own timeline. Same total work, different sequencing — Branch A's coupling to Branch B is one-directional (Branch B consumes Branch A's modal-spec wiring; Branch A does not need anything from Branch B).

- **Generic `winner_value` / `loser_value` columns, not 10-7-specific naming.** The current `loser_balls_pocketed` column bakes ball-count semantics into the schema. The actual concept is "per-game input value the calculator consumes." The user's mental model: "10-7 is just a popularized version. The 10 is winner points; the 7 is the upper bound of a loser range. The same system with 2 points per ball becomes 10-14. The schema should not lie."

- **Modal handles inputs; calculator handles calculations.** Each does its job. Modal writes raw values; calculator's compute function reads them and runs whatever formula the league configured. Future calculators with arbitrary formulas (e.g., `winner_earned = (winner_value - loser_value) * 2`) work without modal changes.

- **Three subsystems compose at the modal across both branches.** Calculator-driven per-side scoring (Branch A), event registry (Branch B), state modifiers (existing — break-fault). Each has its own source of truth and storage. The modal is a composer.

- **Two tables in Branch B (`game_events` + `enabled_events` jsonb on `preferences`), not one.** Recorded facts and configuration are different kinds of data. Mixing them forces NULL-laden columns and awkward CHECK constraints.

- **Role-based applicability + attribution rule per event.** Each event declares: when does its checkbox render (game type + optional `winnerRequired`), and who gets the stat row (winner / loser / breaker / non-breaker / scheduled-breaker). `scheduled-breaker` is distinct from `breaker` because break-foul attribution must point to the offender (the player scheduled to break), not the post-flip actual breaker.

- **`break_fouled` stays as a flat column even after Branch B.** It does mechanical work on every modal render (drives B&R/runout role-gating). Needs synchronous-read access without joining `game_events`. Also recorded as an event row for stats. Different layers, different access patterns.

- **Forfeit suppresses role-conditional event rendering.** A forfeited game has no actual breaker; role-gated events are meaningless. Registry expresses this via a flag rather than tangling the modal with special-case code.

- **`enabled_events` is jsonb on `preferences`, not text[].** jsonb merge supports per-event override; text[] would force REPLACE-only. Mirrors existing scalar-COALESCE pattern shape (single-column-per-pref) while expressing per-key override semantics.

- **LO admin UI ships in Branch B with the data plumbing.** Shipping the override system without UI makes the feature exercisable only via SQL. Bundling them ensures the merge semantics get exercised by the consumer they're built for, catching bugs early.

- **Single-flow scoring entry preserved.** Loss-cause events render as checkboxes alongside descriptors. Scorer always taps winner first; B5's forfeit-suppresses-role + attribution rules handle the rest. No live-page UX rework needed.

- **Dead code (`ScoringModal.tsx`) removed in Branch A.** Avoids future confusion about which file is canonical.

## Dependencies / Assumptions

- The existing `preferences` table and `resolved_league_preferences` view are the cascade infrastructure for Branch B. Extending the view with jsonb concat (`||`) is a Postgres-native operation.
- Every existing calculator already implements `scoringPopupFields()` correctly (verified — `src/systems/calculators/accumulated_per_game.ts:135`, `linear_above_threshold.ts:149`, `accumulate_with_milestone_jumps.ts:124`). Wiring the consumer in Branch A does not require changes to existing calculator implementations.
- "All app data is disposable test data" (project policy). Migrations in both branches do not need backfill plumbing.
- The unified-scoreboard `livePointsCalculator` fallback pattern (`src/components/scoring/UnifiedScoreboard.tsx` line 617) is the reference implementation for A2.
- Calculator-side work (formula evolution beyond today's accumulated_per_game) is the "other side" the user refines separately. Branch A's contribution is correct raw-input storage; Branch B's contribution is event-row stats data. Neither branch evolves calculator compute logic.

## Outstanding Questions

### Resolve Before Planning

(none — all blocking product decisions made)

### Deferred to Planning

**Branch A**

- [Affects A3, A6][Technical] Where the live calculator INSTANCE (not just the name) is sourced when ScoringDialog adapts to consume `scoringPopupFields()`. Likely via the same hook chain that feeds calculator info to the modal call site today, but the resolver hook may need to expose the calculator instance.
- [Affects A4, A5][Technical] Migration sequence for adding `winner_value`/`loser_value` and dropping `loser_balls_pocketed`. Single consolidated migration in this PR.
- [Affects A11, A12][User decision] Final modal copy and label phrasing for attribution disclosure. ("Loss by Early 8 — recorded as [Name]" or alternatives.)

**Branch B**

- [Affects B1, B2] Final per-event-per-game-type `enabledByDefault` matrix. Planning verifies against APA / BCA / FargoRate scoresheets.
- [Affects B1, B6][Technical] Whether `attributedTo` needs to vary by game type (most events have a single attribution rule across all game types, but the registry should support per-game-type override if it surfaces).
- [Affects B11][Technical] Whether realtime subscriptions to `game_events` use a per-game-id filter (cheap on writes, more channels) OR a per-match aggregation view (denser channel, query complexity). Planning evaluates against realtime quota / connection limits.
- [Affects B13][Technical] Whether the jsonb merge happens server-side in the view OR client-side in the resolver hook (`useResolvedLeaguePrefs`). View-side keeps resolution centralized; client-side keeps the view simple.
- [Affects B12, B13][Technical] jsonb merge cannot express "inherit registry default once parent has explicit value" — if org sets `{event: false}` and league wants registry default back, no representation. Document as known limitation OR redesign at resolver layer.
- [Affects B14] LO admin UI shape — checkbox list vs tri-state (inherit / enable / disable) toggle. The tri-state matches the override semantics more faithfully but adds UI complexity.
- [Affects B7, B15][Technical] Pre-Branch-B exercise: write SQL for the top 5 stats queries the future stats page will need, against the proposed `game_events` schema. Validates the read surface before locking it. If queries are clean, schema is right; if they need extra columns or denormalization, redesign before B7 lands.
- [Affects B7, B11][Technical] Whether all 4 boolean columns drop in one migration (single-PR, larger blast radius) OR drop incrementally as each consumer migrates (multi-step, smaller per-step risk). Per "consolidate migrations within a PR" project policy, single-migration is preferred unless consumer-migration sequence requires staging.
- [Affects B5, B6][Technical] How `forfeit suppresses role-conditional events` interacts with the registry's `mutuallyExclusiveWith` field. Likely: the suppression is a separate registry flag that hides events rather than just unchecking them, distinct from mutual exclusion which only unchecks.

## Next Steps

`-> /ce:plan` for **Branch A** first. Branch B can be planned independently when Branch A is in flight or shipped.
