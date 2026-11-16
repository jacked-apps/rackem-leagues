---
summary: Schedule a tournament ahead of time so players can find it nearby and join its hopper early
kind: idea
added: 2026-11-16
checked: 2026-11-16
---

Ed, 2026-11-16: "set up a way for a tournament to be 'scheduled' in advance.
then people can sign up and get into the 'hopper' early. they can search for
tournaments close to them."

Today a tournament's sign-up only exists once the organizer has created it and
shares its join link / QR (`/brackets/join/:joinToken`, the paid tier's
hopper: `docs/plans/2026-09-04-001-feat-tournament-paid-foundation-plan.md`).
Nobody can find one they weren't sent.

**Ed's flow (2026-11-16):**
- The director sets a date for the tournament.
- Players use the QR / link (or find it in search) to make a "reservation":
  they land in the hopper.
- On the day, the director collects entry fees in person (their
  responsibility, not the app's) and moves players from the hopper to the
  official list.
- Once it has started and round 1 is finished, it's closed: no one else can
  be added, it drops out of search, and the link stops working.

**Search (Ed, 2026-11-16):** scheduling a tournament requires a venue, and
the venue is the location. Searchable by: the venue's name, address, city
and zip; the tournament's name; and the director's name and nickname.
Venues already exist in the app (`src/types/venue.ts`) with name, street,
city, state and zip, so text search needs no new venue fields. "Near me" by
distance would also need map coordinates, or search can start by zip/city.
Open point: venues today are added by league operators under an org; a
director who isn't an LO needs a way to pick or add a venue.

**Venue as a paid extra (Ed, 2026-11-16):** saving the tournament's venue
would be one more $1 paid extra. Ed: "not adding to the max charge". Confirm
whether that means it sits inside the current $5 cap (`PRICE_CAP_CENTS`) or
is charged on top of it. Since we're paid either way, the TD's venue is
saved for good and can be reused. Venues can already be shared by several
leagues, so leagues and tournaments sharing one is not a big change.

**Double-booking disclaimer:** a warning that tells LOs and TDs we are not
responsible for fixing scheduling errors or double booking at a shared venue.

Venue owners seeing what's booked at their venue is a separate idea:
`docs/list/2026-11-16-venue-owner-view.md`.

**What already exists:** the hopper, the official list, the join link + QR
poster, Start, and late entry into an unused bye (`LateEntryDialog.tsx`). A
bracket sits in `setup` until Start (statuses: setup, live, complete,
closed). The "closed after round 1" rule fits late entry, since every bye is
in round 1.

**What's new:** a date (plus time and venue) on the tournament; keeping its
hopper open from posting day until the event; the "round 1 done = no more
entries, link dead" rule; and the public search, the biggest piece, which
needs a location to measure distance from.

Three pieces:

1. **Scheduled tournaments.** An organizer posts a tournament ahead of time:
   date, start time, venue, game, entry fee, field size. It sits in a new
   "scheduled" state before setup.
2. **Early sign-up.** Players join the hopper from the listing days ahead, the
   same hopper the join link fills today, so the organizer starts the night
   with names already in.
3. **Find a Tournament.** Visitors and members search scheduled tournaments
   near them (by distance, date, game). The Home page already has a "Find a
   Tournament" card marked Coming Soon (`src/pages/Home.tsx`).

Today there is no tournament-director role: any signed-in member runs one
from Tournaments (no org needed, by design in the paid-tier plan). The
sign-up hopper is a paid feature, so it needs a card on file, charged at
Start ($0 for now, mock form). An LO running one also gets their org's
player-merge powers.

Questions for Ed: who can post one publicly (any member as today, or does a
public listing need something more, so search doesn't fill with junk);
whether a visitor must make an account to sign up early; whether entry fees
are paid at sign-up or at the door; and how it shares search with the league
finder (`docs/list/2026-11-13-league-finder.md`).
