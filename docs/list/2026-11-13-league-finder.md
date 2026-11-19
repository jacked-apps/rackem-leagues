---
summary: Build a league finder so a player with no team can find a league near them
kind: task
added: 2026-11-13
checked: 2026-11-19
---

Ed, 2026-11-13: a new player who isn't on a team lands on My Teams with
nothing to do. My Teams now sends them to the Home page for options, and
Home has "Run Your Own League", but nothing yet for "join a league".

The Home page already holds the spot: the "Find a League" card in
`src/pages/Home.tsx` is a placeholder that says "Coming Soon". Its neighbours
"Browse Leagues", "Live Scoreboards" and "Standings" are placeholders too.

Open questions for Ed: what a visitor searches by (city, venue, game type,
night of the week), whether operators choose to be listed, and what a match
does (contact the operator, request to join a team, or both).

## Ed's ideas (2026-11-19)

A full search-by-city finder isn't needed first. A cheap first version:

1. **Your past organizations.** A player who has played before already has
   teams on record, so we know which organizations (league operators) they
   played for. Show that list.
2. **Their current leagues.** For each of those organizations, show the
   leagues it's running now (or signing up for the next season).
3. **Teams with space.** If a league is in session, show teams that have
   room on their roster.
4. **Captain controls.** A captain marks the team as **invite only** or
   **accepting applications**. Accepting teams show "space available" and a
   player can ask to join; the captain approves.

Teams are meant to be allowed to be big. The roster limit already exists:
an operator can set "max players per team" (1 to 20) in the league / org
roster settings (`RosterSettingsSection.tsx`, `preferences.max_roster_size`;
each team also has `teams.roster_size`). "Space available" = players on the
roster below that limit. Not built yet: the captain's invite-only /
accepting-applications switch and the request-to-join flow.

A brand-new player with no history gets nothing from steps 1 and 2; they
still need the search version (the open questions above).
