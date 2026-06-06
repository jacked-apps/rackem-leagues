---
title: Trigger Room — Standalone Work Room
type: feat
status: active
date: 2026-06-06
origin: docs/brainstorms/2026-06-06-trigger-room-requirements.md
blueprint: docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md
---

# Trigger Room — Standalone Work Room

## Overview

Second standalone work room in the codebase. Authors **Trigger** modules — TYPE / CONDITION / ACTION / RE-ARM. LO builds individual triggers and saves them to their library. No apply-to-league, no ORDER setting, no composition-specific data — those belong to future rooms. The Trigger module knows only its own job.

The allocator room is a precedent for shape (own DB / own loader / own page / own list / own library / own save flow). This room follows the same shape in an independent codepath. Zero runtime state shared.

The only sharing is a small refactor: extract a generic `ExpressionBuilder` widget from the allocator's `FormulaBuilder` so both rooms feel identical when an LO builds an arithmetic expression. The widget is the only thing the rooms touch — they don't share state, data, or logic.

## Problem Frame

Today a Trigger lives in a TypeScript composition file like `compositions/percent-5-man.ts`. Changing a milestone bonus from 1.5 to 2.0 requires a code change. The locked spec for Trigger is well-defined (`docs/league-system/modules/points-system/trigger.md`); the runtime already executes triggers via `runtime.ts` `fireTrigger`. What's missing is a way for an LO to author their own — same gap the allocator room closed for the per-game allocator.

This room ships the authoring + storage half. Application via a future scoring system room is intentionally deferred.

## Requirements Trace

- **R1.** An LO can author a Trigger through the UI: TYPE / CONDITION / ACTION / RE-ARM.
- **R2.** CONDITION and ACTION can only reference universal state-bag names (the same audit principle the allocator room follows).
- **R3.** ACTION's write target is restricted to `home_points` / `away_points` only. No custom names.
- **R4.** Triggers save as DB rows; user-scope rows are owned, official rows are read-only with a tamper trigger.
- **R5.** A user sees their own triggers + read-only officials; cloning an official seeds a new user-scope row.
- **R6.** A save-time guard runs the validator + a small dry-run before persisting. Bad rows refuse inline.
- **R7.** The room is a standalone work room — own DB, own loader, own page, own list, own library, own save flow. No runtime state shared with the allocator room.
- **R8.** A shared `ExpressionBuilder` widget is extracted from the allocator's `FormulaBuilder`. Both rooms use it; both feel identical when building arithmetic expressions.
- **R9.** Triggers fire at fixed phases (not per-side) — the picker exposes team-named entries (`home_wins`, `away_wins`, etc.), no role-based virtuals.

## Scope Boundaries

In scope: standalone trigger module authoring + storage + library + read-only officials + save-time guard + the shared widget extraction.

Out of scope (each item belongs to a future room or future work):
- Applying triggers to leagues.
- Setting ORDER (fire-order number, `beforeAllocator` bool).
- Per-trigger configuration in a specific scoring system context (e.g., binding to threshold names).
- Custom state-var names in the write-target picker.
- Threshold / start-points / composition-specific names in the read picker.
- Composition-control signals (`edge`, `endmatch`) as write targets.
- Inline LO-help on the trigger room UI (lives in the doc-inventory file from the allocator room).
- Snapshot freeze + runtime backstop integration — both already exist for triggers; nothing to add until applying lands.

### Deferred to Separate Tasks

- The scoring system room (where triggers get assembled into systems and applied to leagues).
- A per-trigger-in-system config room (where threshold-derived names become available).

## Context & Research

### Relevant Code and Patterns

- `src/systems/points-system/types.ts` — `Trigger`, `Condition`, `Expression`, `TriggerAction`, `TriggerType`, `ReArm` types. All locked, no changes needed.
- `src/systems/points-system/runtime.ts` — `fireTrigger` already executes triggers with never-throw discipline. No engine changes needed.
- `src/systems/points-system/condition-evaluator.ts` — already evaluates conditions never-throw.
- `src/systems/points-system/expression-evaluator.ts` — already evaluates expressions never-throw.
- `src/systems/points-system/composition-validator.ts` — already validates trigger lists. May need a `validateTrigger(trigger)` extraction for standalone validation.
- `src/operator/scoring-workshop/per-game-allocator/` — blueprint for the room's shape (page, list, editor, side-editor pattern, save-time guard, useAllocatorRoom hook).
- `src/operator/scoring-workshop/per-game-allocator/FormulaBuilder.tsx` — the widget to extract `ExpressionBuilder` from.
- `src/operator/scoring-workshop/per-game-allocator/formulaTokens.ts` — token <-> Expression tree round-trip; reused as-is.
- `supabase/migrations/20260604000000_per_game_allocator_room.sql` — migration pattern for the table + tamper trigger + seeded officials.
- `src/operator/scoring-workshop/WorkshopHomePage.tsx` — workshop directory; gains a new room card.

### Institutional Learnings

- [[project_rls_disabled_in_dev]] — schema-only migration; no RLS in this plan.
- [[feedback_test_placement]] — DB-touching tests under `src/__tests__/database/`; everything else co-located.
- [[project_happy_dom_supabase_insert_limit]] — supabase-js write-path tests need `// @vitest-environment jsdom` pragma.
- [[feedback_modules_are_data_not_code]] — this room is the second concrete realization of the killer principle.
- [[feedback_runtime_trusts_workshop_validates]] — the save-time guard is the workshop-validates side; runtime stays zero-knowledge (already does for triggers).

## Key Technical Decisions

- **Storage:** one table `triggers`. Columns: `id`, `name`, `description`, `scope CHECK IN ('official','user')`, `author_id UUID NULL REFERENCES members(id) ON DELETE SET NULL`, `trigger_type TEXT`, `condition JSONB NOT NULL`, `action JSONB NOT NULL`, `rearm TEXT NOT NULL`, timestamps. CHECK constraint pairs scope and author_id same as the allocator table.
- **No ORDER column on the row.** Order is the scoring system room's concern (future). The Trigger type DOES have `order` in TypeScript, but for v1 of the loader/UI we'll set it to a default placeholder; the scoring system room overwrites it when assembling.
- **Reusable widget:** extract a generic `ExpressionBuilder` from `FormulaBuilder`. Path: `src/operator/scoring-workshop/_shared/ExpressionBuilder.tsx`. The allocator's `FormulaBuilder` becomes a thin wrapper that adds role-perspective handling and passes through. The trigger room imports the bare `ExpressionBuilder` with no perspective.
- **Available data:** new module `src/operator/scoring-workshop/trigger/availableData.ts`. Lists universal state-bag names with plain labels (no role perspective). Same shape pattern as the allocator's `availableData.ts` but with static (not perspective-function) labels.
- **Loader:** `loadTrigger(id)` returns `Trigger | null`, never throws, validates via the validator below. Same shape as `loadPerGameAllocator`.
- **Validator:** extract `validateTrigger(trigger)` as a public function in `composition-validator.ts`. Today's validation logic for a single trigger lives inline in `validatePointsSystem`; the loader needs a standalone entry point.
- **Save-time guard:** validator + a small dry-run that builds a stub PointsSystem with just this trigger and runs `evaluatePointsSystem` over 5 synthetic games. Refuses bad rows. Mirrors the allocator's `saveTimeGuard.ts`.
- **Seeded officials:** four templates — Initial credit / Game-N bonus / Sweep bonus / Empty starter. Seeded at migration time.
- **Workshop home page:** new card for the trigger room added to the `ROOMS` array in `WorkshopHomePage.tsx`.
- **No league-side integration.** No new `preferences` column, no picker, no apply-time preview. The trigger sits in the library; that's where it stops until the scoring system room exists.

## Open Questions

### Resolved During Brainstorm

- **Write-target picker scope?** → `home_points` / `away_points` only.
- **Refactor: extract ExpressionBuilder?** → Yes.
- **League integration?** → Out of scope for this room.
- **Order interleave with prepackaged?** → Out of scope for this room.
- **Threshold/composition names in the picker?** → Out of scope; future when other rooms formalize their contracts.

### Deferred to Implementation

- Exact route path for the trigger room page (probably `/operator/scoring-workshop/trigger` parallel to the allocator's path).
- Editor as full page or modal — match the allocator's choice for consistency (full page).
- Whether the CONDITION builder gets a separate small component or is inlined in the editor — implementation-time call.

## Implementation Units

- [x] **Unit 1: DB schema — table + seeded officials + tamper trigger**

**Goal:** Land the storage layer in one atomic migration. Table created, four officials seeded, tamper trigger installed.

**Requirements:** R4, R5.

**Dependencies:** None.

**Files:**
- Create: `supabase/migrations/20260606000000_trigger_room.sql`
- Test: `src/__tests__/database/trigger-room-schema.test.ts`

**Approach:**
- New table per Key Decisions. Same CHECK + tamper trigger pattern as `per_game_allocators`.
- No FK column on `preferences` (no apply-to-league in this room).
- Seed block at the bottom of the migration inserts the four officials with hand-crafted JSONB matching the in-memory Trigger shape.

**Patterns to follow:**
- `supabase/migrations/20260604000000_per_game_allocator_room.sql` for style + tamper trigger.

**Test scenarios:**
- Happy path: 4 officials seeded with `scope='official'` and `author_id IS NULL`.
- Edge case: Insert with `scope='user'` and NULL `author_id` → CHECK rejects.
- Edge case: UPDATE on a `scope='official'` row → tamper trigger raises.
- Edge case: DELETE on a `scope='official'` row → tamper trigger raises.

**Verification:** Migration applies cleanly; officials present.

- [x] **Unit 2: Loader — `loadTrigger(id)`**

**Goal:** Pure function `id → Trigger | null`, never throws. Validates via Unit 3's standalone `validateTrigger`.

**Requirements:** R4.

**Dependencies:** Unit 1, Unit 3.

**Files:**
- Create: `src/systems/points-system/trigger-loader.ts`
- Test: `src/systems/points-system/__tests__/trigger-loader.test.ts`

**Approach:**
- Mirror `per-game-allocator-loader.ts` exactly in shape. Fetch row → unmarshal JSONB → validate → return `Trigger | null`. Wraps every step in try/catch + warn.

**Test scenarios:**
- Happy path: Load a seeded official → returns a valid Trigger.
- Edge case: Unknown id → null (not throw).
- Error path: Row with malformed JSONB (missing required field) → null + console.warn.
- Error path: Trigger references an unregistered `operationKind` in its action expression → null + console.warn.
- Error path: Supabase throws → null + console.warn.

- [x] **Unit 3: Standalone `validateTrigger` extracted from `validatePointsSystem`**

**Goal:** Public `validateTrigger(trigger)` validates a single trigger's shape without needing the full composition context. Used by the loader and by the save-time guard.

**Requirements:** R6.

**Dependencies:** None.

**Files:**
- Modify: `src/systems/points-system/composition-validator.ts`
- Test: `src/systems/points-system/__tests__/composition-validator-trigger.test.ts`

**Approach:**
- Pull the per-trigger validation logic out of `validatePointsSystem` into a public `validateTrigger(trigger: Trigger): void` (throws on failure, callers wrap in try/catch). `validatePointsSystem` continues to work — it calls the new function in its loop.
- Validates: name non-empty; type is a valid TriggerType; condition shape; action.target is one of `home_points` / `away_points` (the v1 write-target restriction); action.value shape; rearm is a valid ReArm.

**Test scenarios:**
- Happy path: a valid trigger passes.
- Error path: empty name → throws.
- Error path: unknown type → throws.
- Error path: action.target outside `home_points`/`away_points` → throws ("v1 restriction").
- Error path: action.value's expression references unregistered formula op → throws.

- [x] **Unit 4: Extract `ExpressionBuilder` from `FormulaBuilder`**

**Goal:** Pull the click-to-build expression UI out of the allocator's `FormulaBuilder` into a generic widget. Allocator's `FormulaBuilder` becomes a thin wrapper.

**Requirements:** R8.

**Dependencies:** None.

**Files:**
- Create: `src/operator/scoring-workshop/_shared/ExpressionBuilder.tsx`
- Modify: `src/operator/scoring-workshop/per-game-allocator/FormulaBuilder.tsx`
- Modify: `src/operator/scoring-workshop/per-game-allocator/SideEditor.tsx` (consumer)

**Approach:**
- `ExpressionBuilder` takes: `tokens`, `onChange`, `availableData: AvailableDatum[]` (no perspective), `labelForVar: (name: string) => string`.
- `FormulaBuilder` wraps `ExpressionBuilder` and passes through the allocator's perspective-flipped data + label functions.
- The TokenPill, TokenStrip, CursorGap, keyboard handler all move to the shared widget unchanged.
- Trigger room's expression UI imports `ExpressionBuilder` directly.

**Patterns to follow:**
- Existing `FormulaBuilder` — preserve all behavior (cursor, arrows, click-to-remove, etc.).

**Test scenarios:**
- The existing `saveTimeGuard.test.ts` + the `applyTimePreview.test.ts` for the allocator continue to pass without modification — proving the refactor is behavior-preserving.
- New small test confirming `ExpressionBuilder` renders + accepts tokens + emits onChange.

- [x] **Unit 5: Available data registry for triggers**

**Goal:** A new `availableData.ts` for the trigger room. Universal state-bag names with plain (non-perspective) labels.

**Requirements:** R2, R9.

**Dependencies:** None.

**Files:**
- Create: `src/operator/scoring-workshop/trigger/availableData.ts`

**Approach:**
- Same shape pattern as the allocator's `availableData.ts` but `label` and `description` are plain strings (not perspective functions).
- Entries: `home_wins` / `away_wins` / `home_points` / `away_points` / `home_team_handicap` / `away_team_handicap` / `games_played` / `total_games` / per-player counters (5 × 2 = 10 entries for the home_player_N_wins style).
- The list is the READ universe. The write universe (home_points / away_points) is a smaller separate constant inside the editor.

**Test scenarios:**
- Snapshot-style: confirm the list has the expected entries and no composition-specific names.

- [x] **Unit 6: Workshop room UI — list + editor + save-time guard**

**Goal:** The trigger room's user-facing surface. List page with Yours + Templates sections. Editor with all the sub-fields. Save runs the guard.

**Requirements:** R1, R5, R6, R7.

**Dependencies:** Units 1, 2, 3, 4, 5.

**Files:**
- Create: `src/operator/scoring-workshop/trigger/TriggerRoomPage.tsx` — page container
- Create: `src/operator/scoring-workshop/trigger/TriggerList.tsx` — Yours + Templates sections
- Create: `src/operator/scoring-workshop/trigger/TriggerEditor.tsx` — name, description, TYPE, CONDITION, ACTION, RE-ARM
- Create: `src/operator/scoring-workshop/trigger/ConditionBuilder.tsx` — small two-operand + comparator picker
- Create: `src/operator/scoring-workshop/trigger/ActionBuilder.tsx` — target picker + value (set or expr)
- Create: `src/operator/scoring-workshop/trigger/useTriggerRoom.ts` — data hook (list, clone, upsert, remove)
- Create: `src/operator/scoring-workshop/trigger/saveTimeGuard.ts` — validator + synthetic dry-run
- Modify: `src/navigation/NavRoutes.tsx` — register `/operator/scoring-workshop/trigger`
- Modify: `src/operator/scoring-workshop/WorkshopHomePage.tsx` — add the trigger room card

**Approach:**
- Mirror the allocator room's structure 1:1 in shape (independent code, parallel pattern).
- `ConditionBuilder` is small: dropdown for `always | when {operand} {op} {operand}`; each operand is a sub-dropdown of available data or a number input.
- `ActionBuilder`: target picker (Home team points / Away team points) + a radio for "Fixed value" vs "Computed from formula"; the formula path uses the bare `ExpressionBuilder` from Unit 4.
- `saveTimeGuard` runs `validateTrigger` then a small dry-run: build a stub `PointsSystem { triggers: [thisTrigger] }`, call `evaluatePointsSystem` with synthetic inputs + 5 games, confirm no exception escapes.
- All UI uses shadcn components per project convention.

**Patterns to follow:**
- `src/operator/scoring-workshop/per-game-allocator/AllocatorRoomPage.tsx` and siblings.
- File-size rule per [[feedback_file_size_limit]] (~100 lines / file).

**Test scenarios:**
- Save-time guard: happy path for each TYPE × CONDITION combination from the seeded templates.
- Save-time guard: rejects an empty name.
- Save-time guard: rejects an action with target outside the allowed set.
- Save-time guard: rejects an expression action that throws under the dry-run.

- [x] **Unit 7: TOC + implementation-status update**

**Goal:** Update the project index. Note the second standalone work room.

**Requirements:** Project standards ([[feedback_table_of_contents_always]]).

**Dependencies:** All previous units.

**Files:**
- Modify: `TABLE_OF_CONTENTS.md`
- Modify: `docs/league-system/modules/points-system/workshop.md` — add a section for the trigger room paralleling the allocator coverage.

**Approach:**
- Add entries for every new file (migration, loader, validator extract, available data, UI components, tests).
- The `workshop.md` update covers: the trigger room's universal-only data audit (write target restriction), the `ExpressionBuilder` extraction, the explicit non-coupling between rooms.

**Test scenarios:** None — documentation.

## System-Wide Impact

- **Interaction graph:** the trigger room and the allocator room are independent at runtime. The only shared code is the `ExpressionBuilder` widget. Each room's data + state stays in its own files.
- **Error propagation:** loader never-throw, validator throw-then-caught-by-loader, save-time guard never-throw, runtime backstop already in place for triggers via `fireTrigger`. The four-guard contract holds even though this room doesn't yet apply-to-league (no snapshot freeze needed yet — that lands when the scoring system room exists).
- **Unchanged invariants:** the existing `validatePointsSystem` keeps working through the refactor; the `FormulaBuilder` consumers (the allocator's SideEditor) keep working through the widget extraction.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `FormulaBuilder` extraction breaks the allocator room | The existing allocator tests (saveTimeGuard, applyTimePreview, snapshot-and-swap, runtime-allocator-safety, etc.) MUST continue to pass without modification. Behavior-preserving refactor is the gate. |
| `validateTrigger` extraction breaks `validatePointsSystem` | The existing `composition-validator.test.ts` + every cross-audit test for the prepackaged compositions must continue to pass. |
| Save-time dry-run for triggers produces false rejections (e.g., a perfectly valid trigger fails because the synthetic inputs don't have the right thresholds) | The dry-run is intentionally minimal: it validates that the trigger can fire without throwing. It does NOT assert it produces specific output. The synthetic inputs use 0/empty state where threshold-derived names would normally live — the trigger should still not throw. |
| LO authors a trigger referencing `home_points` writes that conflict with the per-game allocator's writes (allocator also writes home_points each game) | This is a real concern for the future scoring system room, not this room. Here we just confirm the trigger writes the name; assembly + ordering decisions happen later. |

## Documentation / Operational Notes

- Update `docs/league-system/modules/points-system/workshop.md` to note the second work room.
- The doc-inventory file (`workshop-doc-inventory.md`) gets a new section appended for trigger room LO-help items in a follow-up (Phase 3 of the docs work; not this plan).

## Sources & References

- **Origin document:** `docs/brainstorms/2026-06-06-trigger-room-requirements.md`
- **Locked spec:** `docs/league-system/modules/points-system/trigger.md`
- **Blueprint room (precedent):** `docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md`
- Related code: `src/systems/points-system/runtime.ts` (existing `fireTrigger`); `src/operator/scoring-workshop/per-game-allocator/FormulaBuilder.tsx` (widget extraction source).
- Branch: `docs/trigger-room-brainstorm` (becomes `feat/trigger-room` for the build).
