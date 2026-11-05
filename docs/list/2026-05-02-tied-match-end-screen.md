---
summary: Show the regular match score and the tiebreak result on a tied match
kind: idea
added: 2026-05-02
checked: 2026-11-04
---

When a tiebreak ends, the end screen shows only the tiebreak numbers.
You can't see the regular match score (e.g. 9–9). Nice to show both.
The end screen is `MatchEndVerification`, fed tiebreak wins only from
`TiebreakerScoreboard.tsx`.

During the tiebreak round (games 19/20/21 in 3v3), the scoreboard stays
at 9–9 because tiebreak games are left out of the count by design.

## Ideas

- A clear "TIEBREAKER" badge so users know it's the short-race round.
- Tiebreak progress on its own, e.g. "Tiebreaker: 1-0, best of 3".
- Who's winning the tiebreak.
- Maybe the race-to-N target.

## Where to look

- `src/components/scoring/TiebreakerScoreboard.tsx` (replaced `ThreeVThreeScoreboard` in PR 99)
- `src/components/scoring/MatchEndVerification.tsx` (its TIEBREAKER
  REQUIRED banner could carry into the tiebreak scoring view)
