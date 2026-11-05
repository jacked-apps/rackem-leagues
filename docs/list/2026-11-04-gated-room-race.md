---
summary: Room Race - a race to 5 as the room's second game
kind: task
added: 2026-11-04
checked: 2026-11-05
---

From `feat/room-race`, PR #317. The database parts (race tables, `room_races`, the confirm-the-breaker change) go live on merge. Only the screens are gated. The Game Room's own gates un-gate separately.

## Gate

`!isProduction`, in two places.

## Entry points

- the Race entry in the game registry, `src/rooms/games/registry.ts`, so production's Start a room list and `GameSlot` never show it (pinned by `registry.test.ts`)
- the dev route `race/:raceId` in `src/navigation/NavRoutes.tsx`

## Verify on staging

Use two accounts on two devices, and grant yourself `host` first.

1. Start a room, pick **Race**, open it, and invite the other account.
2. Both see "Who breaks?". One picks, the other gets "Confirm X breaks", and the picker can change it until then.
3. Score to 5. Each game only counts once the other confirms, and the scoring pop-up shows just the winner (no break & run, no early 8).
4. At 5, both phones show the winner. **Run it back** gives the other Accept or Deny; accepting starts a fresh race, and the old score is listed under earlier races.
5. Walk away mid-race and come back. The score is the same.
6. Delete the room from the Rooms list. It's gone, along with its races.
7. A coin-flip room still creates and opens to others as a Host.
8. Confirm 8-ball is the right default game type. It's a variable in `src/rooms/games/race/raceDefaults.ts`, along with race to 5 and winner breaks.
