---
summary: Playoffs page shows the final standings and the playoff matchups once set
kind: task
added: 2026-11-01
checked: 2026-11-05
---

Asked by Ed on playoff day. After "Set matchups now", the Playoffs page (`src/operator/PlayoffSetup.tsx`, its `locked` state) shows only "Matchups are set" plus View matchups and Reset matchups. Keep both buttons, and add the two things an LO needs to judge the matchups without leaving the page:

1. **Final standings, slimmed down:** place and team name (1st, 2nd, …), in the same order the bracket was seeded from (`sortStandings`).
2. **The playoff week's matchups:** who plays whom (what showed as TBD before), i.e. the last week of the Matchups page, shown here.

**Later, designed together and not built yet:** an edit after the matchups are set, so the LO can move teams around, like the pairing-rule setup before creating them.

**Related annoyance found the same day:** the Matchups page always opens at Week 1, so the playoff week is buried at the bottom and Ed mistook Week 1 for the playoffs. It should open on the current week (during playoffs, the playoff week).
