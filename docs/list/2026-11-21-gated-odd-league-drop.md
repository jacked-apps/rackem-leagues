---
summary: Drop a team from a league that already has a BYE (re-pairs the remaining weeks)
kind: task
added: 2026-11-21
checked: 2026-11-21
---

Replaces "remove a bye team": in a 7-team + BYE league, a dropped team's
opponent and the bye-week team play each other each remaining week (Ed's
hybrid pulls in one more match when that would pile up repeats). The team is
withdrawn, never deleted. Works pre-season too (that case used to error).

## Gate

`!isProduction` around the BYE check in `handleDeleteTeam`. In production the
check is skipped, so the drop falls through to the old paths, which refuse a
second BYE (today's behavior).

## Entry points

- the team's delete/drop action on Manage Teams, via `handleDeleteTeam` in `src/operator/team-management/useTeamActions.ts` (the only door)

## Verify on staging

In a league with an odd team count (so it has a BYE) and a few weeks played,
drop one team. Check: played weeks unchanged; each remaining week every team
plays exactly once and nobody gets a bye from the drop; venues and tables
follow the new home team; the dropped team is gone from standings with its old
results kept. Also try it before any week is played.
