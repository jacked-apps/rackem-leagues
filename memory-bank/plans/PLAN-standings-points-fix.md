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
- [x] **Phase 2 — Re-score this season.** Update
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
- [x] **Phase 5 — Clear the repo's lint errors.** DONE 2026-10-28: 348 → 0
  errors (PRs #292–#304; 22 warnings remain, see handoff). `pnpm run lint` fails on
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

## Where we are (handoff, 2026-10-28 — Ed switching to the PC)

### Open PRs — Jack merges (don't push Ed to)
- **#291** (this branch): points par rule + sort fix + this plan. Separate
  from the stack below; squash is fine. Shares `MatchEndVerification.tsx`
  and `TABLE_OF_CONTENTS.md` with #293/#303, so whichever lands second hits
  a small conflict — resolve it then.
- **Stack #292 → #304**, every PR based on `main`, each branch built on the
  one before. **Merge in order with "Create a merge commit", NOT squash.** A
  local test proved squash makes every later PR conflict; merge commits are
  clean. Each PR body carries that warning. Review = top commit only.
  - #292 lint quick fixes + hooks-order bugs · #293 typed Supabase client
    (`createClient<Database>`, regenerated types) · #294 block user ·
    #295 claim invite status · #296 profanity view (migration
    `20261028043311`) · #297 league night write · #298 profanity filter
    optional for everyone (under-18 lock PAUSED, Ed's call; search
    `TODO(under-18-filter)`) · #299 `any` out of src/api · #300 operator
    picker ambiguous embed · #301 player details night · #302 `any` out of
    lineup+scoring (compiled JS proven byte-identical) · #303 last lint
    errors + fast-refresh splits + `@types/pg` · #304 New Message render
    loop (3,922 fetches/sec) + blocked filter.
- After #291 deploys: Ed re-runs `_1_preview.sql`; apply only if rows show.

### Next, in Ed's order
1. **Phase 6 — investigate the duplicate "Week 14" ONLY. No fix** until Ed
   has the findings. (Details in the Phase 6 bullet above.)
2. **Phase 3 — tiebreaker audit, read-only.** Includes Ben vs Duff
   `92b799f2…`.
3. Then decide fixes for both.

### Parked (ask Ed before doing)
- 22 lint warnings (mostly `exhaustive-deps`) — case by case, some are
  deliberate; #304 shows how they bite.
- Dead code found while typing: `ContentModerationCard`,
  `utils/venueDuplicates.ts`, the unreachable insert in
  `useMatchScoringMutations.ts`, unreachable `expired`/`already_claimed`
  claim screens, `mutations/reports.updateReportStatus` (writes missing
  columns), unused `useFilteredMembers`, unused `isEighteenOrOlder`.
- `MatchWithDetails` (`src/types/schedule.ts`) lacks the verification
  columns + `season` embed queries return; two local types patch it.
- ~118 type errors hide in test files: `tsc -b` excludes tests, so CI never
  sees them.

### Things only the Mac knew (Claude's memory there doesn't travel)
- Every PR needs a `releases.ts` What's New entry OR `[no-changelog]` in
  the body (CI-enforced). Player-facing copy, no jargon.
- New migrations: `supabase migration new` (real UTC timestamp, never
  zeros); check `ls supabase/migrations | sed 's/_.*//' | sort | uniq -d`.
- Never `supabase db reset` — it wipes Ed's local test data.
- The Mac's local DB has two unmerged race-branch migrations applied, so
  `pnpm db:types` there emits `races`/`race_*` objects that must be stripped
  before committing. The PC's local DB may differ — check before regenerating.
- Unit tests need `VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x`.
  The `db` vitest project writes to the local DB — ask before running it.
- Ed is colour blind: never signal by hue alone.
- Ed is a junior dev: plain words, define jargon once, one or two things
  at a time, no code in chat.
