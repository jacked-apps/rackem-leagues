---
date: 2026-04-29
topic: team-deletion-cascade-fix
status: Requirements — refined after document review (with resolve-before-planning questions)
scope: Three PRs in order — PR 0 is a minimal, independently shippable cascade safety net so the urgent fix is not gated on the larger refactor. Captain flake-flag is a separate item (LIST_FOR_ED.md #7).
---

# Team Deletion Cascade Fix (Unified Bye / Withdrawn / Replace Workflow)

## Problem Frame

`LIST_FOR_ED.md` item #1 documents a destructive cascade: the FKs
`matches.home_team_id` and `matches.away_team_id` are defined with
`ON DELETE CASCADE` (verified in
`supabase/migrations/20251130010824_baseline.sql:2960` and `:2980`). When an
operator clicks "Delete Team" in `src/operator/TeamManagement.tsx →
handleDeleteTeam` (the only `teams.delete` call site in `src/`), the
database silently destroys every match that team was part of — breaking
opponents' weekly schedules and corrupting standings that referenced those
matches.

Audit of when an operator would realistically click "Delete Team" surfaced
five scenarios. In four of the five, **"delete" is the wrong verb**:

| # | Scenario | Right verb |
|---|---|---|
| 1 | Setup mistake (no matches yet) | True delete |
| 2 | Captain flakes pre-schedule | Delete or replace |
| 3 | Mid-season drop, replacement available | Replace |
| 4 | Mid-season drop, no replacement | Drop (becomes a bye) |
| 5 | In-progress edge case (almost never) | Refuse |

The bug is therefore not just a missing guard — it's a missing model.
Real-world team movement is **drop**, **replace**, or **delete-when-truly-empty**,
and the system has no concept of the first two.

A separate concern surfaced during the conversation: bye matches today are
represented by `home_team_id = NULL` (see
`src/utils/scheduleGenerator.ts:167-179` TODO and
`memory-bank/plans/bye-team-enhancement-plan.md`), and the same shape is
needed to absorb a dropped team's unplayed matches. The two problems share
infrastructure, so this brainstorm covers both — split into **three** PRs
in build order, with the first being a minimal independently-shippable
safety net.

## Strategic Identity

This is a **correctness fix with a small data-model extension**, not a
feature. Success = the destructive cascade is physically impossible AND
operators have safe, semantically correct ways to handle mid-season team
movement. The unified bye/withdrawn/replace model is the smallest extension
that makes both possible.

After review, the work is split into a **PR 0** (minimal cascade safety
net, ~30-50 lines) that closes the immediate data-loss risk and can ship
today, plus two follow-on PRs that deliver the bye-as-real-team
representation (Piece 1) and the drop/replace workflow (Piece 2). The
urgency profile is decoupled: PR 0 ships ASAP regardless of how long
the larger refactor takes.

## Requirements

**Schema Safety (PR 0 + Piece 2)**

- R1. The FKs `matches.home_team_id`, `matches.away_team_id`, **and
  `match_lineups.team_id`** change from `ON DELETE CASCADE` to
  `ON DELETE RESTRICT`. The database itself must refuse any team
  deletion that would orphan a match or its lineup rows, regardless of
  call-site (UI, ad-hoc SQL, future feature). All three FKs flip
  together — flipping only the matches FKs leaves match_lineups as a
  silent data-loss path on raw `DELETE FROM teams`. **Ships in PR 0.**
- R1a. The UI handler `handleDeleteTeam` in
  `src/operator/TeamManagement.tsx` is updated to refuse deletion when
  the team has any matches (any status), with a clear message. This is
  the immediate user-facing cascade safety net. **Ships in PR 0.** The
  full Drop/Replace UX comes later (R6, R9, R11).
- R1b. `src/components/modals/DeleteLeagueModal.tsx:98` does a bulk
  team delete during league teardown that today relies on cascade. The
  league-teardown flow must also delete child matches (and their
  lineups) before deleting teams, so it doesn't trip the new RESTRICT
  constraint. **Ships in PR 0** (or PR 0 fails to deploy).

**Bye as a Real Team (Piece 1)**

- R2. The `teams.status` `CHECK` constraint accepts a new value `'bye'`
  alongside the existing `'active' | 'withdrawn' | 'forfeited'`.
  (Verified: the column and its constraint exist today at
  `supabase/migrations/20251130010824_baseline.sql:2099`.) **Ships in
  Piece 1** because R3's INSERT depends on the new value being valid.
- R3. A bye is represented as a real `teams` row with `status = 'bye'`,
  no `captain_id`, and no entries in `team_players`. The current
  `'BYE' → null` conversion in `src/utils/scheduleGenerator.ts:167-179`
  is replaced with a real INSERT.
- R3a. `teams.captain_id` is currently `NOT NULL` with a `RESTRICT` FK
  to `members` (verified at
  `supabase/migrations/20251130010824_baseline.sql:2081, :3105`). The
  bye row in R3 cannot be inserted without altering this. The chosen
  approach is to **drop the `NOT NULL` constraint** so a bye row has
  `captain_id = NULL`. Rejected alternative: a sentinel "system bye"
  member, which would force every captain-joining query to special-case
  the sentinel. Code that reads `team.captain_id` after this change
  must handle the null case (audit list deferred to planning).
- R3b. `teams.team_name` is currently `NOT NULL`. Bye rows use a
  deterministic name: `'BYE'` for original schedule-generation byes,
  `'BYE — replaced <Team Name> wk <N>'` for drop-created byes. This
  preserves attribution without adding new columns. `teams.roster_size`
  inherits the league's roster size on insert (the value is meaningless
  for a bye but the column is `NOT NULL` with a CHECK).
- R4. Existing matches with `NULL` team_ids (from previous seasons) are
  migrated to point at a per-season bye row. Past `NULL`-bye matches
  preserve whatever historical state they had. **Migration scope
  depends on the deferred research question below ("how many seasons,
  how many matches, do any have orphan match_lineups rows") — that
  question must be answered before this requirement's exact migration
  shape is final.**
- R5. The known bug at `src/player/TeamSchedule.tsx:322` — "Score Match"
  button still appears on bye weeks — is fixed using the new
  `status = 'bye'` signal.

**Drop Operation (Piece 2)**

- R6. "Drop a team" is an operator action that:
  1. Sets the team's `status` to `'withdrawn'`.
  2. Marks each of that team's `team_players` rows with
     `status = 'dropped'` (the existing
     `team_players_status_check` already supports this value at
     `supabase/migrations/20251130010824_baseline.sql:2042`). Players'
     historical `individual_wins`, `individual_losses`, and skill data
     are preserved — they remain queryable for completed weeks. Roster
     queries that show "current team members" filter by
     `status = 'active'` so dropped players don't appear as current
     roster.
  3. Creates a new `'bye'` team row for the same season (R3a applies).
  4. Reassigns the withdrawn team's `scheduled` and `postponed` matches
     (and their corresponding `match_lineups` rows) to the new bye row.
  5. Leaves matches with status `completed`, `awaiting_verification`,
     `forfeited`, or `in_progress` unchanged — they keep pointing at the
     withdrawn team's row (preserving historical truth and live game
     state). Only `scheduled` and `postponed` matches are reassigned per
     R6.4.
- R6a. The drop operation runs as a single Postgres transaction (an
  RPC / stored function) with a row lock on the team being dropped, AND
  refuses if the team's `status` is already `'withdrawn'` (idempotency
  check). This prevents two operators racing on the same team and
  prevents double-clicks from creating orphan bye rows.
- R7. Each drop creates its **own** new bye row. Multiple drops in a
  season produce multiple bye rows, never reusing one as a shared
  holding pen.
- R8. Drop is the **only** operator action against an active team that
  can take a team out of standings. Hard delete remains available only
  for teams with zero matches (see R12).

**Replace Operation (Piece 2)**

- R9. "Replace" is a single operator action used for two semantically
  identical cases: filling an original season-start bye, and filling a
  bye created by a mid-season drop. It:
  1. Creates a new `teams` row with `status = 'active'` and the new
     captain / roster / name.
  2. Reassigns the bye row's `scheduled` and `postponed` matches (and
     their corresponding `match_lineups` rows) to the new active row.
  3. Leaves the bye row in place as a frozen record. Any past
     `scheduled` or `postponed` matches that the LO chose **not** to
     transfer (because they're staying as opponent forfeits, not
     becoming makeups) remain attached to the bye row and are still
     handled by the read-time helpers in R14/R15.
- R10. Team rows are never recycled. A row represents one identity; on
  withdrawal or supersession its identity is frozen, and a new identity
  becomes a new row.

**Hard Delete (Piece 2)**

- R11. The existing "Delete Team" button is renamed and its behavior
  branches by team state:
  - 0 matches → true delete (row gone, `team_players` cascades as today)
  - Only placeholder matches (`scheduled` + `postponed`) → uses the
    Drop or Replace flow above
  - Any results-bearing match (`completed`, `awaiting_verification`,
    `forfeited`, `in_progress`) → hard delete is not offered; only
    Drop is available
- R12. The schema-level `RESTRICT` (R1) is the final safety net even if
  the UI logic is bypassed.

**Display Rules (Piece 1 + 2)**

- R13. Anywhere active teams are listed (standings, captain dropdowns,
  active team list on the operator's team-management page), filter by
  `status = 'active'`. Withdrawn and bye rows are hidden from these
  views but remain queryable for history.

**Read-Time Helpers (Piece 1)**

- R14. The schedule view hides matches that meet **all three** of:
  opponent has `status IN ('bye', 'withdrawn')`, match status is still
  `'scheduled'`, AND the match's date has passed. Future bye/withdrawn
  matches still render normally as "vs BYE" so users see "no game this
  week."
- R15. Past unplayed matches against bye/withdrawn opponents are
  finalized to `status = 'forfeited'` with the league's standard
  forfeit point and game values, so the standings query at
  `src/api/queries/standings.ts:60-137` continues to rank teams by
  `points` correctly with no rewrite. The eager write happens in two
  triggers:
  - **On Drop (R6).** The drop operation forfeits any past-dated
    `'scheduled'` matches it would otherwise reassign — those weeks
    are already past, the team is gone, so they're locked as forfeit
    losses for the dropped team and forfeit wins for the opponents
    immediately. Future-dated matches get reassigned to the new bye
    row as normal.
  - **End-of-week / season-finalize sweep.** Any remaining past-dated
    `'scheduled'` matches against bye opponents (e.g., from an
    original-schedule bye that nobody has filled or made up) get
    forfeited at week-rollover or season-end. Exact trigger
    (operator-initiated vs automatic on week change) deferred to
    planning.
- R15a. Bye-vs-bye matches never credit anyone — both teams have
  `status != 'active'`, so the forfeit-write logic skips them.
- R15b. Makeup conversion (R17) is a single atomic RPC that:
  - Updates `home_team_id` / `away_team_id` from the bye to the new
    active team
  - Resets `status` from `'forfeited'` back to `'scheduled'`
  - Clears the points / games / `winner_team_id` that the eager
    forfeit wrote
  After this, the match plays like any other scheduled match. From
  the LO's UI: one click ("Convert to makeup → pick team → done").
  This RPC is the reason the eager-write approach doesn't make
  makeups harder than the read-time approach.
- R16. Past matches with status `completed`, `awaiting_verification`,
  `forfeited` (already), or `in_progress` are never touched by the
  drop, replace, or eager-forfeit-write operations. A withdrawn team's
  historical wins/losses still appear on opponents' records exactly as
  played. Only past-dated `'scheduled'` matches are touched (by R15's
  eager write to `'forfeited'`).

**Operator UI (Piece 2)**

- R19. The team-management page's per-team action surface (currently
  one Edit button + one Delete button on each `TeamCard`) becomes:
  - For a team with **0 matches**: existing "Delete Team" button,
    behaves as today.
  - For a team with **only `scheduled` / `postponed` matches**:
    primary "Drop Team" button. The Drop confirmation dialog surfaces
    the impact ("This will reassign N scheduled matches to a new BYE
    slot"). After confirmation, the team disappears from the active
    list (per R13).
  - For a team with **any results-bearing match** (`completed`,
    `awaiting_verification`, `forfeited`, `in_progress`): the Drop
    button is still offered (because mid-season drops are real), but
    Hard Delete is not. The dialog spells out that history is
    preserved.
  Exact visual styling deferred to planning, but the three-state
  behavior is part of requirements.
- R20. Bye and withdrawn rows are not visible in the active team list
  (R13), but a "Replace bye / withdrawn slot" affordance must be
  reachable from the team-management page. Specific surface deferred
  to planning, but candidate locations: a separate "Inactive slots"
  collapsed section on the team-management page, OR a "Replace" entry
  in a bye match's context on the schedule editor. Planning must pick.
- R21. The Drop and Replace operations are individual atomic
  operations (R6a). Operator may invoke them in sequence in one visit
  or across visits — both must be supported. **[Resolves the prior
  open question about combined-flow vs separate-flow.]**

**Captain / Player Communication (Piece 2)**

- R22. The `teams` table gains a `withdrawn_at timestamptz null`
  column, set when a team's `status` flips to `'withdrawn'`. This
  enables read-time UIs to surface "Team X dropped on <date>" context
  without inferring it from match history.
- R23. The schedule UI shows an explanatory note on bye matches
  derived from a drop (i.e., the bye row's `team_name` follows the
  R3b convention `'BYE — replaced <Original Name> wk <N>'`), so a
  captain or player viewing a future "vs BYE" week can tell whether
  it was an original schedule bye or a mid-season replacement. Past
  drop-byes (per R14, hidden from schedule view) need no surfacing.
- R24. Multi-bye warning. When a season has two or more teams with
  `status = 'bye'`, the team-management page surfaces a non-blocking
  notice to the LO: "This season has N bye teams. You can edit the
  schedule so the bye teams play each other for the remaining weeks,
  freeing real teams to play every week." The notice links to the
  schedule editor. The threshold (2+ byes) is the trigger; the
  message stays visible until the season has at most one bye row.
  Implementation: a query on `teams` filtered by `status='bye'`
  joined to the season; banner component on the team-management
  page. No new schema needed.

**Per-Match Makeup Override (Piece 2)**

- R17. The LO can convert a past scheduled bye/withdrawn match into a
  makeup by reassigning that single match to a real team via the
  existing schedule editor (`src/components/schedule/WeekEditorView.tsx`).
  Once both sides of a match are active teams, the match becomes
  playable normally — no special workflow required. **Assumption (to
  be verified during planning):** the existing editor's team-swap UI
  supports reassigning to/from any team in the season, including
  multiple bye rows. If the editor only supports a single "BYE" option
  today (per its `showByeOption` prop), R17 may need editor changes.
- R18. Two-byes-in-one-match edge case (e.g., two teams drop and were
  scheduled to play each other). Honest assessment after review: the
  current schedule editor (`src/components/schedule/useWeekEditor.ts`)
  is single-week-scoped, and its swap logic moves the bye sideways
  within the same week rather than eliminating bye-vs-bye. So R18 is
  **not free** as originally written. Two acceptable outcomes:
  - **(a) Accept bye-vs-bye exists.** Per the user-stated philosophy
    ("two teams not playing because of a bye is the bad thing; bye
    playing bye is fine"), bye-vs-bye matches simply credit no one
    (R15 handles this), the LO can use cross-week schedule editing if
    they want to consolidate, and we don't build new editor features
    for the rare edge case.
  - **(b) Add a cross-week swap action** to the schedule editor as a
    follow-up. Out of scope for the initial three PRs.
  This requirement now reads: "Bye-vs-bye matches are an accepted
  edge case. The standings helper (R15) handles them correctly (no
  win credited). LO consolidation is a manual operator workflow using
  existing per-match editing — not a new feature in this work."

## Success Criteria

**PR 0:**
- The destructive cascade is physically impossible — verified by
  attempting a raw `DELETE FROM teams WHERE id = X` against a team with
  matches and observing the FK rejection on all three FKs (matches +
  match_lineups).
- The UI cannot trigger a destructive delete: `handleDeleteTeam` refuses
  with a clear message when matches exist.
- League teardown via `DeleteLeagueModal` continues to work under the
  new RESTRICT regime (no cascade reliance).

**PR 1 (Piece 1):**
- Bye matches are real `teams` rows (not NULL team_ids).
- The known "Score Match button on bye week" bug is gone.
- Standings correctly credit forfeit wins (with full points / games)
  for past unplayed bye matches, by whichever path R15 selects.
- Bye/withdrawn rows do not appear in active team lists across the
  filter-audit surface area.

**PR 2 (Piece 2):**
- An operator can drop a team mid-season without losing any historical
  match data, including per-player stats on `team_players`. Opponents'
  standings remain correct.
- An operator can replace an original bye OR a drop-created bye with a
  new team, and the new team starts 0-0 regardless of how many forfeit
  losses the bye accumulated.
- The Drop operation is concurrency-safe (idempotent, row-locked).
- Captains and players can tell from the UI when a future "vs BYE"
  match is an original schedule bye vs. a mid-season replacement.

## Scope Boundaries

- **Out: captain flake-flag feature.** Already captured as
  `LIST_FOR_ED.md` item #7. Its only intersection with this work is that
  the drop operation in R6 is the eventual write site for the flag —
  but the flag schema and surfacing is its own PR.
- **Out: auto-forfeit on date pass.** Status stays `'scheduled'` until
  something explicit changes it. The R14/R15 read-time helpers do the
  display and standings work without DB writes.
- **Out: dedicated "make these past byes into makeups" wizard.** R17
  uses the existing schedule editor instead.
- **Out: full execution of the existing
  `memory-bank/plans/bye-team-enhancement-plan.md`.** This brainstorm
  delivers the subset of that plan needed for the cascade fix
  (bye-as-real-team + filtering + Score Match button fix). Configurable
  bye points, auto-completion of bye matches, and a separate
  `is_bye_team` boolean column are all explicitly deferred. Wherever
  this brainstorm overlaps with that plan, this one supersedes it (uses
  `status = 'bye'` instead of a new boolean column).
- **Out: backfill of the captain flake-flag from historical drops.**
  Forward-looking only.

## Key Decisions

- **Team rows are never recycled.** Rationale: reusing a row caused
  "new team inherits forfeit losses" — a junior dev mid-season-drop
  scenario surfaced this directly. Each identity = one row, frozen on
  withdrawal.
- **Drops create a NEW bye row, not a shared one.** Rationale: clean
  attribution ("this bye came from Team A dropping in week 6"), and
  avoids the bye-vs-bye-as-one-row weirdness if multiple teams drop.
  Multiple bye rows is cheap; conflated history is not.
- **Bye uses `teams.status = 'bye'`, not a new `is_bye_team` boolean.**
  Rationale: the existing status column already encodes
  active/withdrawn/forfeited, and bye fits the same lifecycle axis.
  One state column instead of two parallel flags.
- **No auto-forfeit logic.** Rationale: the LO's makeup workflow needs
  matches to remain `'scheduled'` past their date so they're still
  playable. Read-time helpers (R14/R15) achieve the same UX without DB
  writes or background jobs.
- **Schema fix + UI guard, not either alone.** Rationale: UI-only
  guards leave the cascade as a loaded gun for any other code path.
  Schema-only is safe but produces ugly FK errors. Doing both = safe
  AND nice.

## Filter Audit

R13's "filter by `status = 'active'`" affects more call sites than first
enumerated. Verified surface area (planning must enumerate completely;
this is a starting list):

- `src/api/queries/teams.ts` — `getTeamsBySeason`, `getTeamsByLeague`,
  `getTeamDetails` (all `select *`, no status filter today)
- `src/api/queries/players.ts` — captain lookup queries
- `src/api/queries/standings.ts` — already filters by completed
  matches; needs to also exclude bye/withdrawn teams from rankings
- `src/api/queries/teamStats.ts` — consumes standings + layers stats
- `src/utils/playoffGenerator.ts` — must not seed playoffs with
  bye/withdrawn rows
- `src/operator/SeasonScheduleManager.tsx`,
  `src/operator/LeagueDetail.tsx`,
  `src/components/operator/LeagueOverviewCard.tsx`,
  `src/components/operator/SeasonsCard.tsx`,
  `src/components/operator/ScheduleCard.tsx`,
  `src/components/operator/LeagueStatusCard.tsx`,
  `src/components/modals/DeleteLeagueModal.tsx` — operator-side team
  lists
- `src/wizards/league-v2/useFlowStageHandlers.ts`,
  `src/wizards/league-v2/useFlowStageDetection.ts` — wizard team
  enumeration
- `src/components/MatchCard.tsx`, `src/components/schedule/MatchCard.tsx`,
  `src/components/lineup/MatchInfoCard.tsx` — `!opponent` checks
  become `!opponent || opponent.status !== 'active'`
- `src/player/TeamSchedule.tsx` — opponent display + the existing
  Score Match button bug guard at line 322

The recommended approach is to make the filter the **default at the
query layer** (via a shared helper or RPC), with explicit opt-in for
queries that need bye/withdrawn rows. This avoids the long tail of
"every new component that fetches teams must remember to filter."

## Dependencies / Assumptions

- **Piece 1 must ship before Piece 2.** Piece 2's drop operation
  reassigns matches to a bye row that doesn't exist as a real row until
  Piece 1 is in. Sequencing is non-negotiable.
- **Verified:** `teams.status` column exists and is constrained to
  `active|withdrawn|forfeited`
  (`supabase/migrations/20251130010824_baseline.sql:2099`). Adding
  `'bye'` is a CHECK-constraint update, not a new column.
- **Verified:** `match_lineups` rows are auto-created by a trigger when
  a match is inserted, referencing `home_team_id` and `away_team_id`
  (`supabase/migrations/20251130010824_baseline.sql:129-170`). Match
  reassignment must therefore also update or recreate the corresponding
  lineup rows; this is called out in R6.4 and R9.2.
- **Verified:** `handleDeleteTeam` in `src/operator/TeamManagement.tsx`
  is the only `teams.delete` call site in `src/` — but note that an
  unused soft-delete helper already exists at
  `src/api/mutations/teams.ts:261-274` (`deleteTeam`, sets `status =
  'withdrawn'`). The current UI handler bypasses it and issues a raw
  DELETE, which is exactly how the cascade fires today. Any rewiring of
  the UI handler should evaluate whether to use or replace this helper.

## Visual Aid: Operation Effects

| Operation | Old team row | Old team's roster | Past completed matches | Future scheduled matches | New row created? |
|---|---|---|---|---|---|
| **Hard delete** (zero matches only) | Deleted | Cascades away | N/A | N/A | No |
| **Drop** | Status → `withdrawn` | Cleared | Untouched | Reassigned to a new bye row | Yes (bye) |
| **Replace** (bye → active) | Stays as `bye`, frozen | N/A (bye has none) | Untouched | Reassigned to the new active row | Yes (active) |
| **Per-match makeup override** | Untouched | Untouched | Untouched | Single match reassigned to a real team via schedule editor | No |

## Alternatives Considered

- **Block delete in UI only, leave FK as `CASCADE`.** Rejected: leaves
  the destructive path open to any other code call (raw SQL, future
  bulk operations, scripts). The schema is the only guarantee.
- **Add a `deleted_at` column to teams (soft-delete pattern).**
  Rejected: turned out unnecessary because `teams.status` already
  encodes the same lifecycle. Adding a parallel flag would create two
  truth sources.
- **Reuse the same team row when a new captain takes over a bye or a
  withdrawn slot.** Rejected: caused "new team inherits forfeit
  losses" — surfaced directly during the brainstorm via a junior-dev
  walkthrough of "team A 3-3, drops, 2 weeks pass, team B forms."
- **Auto-flip bye matches to `'forfeited'` on date pass via cron or
  trigger.** Rejected: conflicts with the makeup workflow (R17). Once
  a match is `'forfeited'` it can't be reopened cleanly. Read-time
  helpers (R14/R15) achieve the same display effect without locking
  the data.
- **Ship the full
  `memory-bank/plans/bye-team-enhancement-plan.md` in one PR alongside
  the cascade fix.** Rejected: too big for one bite, and the plan
  contains items (configurable bye points, auto-completion) that this
  fix doesn't strictly need.
- **Single-PR for both Pieces 1 and 2.** Rejected: junior-dev-friendly
  review favors smaller bites; same final code either way.

## Outstanding Questions

### Resolve Before Planning

_All resolved._

### Deferred to Planning

- [Affects R3, R4][Technical] Schedule generator currently emits the
  string `'BYE'` and converts to `null`. Planning needs to decide: do
  we INSERT the bye row at schedule-generation time (preferred), or
  lazily on first reference?
- [Affects R4][Needs research] Migration of existing `NULL`-bye
  matches in production: how many seasons, how many matches, do any
  have `match_lineups` rows still pointing at non-existent teams?
  Add an audit-and-classify pre-step before writing the migration.
- [Affects R6][Technical] Exact `match_lineups` reassignment
  approach — UPDATE in place vs DELETE + let trigger recreate. Each
  has subtle differences (preserves vs resets `lineup_locked`,
  `players` JSON, etc.). Watch for the `(match_id, team_id)` UNIQUE
  constraint at `supabase/migrations/20251130010824_baseline.sql:2267`.
- [Affects R11, R19, R20][Technical] Where the branching logic in
  R19 lives — inside `handleDeleteTeam` or split into separate
  operator actions on `TeamCard`. Likely a separate hook/util given
  `TeamManagement.tsx` is already 800+ lines (`LIST_FOR_ED.md` #5).
  Same hook covers Replace surface (R20).
- [Affects R17][Technical] The schedule editor's `showByeOption`
  prop currently gates a single BYE option. Multiple bye rows per
  season require either extending the prop, replacing it with a
  generic "include non-active teams" toggle, or surfacing bye rows
  as named options in the existing teams dropdown.
- [Affects R3a, R10][Technical] Audit list of code paths that read
  `team.captain_id` and assume non-null. R3a drops the constraint;
  every consumer of the join `captain:members!captain_id(...)` must
  handle the null case for bye rows.
- [Affects R10][Technical] Enforcement mechanism for "team rows
  never recycled" — DB trigger, RPC pattern, or operator-trust. If
  the LO can ever undo a drop and want to "restore" the original
  team, the no-recycle rule needs an explicit story (likely:
  Replace creates a new row even if the captain is the same).
- [Affects R1, R1b][Technical] FK swap on a populated `matches`
  table needs the `NOT VALID` + `VALIDATE CONSTRAINT` two-step to
  avoid a long lock. Planning to confirm migration shape against
  production volume.
- [Affects R6.2][Technical] Pending invites
  (`invite_tokens`/`pending_invites` tables) referencing a team that
  is being dropped — should they be revoked automatically, or left
  for the LO to clean up? Low-likelihood but real race scenario.

## Next Steps

`-> /ce:plan` once the resolve-before-planning question above is
answered. Plan should produce **three** ordered PRs:

1. **`fix-team-cascade-deletion`** — PR 0: minimal cascade safety
   net, ships immediately and decouples the urgent fix from the
   larger refactor.
   - R1: flip `matches.home_team_id`, `matches.away_team_id`, AND
     `match_lineups.team_id` from `CASCADE` → `RESTRICT`
   - R1a: UI guard in `handleDeleteTeam` refusing deletion when
     matches exist (any status), with a clear message
   - R1b: Update `DeleteLeagueModal` so league teardown deletes
     child matches/lineups before teams (no cascade reliance)
   - Closes `LIST_FOR_ED.md` item #1.
2. **`bye-as-real-team`** — Piece 1: status enum (`'bye'`),
   `captain_id` nullable (R3a), schedule generator inserts real bye
   rows, NULL-bye backfill migration, `Score Match` button bug fix,
   display filters and the filter-audit work, standings helper /
   eager-forfeit-write per R15 decision.
3. **`team-drop-replace-workflow`** — Piece 2: drop operation as RPC
   (R6, R6a), replace operation, branched delete UI (R19), Replace
   UI surface (R20), `withdrawn_at` column (R22), bye name
   convention (R3b), match_lineups reassignment, cross-cutting
   communication touches (R23).

PR 0 is independently shippable today — neither PR 1 nor PR 2
depend on PR 0's safety net beyond it being in place. PR 1 and PR 2
must ship in order.
