---
summary: Only the two teams in a match should see a working Verify Scores button
kind: task
added: 2026-06-14
checked: 2026-11-04
---

At match end, `MatchEndVerification.tsx` shows a "Verify Scores" button. It is
disabled only by `userTeamVerified || isVerifying`. It never checks that the
viewer is on one of the two teams. So a spectator, a guest, or a player from
another match can verify scores they have no standing to verify. The
component's own docstring says the button is "enabled only for user's team".

Entering scores stays open to anyone on the scoring page. Verifying is the
narrower act that belongs to the two teams.

Fix: gate the button in the UI on "is the current user in this match".
No server-side identity guard (see `feedback_gate_ui_relax_rls`).

Files: `src/components/scoring/MatchEndVerification.tsx`, mounted from
`src/player/ScoreMatch.tsx`.

Status: open PR #314 fixes this. Delete this item when it merges.
