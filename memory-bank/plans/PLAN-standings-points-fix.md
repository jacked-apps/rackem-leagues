# PLAN — Standings points fix + tiebreaker separation

Started 2026-10-27. Branch for Phases 1–2: `claude/reckem-standings-issue-wgeffe`.

## Why

Every team on the real league's standings went negative. Two causes:

1. **Wrong rule (a miscommunication).** Points 3-Man measured a winner in a
   tie-possible match from the WIN target. Ed's real rule (his league
   scoresheet, `TABLE n!O19/P19`) measures BOTH teams from **par** — the tie
   target when a tie is possible, else the win target:
   `points = games_won − par`. Tie target 9 / win 10: 10–8 → +1 / −1,
   12–6 → +3 / −3, 9–9 → 0 / 0. The wrong rule leaked −1 into the league
   total on every decided tie-possible match.
2. **Tiebreaker re-lock rewrote the lineup** (fresh handicaps / team bonus),
   and the engine re-derived targets from it. Fixed in commits `559959d` +
   `2534033` (engine scores against SAVED targets; tiebreaker lock/unlock only
   flips `locked`).

Rules confirmed by Ed:
- Targets are fixed at match start. **Swap player** is the ONLY legitimate
  mid-match recalculation (it rewrites the saved targets atomically).
- A tiebreaker is a separate best-of-3 mini-match. It may only set the winner
  (and mark the match as tied). It never changes lineups, handicaps, games
  won (team or player), targets, or points.

## Phases

- [x] **Phase 1 — Fix the points formula in the app.** Engine composition +
  legacy calculator switched to the par rule; tests use real matches from
  Ed's sheets; locked points docs updated (Ed: "unlock and make the changes").
- [ ] **Phase 2 — Re-score this season.** Update
  `database/maintenance/recalculate_points_3man_1_preview.sql`,
  `_2_apply.sql` and `diagnose_standings_points.sql` to the par rule. Ed runs
  preview → spot-checks → apply. Conservation check: league total ≈ −1 per
  decided NO-tie match. Then PR. (Matches scored before the deploy still use
  the old rule — re-run the scripts after it ships.)
- [ ] **Phase 3 — Tiebreaker audit (read-only, new branch).** List everything
  the tiebreaker reads/writes vs the rule above. Explain Ben vs Duff
  (`92b799f2…`): lineup handicaps changed in a match with NO tiebreaker. Find
  past matches whose lineup rows were rewritten (affects player stats).
- [ ] **Phase 4 — Rebuild the tiebreaker as its own piece.** Leaning: its own
  table for order / ready-lock / verification so it can never touch the
  regular lineup. Whether tiebreaker games also leave `match_games` is decided
  after the Phase 3 audit (many stats queries filter `is_tiebreaker`). Ships
  gated for staging review.
- [ ] **Phase 5 — Clear the repo's lint errors.** `pnpm run lint` fails on
  pre-existing errors (e.g. `no-regex-spaces` in `scripts/`,
  `no-explicit-any` in `src/__tests__/database/`, an unknown
  `vitest/valid-title` rule referenced by disable comments).
- [ ] **Phase 6 — Duplicate week names (own branch).** The real season has
  TWO `season_weeks` rows named "Week 14" (2026-10-04 and 2026-10-11; the
  weeks after it are then labeled 15, 16). Ed believed this class of bug was
  already fixed. Find which writer produced it (schedule generation, week
  editor, holiday / makeup insert — check what changed with
  `feat/schedule-matchup-decoupling`, PR #244), fix the root cause, repair
  this season's labels, and add a guard so a season can never hold two
  regular weeks with the same name (e.g. a DB unique constraint or
  renumber-on-write, plus a regression test).
