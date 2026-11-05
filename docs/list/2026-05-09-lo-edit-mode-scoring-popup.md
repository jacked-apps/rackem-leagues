---
summary: Let a league operator hide or show scoring events right from the scoring popup
kind: idea
added: 2026-05-09
checked: 2026-11-04
---

Part of Branch B (event registry) in
`docs/brainstorms/2026-05-05-scoring-modal-rework-requirements.md`.
Branch B is not planned. When it is, this must be a first-class requirement.

## The idea

- An LO of this match's league sees a pencil in the scoring popup.
- Tapping it lists every event with a hide checkbox
  (Break and Run, Scratch on 8, Early 8, ...).
- Toggling writes to `event_preferences`. Leaving edit mode shows the
  popup with the new set.
- The same component, in preview mode, is what the operator office's
  preferences page shows. What the LO sees matches what scorers see.

8-on-the-break is the example: BCA, APA and bar leagues all treat it
differently.

## Design-in requirements for Branch B

1. `event_preferences` supports org-level and league-level toggles.
2. The popup takes a `mode` prop: `'score' | 'edit' | 'preview'`.
3. The pencil shows only for an LO (or developer) whose org owns this league.
4. Live update for open popups is preferred; next-open is acceptable.
   Pick one and document it.
5. The office preferences page reuses this rendering, not a parallel form.

Out of scope: renaming events (calculator params) and changing when an
event applies (developer-owned registry rules).

Branch A plan: `docs/archive/plans/2026-05-05-001-feat-scoring-modal-plumbing-plan.md`.
