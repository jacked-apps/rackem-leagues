---
summary: Write full glossary entries for the scoring-system and win-calculator stubs
kind: task
added: 2026-05-30
checked: 2026-11-04
---

`src/glossary/entries/scoring.tsx` has `scoring-system` and `win-calculator`
entries, but both are placeholder stubs. They have no `reviewedByEd`, so
`pnpm glossary:progress` lists them as unreviewed.

"Scoring System" is the umbrella term for the whole modular structure (the
top-level module composing all the components, per
`docs/league-system/README.md`). Ed flagged it as important and wants an
educational explanation.

Keep the glossary entries short ("what it is" plus a link out). The deep
explanation belongs in the modules manual (see the modules-manual item).

Other entries (for example `total-points`) link to `#scoring-system`, so the
stub keeps those links working until the full write-up lands.
