---
summary: Drop a team from a league that already has a BYE (re-pairs the remaining weeks)
kind: task
added: 2026-11-21
checked: 2026-11-21
---

Two rules from Ed (2026-11-21), shipped together behind one gate:

- **Before any game is played**, adding or removing a team throws the schedule
  away (BYE included) and sends the operator to build a fresh one, so every
  season starts with a "perfect" schedule.
- **Once games are played**, dropping a team from a league that has a BYE
  re-pairs the remaining weeks: the dropped team's opponent and the bye-week
  team play each other (Ed's hybrid pulls in one more match when that would
  pile up repeats). The team is withdrawn, never deleted. An even league keeps
  `drop_team_mid_season`.

Not gated (a plain fix): clearing a schedule now also removes its BYE.

## Gate

`isProduction` in `src/operator/team-management/useTeamDrop.ts` (`dropLegacy`
in production, `dropGated` elsewhere) and `!isProduction` on the rebuild after
an add in `handleTeamCreateSuccess` (`useTeamActions.ts`). Production keeps
the old behavior: pre-season the team becomes the BYE, mid-season
`drop_team_mid_season` (which refuses an odd league), and adding a team keeps
the schedule. On un-gate, delete `dropLegacy` (and `convertTeamToBye` if nothing
else uses it).

## Entry points

- the trash can on a team card on Manage Teams, via `handleDeleteTeam` in `src/operator/team-management/useTeamDrop.ts`
- the Add Team save on Manage Teams, via `handleTeamCreateSuccess` in `src/operator/team-management/useTeamActions.ts`

## Verify on staging

Use the 7-team dev league (`database/dev_seed_odd_league.sql`) or any odd league.
Before any week is played: remove a team → you land on schedule setup; the new
schedule has no BYE at 6 teams. Add a team → schedule cleared, rebuild → exactly
one BYE at 7. Then play a few weeks and drop a team: played weeks unchanged;
each remaining week every team plays once and nobody gets a bye from the drop;
venues and tables follow the new home team; the dropped team is gone from
standings with its old results kept.
