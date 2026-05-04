---
date: 2026-05-03
topic: unified-scoreboard
depends-on: PR #98 (modular-league-system-v2) — assumed merged as-is
related: docs/brainstorms/modular-league-system-requirements.md
---

# Unified Scoreboard — One Component for All Configs

## Problem Frame

`src/player/ScoreMatch.tsx` routes between four scoreboard components — `ThreeVThreeScoreboard`, `FiveVFiveScoreboard`, `TenSevenScoreboard`, `TiebreakerScoreboard` — based on `(handicap_type, lineup_size, isTiebreakerMode)`. Every new combo (e.g. Fargo + games-won, surfaced 2026-05-03 during the modular-league-system test pass) potentially needs either a new scoreboard variant or a router exception. This is the n×m matrix problem the modular system was supposed to kill. PR #98 made the data layer mode-neutral (threshold trio per side, both axes always tracked, calculator registry); the display layer is the last place where "BCA vs Fargo vs 10-7" is hardcoded as separate components. Three instances of the same `handicap_type === 'fargo'` conflation surfaced in one testing session — tactical guards landed in PR #98, structural fix queued here.

A second concern surfaced during the same testing pass: the live scoreboard's mobile vertical footprint is too tall, pushing game rows below the fold during active matches. This brainstorm folds the layout redesign into the architectural rebuild — both touch the same component, splitting them creates rework.

## Requirements

### Component consolidation

- **R1.** ONE `UnifiedScoreboard.tsx` replaces `ThreeVThreeScoreboard`, `FiveVFiveScoreboard`, `TenSevenScoreboard`. The three legacy components are deleted.
- **R2.** `TiebreakerScoreboard.tsx` stays as a separate component but is updated in the same branch. Routing in `ScoreMatch.tsx` collapses to `isTiebreakerMode ? TiebreakerScoreboard : UnifiedScoreboard`.
- **R3.** The unified scoreboard reads ALL its data from the match row's calculator-correct fields (`home_games_won`, `home_points_earned`, `home_to_win`, `home_to_tie`, `home_to_lose`, and matching `away_*` set) plus `system_snapshot.points_calculator` + `system_snapshot.points_calculator_params`. No re-computation.
- **R4.** The unified scoreboard never reads from the legacy parallel-compute helpers (`calculateFargoMatchTotals`, `calculateBCAPoints`, `calculatePoints`). Display reads only from the match row. The helpers themselves SURVIVE in this branch because (a) the silent post-completion divergence audit (PR #98 Phase 5 Unit 5.6) uses them as its independent reference implementation — keeping two independent paths that audit each other is the design intent, and (b) seven characterization tests use them to prove the new calculators are equivalent to the legacy behavior. The bug from 2026-05-03 testing wasn't "two systems disagreed" — it was "the scoreboard read from the wrong source." This branch fixes the source, not the audit.
- **R4a.** Prerequisite — 3v3 BCA's `home_points_earned` / `away_points_earned` must be calculator-correct (i.e. populated by the new running-totals pipeline) before this branch can ship. A code comment in `src/player/ScoreMatch.tsx` flags that 3v3 BCA still uses the legacy compute path for the displayed points; verify during planning whether this is wired up post-PR #98 or whether it needs a small prerequisite fix in this branch (or a separate prep branch).

### Dispatch model

- **R5.** The unified scoreboard never branches on `handicap_type` or `lineup_size`. Display behavior is driven by `win_condition` (which axis is primary), `points_calculator` + `points_calculator_params` (calculator-specific cues), and `lineup_size` only as a count for player-row rendering.
- **R6.** Display cues are auto-derived from each calculator's existing `paramSchema` (the schema field already declared on every calculator). Each param can optionally declare a `display_role` (e.g. `milestone`, `bonus_marker`, `progress_target`); the scoreboard recognizes known roles and renders them appropriately. Unknown or missing roles fall back to a generic "label + value" rendering — never crashes. Adding a new param to a calculator's schema with a `display_role` → display picks it up automatically. Honors PR #98's runtime/display separation: calculator file stays pure math; display logic lives in the scoreboard layer reading the schema.
- **R7.** When `points_calculator === 'none'`, the points axis is hidden entirely. Combo coherence already forbids `none + win_condition='points'`, so this combo always means "games is the only metric." For this branch, treat both `points_calculator === null` (legacy snapshots) and `points_calculator === 'none'` as the no-points-axis case; tightening the type to non-null is out of scope.

### Compact-mode layout (mobile-first)

- **R8.** Inline team identity: `{TeamName} · Home` / `{TeamName} · Away` replaces today's stacked HOME/AWAY label row + team name. Saves one row.
- **R9.** Games and points appear on the same line per team. The secondary axis is visually subordinate (smaller text) per the active `win_condition` — primary axis stays visually dominant for legibility from across the table.
- **R10.** Threshold trio (`to_win` / `to_tie` / `to_lose`) is collapsible. Default-collapsed view surfaces the most actionable threshold inline (typically `to_win`) on the primary-axis line. Trio expands when the user taps to expand, OR auto-surfaces relevant markers when the live score crosses tie/loss territory.
- **R11.** ~~Sticky-thin-bar on scroll~~ — *removed 2026-05-03 review pass.* Ed's framing: "the scoreboard needs to be the main focus of the page, like a stadium scoreboard, not a sportsbook ticker." Compact-mode (R8 + R9 + R10 + R13) already meets the mobile-footprint goal. Sticky-thin behavior is out of scope; deferred to a possible future branch only if the new compact scoreboard still feels too tall in practice.
- **R12.** Drop the "VS" / center info-button column. Two team cards sit side-by-side; info button moves to a corner icon.
- **R13.** Mobile-first padding: tighter inner spacing and gap between team cards than today's layout.
- **R14.** Player-row layout auto-flexes based on `lineup_size` (3 rows for 3v3, 5 rows for 5v5, etc.) — no per-size variants.

### Mid-match clinch detection

- **R15 + R16.** ~~Mid-match clinch detection~~ — *removed 2026-05-03 review pass.* Reviewers surfaced compounding problems (computability for non-monotonic calculators, alert team-targeting, accidental-dismiss recovery, scope outside the stated goals). Ed's framing: "it's a quality-of-life thing, not important; if it's too tough to tackle then drop it." Deferred to its own future brainstorm where the per-calculator predicate, team-targeting, dismiss recovery, and toast-vs-modal can get proper attention.

### Calculator cues + future-flex

- **R17.** Calculators MAY override the auto-derived rendering for genuinely-unique cases via an optional `getDisplayHints(params)` escape hatch. Default behavior is schema-driven (R6); the override exists for the rare case where a calculator's display needs don't fit any standard `display_role`. Future calculator-feature additions (e.g. the deferred benchmark-game param on `accumulate_with_milestone_jumps`) typically plug in by adding a param with a `display_role` to the schema — no scoreboard edits, no escape-hatch override needed in most cases.

### Tiebreaker scoreboard treatment

- **R18.** Replace `HOME` / `AWAY` labels with actual team names from the match row.
- **R19.** Tiebreaker stays minimal otherwise — no lineup drawer, no full feature parity with the unified scoreboard. Today's "First to 2 wins" + score display is the right shape; only the labels change in this branch.
- **R20.** "Don't lock things down" — the tiebreaker scoreboard's structure shouldn't actively prevent a future `tiebreaker_format` axis (e.g. race-to-N, sudden-death) from being added later. NO new abstraction is built in this branch; this is restraint, not design-for-modularity. Today only one method exists (best-of-3 single rack); the team-name fix in R18 just shouldn't paint the component into a corner that makes a later refactor harder than necessary.

### Item 10 + item 11 fold-ins

- **R21.** Resolve LIST_FOR_ED.md item #10: scoreboard number layout (duplicated thresholds, ambiguous slash format). Specifics fold into the new compact-mode layout — exact treatment defers to plan wireframes.
- **R22.** Fargo points-mode start-points display: surface each team's starting point delta as part of the unified scoreboard's points line (small adjacent text), not as its own component or row. Data path: under `win_condition='points'`, the starting credit is read directly off `match.home_to_tie` / `match.away_to_tie` (post Phase 2 Unit 2.1 column rename — whichever side is positive identifies the weaker team). No recomputation, no extra fetch. Note: a stale comment in `src/utils/fargoMatchTotals.ts` still references the pre-rename `home_to_win` semantics — fold the cleanup into this branch since the file is already touched.

## Success Criteria

- Every league configuration that previously routed to 3v3, 5v5, or 10-7 scoreboards renders correctly in the unified scoreboard with no per-config exceptions in `ScoreMatch.tsx`.
- A new calculator (off-preset combo or future addition) can be added without editing `UnifiedScoreboard.tsx` — its display cues come from the schema's `display_role` declarations (or the optional escape-hatch override).
- Mobile vertical footprint of the scoreboard is materially smaller than today's, allowing more game rows to be visible during a match — without compromising the scoreboard's role as the page's main visual focus ("stadium scoreboard, not sportsbook ticker"). Quantitative target: reviewer confirms more game rows visible on a representative phone screen during an active 5v5 match than the equivalent today.
- BCA-pitch demo: pick any combination of axes and the live scoreboard reads naturally, with the right primary metric emphasized and the right calculator cues showing.
- The unified scoreboard contains no calls to the legacy parallel-compute helpers (`calculateFargoMatchTotals`, `calculateBCAPoints`, `calculatePoints`). The helpers themselves remain, used only by the divergence audit and characterization tests.

## Scope Boundaries

### In scope
- Unified scoreboard component replacing 3 of the 4 today
- Tiebreaker team-name fix (R18) + "don't lock things down" restraint (R20)
- Item #10 (number layout) fix folded into new compact mode
- Compact-mode layout (R8 + R9 + R10 + R12 + R13 + R14)
- Schema-derived display hints with optional escape-hatch override
- Stale comment cleanup in `src/utils/fargoMatchTotals.ts` (touched by R22 work anyway)
- Prerequisite confirmation that 3v3 BCA's match-row points are calculator-correct (R4a)

### Out of scope (deferred)
- Mid-match clinch detection — *removed during 2026-05-03 review pass.* Compounding problems (computability for non-monotonic calculators, alert team-targeting, accidental-dismiss recovery) on top of being orthogonal to the stated goals. Becomes its own brainstorm later.
- Sticky-thin-bar on scroll — *removed during 2026-05-03 review pass.* "Stadium scoreboard, not sportsbook ticker" — compact-mode alone meets the footprint goal. Can revisit if the new compact scoreboard still feels too tall in practice.
- Scoring modal (`ScoringDialog`) generalization — separate brainstorm + branch. Architecturally independent from the scoreboard (modal writes; scoreboard reads; sync via DB). The tactical `pointsCalculator` guard from 2026-05-03 stays in place until that branch.
- "Richer modal vision" (per-side configurable point ranges, two independent point-award systems, per-flag league-level toggles for tracked fields) — its own brainstorm; potentially involves schema and league-prefs changes.
- Adjacent calculator-feature: benchmark-game param on `accumulate_with_milestone_jumps` — defer the feature itself; only the scoreboard's schema-driven display flex is in scope, so the cue auto-appears once the param + `display_role` land.
- Tiebreaker drawer with lineup + game totals — explicitly excluded ("not really needed" per Ed 2026-05-03).
- Full `tiebreaker_format` axis system + additional tiebreaker methods — only "don't lock things down" restraint is in scope (R20).
- Legacy parallel-compute helper deletion — helpers SURVIVE in this branch as the divergence audit's reference implementation. Their eventual deletion is its own future cleanup, gated on rewriting the characterization tests to use the new calculators directly.
- Triple-tie fallback for even-game Fargo formats (project memory gap; distinct concern, not a scoreboard fix).
- Item #13 (tied-match scoreboard shows more info) as an explicit fold-in — tie-territory surfacing in R10 covers the spirit; item #13 stays open if more is wanted later.

## Key Decisions

- **Modal generalization deferred to its own branch.** Modal writes; scoreboard reads. They're decoupled by the database, not by shared state. Combining them risks scope expansion into the richer modal vision.
- **Tiebreaker stays a separate component but in same branch.** Both scoreboards touch the same routing decision in `ScoreMatch.tsx`; separate branches would create merge conflict risk. Tiebreaker semantics (no threshold trio, different game-set) don't cleanly fit one unified contract.
- **Schema-derived display hints with escape-hatch override.** Hints auto-derive from each calculator's existing `paramSchema` via optional `display_role` declarations on params; calculators can override for genuinely-unique cases. Honors PR #98's runtime/display separation (calculator file stays pure math; display logic reads the schema). Most scalable + dummy-proof: unknown roles fall back to a generic "label + value" rendering — never crashes.
- **Two independent paths that audit each other (Ed's framing 2026-05-03).** The match row is the source of truth for display. The legacy parallel-compute helpers SURVIVE as the divergence audit's independent reference implementation. Keeping two paths that check each other at end-of-match is the design intent — it catches discrepancies neither path would catch alone. The bug from 2026-05-03 wasn't "two paths disagreed"; it was "the scoreboard read from the wrong path." This branch fixes which path the scoreboard reads.
- **Compact-mode is the default — within the "scoreboard as page focus" constraint.** Today's layout becomes "expanded"; the new compact mode trims height (inline team identity, games+points one line, collapsible threshold trio, tighter padding) but the scoreboard remains visually dominant. "Stadium scoreboard, not sportsbook ticker."
- **`handicap_type === 'fargo'` is not a proxy for scoring system.** It means "this league applies handicap via Fargo ratings" — orthogonal to which calculator runs, which win condition decides, and which threshold mechanism applies. Any code that conflates them is wrong; this branch finishes killing the conflation.

## Dependencies / Assumptions

- PR #98 (modular league system v2) merges as-is. All schema fields referenced (`home_to_win` trio, `home_games_won` / `home_points_earned`, `system_snapshot.points_calculator` + `points_calculator_params`) exist post-merge.
- Each calculator's existing `paramSchema` will be extended with optional `display_role` declarations on params (e.g. `display_role: 'milestone'` on `accumulate_with_milestone_jumps`'s `multiplier_at_tie` param). The scoreboard reads the schema and renders accordingly; an optional `getDisplayHints(params)` escape hatch on the calculator module covers genuinely-unique cases. Today's three registered calculators (`linear_above_threshold`, `accumulate_with_milestone_jumps`, `accumulated_per_game`) plus the `'none'` sentinel are in scope; the exact `display_role` taxonomy is a planning decision.
- **PR #98 fragility note:** PR #98 is OPEN at brainstorm time. Schema fields referenced (snapshot keys, threshold-trio columns, calculator registry method signatures) are assumed to merge as-is. If review feedback materially reshapes any of these, this brainstorm needs revision before planning starts. Re-read PR #98 immediately before invoking `/ce:plan` and flag any drift.
- **Legacy snapshot fallback policy:** Existing in-flight matches may have legacy snapshots without `points_calculator_params`. `src/api/queries/matches.ts:856` already has a defensive live-prefs fallback. The unified scoreboard inherits that fallback — meaning R3's "no re-computation" is true for fresh matches, but legacy matches still fall through the live-prefs path. Acceptable for this branch since all dev data is disposable per project convention; production deployment would gate on either a snapshot backfill or `supabase db reset`.
- `src/types/match.ts` already carries the threshold-trio columns (per PR #98 Phase 2); `src/types/database.types.ts` already has the regenerated types.
- `useResolvedLeaguePrefs` already exposes `win_condition` and `lineup_size` — no schema work needed for this branch.
- Tested-preset coverage: BCA 3v3, BCA 5v5, Fargo 5v5 points-mode (legacy — current Fargo league before format change), Fargo 5v5 games-mode (next-season target — same league post-format-change), and "None — don't track points" all need to render correctly through the unified scoreboard with no per-preset code paths. Both Fargo modes must work during the transition season.

## Outstanding Questions

### Resolve Before Planning

- [Affects R4a][Technical] Confirm: is 3v3 BCA's `home_points_earned` / `away_points_earned` already calculator-correct (populated by the new running-totals pipeline post-PR #98), or does it still flow through the legacy `calculatePoints` helper as the comment in `ScoreMatch.tsx:676-678` suggests? If still legacy, the unified scoreboard cannot read calculator-correct points for 3v3 until that's fixed — decide whether the fix lands in this branch or a small prerequisite branch first.

### Deferred to Planning

- [Affects R6, R17][Technical] Exact `display_role` taxonomy — what role names exist (`milestone`, `bonus_marker`, `progress_target`, others?), what data each role's renderer expects, what the generic fallback shape looks like. Also: does the scoreboard get the schema directly from the calculator module's exported `paramSchema`, or via a registry lookup?
- [Affects R10, R13][Design] Pixel-level visuals for compact-mode — exact font sizes, breakpoints, threshold-trio expand/collapse interaction, info-button corner placement. Wireframe in plan. Constraint: scoreboard must remain the page's main visual focus (stadium feel, not ticker feel).
- [Affects R10][Design] Threshold trio interaction state machine: when score crosses tie/loss territory, does it auto-expand? If user manually collapsed, does an auto-trigger override that? Priority rule for which threshold surfaces inline when collapsed (today's "typically `to_win`" needs a deterministic rule).
- [Affects R10, R14][Design] How does compact mode integrate with the existing `MatchEndVerification` component when all games complete? Today's scoreboards render `MatchEndVerification` in place of (or above) the score display; the unified scoreboard's match-complete state needs an explicit treatment.
- [Affects R10, R12, R13][Design] Legibility minimums + WCAG touch targets — primary score number font size minimum (legibility from across the table), threshold-trio expand/collapse tap-target size (44×44px WCAG floor for chalk-handed players).
- [Affects R20][Technical] Validate that the team-name fix (R18) doesn't introduce coupling that would prevent a future `tiebreaker_format` axis from being added. Shape check only — no new abstraction.
- [Affects R21][Needs research] Re-read item #10 in `LIST_FOR_ED.md` and confirm the exact "duplicated threshold" + "ambiguous slash format" pattern to fix. Wireframe the corrected layout in plan.
- [Affects R22][Design] Label format for start-points delta: positive-only (`+3`), signed (`+3` / `−3`), or asymmetric per side (advantaged team shows `+0` or hides; weaker team shows `+N`). Existing Fargo logic stores the credit on the weaker side's `*_to_tie`; the design choice for how to render this in the compact-mode points line is unresolved.

## Visual Aid — Compact Mode (rough)

Today (5v5 example, two cards side-by-side, ~7 vertical rows including labels and verify region):

```
┌─────────────────────────────────────┐
│           HOME    [i]    AWAY       │  <- label row
│ ┌──────────┐         ┌──────────┐  │
│ │ Team A   │         │ Team B   │  │
│ │ W: 8 L:4 │         │ W: 5 L:7 │  │
│ │ Pts: 9   │         │ Pts: 5.5 │  │
│ │ For Win  │         │ For Win  │  │
│ │   11     │         │   14     │  │
│ │ For 1.5  │         │ For 1.5  │  │
│ │   8      │         │   11     │  │
│ └──────────┘         └──────────┘  │
└─────────────────────────────────────┘
```

Compact-mode default (top of viewport):

```
┌─────────────────────────────────────┐
│ Team A · Home    [i]   Team B · Away│  <- inline identity
│  8 → 11   9 pts │  5 → 14   5.5 pts │  <- games + points one line
│  ▼ thresholds   │  ▼ thresholds     │  <- trio collapsed
│  [player rows auto-flex by size]    │
└─────────────────────────────────────┘
```

No "no-points-axis" example yet — when `points_calculator === 'none'`, the points slot disappears entirely:

```
┌─────────────────────────────────────┐
│ Team A · Home    [i]   Team B · Away│
│  8 → 11         │  5 → 14           │  <- games only, no points column
│  ▼ thresholds   │  ▼ thresholds     │
│  [player rows]                      │
└─────────────────────────────────────┘
```

Pixel-level visuals defer to plan. Constraint: scoreboard remains the page's main visual focus — stadium scoreboard, not sportsbook ticker.

## Next Steps

-> `/ce:plan` for structured implementation planning
