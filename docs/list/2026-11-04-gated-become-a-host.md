---
summary: Become a Host, the $1/mo or $10/yr purchase that makes you a host
kind: task
added: 2026-11-04
checked: 2026-11-04
---

From PR #287. It grants the `host` designation.

## Gate

`!isProduction`. It is gated because what it sells is hosting game rooms, and the game room isn't on main yet (PR #317). In production it would sell a feature that isn't there, and it asks for a card number on a mock payment form that bills nothing.

## Entry points

- the route `become-host` in `src/navigation/NavRoutes.tsx`
- the "Host Your Own Game Rooms?" card in `src/profile/Profile.tsx`

## Verify on staging

The Profile card appears, the purchase completes, the card is saved on file, and the `host` designation is granted. Un-gate both places together, with the game room, and not before.
