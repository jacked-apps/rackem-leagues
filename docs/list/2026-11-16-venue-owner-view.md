---
summary: Let a venue owner see and manage what's booked at their venue
kind: idea
added: 2026-11-16
checked: 2026-11-16
---

Ed, 2026-11-16, while planning scheduled tournaments
(`docs/list/2026-11-16-scheduled-tournaments-finder.md`), which would add
venues from tournament directors as well as league operators.

Venue owner is already a planned designation
(`docs/brainstorms/2026-09-16-member-designations-requirements.md`), and the
database has a `venue_owners` table plus `venues.venue_owner_id`.

Things a venue owner could do:

- See which leagues and tournaments are attached to or scheduled at their
  venue.
- Move assigned tables around.
- Block certain users from using their establishment.

Needs designing: how someone proves they own a venue, and what "block"
means in practice (can't be scheduled there, can't join events there, or
both).
