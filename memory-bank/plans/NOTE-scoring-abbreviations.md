# Scoring Abbreviations (BCA/Industry Standard)

**Discovered:** 2026-04-14

These are standard abbreviations used in pool league scoring:

| Abbreviation | Meaning | Our System Equivalent |
|-------------|---------|----------------------|
| **WB** | Win on the Break (golden break — game ball sunk on break) | `golden_break_counts_as_win` / achievement tracking |
| **WZ** | Win Zip — 10-0 score (shutout/skunk) | Could be tracked as an achievement |
| **WF** | Win Forfeit — opponent forfeited the game | Forfeit handling (not yet built) |

## Notes

- WB maps to our existing "golden break" tracking toggle in preferences
- WZ (shutout) is a potential achievement to track — useful for stats
- WF (forfeit) needs a forfeit system — how games/matches are handled when a team or player doesn't show. This affects scoring, standings, and handicap calculations.
- These abbreviations may need to appear in the scoring UI and match reports
