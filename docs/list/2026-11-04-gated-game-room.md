---
summary: Game Room - multi-phone rooms with the two-phone coin flip
kind: task
added: 2026-11-04
checked: 2026-11-05
---

From `feat/game-room`, shipping in PR #317. Opening a room to others needs the **Host** designation (not the operator role). Rooms no longer delete themselves (end one to remove it). A host can keep 10 at once.

## Gate

One condition in four places: `<NonProdGate>` on three routes, plus `!isProduction` on the menu entry. `src/navigation/roomsGate.test.tsx` pins the routes.

## Entry points

- the routes `rooms`, `rooms/join/:joinToken` and `rooms/:roomId` in `src/navigation/NavRoutes.tsx`
- **the menu entry, still to add.** Once PR #311 is on main, add `{ id: 'rooms', label: 'Rooms', path: '/rooms', group: 'extras', show: () => !isProduction }` after Stats in `src/components/layout/navEntries.ts`, ideally inside this PR before it merges. Until then, staging reaches it by typing `/rooms`.

## Verify on staging

Grant your member `host` first (SQL, like the developer key). Once the entry is in, "Rooms" sits in the menu's Extras fold next to Tournaments.

1. Start a room on one phone, open the door, and scan the QR on a second phone (signed out, then login, then back on the join page). Join. Both see "2 here · 2 seats open".
2. Open a second room as the same host. Its counter already shows "1 here · 1 seat open". Seats are per host across rooms and your own screens count too: 4 seats = 2 of yours + 1 guest + 1 open.
3. The host ends the room, and the guest sees "This room has ended" without refreshing.
4. Coin flip: the guest taps Heads or Tails, the host taps Throw, and both phones show the same face and winner. Refresh either one and the result is the same.
5. An 11th room says "You have 10 rooms already."

Un-gate = remove `NonProdGate` from the three routes and the menu entry's condition in the same commit, then drop or flip the production cases in `roomsGate.test.tsx`.
