---
summary: Build a league finder so a player with no team can find a league near them
kind: task
added: 2026-11-13
checked: 2026-11-13
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
