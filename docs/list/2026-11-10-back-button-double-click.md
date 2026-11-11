---
summary: Stop a double click on a back button from going back two pages
kind: task
added: 2026-11-10
checked: 2026-11-10
---

Ed, 2026-11-10: "sometimes when i click the back button (in LO dashboard) it
goes back to my teams". Not urgent.

Why it happens: operator pages (league page, Manage Players, ...) have a
header back button to the operator dashboard. The dashboard's own header back
button sits in the same spot and always goes to My Teams
(`src/operator/OperatorDashboard.tsx`, `backTo="/my-teams"`, since the
navigation overhaul in PR #124). A double click lands once on each, so the
user ends up on My Teams.

Fix: make the shared header back button ignore a second click right after the
first (`src/components/PageHeader.tsx`), so every page gets
it at once. Related: the double-tap sweep item
(`docs/list/2026-09-05-double-tap-promise-sweep.md`), which covers buttons
that start async work.
