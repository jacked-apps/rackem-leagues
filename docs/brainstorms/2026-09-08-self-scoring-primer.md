# Primer — Self-Scoring for Individual Races (tournaments AND leagues)

> **This is a PRIMER, not the brainstorm.** It exists so a fresh session starts
> from what has already been established rather than rediscovering it. The
> brainstorm's own requirements document is a separate file.
>
> Written 2026-09-08 at the end of the Phase C session, branch
> `feat/tournament-paid-foundation` (PR #275).

---

## What this feature is

`self_scoring` — "Players score their own matches" — one of six premium
tournament features listed in `src/brackets/paid/premiumFeatures.ts`. Its
catalog blurb, already written and shown to organizers:

> Each pair confirms their own winner from their phones — you stop being the
> sole scorekeeper.

**But it is not only a tournament feature.** Ed's framing, and the single most
important constraint on this design:

> "this IS going to be a league option… i believe when we set this up it MUST
> translate to running leagues with individual races."

So the target is **individual-race scoring as a general capability**, used by
tournament brackets first and by leagues that run individual races second. A
design that only works for brackets and gets "ported" to leagues later is the
wrong answer.

---

## Ed's vision, as stated

Captured close to his own words, because the design has to answer these and not
a paraphrase of them.

**How a player knows they are up.** No alerts, no venue/tables (those are
separate premium features not built yet). The signal is the organizer:

> "the organizer makes this 'matchup' In progress. this allows me to click on
> that thing."

**Rules the organizer sets before play.** Defaults are fine, but every
tournament differs:

> "we also need to know winner breaks alternating breaks? these are 'rules'
> that need to be known beforehand that the organizer needs to set. we can have
> defaults but every tournament is different."

> "race to what UN HANDICAPPED would just mean there is no difference to the
> races. i need 5 you need 5 so organizer sets race to 5 winners side race to 3
> loser side? (may also want different 'game' option for winner loser side)
> 8ball winner side 9 ball loser side. etc."

So at minimum: **break format**, **race length per bracket side**, and
**game type per bracket side**.

**Who may score — and the league tie-in.** For v1 it is only the two opponents.
The future extension is the one already discussed for league scoring:

> "many eyes in this scenario is going to be solely the 2 opponents matched up
> … we talked about (in the league scoring) having additional score keepers NOT
> on either team to be allowed to view and or score the match. so this feature
> if we build it here SHOULD translate to that and may really be a good reason
> to build it here."

**How a result is recorded.** Ed corrected an earlier suggestion that each
player keep their own tally — that is not how this app records anything:

> "everyone keeps their own tally is NOT how we record games in this app now is
> it? we have the confirmation system. now one player clicks i won (maybe allow
> the add a break and run stuff golden break stuff later?) the opponent gets the
> popup with the confirm deny thing **there cannot be a discrepency**."

Two sub-cases he notes are **already solved** in league scoring and must be
reused, not rebuilt: both players claiming the win, and accepting the
opponent's scoring.

**Reuse the real room.**

> "i want to use the official league scoring room for these as well."

**The scoreboard is the known-unresolved piece.**

> "scoreboard is a little different too. i dont think the 'game' list thing is
> going to work the same for individual races. well it would work but i dont
> think its ideal."

Why it does not fit: in a league 3v3 the games list shows *different pairs*
playing one game each. In a race to 5 it would show *the same two names* up to
nine times. It renders, but it carries almost no information.

---

## What already exists (verified 2026-09-08)

Do not re-derive these. Each was checked against the code this session.

### 1. Break order is an existing dial with a documented extension point

`src/systems/pairings/stages/breakRackAssignment.ts` — Stage 3 of the Pairings
Generator. Today it has one variant, per-round alternation (home breaks on even
rounds, away on odd). The file's own header anticipates exactly this work:

> "a future 'strict per-game alternation' variant would read `gameNumber % 2`
> instead; swap this function, leave Stages 1 and 2 untouched."

Winner-breaks is therefore **a third variant of an existing dial**, not a new
concept. Ed's point stands: round-robin league play already alternates, and the
system for it is in place.

Related columns already in the database: `match_games.home_action` /
`away_action`, values `'breaks' | 'racks'` (see
`src/utils/match/computeMatchPrepPayload.ts`).

### 2. Race length already exists as a locked Module

`src/systems/match-format/` — the Match Format Module, per the locked blueprint
`docs/league-system/modules/match-format.md`. Two axes:

- `pairingFormat`: `'single_rack' | 'race_to_n'`
- `raceLength`: the N when `race_to_n`, null otherwise

Its docs already name race-tradition scoring systems as the intended consumer.
**It is locked canon** — see the locked-doc rules before proposing changes to
it. It has no break-format axis and no per-side (winners/losers) concept.

### 3. The confirmation machinery is built and in `main`

- `supabase/migrations/20260525000000_game_confirmations.sql` (+ three follow-ups:
  `is_initiator`, `auto_confirmed`, `reason`)
- `src/api/hooks/useGameConfirmations.ts`
- `src/utils/match/pendingConfirmations.ts`
- `src/components/scoring/` — `ConfirmationDialog`, `ConfirmationModal`,
  `DissentFlag`, `DisputeBanner`, `DisputeDetailModal`, `PeekConfirmDialog`,
  `VacateModal`, `MatchEndVerification`

This is the "many eyes" layer and it is what Ed means by the confirmation
system. **Caveat:** `game_confirmations` is keyed on **member ids**, and a
tournament walk-up has no account and no member id.

### 4. The scoring room is team-shaped, not player-shaped

`src/player/ScoreMatch.tsx` — ~1,485 lines, the page Ed calls "the official
league scoring room". It loads `useMatchWithLeagueSettings`, `useMatchLineups`,
`useUserTeamInMatch`, `useTeamDetails` (via `src/hooks/useMatchScoring.ts`), and
carries ~129 references to teams, lineups and positions.

A tournament match is **two individual players, no teams, no lineup**, and one
of them may be a walk-up with no account.

Also present and relevant: `src/components/scoring/UnifiedScoreboard.tsx`,
`GamesList.tsx`, `ScoringDialog.tsx`, `AdaptiveCounter.tsx`.

### 5. The "in progress" flag already exists

The organizer's Start control on a bracket match sets it; it drives the
playing/on-deck legend and is already checked by late entry
(`supabase/migrations/20260907182857_bracket_late_entry.sql`). Ed's "organizer
makes this matchup In progress" needs no new concept — the player's tournament
page watches the flag.

---

## The core open question

**How does a two-individual-players match get into the league scoring room?**
Three shapes were sketched, not decided:

1. **Fake teams-of-one** — give each tournament player a synthetic team so the
   room reads it as a league match. Least code. Writes a lie into the data.
   This is the "kinda fits" shortcut the project has explicitly ruled against.
2. **Extract the shared middle** — pull the confirmation / dissent / dispute /
   vacate machinery out so league and tournaments both sit on it, each with its
   own thin page. Honest data model, more work up front.
3. **Generalize the room** to take "participants + format" instead of "teams +
   lineups". Touches live league scoring.

Option 3 collides with a hard project rule: **the scoring engine must never
break** — live scoring with 36 players mid-match cannot throw.

---

## Other questions the brainstorm should settle

- **Walk-up confirmation.** The catalog blurb already commits to a rule, and
  the organizer picks at setup: *"how a match with an unregistered walk-up is
  scored — trust the registered player's word, or you enter it yourself.
  Registered-vs-registered always self-scores."* Does that survive scrutiny, and
  what happens when **both** players are walk-ups?
- **Who-may-score as data.** Ed wants the future outside-scorekeeper case to
  work in leagues too. Building the confirmer set as an explicit **list of who
  may score this match** (rather than deriving it from "the two teams" or "the
  two opponents") is what makes that a later addition instead of a later
  rewrite. Confirm this is the right shape.
- **Where the rules live.** Break format / race per side / game type per side —
  on the bracket? On a per-match record? A reusable saved setup (Phase D)? Note
  that handicapped races are a *separate* premium feature that should later
  *modify* a race length, not invent one — so unhandicapped self-scoring must
  not depend on the handicap feature.
- **The scoreboard shape** for an individual race. Known unresolved. Do not
  design it before the rules layer is settled — Ed flagged jumping ahead to it
  as going too far.
- **Break-and-run / golden break** — explicitly "maybe later", not v1.

---

## Constraints that apply

- **Live scoring must never break.** Games won/lost are sacred; anything derived
  is recoverable. Bad math logs and bypasses rather than throwing.
- **Rigor over "kinda fits."** Never wrap adjacent code as a shortcut to a spec.
- **Locked docs are policy contracts.** `docs/league-system/**` — including
  `match-format.md` — needs Ed's literal unlock phrase before any edit, per
  change. Design around them or request a specific unlock; do not surface
  "should we follow the protocol?"
- **Respect Module boundaries.** Do not bundle work across different Module
  kinds into one plan just because they share a parent.
- **RLS is intentionally off** until a dedicated pre-launch pass. Not a bug, and
  not a topic for this brainstorm.
- Walk through use cases concretely — that is how Ed thinks through
  architecture. Lean simple; expect each layer to surface the next decision.
- One or two points at a time, plain language, define jargon on first use. Ed is
  a junior developer and is learning. No code blocks in chat.
- Ed is colour blind — never let hue be the only carrier of meaning in any UI
  this produces.

---

## Where things stand

- Branch `feat/tournament-paid-foundation`, PR #275 — Phases A, B and C complete,
  all four CI checks green, awaiting Jack's review. Do not fold this work into it.
- Built premium features: `real_players`, `payment_tracker`. Plus late entry into
  a bye, which Ed made a free bonus with any purchase.
- Not built: `self_scoring`, `handicap_races`, `venue_tables`, `notifications`.
  They are currently selectable and chargeable; Ed has explicitly deferred that
  concern until a real payment processor is wired up.
- Phase D (reusable saved setup, tournaments-run count) is planned but not
  started — it may be where the rules layer wants to live.
- Full context: `docs/plans/2026-09-04-001-feat-tournament-paid-foundation-plan.md`
  and `docs/brainstorms/2026-09-04-tournament-paid-foundation-requirements.md`.
