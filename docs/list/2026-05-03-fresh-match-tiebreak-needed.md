---
summary: Retest - a brand-new match shows "tiebreak needed" after leaving another match
kind: task
added: 2026-05-03
checked: 2026-11-04
---

## Ed: retest A → B

1. Open match A (any state).
2. Go back to the dashboard or match list.
3. Create and open match B (fresh, no games scored).
4. As home team: does "tiebreak needed" show right away?

It may have been fixed in passing by PRs #143 and #305. Nothing targeted
it directly. Workaround if it still happens: hard refresh.

## Likely cause

State from match A bleeding into match B: stale query cache when the match
id changes, realtime events from A routed to B, or `MatchEndVerification`
mounting with A's verification flags and reading B as a tie.

## Fix direction if it reproduces

- Make switching matchId fully drop the old match data
  (`useMatchScoring` and its query keys).
- `MatchEndVerification` should not judge completion until `match.id`
  matches the current matchId.
- Scope realtime cleanup strictly per match.

## Related: second verifier doesn't auto-navigate

Both teams verified, the match completed correctly, but the home screen
stayed put. Possible causes: the `status === 'completed'` guard, a stuck
`completionStartedRef`, or effect deps drifting. Fix direction: split
navigation from the write guard in `completeTheMatch`, so navigating is
its own idempotent step. Workaround: click back to the dashboard.
