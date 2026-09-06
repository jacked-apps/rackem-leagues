---
title: "feat: Tournament Bracket Tool — Free Tier v1"
type: feat
status: active
date: 2026-08-26
origin: docs/brainstorms/2026-08-26-tournament-bracket-requirements.md
---

# feat: Tournament Bracket Tool — Free Tier v1

## Overview

A standalone, "just names" tournament **bracket** tool. Any logged-in user creates a bracket, types in participant names (no accounts), picks **single- or double-elimination**, seeds them, and advances winners by tapping. A **public read-only share link** shows the bracket live as it updates. Nothing carries over between tournaments — a bracket is closed (hard-deleted) explicitly, and abandoned brackets are auto-swept after inactivity.

This is **v1 = free tier only**. It is built **paid-aware**: the data model is shaped so future paid features (real players, winner-confirmation, handicap races, venue/tables, notifications) attach later without a rewrite — but none of them are built here (see origin: `docs/brainstorms/2026-08-26-tournament-bracket-requirements.md`, "Paid Feature Roadmap").

## Problem Frame

The app has no standalone bracket tool. Existing free tools (Challonge/Brackethq) treat participants as plain text and run one-off brackets. We want a competitive free version as a growth funnel, then layer paid "smart" features later as their own brainstorms. The core league product's playoff code (`src/utils/playoffGenerator.ts`) is standings-bound and even-bracket-only, so only its seed-pairing math is reusable — the bracket-tree engine and renderer are greenfield.

## Requirements Trace

From the origin requirements doc (Free Tier v1 scope):
- R1. Any logged-in user can create and run a bracket at no cost.
- R2. Support single- and double-elimination formats.
- R3. Participants are plain text names — no accounts, no identity linkage.
- R4. Organizer seeds the bracket (seeded / ranked / random) and advances winners by tapping.
- R5. A live, shareable **public** bracket view (names only, no PII) that updates as winners advance.
- R6. Nothing persists between tournaments — ephemeral.
- R21. Organizer must be a logged-in user (no anonymous creation).
- R23. Explicit **close** action purges the bracket; abandoned brackets are **auto-swept after inactivity**.
- Naming: entity is **Bracket** (NOT `Tournament` — that namespace is the BCA/APA championship-date lookup in `src/types/tournament.ts`).
- Paid-aware: shape participant + match model so paid features attach additively.

## Scope Boundaries

- **Free tier only.** No real-player linking, winner-confirmation, handicap races, venue/tables, notifications, entry fees, or payout. Those are each a separate future brainstorm.
- **No RLS work.** RLS is intentionally disabled until launch (see origin + `memory/project_rls_disabled_until_launch.md`); any "anyone can advance any bracket" gap is logged as a pre-launch item, not fixed here.
- **No native app** — PWA only.
- Round-robin / Swiss formats are out.

### Deferred to Separate Tasks
- Real-player pool, hopper/entry-fee, venue/tables, winner-confirmation, handicap races, notifications, payout: each its own brainstorm → plan (origin doc "Paid Feature Roadmap").
- Pre-launch RLS pass to gate who can write/advance a bracket: `PRE_LAUNCH_CHECKLIST.md`.

## Context & Research

### Relevant Code and Patterns
- **Public read-page precedent:** `src/onboarding/TeamJoinPage.tsx` + `src/api/queries/teamJoin.ts` (`get_team_join_view` RPC) — a public, param-driven page reading curated public columns for an unauthenticated visitor. Model for the public bracket-share view. Public routes are unwrapped `{ path, element }` entries in `src/navigation/NavRoutes.tsx` (top `=== Public Routes ===` block).
- **Reusable seed math (thin — read the constraints):** `realPairsForStyle(bracketSize, style)` in `src/utils/playoffGenerator.ts` is a pure round-1 style helper returning `[homeSeed, awaySeed][]` for `seeded|ranked|random`. **It guards `bracketSize < 2 || bracketSize % 2 !== 0 → return []` and has NO concept of byes.** So it is usable ONLY when called with a power-of-two `bracketSize`; the caller (our `seeding.ts`) must pad `N → nextPow2(N)`, assign byes to top seeds, and map bye slots back to seeds itself. Treat it as a small helper, not the bye engine. Everything else in that file is league/standings-bound — do not reuse.
- **Migration style:** `supabase/migrations/20260818000000_push_subscriptions.sql` — header comment, `CREATE TABLE IF NOT EXISTS`, `uuid PK DEFAULT gen_random_uuid()`, FK `ON DELETE CASCADE`, `timestamptz DEFAULT now()`, indexes, `COMMENT ON`. Codebase favors **text columns + CHECK** over PG enums.
- **Data layer:** `src/api/queries/*`, `src/api/mutations/*`, `src/api/hooks/*` (TanStack Query v5), keys in `src/api/queryKeys.ts`. Examples: `src/api/mutations/pushSubscriptions.ts`, `src/api/hooks/useMessages.ts`.
- **Realtime pattern:** `src/api/hooks/useMessagingRealtime.ts` — named channel on `postgres_changes` with `filter`, invalidates a query key on event. New tables must be added to the `supabase_realtime` publication.
- **Multi-step form:** wizard framework `src/components/wizard/WizardFlowShell.tsx` + `src/wizards/league-v2/` (config-driven). Reusable blocks: `CardSelector`, `SelectableCard`, `NumberStepper`. For an ephemeral bracket a simpler linear flow is acceptable.
- **Matchup-cell styling reference only:** `src/components/playoff/PlayoffBracketCard.tsx` (single-round grid — NOT a tree; no tree renderer exists anywhere).
- **shadcn/ui mandatory** (`Button`, `Input`, `Label`, `Select`, `Card`); dates via `@/components/ui/calendar` + `parseLocalDate`/`formatLocalDate`.

### Institutional Learnings
- `memory/project_rls_disabled_until_launch.md` — RLS off; public reads "just work"; don't add policies now.
- `memory/feedback_new_edge_functions_need_supabase_restart.md` — a new edge function needs full `db:stop && db:start`; new realtime-published tables may need a realtime-container restart; after `db reset` always full stop/start.
- `memory/project_dbtypes_cli_version_drift.md` — regen types on CLI ≥2.115 (clean); write regen to a TEMP file first (a hang blanks the target).
- `memory/project_match_realtime_resilience_gap.md` — make bracket state **data-derived** (computed from matches on every fetch/poll) so a missed realtime event delays but never loses an update; keep subscription effect deps minimal.
- `src/__tests__/README.md` + `memory/project_db_test_shared_postgres_isolation.md` — DB-write tests go in `src/__tests__/database/*.db.test.ts` (jsdom, sequential, shared Postgres → tx-scope or snapshot+restore).
- `memory/feedback_dev_data_disposable.md` + `memory/feedback_consolidate_migrations_in_pr.md` — disposable data; one clean consolidated migration of final intent.
- Feature-gating (project `CLAUDE.md`): gate route AND every entry point behind one flag; log in `LIST_FOR_ED.md`; flip together at un-gate.
- **Gap:** no prior art for ephemeral-data purge / scheduled sweeps — decide the auto-sweep mechanism fresh (Unit 7).

### External References
- Double-elimination structure (byes = `nextPow2(N) - N` to top seeds; WB round R loser → LB round `2R-1`; cross-seed drops to avoid rematch; conditional grand-final **bracket reset**; matches = `N-1` single / `2N-2`..`2N-1` double). Sources: Wikipedia (Double-elimination tournament, Bye), tournament-software docs. Pool leagues commonly **omit the reset** — make it a declared, default-off option.

## Key Technical Decisions

- **Entity name = `Bracket`** (tables `brackets`, `bracket_participants`, `bracket_matches`; route `/brackets`). Avoids the real collision with `src/types/tournament.ts`. *User-facing label* ("Bracket" vs "Event") is a trivial copy choice — defaulting to "Bracket"; flagged for Ed to override.
- **Match tree stored as explicit rows with pointer columns** (`next_match_id`/slot for the winner, `loser_next_match_id`/slot for double-elim drops). Generation computes the whole tree up front; advancement just fills slots and follows pointers. This makes both single- and double-elim one data shape and keeps advancement a pure propagation.
- **Bracket state is data-derived.** The renderer computes everything (who's where, who's up) from `bracket_matches` on each fetch; realtime only triggers a refetch. A missed event delays, never corrupts (mirrors the live-scoring resilience learning).
- **Public share via curated read.** The public view reads only public columns (names + structure + winners) through a dedicated query/RPC — launch-safe and paid-ready even though free-tier data has no PII.
- **Paid-aware, not paid-built.** `bracket_participants.member_id` is nullable now (the one forward hook for real players). Other paid columns (rating, table, confirmation) attach in their own future migrations — trivial since data is disposable and additive.
- **Grand-final reset is a per-bracket declared option, default OFF** (common in pool leagues; avoids dispute).
- **Ships gated** behind a `BRACKETS_ENABLED` flag (on in dev, off in prod) with route + every entry point gated together; listed in `LIST_FOR_ED.md`.

## Open Questions

### Resolved During Planning
- Public vs login for the share view → **public** (names only, no PII), served like `join/:token`. (origin R5)
- Which bracket math is reusable → `realPairsForStyle` is a thin round-1 helper (power-of-two only, no byes); the tree engine, bye mapping, and renderer are greenfield. (research + review)
- Reset semantics → declared per-bracket, default off; encoded as a conditional terminal node. (research)
- Enum vs text for `format`/`status`/`seeding_mode` → **text + CHECK** (NOT NULL, explicit sentinels) per `memory/feedback_string_sentinels_not_null.md`.
- `share_token` → **`uuid DEFAULT gen_random_uuid()`** (non-enumerable, matches `join_token` precedent). (review)
- Public read → **`SECURITY DEFINER` RPC** column-projected to public fields, like `get_team_join_view`; not a client `.select()` (RLS is off). (review)
- Realtime → tables need `REPLICA IDENTITY FULL` for filtered UPDATE events. (review, verified)
- Close → **`status='closed'` tombstone**; the inactivity **auto-sweep hard-deletes** (default mechanism = opportunistic cleanup-on-create, zero infra). (review)
- Concurrency → `advanceWinner` uses a conditional write; a live bracket bumps `last_activity_at` on every organizer action so it's never swept mid-play. (review)
- Double-elim mobile layout → a **tabbed Winners/Losers/Grand-Final surface** is the accepted v1 minimum. (review)
- Tap-to-advance → **confirm before write + organizer can re-open/vacate** a mis-tapped match. (review)
- v1 participant cap → **64**. (review)

### Deferred to Implementation
- Whether anon realtime streaming works for the public view, or a polling fallback is needed (verify in Unit 6; data-derived state makes either correct).
- Exact mobile layout polish within the tabbed/scroll frame; the renderer is net-new.
- The precise player-dashboard file that hosts the gated entry point (name it in Unit 8).
- Final helper/function names and query shapes.

### Needs Ed's Call
- **Keep `bracket_participants.member_id` (nullable) in v1, or drop it?** It's your one deliberate "paid-aware" hook for real players. The scope reviewer argues YAGNI — data is disposable, the future paid-participant shape is unknown, so it could be added later for free. Counter: it's a single harmless nullable column that signals intent and costs nothing now. Current plan keeps it; easy to drop if you prefer the leaner schema. (The real paid-awareness is the *relational shape* — brackets have participants + a match tree — which holds either way.)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Data model (3 tables):**

    brackets                    bracket_participants          bracket_matches
    --------                    --------------------          ---------------
    id (uuid pk)                id (uuid pk)                  id (uuid pk)
    name                        bracket_id -> brackets        bracket_id -> brackets
    format (single|double)      display_name (text)           round (int)
    status (setup|live|         seed (int)                    side (winners|losers|grand_final)
            complete|closed)    member_id (nullable, FUTURE)  slot (int)
    seeding_mode                                              home_participant_id (nullable -> participants)
    grand_final_reset (bool)                                  away_participant_id (nullable -> participants)
    share_token (uuid uniq,default              winner_participant_id (nullable)
      gen_random_uuid())
    created_by -> members                                     next_match_id (nullable -> bracket_matches)
    last_activity_at                                          next_match_slot (home|away)
    created_at                                                loser_next_match_id (nullable, double-elim)
                                                              loser_next_match_slot (home|away)
                                                              status (pending|ready|complete)
    All child FKs ON DELETE CASCADE  ->  closing/​sweeping a bracket removes everything.

**Double-elim drop routing (the one non-obvious rule):**

    WB round R loser  ->  LB round (2R - 1)      (odd LB rounds = drop-in, even = internal)
    cross-seed the drop to the OPPOSITE half of the LB (no immediate rematch)
    byes (nextPow2(N) - N, to top seeds) never produce an LB drop -> that LB slot gets a bye
    grand final: WB champ vs LB champ; if reset ON and LB champ wins game 1, play one decider

**Advance flow:** organizer taps winner → **conditional write** (`set winner WHERE match.status='ready' AND winner_participant_id IS NULL`) so a stale/duplicate/second-device tap cannot overwrite a decided match → copy winner into `next_match` slot; if double-elim, copy loser into `loser_next_match` slot → the target match becomes `ready` when both slots are filled → `last_activity_at` bumped → realtime fires → all viewers refetch → renderer recomputes. Byes are written as `complete` rows with the winner pre-populated at generation.

**Two invariants the review surfaced (load-bearing):**
- **Generation runs exactly once, at `startBracket`, and is persisted.** Random seeding is resolved once here and frozen into rows. "Data-derived" means the renderer derives state from the *persisted* `bracket_matches` — it NEVER re-runs `generateBracket` on a read/refetch (that would reshuffle a random bracket).
- **Terminal + grand-final-reset completion.** The bracket is `complete` only when its terminal match resolves. With reset ON there are two possible terminals: the grand final (if the WB champ wins it) or the reset match (if the LB champ won game 1). Generation encodes the reset match as a conditional node; advancing the grand final either completes the bracket (WB champ wins) or activates+routes into the reset match (LB champ wins) — the completion predicate must check the *active* terminal, not just "grand final resolved."

**Close & sweep (reconciles the `closed` status):** `closeBracket` sets `status='closed'` (a tombstone) so an already-shared link still shows the final result instead of instantly 404-ing — important for a share-funnel tool. The inactivity **auto-sweep hard-deletes** `closed` and long-idle brackets (cascade). This satisfies R23 (purge) via the sweep while keeping results briefly viewable.

## Implementation Units

Grouped into three phases. Foundation (1–3) → UI (4–6) → lifecycle & ship (7–8).

### Phase 1 — Foundation

- [ ] **Unit 1: Schema + migration + generated types**

**Goal:** Create the three bracket tables, add them to the realtime publication, regenerate types.

**Requirements:** R1–R6, R23 (storage foundation), paid-aware model.

**Dependencies:** None.

**Files:**
- Create: `supabase/migrations/<ts>_bracket_tables.sql`
- Modify: `src/types/database.types.ts` (regenerate)
- Modify: `TABLE_OF_CONTENTS.md`
- Test: `src/__tests__/database/brackets_schema.db.test.ts`

**Approach:**
- One consolidated migration creating `brackets`, `bracket_participants`, `bracket_matches` per the data-model sketch. Text columns + `CHECK` (not enums); all NOT NULL with sentinels where a "none" state exists; child FKs `ON DELETE CASCADE`; indexes on `bracket_id`, `share_token`, `last_activity_at`. `member_id` nullable (the sole paid-aware hook — see the open question on whether to keep it in v1).
- **`share_token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid()`** — a non-enumerable token generated at the DB level, matching the `teams.join_token` / `invite_tokens.token` precedent. Never generate it in application code.
- **Realtime:** add `bracket_matches` (and `brackets`, since the view watches its status) to the `supabase_realtime` publication AND set `REPLICA IDENTITY FULL` on both. Filtered `postgres_changes` UPDATE subscriptions (`bracket_id=eq.…`) only match when the replicated row carries `bracket_id`, which requires `REPLICA IDENTITY FULL` — every existing realtime table sets it. Use the realtime-enablement migration (e.g. `supabase/migrations/20251212000000_enable_realtime.sql`) as the pattern for this block, NOT `push_subscriptions` (which is INSERT-only and not a realtime table).
- Regenerate types on CLI ≥2.115 to a temp file, then move into place.

**Patterns to follow:** `supabase/migrations/20260818000000_push_subscriptions.sql`.

**Test scenarios:**
- Happy path: insert a bracket + participants + matches; rows persist with defaults applied.
- Integration: deleting a `brackets` row cascades to its participants and matches (nothing orphaned).
- Edge case: `CHECK` rejects an invalid `format`/`status`/`side` value.
- Edge case: duplicate `share_token` insert is rejected by the unique constraint.

**Verification:** Migration applies on a fresh `db reset`; types compile; cascade + checks proven by the db test.

- [ ] **Unit 2: Bracket generation engine (pure)**

**Goal:** Generate the full single- or double-elimination match tree from N seeded participants — byes, slot ordering, WB/LB drop routing, grand final + optional reset. Pure functions, no DB.

**Requirements:** R2, R4.

**Dependencies:** Unit 1 (for the match-shape types; the functions themselves are pure).

**Files:**
- Create: `src/utils/bracket/generateBracket.ts` (orchestrator + single-elim) and `src/utils/bracket/seeding.ts` (padding + byes + slot ordering)
- Create: `src/utils/bracket/doubleElim.ts` **only if** `generateBracket.ts` grows past ~100 lines (extract the complex half first; don't pre-split single-elim/seeding speculatively)
- Create: `src/types/bracket.ts`
- Test: `src/utils/bracket/generateBracket.test.ts` (co-located, unit project)

**Approach:**
- `seeding.ts`: **pad `N → nextPow2(N)`**, compute `byes = nextPow2(N) - N` assigned to top seeds and distributed across halves, recursive standard slot ordering (1,8,5,4,3,6,7,2 …) so top seeds meet late. It owns the bye→slot mapping; it may call `realPairsForStyle` ONLY with the padded power-of-two size (that helper returns `[]` for odd sizes and knows nothing about byes). Random seeding is resolved here **once** (at generation) and never recomputed.
- Single-elim: build `N-1`-match winners tree with `next_match` pointers; bye matches are emitted as `complete` rows with the winner pre-set.
- Double-elim: build WB tree + LB tree; route WB round R loser → LB round `2R-1`; **cross-seed drops to the opposite LB half at every drop-in round** (not just round 1) so a dropee never immediately re-meets who just beat them; propagate WB byes as LB byes; append grand final + a **conditional reset node** when `grand_final_reset` (encoded so `advanceWinner` activates it only if the LB champ wins game 1, else the grand final is terminal).
- Output is an in-memory tree the data layer (Unit 3) persists; every pointer must resolve to a real match (no cycles, exactly one active terminal).

**Technical design:** see the drop-routing block in High-Level Technical Design — directional, not a spec.

**Patterns to follow:** `realPairsForStyle` in `src/utils/playoffGenerator.ts` (pure seeding style).

**Test scenarios:**
- Happy path: 8 players single-elim → 7 matches, seed 1 vs 8 in round 1, correct `next_match` chaining to one final.
- Happy path: 8 players double-elim (reset off) → 14 matches, WB semifinal loser routes to LB final, grand final present, no reset match.
- Edge case (byes): 13 players single-elim → 3 byes to seeds 1–3, byes distributed across halves, byes auto-complete round 1.
- Edge case (small fields): 2 players → 1 match; 3 players → 1 bye to seed 1; 4-player double-elim → correct minimal WB/LB/grand-final structure.
- Edge case (reset on): double-elim with `grand_final_reset` → reset match exists and is only "played" if the LB champ wins game 1 (structure present, marked conditional).
- Edge case (double-elim byes): 6 players double-elim → fewer WB R1 drops, LB first drop-in round absorbs a bye correctly.
- Edge case (odd-N double-elim): 5 and 7 players → LB bye math is correct at the first drop-in round (the fragile case), tree is valid.
- Edge case (LB rematch, later rounds): in a 16-player double-elim, assert NO participant meets someone who already eliminated them at ANY LB drop-in round (not just the first) — the classic cross-seed failure.
- Structural validity (every generated tree): pointer graph is acyclic, every `next_match_id`/`loser_next_match_id` resolves to a real match, and there is exactly one active terminal — a count-correct tree can still be mis-linked, so assert structure, not just counts.
- Error path: 0 or 1 participant → generation refuses / returns empty with a clear signal (no malformed tree).
- Property: total match count matches `N-1` (single) and `2N-2`/`2N-1` (double) for a range of N (2…64).
- Determinism: `seeded`/`ranked` produce identical trees across runs; `random` with a fixed input order produces a stable tree (resolved once).

**Verification:** All scenarios pass, including the structural-validity and later-round-rematch assertions on 8/16/32-player double-elim trees (automated, not a manual spot-check).

- [ ] **Unit 3: Data layer — queries, mutations, hooks**

**Goal:** Persist and drive a bracket: create, add participants, generate+save matches, advance a winner (propagation), read (authed + public), close.

**Requirements:** R1, R3, R4, R5, R6, R21, R23.

**Dependencies:** Units 1–2.

**Files:**
- Create: `src/api/mutations/brackets.ts`, `src/api/queries/brackets.ts` (both `getBracket` and the public `getBracketShare` live here — no separate file), `src/api/hooks/useBrackets.ts`
- Create: `supabase/migrations/<ts>_bracket_share_rpc.sql` (the public read RPC — consolidate into Unit 1's migration before merge)
- Modify: `src/api/queryKeys.ts`
- Test: `src/__tests__/database/brackets_lifecycle.db.test.ts`

**Approach:**
- Mutations (all bump `last_activity_at` so a bracket mid-setup is never swept): `createBracket` (status `setup`, `created_by` = current member; `share_token` comes from the DB default, not app code), `setParticipants`, `startBracket` (calls Unit 2, persists match rows, status `live`), `advanceWinner` (conditional write — set winner only `WHERE status='ready' AND winner_participant_id IS NULL`; propagate winner/loser to next matches; set bracket `complete` when the *active* terminal resolves), `closeBracket` (set `status='closed'` tombstone — the sweep hard-deletes later).
- **Public read is a `SECURITY DEFINER` RPC granted to `anon`, column-projected to public fields only** (names, structure, winners, statuses) — matching `get_team_join_view`. With RLS off this RPC IS the authorization boundary, so a client-side `.select()` is NOT acceptable (it's bypassable); `getBracketShare` calls `supabase.rpc(...)`.
- Authed `getBracket` (full) is a normal query. Hooks wrap these with TanStack Query; invalidate on mutation.

**Execution note:** Write the `advanceWinner` propagation test-first — it is the core correctness path.

**Patterns to follow:** `src/api/mutations/pushSubscriptions.ts`, `src/api/queries/teamJoin.ts`, `src/api/hooks/useMessages.ts`, `src/api/queryKeys.ts`.

**Test scenarios:**
- Happy path: create → set 8 participants → start → 7 match rows persisted; advancing the round-1 winners populates round-2 home/away slots.
- Integration (double-elim): advancing a WB match writes the winner to `next_match` AND the loser to `loser_next_match`.
- Happy path: advancing the terminal match sets bracket `status = complete`.
- Edge case: a bye match is already `complete` at start and its winner is pre-populated downstream.
- Error path: `advanceWinner` on an already-complete match is a no-op (idempotent), not a double-advance.
- Error path (concurrency): two `advanceWinner` calls naming DIFFERENT winners on the same `ready` match — the conditional guard lets only the first succeed; the second is a no-op (no downstream corruption).
- Happy path: `closeBracket` sets `status='closed'`; the bracket drops off the organizer's active list but its `share_token` still resolves (results remain viewable until swept).
- Integration: every organizer mutation (`createBracket`/`setParticipants`/`startBracket`/`advanceWinner`) updates `last_activity_at`.
- Happy path: `getBracketShare` (RPC) returns names + structure for an anon caller and omits `created_by`, `member_id`, and every non-public column.
- (DB test hygiene: tx-scope or snapshot+restore per `src/__tests__/README.md`.)

**Verification:** Full create→advance→complete→close cycle proven by the db test; public read returns names-only.

### Phase 2 — UI

- [ ] **Unit 4: Create-bracket flow**

**Goal:** Linear flow for an authed organizer: name → participants → format → seeding → review → create.

**Requirements:** R1, R2, R3, R4, R21.

**Dependencies:** Unit 3.

**Files:**
- Create: `src/brackets/CreateBracketFlow.tsx` + `src/brackets/steps/*` (name, participants, format, review)
- Test: `src/brackets/CreateBracketFlow.test.tsx`

**Approach:**
- Add participant names (add/remove); **reorder via up/down controls** (mobile-safe — not drag-and-drop) when seeding mode is `seeded`. Choose `single|double` + reset toggle; choose seeding mode (`seeded|ranked|random`).
- **Review step shows the round-1 pairing preview** (who plays whom, byes marked) so an unexpected matchup is caught before the bracket goes live. Confirm → `createBracket` + `setParticipants` + `startBracket`.
- If `startBracket` fails (e.g. generation error), the bracket stays in `setup` with participants intact and the organizer can retry or discard — no stuck state.
- shadcn components; files ~100 lines. Simpler than the full wizard framework (ephemeral, no persistence needed), but mirror its `CardSelector`/`NumberStepper` building blocks.

**Patterns to follow:** `src/wizards/league-v2/` (structure), `src/components/wizard/` blocks.

**Test scenarios:**
- Happy path: fill name + 8 names + double-elim → review shows correct summary → submit calls the create/start mutations with expected args.
- Edge case: fewer than 2 participants blocks submit with a clear message.
- Edge case: duplicate display names are allowed (free text) but a soft warning is shown.
- Edge case: reordering names changes the seed order passed to generation.

**Verification:** Creating a bracket lands the organizer on the live bracket view with a generated tree.

- [ ] **Unit 5: Bracket tree renderer + organizer live view**

**Goal:** The multi-round tree visualization (net-new) with tap-to-advance for the organizer and mobile-friendly IA; live via realtime.

**Requirements:** R4, R5.

**Dependencies:** Units 2–3.

**Files:**
- Create: `src/brackets/BracketView.tsx`, `src/brackets/BracketTree.tsx`, `src/brackets/MatchCell.tsx`
- Create: `src/brackets/useBracketRealtime.ts`
- Test: `src/brackets/BracketTree.test.tsx`

**Approach:**
- Render winners tree (and losers tree + grand final for double-elim) computed purely from `bracket_matches`. Realtime subscription (mirror `useMessagingRealtime`) filtered by `bracket_id` → invalidate the bracket query; state is data-derived so a missed event only delays.
- **Design minimums (so states aren't invented — full visual polish still iterates in build):**
  - **Tap-to-advance is guarded:** tapping a participant in a `ready` match opens a small confirm ("Advance [name]?") before writing. A completed match can be **re-opened / vacated** by the organizer to fix a mis-tap (re-clearing the winner clears downstream slots that hadn't advanced further) — mirrors the app's vacate-and-rescore stance for correctness.
  - **Double-elim mobile layout:** a **tabbed surface (Winners / Losers / Grand Final)** is acceptable for v1 — both trees need NOT be visible simultaneously. This unblocks the renderer and lets Unit 6 reuse it.
  - **Large fields:** horizontal scroll with sticky round headers; default scroll position = the earliest `ready` round. Set a **v1 participant cap of 64** to bound the layout.
  - **Bracket states:** `setup` shows the participant list + "Start"; `live` shows the tree; `complete` shows a winner banner + "Close" action; a **bye cell** shows the advancing name with a small "BYE" marker.

**Patterns to follow:** `src/api/hooks/useMessagingRealtime.ts` (realtime), `src/components/playoff/PlayoffBracketCard.tsx` (match-cell styling only).

**Test scenarios:**
- Happy path: an 8-player tree renders 3 winner rounds; a completed match shows its winner advanced into the next round.
- Happy path (interaction): tapping a participant in a `ready` match calls `advanceWinner` with the right ids.
- Edge case: double-elim renders winners + losers + grand final; a bye cell renders as auto-advanced.
- Edge case: non-`ready` matches (missing an opponent) are not tappable.
- Integration: a simulated realtime UPDATE triggers a refetch and re-render (winner appears without a manual reload).

**Verification:** Organizer can run an entire bracket to completion by tapping; view stays live.

- [ ] **Unit 6: Public share view**

**Goal:** Public, read-only, live bracket at `/brackets/share/:shareToken` — names only, no auth.

**Requirements:** R5, R21 (viewers need no account; only the organizer creates).

**Dependencies:** Units 3, 5.

**Files:**
- Create: `src/brackets/PublicBracketPage.tsx`
- Modify: `src/navigation/NavRoutes.tsx` (public route, outside `MemberLayout`)
- Test: `src/brackets/PublicBracketPage.test.tsx`

**Approach:**
- Reuse `BracketTree` in read-only mode (no tap-to-advance). Read via `getBracketShare(shareToken)` (the RPC).
- **Verify anon realtime early:** the existing realtime hooks all run on authed pages, so postgres_changes delivery to the `anon` role is unproven here. Verify it in this unit; if anon streaming doesn't work, fall back to short-interval polling — because state is data-derived, polling still satisfies "live" (just coarser). Don't assume the authed messaging pattern transfers.
- **Not-found / ended state** (unknown, closed, or swept token): a friendly "This bracket has ended" screen with a "Create your own bracket" CTA — this is a public funnel page, so the dead-link state is a conversion surface, not just an error.
- Model the page on `src/onboarding/TeamJoinPage.tsx` (public param-driven read).

**Patterns to follow:** `src/onboarding/TeamJoinPage.tsx`, `src/api/queries/teamJoin.ts`, public-route block in `src/navigation/NavRoutes.tsx`.

**Test scenarios:**
- Happy path: an anon visit to a valid `shareToken` renders the live read-only bracket with names.
- Edge case: unknown/closed `shareToken` → friendly "bracket not found / ended" state, no crash.
- Edge case: read-only — no tap-to-advance affordance is present.
- Integration: an advance made in the organizer view appears in the public view via realtime.

**Verification:** Sharing the link shows the live bracket to a logged-out user; no PII beyond names.

### Phase 3 — Lifecycle & Ship

- [ ] **Unit 7: Close + inactivity auto-sweep**

**Goal:** Explicit close (hard delete) and an auto-sweep of abandoned brackets, so nothing lingers.

**Requirements:** R6, R23.

**Dependencies:** Unit 3.

**Files:**
- Create: `supabase/functions/sweep-brackets/index.ts` (or a SQL routine — decided at implementation)
- Modify: `src/brackets/BracketView.tsx` (close action + confirm)
- Test: `src/__tests__/database/brackets_sweep.db.test.ts`

**Approach:**
- Close: a confirmed action calling `closeBracket` (sets `status='closed'` — the shared link keeps showing final results).
- Auto-sweep: hard-delete (cascade) any bracket that is `closed` OR whose `last_activity_at` is older than a threshold (e.g. 7 days). **Default mechanism = opportunistic cleanup-on-create** — `createBracket` first deletes qualifying stale brackets. This is zero-infrastructure and sidesteps the no-cron-precedent problem; a scheduled edge function / pg_cron is a later upgrade if needed (if an edge function is ever used, a full `db:stop && db:start` is required after adding it).

**Patterns to follow:** cascade-delete from Unit 1; `memory/feedback_new_edge_functions_need_supabase_restart.md` if an edge function is ever chosen.

**Test scenarios:**
- Happy path: close sets `status='closed'`; children remain until swept; the share link still resolves.
- Happy path: the sweep hard-deletes `closed` and past-threshold brackets + all children (cascade), leaving zero orphans.
- Edge case: a bracket with recent `last_activity_at` is NOT swept.
- Edge case (the setup trap): a bracket in `status='setup'` with recent `setParticipants` activity is NOT swept mid-configuration.
- Edge case: advancing a winner bumps `last_activity_at` (a live bracket never gets swept mid-play).

**Verification:** Closed and abandoned brackets leave zero orphaned rows.

- [ ] **Unit 8: Feature gate, entry points, navigation, docs**

**Goal:** Ship gated — flag + route + all entry points together — and update project docs.

**Requirements:** R1 (discoverable), gating convention.

**Dependencies:** Units 4–6.

**Files:**
- Create: `src/brackets/BracketsIndexPage.tsx` (organizer's list of their brackets + empty state)
- Modify: `src/config/featureFlags.ts` (add `BRACKETS_ENABLED`)
- Modify: `src/navigation/NavRoutes.tsx` (authed `/brackets` routes, gated)
- Modify: the **player dashboard** entry surface (confirm the exact file during the unit) — a "Brackets" card/link gated with the SAME flag
- Modify: `LIST_FOR_ED.md`, `TABLE_OF_CONTENTS.md`
- Test: `src/brackets/bracketsGating.test.tsx` (light)

**Approach:**
- `BRACKETS_ENABLED` on in dev, off in prod (mirror `PUSH_NOTIFICATIONS_ENABLED`). Gate the route AND every entry point behind it so prod never shows a door to a missing room (the 2026-06-21 gating bug).
- **Brackets index:** lists the organizer's brackets (live / setup / complete); empty state = a "Create your first bracket" CTA. This is the landing surface behind the dashboard entry.
- Add the gated feature to `LIST_FOR_ED.md`; keep `TABLE_OF_CONTENTS.md` current for all new files.

**Patterns to follow:** `src/config/featureFlags.ts`, feature-gating section in project `CLAUDE.md`.

**Test scenarios:**
- Test expectation: light — verify the entry point and route are both hidden when the flag is off (guards against the "door but no room" bug).

**Verification:** With the flag off, no bracket UI is reachable; with it on (dev/staging), the full flow works end-to-end.

## System-Wide Impact

- **Interaction graph:** New tables join the `supabase_realtime` publication; a new public route sits outside `MemberLayout`. No existing league/match/scoring code is touched.
- **Error propagation:** Mutations `throw` per convention; `advanceWinner` is idempotent so a double-tap or a replayed realtime event cannot double-advance.
- **State lifecycle risks:** Bracket state is data-derived (recomputed from matches) so a missed realtime event delays but never corrupts. Cascade deletes prevent orphans on close/sweep.
- **API surface parity:** None — this is greenfield; it does not change existing APIs.
- **Integration coverage:** Cross-layer scenarios (advance → propagate → realtime → re-render; close → cascade) are covered by db tests + a simulated-realtime component test.
- **Unchanged invariants:** No change to `src/types/tournament.ts` (championship lookup), the league playoff pipeline, `game_confirmations`, or the push pipeline. This plan explicitly builds none of the paid features.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Double-elim generation is intricate (drop routing, byes, reset) | Isolate as pure functions (Unit 2) with an exhaustive scenario suite before any UI; algorithm rules pinned from authoritative sources in research. |
| No existing bracket-tree renderer — mobile layout is net-new | Data-derived renderer; default to horizontal-scroll + round anchors; treat exact technique as a deferred prototype in Unit 5. |
| Realtime CLOSED/TIMED_OUT churn in dev | Known to be the local container (restart); app-level pattern makes state data-derived so play never blocks; keep effect deps minimal. |
| Anon realtime may not stream to the public share view (unproven for the `anon` role) | Verify in Unit 6; fall back to short-interval polling — data-derived state keeps it correct, just coarser. |
| Filtered UPDATE events silently don't fire (missing `REPLICA IDENTITY FULL`) | Set it in Unit 1's migration; a db test asserts an advance UPDATE is received on a `bracket_id`-filtered channel. |
| RLS off → anyone can advance/write any bracket | Accepted for gated v1 with disposable data; logged as a pre-launch RLS item (`PRE_LAUNCH_CHECKLIST.md`), not fixed here. |
| Auto-sweep has no cron precedent | Delete logic planned now; scheduling mechanism deferred to implementation against the local stack; explicit-close covers the common case regardless. |
| Type regen drift | Regen on CLI ≥2.115 to a temp file; additive hand-edit is acceptable (disposable data). |

## Documentation / Operational Notes
- Add `BRACKETS_ENABLED` to `LIST_FOR_ED.md` (gated → awaiting staging review + un-gate), noting the route + entry points gated together.
- Keep `TABLE_OF_CONTENTS.md` current for every new file.
- New edge function (if used for sweep) requires a full local Supabase stop/start.
- Log to `PRE_LAUNCH_CHECKLIST.md` with specifics so the RLS author has a concrete spec: (a) bracket writes must require `created_by = the calling member` (not merely "authenticated"); (b) the public share RPC stays column-projected; (c) `share_token` has no independent TTL, so a failed close/sweep leaves a bracket readable at its URL — acceptable for disposable v1, revisit at launch.

## Sources & References
- **Origin document:** [docs/brainstorms/2026-08-26-tournament-bracket-requirements.md](docs/brainstorms/2026-08-26-tournament-bracket-requirements.md)
- Reusable seed math: `src/utils/playoffGenerator.ts` (`realPairsForStyle`)
- Public-read precedent: `src/onboarding/TeamJoinPage.tsx`, `src/api/queries/teamJoin.ts`
- Realtime pattern: `src/api/hooks/useMessagingRealtime.ts`
- Migration style: `supabase/migrations/20260818000000_push_subscriptions.sql`
- Naming collision: `src/types/tournament.ts`
- Memory: `project_rls_disabled_until_launch`, `project_match_realtime_resilience_gap`, `project_db_test_shared_postgres_isolation`, `feedback_new_edge_functions_need_supabase_restart`, `project_dbtypes_cli_version_drift`, `feedback_dev_data_disposable`
- External: Wikipedia (Double-elimination tournament, Bye); tournament-software bracket/seeding docs (see research)
