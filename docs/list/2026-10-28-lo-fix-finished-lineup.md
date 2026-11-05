---
summary: Let a league operator fix a lineup on a match that has already started
kind: task
added: 2026-10-28
checked: 2026-11-04
---

Low priority. Ed, 2026-10-28: "it's a rare thing, we have only one league, so
I can just do it again if it comes to that for now."

The situation: a player recorded in a substitute slot earns zero games in
their record. Sub placeholder ids are stripped from player stats on purpose
(`src/api/queries/playerStats.ts`, around line 164). Right for a real
anonymous sub, wrong when a named person actually played. Ed has hand-fixed
this in SQL at least once.

What exists: the LO match-correction path (`loReopenMatch`, then
`loVacateGame` / `loCorrectGame` / `loRestoreGame`, then
`loRestoreCompletion`) edits games, not lineups.
`src/operator/ManualScoringPage.tsx` (around line 112) only routes to lineup
Setup while `status = 'scheduled'`, so once a match starts there is no way to
change who was in a slot or their handicap.

Why it's small: the write path exists and is gate-free. `loSaveLineups` in
`src/api/mutations/loManualScoring.ts` (around line 111) upserts both lineup
rows locked. Missing: a UI route into it for a reopened match, and guardrails
(recredit the games to the corrected player, record who changed it).

Related: `docs/audits/2026-10-28-tiebreaker-audit.md` finding F6, and the Ben
vs Duff investigation in the same doc. Hand-edited SQL leaves no trace.
