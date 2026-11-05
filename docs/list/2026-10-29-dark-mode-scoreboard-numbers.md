---
summary: Dark mode turns scoreboard numbers near-white on the light team panels
kind: task
added: 2026-10-29
checked: 2026-11-04
---

Found by Ed while testing the tiebreaker. On the live scoreboard, the points
and other numbers are near-white in dark mode and hard to read.

Open PR #314 fixes this. Delete this item when #314 merges.

Likely cause (checked, not fixed on main): the team panels use fixed light
backgrounds (`bg-blue-100` / `bg-orange-100` from
`src/components/scoring/scoreboardColors.ts`), but the text on them uses
`text-foreground`, which flips to white in dark mode. See
`src/components/scoring/UnifiedScoreboard.tsx` around line 337 (points) and
the player table around lines 462 to 515.

Fix: fixed-colour text on fixed-colour backgrounds (the panel's own
`headerText` colour, or a dark-mode panel colour). Check
`src/components/scoring/TiebreakerScoreboard.tsx` too. Its score uses the
same pattern.
