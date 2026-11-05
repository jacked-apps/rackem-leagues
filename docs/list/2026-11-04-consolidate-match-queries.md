---
summary: Give matches one full-record query, and make every mutation refresh stale data
kind: task
added: 2026-11-04
checked: 2026-11-04
---

Members is done (slice 1, PR #183). Matches is slice 2 and was never started.

## What's left

- Matches: one canonical query and one full type, cached by match id.
  Components use the fields they need instead of each fetching its own subset.
- Stale updates: every mutation should either update the cache
  optimistically (with rollback) or invalidate the right query keys,
  including any lists that hold the entity.
  Today some mutations invalidate nothing, some miss related keys, and
  there's no consistent pattern.

## Why it matters

Field lists drift apart, the same match is cached in several shapes, and
adding a field means touching several places.

## Where to look

- `src/api/queries/*.ts`, `src/api/hooks/*.ts`, and inline fetches in components.
- Template to follow: `docs/plans/2026-06-06-001-refactor-members-data-access-consolidation-plan.md`
  (its "Deferred to Separate Tasks" section names Matches as slice 2).
- Teams, leagues, seasons, venues and orgs are mostly clean already. Not worth touching.
