---
title: 'Game Room — two players decide something between themselves'
date: 2026-09-10
status: settled
---

# Game Room — two players decide something between themselves

A room reached from the profile page where a member challenges another member
to settle something. The first question it settles is **who breaks**, and the
coin flip is how it settles it.

Two players, two devices, one outcome. Not a pass-the-phone toy.

## The model: this is the scoring page's confirmation flow

The app already has a proven answer for "two people must agree about a thing
that just happened", and it is the live scoring page. The Game Room copies it
rather than inventing a second vocabulary for the same idea.

How scoring does it:

| Scoring | Game Room |
|---|---|
| One side reports a game result | One side proposes a challenge |
| It appears on the opponent's device and asks them to confirm | It appears on the opponent's device and asks them to accept |
| `confirmed_by_home` / `confirmed_by_away` — a column per side | `accepted_by` / acknowledgement per side |
| Official only when BOTH are filled | Settled only when BOTH have acknowledged |
| `vacate_requested_by` — either side asks to undo, the other must agree | `redo_requested_by` — either side asks to re-flip, the other must agree |
| `game_confirmations` — append-only record of every vouch | append-only record of every step |
| Realtime pushes the ask to the other device | Realtime pushes the ask to the other device |

Same shape, same guarantees, and a player who has scored a match already knows
how to use it.

## The flow

1. **Propose.** A picks B and proposes a coin flip for the break. Proposing is
   A's half of the agreement — nobody has to confirm their own challenge.
2. **The ask arrives.** B's device shows it, the way an opponent's score
   arrives during scoring. Accept or decline.
3. **The coin is thrown once.** On acceptance the **database** decides the
   result and writes it. Both devices display what the row says.
4. **Both acknowledge.** Each player taps to say they saw it. Only when both
   have is it settled — the same "official when both sides are filled" rule
   scoring uses.
5. **Either side may ask for a re-flip**, and the other must agree, exactly as
   a vacate works during scoring.

## Why the database throws the coin

The one thing that cannot be got wrong: **if each phone flips its own coin,
the two phones disagree about who won.** The outcome is decided once, by the
one participant neither player controls, and both devices are told.

This is the seam removed from `CoinFlip` on 2026-09-09 — a way to hand the
component a predetermined result to display. It was cut because nothing used
it and its only demonstrable use was rigging a flip. This is the caller that
justifies it, and it comes back pointed at the server, which is the version a
player cannot lean on. The component keeps knowing nothing: it is handed an
outcome and animates it.

## What already exists and is reused, not rebuilt

- **The opponent picker.** `NewMessageModal` already searches every registered
  member, excludes blocked users and yourself, and offers All / My Leagues /
  My Teams. Challenging someone is that component with a different verb.
- **Realtime.** `useMatchRealtime` — subscription lifecycle, reconnect
  handling, and a `live | reconnecting | error` status the UI can show.
  `brackets`, `messages` and `game_confirmations` are already on the
  publication; the challenge table joins them.
- **The confirmation UI.** `ConfirmationDialog` is deliberately dumb — it
  renders what it is given and delegates every decision to its caller. A
  challenge ask is another thing to hand it.
- **The coin flip.** Finished and tested, and knows nothing about leagues or
  matches, which is exactly why it drops in here unchanged apart from being
  handed its result.
- **Blocking.** `blocked_users` exists and the picker honours it. A blocked
  member cannot challenge you.

## Reaching someone who isn't looking

`push_type_policy` has only `direct` enabled in production. A challenge
therefore rides on a direct message for now, which works today and costs
nothing. Its own push kind is a later refinement, and a later thing for a
member to have to mute.

## Deliberately out of scope

- More than two players.
- Anything turn-based. A coin flip resolves in one step; a game with turns
  needs a move log and a whose-turn-is-it rule, which is a different and much
  larger design. The room is built for one-step decisions first.
- Stakes, scores, history, rematches, leaderboards, spectators.

## Why it is worth more than the coin flip

Two members settling something between themselves — who breaks, who racks, who
buys — is the shape of most of what a league argues about. A room that can
host one two-player decision can host the next one. The coin flip is the
cheapest possible first tenant to prove the plumbing.
