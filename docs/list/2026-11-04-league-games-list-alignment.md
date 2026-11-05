---
summary: Line up the league games-list buttons the way the room race does
kind: task
added: 2026-11-04
checked: 2026-11-05
---

Ed liked it on the room race; do the same for the league match. The league games list (`src/components/scoring/GamesList.tsx`) builds each row as its own `grid-cols-[auto_1fr_auto_1fr]`, so the game-number and middle columns size to their content. "vs" is narrow, "Vacate" wider, "Vacate Request" wider still, and the player buttons shift width from row to row.

The fix is already built for the race: `GAME_ROW_GRID` in `src/components/scoring/GameButtonRow.tsx` (`gap-1`, number column `1.25rem` right-aligned, middle `3.5rem` with the middle buttons at their natural `text-xs px-1` width, centred). Use the same grid in `GamesList`, for the rows and the column-heading bar.

One thing to decide on the way: "Vacate Request" won't fit the narrow middle on one line. Let it wrap to two lines, or shorten the word.

Own small branch off main. It touches live league scoring, so check a real match after.
