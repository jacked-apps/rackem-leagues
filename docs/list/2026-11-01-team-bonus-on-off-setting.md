---
summary: Let an operator switch the team bonus on or off for league and playoffs
kind: task
added: 2026-11-01
checked: 2026-11-05
---

Playoff weeks now get no team bonus automatically, and the lineup screen and match setup share one helper (`getTeamHandicapBonus`) that reads the league's real team-bonus setting (standard ÷2, reduced ÷3, or none). See `docs/plans/2026-11-01-003-fix-team-bonus-playoffs-plan.md`.

Left for the big settings project: an operator on/off switch for the bonus, in league play and in playoffs. `system_overrides.team_bonus_enabled` exists as a type, but nothing reads it.
