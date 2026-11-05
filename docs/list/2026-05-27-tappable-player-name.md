---
summary: Make every nickname tappable to show the player's full name
kind: task
added: 2026-05-27
checked: 2026-11-04
---

Nickname is the main display name, but people sometimes need the full name
(two "Jack"s, a nickname they don't know). Tapping a name should show it,
the same way everywhere.

`src/components/PlayerNameLink.tsx` already does this: a popover with the
full name and actions. `UnifiedScoreboard.tsx` and many other screens use it.

## Still showing plain text

All in `src/components/scoring/`:

- `GamesList.tsx`: player buttons and completed-game labels.
- `ConfirmationDialog.tsx`: the winner name in the prompt.
- `DissentFlag.tsx`: the winner line.
- `DisputeDetailModal.tsx`: confirmer and winner names.

Each one is mechanical: swap the plain `getPlayerDisplayName(id)` output for
`<PlayerNameLink />`. Medium priority. A real gap in big leagues with
nickname clashes, but no data risk.
