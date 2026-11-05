---
summary: LMS handicap calculator, a dev and staging tool
kind: task
added: 2026-11-04
checked: 2026-11-04
---

It was gated in the code but missing from the old list.

## Gate

`NonProdGate` on the route, and `!isProduction` on the link.

## Entry points

- the route `tools/calc` in `src/navigation/NavRoutes.tsx`
- the "LMS Calc" link at the bottom of `src/profile/Profile.tsx`

## Verify on staging

Decide whether it should ever go live. If yes, un-gate both together. If it stays a staff tool, it can stay here or be removed (the code comments say which lines to delete).
