---
title: 'Game Room — challenge another player to a game'
date: 2026-09-10
status: awaiting-decision
---

# Game Room — challenge another player to a game

A place reached from the profile page where a member picks another member and
challenges them to a game. The coin flip is the first game; the room is built
so a second and third can be added without reopening the plumbing.

## The one decision everything hangs on

**Are the two players standing at the same table, or are they apart?**

The two answers produce genuinely different products, and almost none of the
work is shared:

### Together — one screen, two people

The pool-hall case. Both players are at the table, one phone is held up, they
both watch it. "Inviting" someone means naming who you're playing so the
result says *"Mike wins"* rather than *"tails"*.

This needs no table, no migration, no realtime, and no notification. It is
the coin flip component that already exists, with an opponent picker in front
of it. Buildable in an afternoon.

The weakness: it isn't really an invitation. Nobody is invited — you pick a
name off a list, the way the dev sandbox already does. If that is all this is,
the phrase "challenge him to a game" is doing no work.

### Apart — two screens, one outcome

Player A challenges Player B. B is told, opens it, and both watch the same
flip resolve on their own phones. This is what "invite" and "challenge"
normally mean, and it is the version worth building a room for.

It needs real machinery, described below.

**Recommendation: build for apart.** It subsumes the together case — two
people at one table can still both open it — and it is the only version where
a Game Room is more than a launcher.

## What "apart" requires

### One authority decides the outcome

The important constraint, and the one that is easy to get wrong: if each phone
flips its own coin, the two phones disagree about who won. The outcome has to
be decided **once**, and both devices told.

The natural place is the database: when a challenge is accepted, a function
generates the result and writes it to the row. Both phones then display what
the row says rather than deciding anything.

This is exactly the seam removed from `CoinFlip` on 2026-09-09 — a way to hand
the component a predetermined outcome to display. It was cut because nothing
used it and its only demonstrable use was rigging a flip. This is the caller
that justifies it, and the reason the removal preserved its reasoning rather
than deleting it. It comes back pointed at the server, which is the honest
version: the player cannot influence a result their own device did not
generate.

### A challenge is a row with a lifecycle

`pending → accepted → complete`, with `declined`, `cancelled` and `expired` as
exits. Expiry matters: a challenge nobody answers should not sit in an inbox
forever.

### Both phones must see it change

Realtime, the same way `brackets`, `game_confirmations` and `messages` already
work — add the table to the `supabase_realtime` publication and subscribe to
rows where you are either participant. `useMatchRealtime` is the pattern to
follow, including its connection-health handling.

## What already exists and should be reused

- **Finding a person.** `NewMessageModal` already searches every registered
  member, excludes blocked users and the current user, and offers All / My
  Leagues / My Teams tabs. The opponent picker is that component's problem,
  already solved. This also matches the messaging principle that you can reach
  anyone in-league without storing their contact details.
- **Realtime.** `src/realtime/useMatchRealtime.ts` — subscription lifecycle,
  reconnect handling, and a coarse `live | reconnecting | error` status.
- **The game itself.** `CoinFlip` is finished, tested, and deliberately knows
  nothing about matches or leagues, which is exactly why it can be dropped in
  here unchanged apart from the display seam.
- **Blocking.** `blocked_users` already exists and the picker honours it. A
  blocked member must not be able to challenge you.

## Open question: does a challenge reach them when the app is closed?

Push notifications ship, but `push_type_policy` has only `direct` enabled in
production — team chat, captains chat, announcements and match chat are all
off. So a challenge either:

- rides on a direct message (works in production today, costs nothing), or
- becomes its own push kind (more honest, more work, and a new thing for a
  member to have to mute).

Riding on direct messaging is the cheaper first answer and can be revisited.

## Deliberately out of scope for a first cut

- More than two players.
- A game with turns. A coin flip resolves in one step; anything turn-based
  (and most real games are) needs a move log and a whose-turn-is-it rule,
  which is a different and much larger design.
- Stakes, scores, history, rematches, or a leaderboard.
- Spectators.

## Why this is worth building beyond the coin flip

Two members settling something between themselves — who breaks, who racks, who
buys — is the same shape as most of what a league argues about. A room that
can host one two-player decision can host the next one, and the coin flip is
the cheapest possible first tenant to prove the plumbing with.
