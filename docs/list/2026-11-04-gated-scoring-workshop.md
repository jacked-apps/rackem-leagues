---
summary: Scoring Workshop, still in active development
kind: task
added: 2026-11-04
checked: 2026-11-04
---

It once shipped to production un-gated by accident. It is paused for a design reason: it exposes controls a league operator shouldn't have, and Ed is rethinking that.

## Gate

`!isProduction`.

## Entry points

- the routes `operator/scoring-workshop` and its sub-pages in `src/navigation/NavRoutes.tsx`
- the dashboard card in `src/operator/OperatorDashboard.tsx`

## Verify on staging

It still shows on staging. Un-gate both guards when it's ready for users.
