---
summary: One team's screen flashes and re-renders around the tiebreak
kind: task
added: 2026-05-02
checked: 2026-11-04
---

## What's left

Either memoise the lineup page like the scoring page, or Ed confirms the
flash no longer shows in normal use. The scoring page already got
`stableMatchForMutations` in `ScoreMatch.tsx` (commit `825e90f`, PR #100).
`MatchLineup.tsx` did not.

## Symptom

Only one team's device flashes; the other works fine. Refresh fixes it.
That points to bad client state on one device, not a server loop.

1. Tiebreak setup: the away screen flashed while games 19/20/21 were
   being created and lineups unlocked.
2. Tiebreak lineup page: on a phone, the page flashed locked/unlocked and
   the player dropdowns couldn't be picked.

## Likely cause

A realtime subscription bouncing: a refetch changes a prop's identity,
the hook resubscribes, replays the event, and re-renders.
Console showed `confirmOpponentScore` → `updateMatchRunningTotals` firing
repeatedly and `[useMatchRealtime] Cleaning up` teardowns.

## Where to look

- `src/hooks/lineup/useMatchPreparation.ts` (away-team polling for tiebreak games)
- `src/realtime/useMatchRealtime.ts` (update → resubscribe cycle)
- `src/components/scoring/MatchEndVerification.tsx` (tied-match polling,
  lines ~395-440, may re-fire if cancellation isn't clean)
