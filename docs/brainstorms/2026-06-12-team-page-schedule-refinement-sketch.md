---
date: 2026-06-12
topic: team-page-schedule-refinement
---

# Team Page + Schedule Refinement — SKETCH (brainstorm pending)

**Status:** Sketch only — NOT a complete requirements doc. Captures today's
decisions so they aren't lost. The full brainstorm is **deliberately deferred
until "My Match" ships** (see Sequencing below). Resume with `/ce:brainstorm`
then.

**Origin:** Brainstorm with Ed, 2026-06-12 — "the UI/UX for players getting
from the team page to the scoring page; the team page is too busy especially
for captains; the schedule page needs work."

## Problem Frame

Players (and especially captains) reach scoring through a long chain —
`My Teams → View Schedule → this week's row → Score Match → lineup → score` —
and the chain is *worse* than its hop count because the buttons that matter are
**hidden behind accordions** (you must expand a card before the action appears).
On top of the distance problem, the team page (`src/player/MyTeams.tsx`) is
**overloaded for captains**: setup warnings, invites, edit, venue, full roster,
and stats all live inline on the same surface a player just wants to glance at.

Two intertwined problems per page: **distance** (too many hops/expands to act)
and **busy-ness** (too much on screen, captain-heavy).

## Decisions So Far (today)

- **Two problems, one fix per page.** Refine each page *with click-through in
  mind* — every declutter pass should also shorten a path to scoring. "Kill two
  birds": decluttering and hop-reduction are the same work per page, not two
  efforts. (Ed's framing.)
- **Separate "glance/play" from "manage."** The default team view stays lean for
  everyone; the heavy captain tools (setup warnings, invites, edit, roster
  management) move into a tucked-away "Manage Team" area rather than living
  inline on the glanceable surface.
- **The score button is never hidden behind an accordion.** Whatever the primary
  "get me to my match" action is on a card, it stays visible without expanding.
- **Schedule page (`src/player/TeamSchedule.tsx`) is in this bucket too** — Ed
  flagged it "needs work" but its specific problems aren't yet pinned down
  (likely the same accordion/buried-button pattern; confirm during the
  brainstorm).

## Sequencing — why this is deferred

**Build "My Match" FIRST, then brainstorm these pages.** (See
`docs/brainstorms/2026-05-29-live-match-jumpin-requirements.md` — already
plan-ready.) Rationale: the team page and schedule are overloaded partly
*because they're currently forced to serve as the fast-path to scoring*. Once
"My Match" exists as a one-tap express lane, that responsibility lifts off these
pages. Brainstorming the refinements **before** My Match ships would bake in
fast-path duties that My Match is about to make redundant — designing against a
baseline that's about to change. After My Match lands, the sharper question is:
"now that there's an express lane, what does the team page actually still need
to do?"

## Open (for the real brainstorm, post-My-Match)

- What exactly belongs in "glance/play" vs. "Manage Team," and is "Manage Team"
  a separate route, a tab, or a collapsed section?
- What is the schedule page's specific problem beyond buried buttons?
- Which paths did "My Match" already absorb, so we don't rebuild them here?

## Next Steps

- Ship `2026-05-29-live-match-jumpin-requirements.md` (My Match) → `/ce:plan`.
- After it lands: `/ce:brainstorm` this sketch into a full requirements doc.
