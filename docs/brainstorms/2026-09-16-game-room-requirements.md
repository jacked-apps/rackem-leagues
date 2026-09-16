---
title: Game Room — a generic, perishable, multi-phone room that games plug into
date: 2026-09-16
status: ready-for-planning
audience: developer + AI sessions
scope: deep
supersedes: docs/brainstorms/2026-09-10-game-room-requirements.md (on branch feat/game-room; see "Relationship to the Sept 10 brainstorm")
---

# Game Room — a generic, perishable, multi-phone room that games plug into

## Problem Frame

Two friends at a bar want the app to keep score while they play — a race, a
coin flip for the break, rock-paper-scissors, a round robin when four or six
people show up. None of it is a league night or a tournament. None of it should
ever touch a handicap, a stat, or a standing.

Today the app has no place for that. The league scoring room is team-shaped
through and through (lineups, positions, home/away) and its rows are sacred.
The coin flip component exists but runs on one phone only — two phones each
toss their own coin and can disagree about who won.

What is missing is **the room, not the games**: a shared place two or more
phones can be in together, where a game's rows are written by one phone and
seen by every other one. The games — races, flips, round robins — plug into
that room later, each on its own. This document is about the room only.

**Why now, honestly:** Ed wants it, he and his friends would use it tonight,
and it is cheap. It is also the first thing in the app a *player* (not an
operator) might pay for personally — a positioning bet worth naming. It is
being built ahead of the sold-but-unbuilt tournament `self_scoring` feature;
see "Relationship to tournament self-scoring" for why that is deliberate.

## What this is

A generic container. The room knows who is in it, which game is being played,
and which tables that game writes to. It opens one live channel per phone,
listens to those tables for this room only, and forgets everything after a
day or two. It never reads a game's rows, never knows what a "race" is, and
never changes when a new game is added.

**The test of "generic":** the first game plugged in (Ed's already-built race,
held on his other machine and deliberately *not* shown during this brainstorm)
must fit without a single change to the room. Any change it needs is a room
bug, fixed in the room.

## Requirements

**Room identity and lifecycle**
- R1. A room is created by a signed-in member (the host) and records: the host,
  the game being played, the list of tables that game uses, the game's
  settings (opaque to the room), and whether the room is shared. The table
  list is capped (3 to start — a dial, not a decision).
- R2. A room is perishable. Every row it owns — in every listed game table —
  is deleted with it. Rooms are deleted when the host closes them or after an
  inactivity window (24 hours to start; a dial, not a decision). **Activity is
  the room's own signal:** any room screen, free or shared, heartbeats the
  room row while open. Games contribute nothing to it, so a game author cannot
  forget it and a free room (no channel) is never swept mid-play.
- R3. Completing a game does not close the room. The same people may set up
  another game in the same room. **Setting up a new game wipes the previous
  game's rows** (the room deletes by `room_id` from each listed table — it
  knows the names, never the columns) and re-establishes the live channel,
  since bindings cannot change on a live channel. Games never need an
  instance id.
- R4. Nothing written in a room ever feeds handicaps, stats, standings, or
  match history. Room data lives in its own tables. This is a **fence, not a
  wall**: a bracket match may one day open a room (see "Relationship to
  tournament self-scoring"); what it may never do is write back to stats.

**Free vs shared**
- R5. A room that is not shared is the free experience: one phone, no live
  channel opened, otherwise identical. The game running inside cannot tell the
  difference.
- R6. A shared room requires the host to hold Game Room membership. Membership
  is a **gate, not a charge** today — no payment processor is wired up, same
  posture as the tournament paid tier. The room checks one thing at the door:
  "may this person host a shared room?" **For this iteration the answer is: a
  member whose `role` is `league_operator` or `developer`.** Ed is designing a
  proper per-member designations table on his other machine; when it lands, the
  door check swaps to it and nothing else changes. Nothing inside the room cares how they
  got through. **Until a processor exists the gate is effectively open**
  so launch behavior is "any league operator can host a
  shared room" and the seat rule is the only limiter.
- R7. A room can be switched from not-shared to shared in place. The game in
  progress does not restart, move, or notice. (The host's phone opens its
  channel at that moment.)

**Seats and joining**
- R8. Every **Game Room member** present in a shared room brings three guest
  seats (four phones per member, including their own). Two members present =
  eight phones. A signed-in account that does not hold membership is a guest.
  Three-per-member is a starting dial, not a fixed number; nothing may assume
  it. **Purpose of the cap:** to stop one membership from serving a whole bar.
  It is not cost control (cost is trivial at these numbers) and not an upsell
  aimed at guests.
- R9. Seats are derived, never stored as a number: members present × 4, minus
  phones present. A member joining raises the count; a member leaving lowers
  it.
- R10. Capacity is checked only when a phone tries to join. Once in, a phone
  is never removed because the count later dropped (a member left, a phone
  went to sleep). The rule means "may one more phone come in," never "must
  someone leave."
- R11. Joining is by link or QR code. A guest with no account types a name and
  is in. A signed-in account is recognized as such; a Game Room member adds
  seats. *(Name-only guests: assumed — Ed did not object; flagged in
  Outstanding Questions.)*
- R12. The room shows how many phones are watching and how many seats are
  empty. Tapping the empty-seat count is how you invite: it shows the room's
  QR code and a copyable link. With no seats left, the same tap explains that
  another member joining opens more.
- R13. **"Present" is a stored fact, not a channel side-effect.** The room
  keeps one row per phone in the room (name, whether they are a member, a
  last-seen heartbeat). A phone is present while its heartbeat is fresh; a
  phone whose screen sleeps at the bar stays present for a grace window and
  keeps its seat. Seats, the door check, and "who's here" all read these rows.
  This row is also the stable per-room identity a game can key "confirmed by"
  on — it means nothing outside the room and dies with it. (Precedent: the
  bracket hopper stores participants as rows; the codebase has no
  channel-presence usage and does not need one.)

**Live sync**
- R14. Each phone in a shared room holds exactly one live channel for the
  room. On it, the room listens to the room row, its own phone rows, and each
  table in the room's table list, all filtered to rows belonging to this room.
  The scoring room already does this with a hard-coded list of four tables;
  here the list is data on the room row.
- R15. Delivery is bounded by the row filter, not the channel: a phone in room
  A receives zero events from room B. (The channel name is irrelevant to
  Supabase's filtered delivery; the `room_id` filter is what does the work.)
- R16. **How a change reaches a game's screen:** the room invalidates a query
  key of the shape `['room', roomId, tableName]` whenever a listed table
  changes, and again for every listed table after a reconnect (catch-up).
  Games MUST key their queries that way. That is the whole seam; the room
  never reads the rows and never calls into a game. (Precedent: the bracket
  realtime hook invalidates by key; the scoring room's hook takes per-table
  callbacks — the key convention is the zero-knowledge version.)

**Plug-in contract (what a game brings; what the room promises)**
- R17. A game brings: a name, its own tables, its own setup screen (which
  writes the room's settings slot), and its own screen that reads its rows
  (keyed per R16) and renders the score. **Every game table must:** carry a
  `room_id` that cascades on delete; be added to the realtime publication;
  and be set to full replica identity — without that, filtered update and
  delete events are silently dropped, and a race's rollback (a delete) would
  never reach the other phones. The room checks this at room creation and
  fails loudly if a listed table is not set up, so the mistake surfaces at
  setup, never at play.
- R18. The room promises: create/join/leave, who's here, the live channel over
  the listed tables, the query-key invalidation (R16), the settings and game
  slots, the activity heartbeat, and cleanup. Nothing else.
- R19. Adding a new game requires no change to the room's code. It does
  require the game's own migration (its tables, each meeting R17). Strictness,
  confirmations, rollback, extras like break-and-run — all of that is the
  game's business, written in the game's rows, read by the game's screen.

## Success Criteria

- The two-phone coin flip runs in the room: one phone calls, the other throws,
  both see the same server-decided face and the same winner.
- Ed's existing race then plugs into the room with zero room changes.
- Two phones in a shared room see the same rows within a beat of each other,
  and a phone in a free room never opens a channel.
- A phone in room A never receives an event from room B.
- Deleting a room leaves no rows behind in any game table.
- The league scoring engine, `matches`, `match_games`, and every stats path are
  untouched by this work.

## Scope Boundaries

- **One game, not zero.** The two-phone coin flip is in scope as the first
  tenant — small, already planned, and it needs the room anyway. Nothing
  else: not the race (stays hidden as the acceptance test), not round robin,
  not rock-paper-scissors. Each is its own later piece.
- **No payment processor, no charging.** Membership is a gate.
- **No persistence past the room's life.** No history, no "my past rooms."
  Revisit once there is a paying user asking "what did I get."
- **No changes to the league scoring room** or its tables.
- **No notifications, no push, no "your turn" alerts.** A "challenge a member
  from their profile" door (invite via message) is a later second door into
  the same room, not v1.
- **No tamper resistance from the room.** Rows are written client-side. Games
  that need a trustworthy outcome (the coin flip) decide it server-side in
  their own rows; strict mode is the players' tool for the rest.

## Relationship to tournament self-scoring

The tournament paid tier already sells `self_scoring` ("each pair confirms
their own winner from their phones"), unbuilt, and the self-scoring primer
(`docs/brainstorms/2026-09-08-self-scoring-primer.md`) says it must also serve
individual-race leagues. This room's first game is an individual race scored
from two phones with confirm/deny. Two reviewers flagged that the document
never said whether these are the same thing. **Decision: the room is the
foundation.** Tournament self-scoring and individual-race leagues will sit on
this room later rather than getting a second two-phone scorer. Consequences
now: R4 is a fence (no room row feeds stats), not a wall; and the first game's
"confirmed by" must be able to point at a real member id as well as a room
phone row, so a tournament pair can be recognised as members when that day
comes.

## Relationship to the Sept 10 brainstorm

`docs/brainstorms/2026-09-10-game-room-requirements.md` (branch
`feat/game-room`, status "settled") designed a two-member, challenge-from-
profile room on an event log with room-enforced per-event confirmation and
server-decided outcomes. This document supersedes it on: sync model (tables,
not tape), where confirmation lives (games, not room), who's in it (host +
guests, many phones), and the free/paid split. Three ideas from it are carried
forward: server-decided coin flip outcome (games appendix), the profile
"challenge" door (scope boundaries, later), and a shared game-side
confirmation helper once a second game wants one (games appendix).

## Key Decisions

- **Games bring their own tables; the room subscribes from a list.** Chosen
  over an event-log ("tape") design where games reconstruct state from ordered
  moves, and over a single generic `room_rows(room_id, game, key, payload)`
  table (considered after review). The generic-rows table would remove the
  per-game migration, the publication step, and the table cap — but it gives
  up typed columns, constraints, and plain queryability, and it is not how
  anything else in the app or Jack's mobile mirror works. Real tables win;
  the per-game migration checklist in R17 is the honest price.
- **Every game table has `room_id` with delete-cascade, is published, and has
  full replica identity.** One rule buys an identical listen filter for every
  table, free perishability (cleanup deletes room rows and nothing else), and
  a game author who cannot forget cleanup because they write none. The room
  verifies the publication/replica setup at creation so the one thing an
  author *can* forget fails loudly.
- **One stored cell: shared or not.** Capacity is *not* stored because it
  changes whenever a member walks in or out. Seats are derived from the
  phone rows (R13).
- **Presence is rows with a heartbeat, not channel presence.** A joining phone
  must be able to check seats *before* it is in the room, a free room has no
  channel to derive presence from, and games need a stable identity to key
  on. Rows give all three; channel presence gives none. The cost is that
  "leaving" is a stale heartbeat, not an instant event — acceptable, and it
  is what keeps a sleeping phone at the bar in its seat.
- **Count phones, not players.** Six players and two phones is two phones. The
  seat rule limits how many screens score, never how many people play. The
  free room already handles any number of players on one screen.
- **Host pays, guests ride free.** If a guest had to pay to confirm a score,
  he'd say "just put it on your phone." One membership covering a table of
  phones is well inside the dollar.
- **Free room is the same room with the door shut.** Not a lighter separate
  thing. One room, one race, "upgrade" = the door opens. Known trade: the free
  room still writes each tap to the database, so it needs signal where a
  purely local scorer would not. Accepted for one-code-path simplicity.
- **Cost model.** Supabase realtime bills peak concurrent connections and
  messages delivered — not channels or rooms. A phone holds one socket
  regardless. What bounds *delivery* is the `room_id` row filter (R15). What
  bounds *server work* is changes × live subscriptions, since every change on
  a published table is checked against every subscriber's filter — the thing
  to watch as rooms multiply, and the reason game tables stay small and
  narrow. Pro plan's 500 concurrent connections is the practical ceiling
  before any overage.

## Decisions captured for the games (NOT room requirements)

These came up during the brainstorm and are worth keeping, but they belong to
whichever game implements them. The room knows nothing about any of it.

- **A race is a stack.** Scoring pushes a game on top. Fixing game 3 of 5 means
  taking 5 and 4 off first. No in-place edits.
- **Three strictness levels, one mechanic:**
  - *Strict* — a score sits beside the stack until the opponent confirms, then
    goes on top. The next game does not appear until then.
  - *Trust-but-verify* — a score goes on top immediately; the other phone gets
    a verify prompt. Deny takes the top off (always safe — nothing is built on
    it yet). The prompt is a single window that always points at the most
    recent game; the next score moves it along. Nothing stacks, no timer needed.
  - *Open* — a score goes on top, no prompt. Rollback still available.
  - Rollback ("pop the top") exists in all three.
- **Extras (break-and-run, early 8, etc.) are per-game setup, default off.**
- **The coin flip's outcome is decided server-side** — the face is generated
  by the database as the flip row is created, so no phone can lean on it. Both
  phones display what the row says. This is the supplied-face seam cut from
  `CoinFlip` on 2026-09-09, returning pointed at the server. On the room's
  tables it is one "call" row and one "throw" row.
- **A shared confirmation helper for games** — when a second game wants "the
  other phone confirms," build it once as a game-side reusable piece, not per
  game and not in the room.

## Dependencies / Assumptions

- The tournament self-add link/QR join mechanic exists and is the pattern for
  R11/R12 (verified: hopper self-add shipped in PR #275's phases).
- The scoring room's multi-table single-channel subscription
  (`src/realtime/useMatchRealtime.ts`) and the bracket hook's key-based
  invalidation (`src/brackets/useBracketRealtime.ts`) are the verified
  precedents for R14/R16.
- **The membership gate has no precedent to lean on**, and this iteration
  does not build one. The tournament tier gate is per-bracket (a tier on the
  bracket row), and `payment_methods` is a saved card, not an entitlement.
  `members.role` is a single value per member (player / league_operator /
  developer), so it cannot express "LO *and* host" — which is why Ed is
  designing a one-row-per-hat designations table (with `until` and
  `source`) separately. Until then: LO or developer may host.
- **Name-only guests write rows and listen on the anon key with RLS off.**
  That is the current posture on every table (RLS enablement is a separate
  planned pre-launch pass), and the one anon write in the codebase (walk-up
  self-add) is a deliberately scoped RPC. The room's phone row (R13) is the
  identity a future RLS policy can key on. Supabase anonymous sign-ins are
  currently disabled in config; enabling them would give guests a real
  `auth.uid()` cheaply and is the recommended path — decided in planning.
- `pg_cron` already exists in the project (auto-forfeit sweep) and is the
  honest way to run a 24-hour inactivity sweep; sweep-on-create (the brackets
  precedent) would leave rooms alive until someone, anywhere, creates one.

## Outstanding Questions

### Resolve Before Planning

- *(none — the three product calls raised by review were made 2026-09-16:
  foundation not casual-only; wipe on new game; room + coin flip as first
  tenant. Ed may overrule any of them.)*

### Deferred to Planning

- [Affects R11][User decision, assumed] Guests join by name only, no account.
  Ed did not confirm or object. Proceeding on this; reverse if he wants a
  sign-up wall.
- [Affects R11, R13][Technical] Enable Supabase anonymous sign-ins for guests
  vs. rely on anon-key writes with RLS off. Recommendation: enable.
- [Affects R6][Deferred to Ed] The per-member designations table (LO /
  tournament organizer / host, one row per hat with `until` and `source`) is
  Ed's work on his other machine. This iteration gates on `members.role`.
- [Affects R17][Technical] The room-creation check for publication + replica
  identity: an RPC reading `pg_publication_tables` and `relreplident`.
- [Affects R13][Technical] Heartbeat interval and the grace window before a
  phone is "gone." Two constants.
- [Affects R2][Technical] Sweep via `pg_cron`; what a guest sees when they
  scan a QR for a swept or host-closed room ("this room has ended," not an
  error — mirror the bracket share-link's not-found shape); what guests see
  when the host closes mid-game (the room row's delete reaches them because
  the room row itself is published with full replica identity).
- [Affects R1][Technical] Whether the table-list cap is a database check or a
  client rule; whether the settings slot needs a size cap given every phone
  refetches it on each room-row event.
- [Affects R8][Product, dial] Three guest seats per member. One constant.
- [Affects R2][Product, dial] 24-hour inactivity window. One constant.

## Next Steps

→ `/ce:plan`. Ed's race stays
on his other machine until the room is built; it is the acceptance test, not
the template.
