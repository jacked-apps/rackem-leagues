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
- [x] **Standings tie order restored to wins → points → games** (the
  scoresheet's order; PR #98 had swapped points and games in the app
  default). Not done yet, for when the LO sort-order option is built: the
  wizard's `wins_first` preset (`presetMappings.ts`) and the
  `preferences.standings_sort` DB default still store the swapped order —
  the app doesn't read that setting today, so it's harmless until it does.
- [ ] **Phase 6 — Duplicate week names (own branch).** The real season has
  TWO `season_weeks` rows named "Week 14" (2026-10-04 and 2026-10-11; the
  weeks after it are then labeled 15, 16). Ed believed this class of bug was
  already fixed. Find which writer produced it (schedule generation, week
  editor, holiday / makeup insert — check what changed with
  `feat/schedule-matchup-decoupling`, PR #244), fix the root cause, repair
  this season's labels, and add a guard so a season can never hold two
  regular weeks with the same name (e.g. a DB unique constraint or
  renumber-on-write, plus a regression test).

## Where we are (handoff, 2026-10-27)

- **Phases 1 + 2 done**, plus the sort fix. All in PR #291 (this branch).
  Production rescored twice (5 matches, then 27). After #291 deploys, Ed
  re-runs `_1_preview.sql`; apply only if rows show up.
- **Ed's chosen order for what's next:** Phase 5 → Phase 6 (investigation
  ONLY, no fix) → Phase 3 (audit). Fixes for the duplicate week and the
  tiebreaker wait until both investigations are in.
- **Phase 5 is bigger than expected:** 348 errors + 22 warnings in 130
  files. By rule: `no-explicit-any` 289, `no-unused-vars` 27,
  `react-refresh/only-export-components` 17, `vitest/valid-title` 4,
  `no-regex-spaces` 3, `no-empty-object-type` 3, `rules-of-hooks` 3,
  `no-constant-binary-expression` 1, `prefer-as-const` 1. Warnings:
  `exhaustive-deps` 18. Area: app 286, tests 59, scripts 3.
- **Recommended Phase 5 approach (awaiting Ed's yes):** PR 1 = the 4
  possible real bugs (`rules-of-hooks` ×3, `no-constant-binary-expression`)
  plus the ~55 quick mechanical fixes. Then the 289 `any`s in several PRs,
  one app area at a time. Do NOT downgrade `any` to a warning.
- Branch `chore/lint-cleanup` exists (off main), nothing on it yet.
