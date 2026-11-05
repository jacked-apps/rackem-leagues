---
summary: Seed a scored match and a finished season for testing
kind: idea
added: 2026-06-13
checked: 2026-11-04
---

Clean-database tests showed two gaps in the seed:

- No scored games (`match_games` is empty), so the `appendConfirmation` and `gameConfirmations.schema` tests have no fixture.
- No finished-season fixture, so nobody can watch the playoffs fill in on their own. Every seed season is at week 1 of 16.

Adding a played match with games, plus one completed season, would turn those tests green and let the playoff automation be tested end to end. Seed files are dev-only.
