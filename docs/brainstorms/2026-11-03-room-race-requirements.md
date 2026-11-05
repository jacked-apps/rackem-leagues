---
title: Room Race — scoring a two-player race inside a Game Room
date: 2026-11-03
status: ready-for-planning
audience: developer + AI sessions
scope: standard
builds-on:
  - docs/brainstorms/2026-09-16-game-room-requirements.md (branch feat/game-room)
  - docs/plans/2026-09-10-self-scoring-resume-here.md (branch feat/self-scoring-individual-races)
---

# Room Race — scoring a two-player race inside a Game Room

## Problem Frame

A **room** is a place where people play any kind of game. The coin flip was
the first game, the race is the second, and more will follow. Ed built rooms
because tournaments were stuck without one: there was nowhere for "these two
players, this match" to meet. With a room, a tournament can send two invites,
the players follow the link in, and they score their match.

The race engine is already built (branch `feat/self-scoring-individual-races`):
tables, server-side engine, scoring screen, strict confirm, reverse-the-last-game,
early 8. The room is built too (branch `feat/game-room`, gated). What's
missing is the race **playing inside the room**.

**This iteration locks down race scoring and nothing else.** Every setup
option (handicaps, ratings, tournament settings, break-rule choice) only
changes the numbers the race starts with. So scoring has to be solid first,
and those options come later as small additions.

## One room, three doors (only the first is in scope)

| Door | Who creates the room | Who's in it | Status |
|---|---|---|---|
| Friends | A member who holds the **Host** designation | Host + the one person they invite | **v1** |
| Tournament | The bracket | The two players, sent invites by the bracket | Later, same room + same race |
| League | — | 5 pairs, several at once | Much later, and a separate effort. The race's resume note says the league is NOT "the race, five times". The race is only kept in a shape a league could reuse |

For Friends and Tournament it's the same room and the same race. Only the way in differs.

## Requirements

**Entering the race**
- R1. **Race** is a game in the room's game list, next to Coin flip. Like
  every game, it's picked when the host creates the room (there's no switching
  games inside a room). A race room is always **shared** (open to others),
  because it needs two phones. It seats exactly **2 screens**, like the coin
  flip. The host's screen is one of them. The two people in the room *are* the
  two players. There's no picking step and no spectator in v1.
- R2. There's no setup screen. Once both players are in, a race is ready with
  the default settings (R3).
- R3. **Settings are variables with defaults, not hard-coded values.** Each is
  read from one place so it can be set from outside later (a tournament, a
  setup screen, a handicap):
  - **Base** = 5. Each player's goal is derived from the base. In v1 both goals
    equal the base. Later, ways to adjust the base, or each player's goal from
    it, plug in here. The race already stores a goal per player.
  - **Break rule** = winner breaks.
  - **Game type**: see Outstanding Questions.

**Who breaks first**
- R4. The first thing both players see is a **"Who breaks?"** pop-up. One
  player sets the answer and the other confirms it. The race doesn't start
  until both agree. (Players usually lag for the break, so the app records
  the answer. It doesn't decide it.) **The app doesn't referee a
  disagreement.** The players settle it at the table however they like, and
  there's no "change" or dispute flow. A per-game "change breaker" is v2.
- R5. After the first game, the break rule (R3) decides every break. Nobody
  is asked again.

**Scoring**
- R6. **Strict confirm only.** A game counts only after the other player
  confirms it, and the next game doesn't appear until then. This is how the
  race already works.
- R7. Reverse stays as built. Only the last game with a result can be
  reversed. To fix game 3 of 5, you reverse 5, then 4, then 3. **No extra
  finality rules in a hosted room.** Rules stay informal here. Finality,
  unfinished races and disputes will look very different in tournaments and
  leagues, and they're designed there, not here.
- R7a. **Each game records the winner only.** No early 8, break-and-run or
  other extras. Those exist for stats, and friendly games don't count. The
  scoring dialog hides them for a room race.
- R8. **The scoreboard is deliberately simple:** each player's name and their
  wins out of their goal (e.g. `2 / 5`). The race's existing scoreboard
  already does this and shows a separate goal per player. When a player reaches
  their goal it marks them "Won the race" in words, not just color. During
  play it marks no leader, and v1 doesn't add one.

**End of the race**
- R9. When a confirmed game takes a player to their goal, the race is over.
  That confirmation is the final one. There's no separate "verify the final"
  step.
- R10. Both phones show the final score and the winner. The results stay
  visible in the room so players can look back at them, but they're never
  counted anywhere.
- R11. Either player can tap **Run it back** (rematch). The other player gets
  accept / deny. On accept, a new race starts in the same room with the same
  two players and the same settings, beginning again with "Who breaks?" (R4).
  Run it back is a hosted-room feature only. Tournaments won't have it.

**Rooms wait; the host manages them**
- R11a. **Nobody is locked in.** A player can leave mid-race. The room and the
  unfinished race stay in the host's house, and when they come back (tonight
  or next week) they pick up exactly where they left off. A host can have
  several rooms open at once.
- R11b. **The host can delete any of their rooms from the outside**, from the
  Rooms list, whether it's finished, unfinished or never used, without opening
  it. (Today the list only has "Open"; End room is inside the room.)
- R11c. **Rooms no longer delete themselves, for every game, not just the
  race.** The 24-hour sweep was only ever an automatic cleanup. Rooms now pile
  up until the host deletes them (R11b). To keep a house from growing without
  limit, **a host has a cap on how many rooms they can have** (a dial, like
  the house seats; the number is a planning default, ~10). Creating one past
  the cap is refused with a plain message telling them to delete one first.
  This reverses the room doc's "room count needs no cap," which assumed rooms
  self-deleted.
- R12. Nothing from a room race feeds stats, handicaps or standings. That's
  enforced by construction, not by every query having to remember: **a
  Friends race is deleted with its room**, like the coin flip's rows. (Ed: a
  friends result "goes nowhere once the room closes.") A tournament result
  outliving its room is the tournament door's job, decided when that's built.

## Success Criteria

- The host opens a Race room, the invitee joins, and both are scoring within
  seconds. Setup is the "Who breaks?" pop-up and nothing else.
- Every game result shows on both phones and counts only after the other
  player confirms it.
- Reaching 5 ends the race on both phones, and Run it back (accepted by the
  other player) starts the next one.
- Two players can walk away mid-race, come back days later, and continue
  from the same score.
- Changing the base or break-rule default is a one-place change.
- The race engine's existing tests stay green, except the start-of-race tests
  that R4 deliberately changes. Those are rewritten, not deleted. The coin flip
  is untouched.

## Scope Boundaries

- **No setup options** (custom race length, handicaps, ratings, break-rule
  choice, game-type choice). They're defaults now and settings later (R3).
- **No "flip for it."** The coin flip deciding the break comes later.
- **No trust-but-verify or open modes.** Strict only.
- **No official result acknowledgment.** A "both players sign off on the
  result" step may come back for tournaments; Ed is undecided.
- **No scoreboard rebuild.** The shared, modular scoreboard is its own later
  project (the league `UnifiedScoreboard` is tied to league matches and must
  not be faked into showing a race). The room race's simple scoreboard is one
  of the places it plugs into afterwards.
- **No tournament, bracket or league wiring.**
- **No free one-phone race — that's v2.** The free version is one device, one
  person keeping score for two typed names ("Zack needs 5, Mark needs 5, Mark
  won, 5–4 now"). No accounts for the players, no confirm, no live updates,
  nothing recorded. It doesn't fit the race engine (which needs two members
  and confirmations), so it's its own small piece, built after the hosted
  race works.
- **No spectators** (more than 2 screens).
- **Registered members only (Ed, 2026-11-03).** An unregistered "Player 1 /
  Player 2" guest comes with tournaments, solved once alongside tournament
  security.
- **No saved friendly stats.** Hosts may later be allowed to keep stats for
  friendly games. For now everything is deleted with the room.

## Key Decisions

- **One race everywhere.** The room launches the existing race engine. It
  doesn't get a casual copy of it. Tournaments and leagues reuse the same race,
  so its rules (linear stack, strict confirm, server-side append) stay as
  decided in the race's resume note.
- **The race stays parent-free; the room points at it.** The race was built so
  that things point *at* a race, never the reverse, and that's what lets a
  tournament reuse it later. So the race tables don't get a `room_id`. A small
  room-owned link (room → race) can meet the room's plug-in contract as it
  stands (room_id cascade, published, full replica identity). The room plan's
  "zero room changes" test may still hold. Planning confirms it, and any room
  change it needs is a room bug, fixed in the room.
- **The finish confirm is the last game's confirm.** In strict mode both
  players already agreed to the winning game, so asking again would be the
  same question twice. Acknowledging a win is a *different* concept from
  confirming a game, so it may come back as a tournament "official result"
  step. It's deferred, not dropped.
- **Setting up the break needs both players. This is an engine change, made
  on purpose.** Today the race's "who breaks first" is one tap by either
  player. It becomes set + confirm, matching how game results work. Because
  there's one race everywhere, this applies to every race (sandbox, and later
  tournaments). That's intended, since a tournament needs the agreement too.
- **Tournament rooms are funded by the paid tier.** They aren't limited by a
  host's 4 house seats. That matters later, not for v1.

## Dependencies / Assumptions

- Both branches are unmerged: `feat/game-room` (gated, awaiting Ed's staging
  review) and `feat/self-scoring-individual-races`. This work needs both.
- Each room screen already knows its member (`member_id`), which is exactly
  what starting a race needs. That's verified in the room's phone rows and in
  `create_race`.
- The race already supports `winner_breaks` and a goal per side, but its
  default break rule is `alternate`, so the room race must pass winner-breaks
  explicitly (or the default changes). Verified in the race migration.
- The race has its own live updates, separate from the room's table list.
  Whether that stays separate or joins the room's subscription is a planning
  question.
- Both race routes are gated `!isProduction`. Adding Race to the room's game
  registry **creates the first door into them**, so the registry entry (and
  therefore the Create Room game list) must be gated the same way (CLAUDE.md
  feature-gating rule).
- **The host gate is out of date.** The room still checks `members.role` in
  (league_operator, developer) (`room_member_is_host`). Main now has the
  **Host** designation and a gated "Become a Host" purchase (`d3c41e7d`,
  `797575e8`). The room doc always intended this swap. Until it happens, a
  plain player can't open the Friends door. The swap is a dependency of v1.
- One member on two devices is two screens (room doc R13). A race needs two
  *different* members, and `create_race` rejects the same player twice.

## Outstanding Questions

### Resolve Before Planning
- *(none blocking)*

### Deferred to Planning
- [Affects R3][Ed, quick] **Game type default.** Not discussed. Assumption:
  8-ball, as a variable like the others. Ed to confirm or change.
- [Affects R1][Technical] The shape of the room → race link. Which phone
  calls `create_race` (so two phones arriving together can't make two races),
  and who is home/away (default: host = home).
- [Affects R12][Technical] How a Friends race (finished or not) is deleted
  when the host deletes its room, without giving the race tables a `room_id`.
- [Affects R11c][Technical] Retiring the daily sweep (`game-room-sweep` cron +
  `sweep_stale_rooms`) and where the room cap is enforced (in `create_room`,
  next to the house-seat check).
- [Affects R6][Technical] Whether race live updates join the room's single
  channel through the link table or keep their own. Either way, the room's
  hidden-tab release and reconnect catch-up must cover the race too.
- [Affects R4][Technical] Set + confirm for the first breaker: what the
  setter sees while waiting, and what happens if the confirmer disagrees.
- [Affects all][Technical] Branch strategy: the race branch and the room
  branch both need to land. Stack, merge or combine.
- [Affects R2][Technical] What the room shows before the second player
  arrives (the coin flip's "invite someone in" pattern is the precedent).

## Next Steps

→ `/ce:plan` for structured implementation planning.
