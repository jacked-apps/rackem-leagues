---
title: "fix: team handicap bonus — off in playoffs, one formula everywhere"
type: fix
status: built 2026-11-01 on fix/team-bonus-playoffs — awaiting PR + merge. Must ship before next season.
date: 2026-11-01
branch: fix/team-bonus-playoffs
---

# fix: team handicap bonus — off in playoffs, one formula everywhere

## The problem

The **team handicap bonus** is the extra handicap the HOME team gets (or
loses) in points-system leagues (3-man, −2/+2), based on the gap in match
wins this season.

1. **It's applied in playoff matches. It must not be.** (Ed, 2026-11-01.)
   None of the bonus code checks what kind of week a match is in. A playoff
   week is marked on its schedule row (`season_weeks.week_type = 'playoffs'`),
   but the bonus math never looks at it. So in a points-system league, a
   playoff match gets the bonus just like a regular-season one. Too late to
   change for tonight's play; it **must be fixed before next season**.

2. **Two copies of the bonus math disagree.** Found while checking (1).
   - The **lineup screen** (what players see) uses `calculateTeamHandicap` in
     `src/utils/handicapCalculations.ts`. It respects the league's
     `team_handicap_variant`: `standard` = win gap ÷ 2, `reduced` = ÷ 3,
     `none` = 0.
   - **Match setup** (what sets the games each team needs) uses
     `getTeamHandicapBonus` in `src/utils/getTeamHandicapBonus.ts`, called
     from `calculateHandicapThresholds` (used by `computeMatchPrepPayload`,
     `composeMatchThresholds` and `useMatchPreparation`). It ALWAYS divides
     by 2 and ignores the variant.
   - With the default (`standard`) they agree, so most leagues won't notice.
     A league on `reduced` or `none` sees one bonus on the lineup screen and
     plays a different one.

3. **A "turn team bonus off" switch nobody reads.** `leagues.system_overrides`
   documents `team_bonus_enabled: false` ("BCA league disables team bonus"),
   and the type exists in `src/types/systemOverrides.ts`, but no runtime code
   reads it. Decide: wire it in, or remove it.

## What "done" looks like

- A playoff match gets **no** team bonus, on the lineup screen AND in match
  setup, every time.
- The lineup screen and match setup get the bonus from **one** place, so they
  can't disagree again, and that place respects the league's setting.
- Tests prove both, including a playoff match and a `reduced` / `none` league.

## Before starting — check

- **Does production have any `reduced` / `none` leagues, or playoff matches
  already played with a bonus?** Write a read-only query (one file) for Ed to
  run; it changes nothing. That tells us whether any past result was affected.
- **Where does the new scoring engine stand?** The north star is moving every
  scoring system into saved DB modules with byte-identical results
  (see memory: scoring systems → DB modules; and
  `docs/league-system/modules/*/README.md` — read before deciding where the
  "is this a playoff?" check lives). The fix must go through the same path
  the runtime uses, not a side check bolted onto one screen.
- Frozen data: once a match's lineups lock, its bonus is stored with them.
  Fixing the formula must not rewrite already-locked matches.

## What was built (2026-11-01)

Ed chose: no setting for now (a big settings project is coming), just take
the bonus out of playoffs.

- `src/utils/getTeamHandicapBonus.ts` is the ONLY bonus helper:
  `getTeamHandicapBonus(matchId, handicapType)`. Points system only; 0 when
  the match's week is `playoffs`; divisor from
  `resolved_league_preferences.team_handicap_variant` (the value the
  operator's Preferences card writes; the lineup screen used to read
  `leagues.team_handicap_variant`, a third disagreement). Pure rule exported
  as `computeTeamBonus`.
- Callers: lineup screen (`MatchLineup.tsx`), match setup
  (`calculateHandicapThresholds` → `useMatchPreparation`,
  `computeMatchPrepPayload` / LO manual setup, `composeMatchThresholds` /
  lineup swap). They pass the match id instead of team + season ids.
- `calculateTeamHandicap` (the second copy) is deleted. The scoring page now
  shows the bonus FROZEN on the home lineup instead of recomputing it.
- Already-locked matches are not touched: their bonus stays frozen.
- `team_bonus_enabled` left as-is (unread) for the settings project.
- Read-only check for production:
  `database/maintenance/diagnose_playoff_team_bonus.sql`.
- Tests: `getTeamHandicapBonus.characterization.test.ts` (rule + mocked
  lookup) and `src/__tests__/database/teamHandicapBonus.db.test.ts` (real
  queries: regular +2, playoff 0, reduced +1).
