# Unit 0 — a league night, walked against the designed race

> **Status:** complete. Prose only, no code. This is the output of Unit 0 of
> `2026-09-09-001-feat-self-scoring-individual-races-plan.md`, run **before** any
> migration exists so that what it finds is still free to change.
>
> **Verdict up front:** the race survives the league night. The loop, the confirm
> flow and the three tables need **no second implementation** — R32 passes. But the
> walk found **one hard blocker outside the race** (the league cannot express a
> five-race night at all today), **two schema additions** the plan does not have,
> and **one place where an existing write path must widen**. All four are below,
> with what they change.

---

## 0. How this was run

The method was deliberately literal: take one real Tuesday, start at "the captain
opens the app" and end at "the standings move," and at every step name the row that
gets written. Where the designed race had no row for something that happens, that is
a gap. Where the league already has a row and the race would write a second one, that
is a rival source of truth — the thing the project's canon rules against.

The league walked is the realistic race format, not a hypothetical: **five players a
side, each player plays exactly one opponent, each pairing a race to 5**, with the
race length adjusted per pairing by handicap. This is the shape Ed described and the
shape R32 and the requirements' own success criteria name ("a league night of five
individual races").

Three documents were treated as fixed and read as the authority rather than the code:
the locked **Match Format** and **Team Geometry** module docs, and the requirements.
Where the code and a locked doc disagreed, the disagreement is reported, not resolved.

---

## 1. The night, step by step

### 1.1 Before anyone arrives — where the race length comes from

The league's preferences already carry `pairing_format = 'race_to_n'` and
`race_length = 5`. That is **Match Format**, season-stable and locked. If the active
handicap mechanism is `race_length_adjustment`, the mechanism reads its threshold
chart and turns that one baseline into a **per-pairing pair of goals** — stronger
player races to 5 + δ, weaker to 5 − δ.

This is the whole answer to the plan's second question, and it is a clean one: **a
league race's two goals are the Handicap Mechanism's output, anchored on Match
Format's `race_length`.** The race is stamped with the two numbers at creation and
never asks again, exactly as R1 requires.

What must **not** happen is the league reading the bracket's per-side race-length
columns. Those columns are Unit 2's, they live on `brackets`, and they exist because a
tournament has no league preferences to read. A league that read them would give race
length two owners. The rule to write into Unit 2's migration comments: *the per-side
race length on `brackets` is the tournament's substitute for Match Format, never a
supplement to it.*

### 1.2 The captains submit lineups — and the night cannot be built

Five home players, five away players, each at positions 1–5. The captains expect five
pairings: 1v1, 2v2, 3v3, 4v4, 5v5.

**The app cannot produce that.** `game_generation` has exactly two values,
`single_round_robin` and `double_round_robin`, and the game count is
`lineup_size² × multiplier` (`src/systems/team-geometry/index.ts:42`). Five players a
side gives **25 pairings or 50**, never 5. There is no third value, and the locked
Team Geometry doc is explicit that the two round-robin rules are the whole axis today.

This is the blocker, and it is not a race problem — the race would work fine 25 times.
It is that **the individual-race league format Ed described does not exist in Team
Geometry**, and no amount of race work creates it. Twenty-five races to 5 is, in the
locked Match Format doc's own words, "an unrealistic single night."

The good news is that the locked doc already names the extension point: *"Power-of-two
bracket play, Swiss pairing, and other non-round-robin schemes belong in separate
`game_generation` variants if introduced."* So the fix is a **third variant** — every
player plays the opponent at their own position, game count = `lineup_size` — plus the
`computeGameCount` formula ceasing to be `lineupSize²`. Both changes land inside the
Module that owns them, which is the correct shape.

Two consequences worth having in writing before anyone builds it:

- It is a **locked-doc change** in Team Geometry, so it needs Ed's gate phrase for
  that change specifically. It is not something to slip into a race migration.
- `game_generation` is **season-stable** — locked at the DB layer for the season. A
  league cannot become an individual-race league mid-season, which is correct and
  worth telling the operator plainly rather than letting them discover it.

For the rest of this walk, assume that variant exists and the night has five pairings.

### 1.3 The match is prepped — and the pairing rows are born

`prep_match` flips the match to `in_progress`, stamps `started_at`, writes the
thresholds, and **inserts every `match_games` row for the night up front** from the
generated pairing list
(`supabase/migrations/20260504000000_harden_prep_match_write_guards.sql:79`). Five
pairings, five rows, each carrying its two player ids, the two positions, and a
break/rack assignment — all with no winner yet.

This is the single most important thing the walk found, and it is a **fit, not a gap**:

> **A league race night creates the same five `match_games` rows a single-rack night
> would. The race lives *inside* one of those rows. The racks inside the race are not
> `match_games` rows and never become any.**

That is not an invention to make the design work — it is what the locked Match Format
doc already says: *"Each pairing still contributes one game-won to the team count (the
pairing's overall winner); the racks inside the race are pairing-internal events that
don't independently count toward team totals."*

There is an apparent contradiction with R2 ("a game that was never played must never
exist as a row") that is worth defusing now so nobody later "fixes" the pre-creation.
R2 governs **racks** (`race_games`), where a pre-created row would be a lie about
something that never happened. The pairing row is not a game that was or wasn't
played — it is the **slot** that says these two people are scheduled to meet, which is
true the moment the lineups lock. Two levels, two rules, no conflict.

The break/rack assignment on the pairing row does become close to meaningless, since a
race's break order is governed by its own break rule after R6's opening tap. Treat it
as the first rack's assignment and ignore it thereafter; it is not worth a schema
change.

### 1.4 The five races open

Each pairing row now needs to point at a race. Per R7 the race does not know what it
belongs to, so the pointer goes the other way: **a nullable `race_id` on
`match_games`**, exactly mirroring the bracket's `race_id` on `bracket_matches`. One
column, one FK, null for every single-rack league that ever runs. Standings code that
ignores it sees today's world unchanged.

The race is created when the pairing starts — the league's equivalent of the
tournament's "a match going in progress is what creates its race." Its two sides are
**member ids**, which is already one of the two participant shapes Unit 2 designs
(member id *or* bracket participant id, exactly one per side). The league needs no new
participant kind.

Someone taps who breaks first (R6), and the night is under way on five tables at once.

### 1.5 Scoring a rack

Nothing here is new, which is the point. Two league players are both registered
members, so R13 applies: both are on the scoring list, both must agree, and the
confirm loop is the one that already exists. `race_confirmations.side` carries the
literal `'home'` / `'away'` — and in a league those words finally mean what they say,
since the sides *are* the home and away teams. The trap Unit 2 flags (a participant
uuid in `side` silently disabling `deriveDissents`) does not arise on the league path
at all.

The list is stamped at creation from the two members. The neutral scorekeeper R17
wants is an **additional row on the same list**, not a redesign: the race's scoring
list is a child table precisely so it can hold someone on neither side. In a league
that person is usually a benched teammate or the opposing captain, and they are a
member like anyone else. Nothing about the loop changes; the list is simply three
names long and any of the three may enter a rack. Whether the two players must still
confirm a scorekeeper's entry is a policy question, not a structural one, and it maps
onto the same three-position shape as R26 rather than needing its own.

### 1.6 A race finishes — and the pairing row is filled in

Player 3 reaches her goal. The race announces (R4, R11) — it does not act.

What listens, in a league, is a write that fills in the pairing's `match_games` row:
the winner's player id, the winning team id, and nothing else that the row does not
already have. Then the existing `updateMatchRunningTotals` recomputes
`home_games_won` / `away_games_won` / the points columns from the full set of confirmed
`match_games` rows, exactly as it does after every single-rack score today
(`src/hooks/useMatchScoringMutations.ts:391`).

This resolves the contradiction the plan flagged in its sixth question — R33 calling
the league gap "read-side only" while R9 forbids touching the live write path. **Both
are true, because the race is a new *caller* of the existing write shape, not a change
to it.** The `match_games` update is the same update the scoring mutation performs;
what differs is who triggers it and when. R9's constraint is that the path's shape and
behavior do not change, and it does not.

The read-side work R33 names is real but narrower than it sounded: **team standings
need no change at all**, because they read `match_games`, and the pairing rows are all
there. Only **rack-level individual stats** — how many racks a player actually won
across a season — need to read `race_games`. That is genuinely additive and cannot
take live scoring down.

### 1.7 End of night

`allGamesComplete` is `completedGames === totalGames` over the `match_games` rows in
the database (`src/player/ScoreMatch.tsx:351`). Five rows, five winners, and the
end-of-night verification screen appears on both captains' phones exactly as it does
after 25 single racks. Both verify, `MatchEndVerification` writes `winner_team_id`,
`match_result`, `completed_at` and `status = 'completed'`, and the night is over.

Worth noting in passing: five pairings is an odd game count, so this format cannot
produce a team tie and never reaches the tiebreaker path. A four-a-side individual-race
league could, and would inherit the known even-game triple-tie gap — not this plan's
problem, but the same gap, not a new one.

---

## 2. The six questions, answered

**1. Which seat holds a placeholder player?**
The member seat. A placeholder is a `members` row with `user_id IS NULL`
(`src/types/member.ts:21`), so it fits the race's member-id side with no new shape.
What it cannot do is **confirm** — there is no phone. That makes a placeholder the
league's exact analogue of the tournament's category-C player, and it means the
single-player scoring policy (R26) is not tournament-only: a league race against a
placeholder is a one-identity race and needs the same three positions. The one
difference is who "the organizer" is at 8pm on a Tuesday — there is no operator at the
table, so the role falls to the opposing player or the captain. That is a naming and
routing question for the league build, not a structural one; the list already holds
whoever it is told to hold.

**2. Where do a league race's per-side goals come from?**
Match Format's `race_length`, adjusted per pairing by the Handicap Mechanism. See §1.1.
The bracket's per-side columns are the tournament's substitute for Match Format and
must never be read by a league.

**3. Where does R17's neutral scorekeeper sit?**
A third row on the race's scoring list. See §1.5. No redesign, and the league is the
reason the list is a child table rather than two columns.

**4. How does a league forfeit end a race?**
The plan suspected a fifth status and it is right. The four designed statuses are
`created | in_play | finished | abandoned`, and a league forfeit is none of them: it is
*ended without play, with a result*, which is the opposite of `abandoned`. A tournament
can treat a departure as "simply gone" because nothing downstream needs a row. A league
cannot — the forfeit is a recorded result that credits games, moves standings, and may
carry dues and handicap consequences.

The fit is cleaner than it first looks, because the league already has the vocabulary
one level up: `match_games.win_by_forfeit`. So:

- The **race** gets a terminal `forfeited` status naming the side that receives the
  win. It materialises **no** `race_games` rows for racks nobody played — R2 holds, and
  the racks that *were* played before the walkout stay, because they really happened.
- The **pairing row** records the winner with `win_by_forfeit = true`, which is exactly
  what a forfeited single-rack pairing records today. Standings, running totals and
  end-of-night verification all keep working with no knowledge of races.

The credited-games math therefore lives at the pairing level where it already lives,
not inside the race. The race's job is to stop and say who won and why.

**5. What does a substitution do to a seat?**
This is the one place an existing write path must widen, and the reason is precise.
`swap_player_in_lineup` cascades the incoming player into that team's **unplayed**
games only — `winner_player_id IS NULL` — and played games keep the original player
(`supabase/migrations/20260602000001_swap_player_in_lineup_rpc.sql:117`). Under single
rack that rule is total, because a pairing is one game and is therefore either played
or not.

A race breaks the dichotomy: a pairing can be **half-played**, sitting at 2–2 when the
captain wants to sub. The `match_games` row has no winner, so today's cascade would
happily rewrite the player id underneath a race that is already two racks deep, while
R1 stamps the race's participants at creation and no transition changes them. The row
would then name one player and the race another.

The answer that costs least and lies least: **a race that has started is played, for
swap purposes.** The cascade's condition widens from "no winner yet" to "no winner yet
**and** no race in progress" — a race still at `created` is substitutable, a race at
`in_play` is not. That preserves the existing rule's intent exactly (you cannot sub out
of something already happening) and needs no new race capability. It is an additive
widening of one WHERE clause, which is what R9 permits.

The alternatives are worse and should be recorded as rejected: mutating the race's
participants violates R1 and rewrites history mid-loop; abandon-and-recreate strands the
racks already played, which the plan already rejected.

A captain who genuinely must sub mid-race is in the same position as one who must sub
mid-rack today — it is a house-rules conversation, and the app's honest answer is that
the race finishes with the player who started it or it is forfeited.

**6. What marks the parent `matches` row complete?**
The same thing that marks it complete today: every `match_games` row having a winner.
The rows exist because `prep_match` creates them for every pairing. See §1.6 for why
this makes R33 and R9 compatible rather than contradictory.

---

## 3. What changes as a result

Cheap now, expensive later — which is why this ran first.

**Blocking, and outside this plan:**

1. **A third `game_generation` variant** (each player plays the opponent at their
   position; game count = `lineup_size`) plus the `computeGameCount` formula change.
   Locked Team Geometry doc — needs Ed's gate phrase for that change. **Without it
   there is no five-race league night to score**, so no amount of race work delivers
   R32's acceptance test end to end.

**Schema additions the plan does not currently have:**

2. **`match_games.race_id`** — nullable FK, the league's pointer at its race, mirroring
   `bracket_matches.race_id`. Null for every league that runs today.
3. **A `forfeited` race status** carrying the winning side — a fifth status, as
   suspected. Add it in Unit 2 rather than migrating it in later; the tournament can
   ignore it, and adding a status value to a live CHECK constraint later is a migration
   that a column comment could have avoided.

**Existing behavior that must widen:**

4. **`swap_player_in_lineup`'s cascade condition** — "unplayed" becomes "unplayed and
   not in a started race." Additive, one clause, one test.

**Documentation, in Unit 2's comments:**

5. The per-side race length on `brackets` is the tournament's **substitute** for Match
   Format, never a supplement. A league reads Match Format.
6. Pairing rows are pre-created; rack rows are not. Both rules are correct, and they
   govern different levels.

---

## 4. Handed back to Ed

Only one of these needs an answer before the build continues, and it is not urgent —
none of it blocks Units 1 through 7.

- **The Team Geometry variant.** It is a locked-doc change, the format Ed described
  cannot exist without it, and it is the natural moment to decide whether individual-race
  leagues ship at all in this pass or the race proves itself in tournaments first. The
  plan's own sequencing ("tournaments, then leagues") suggests the latter, in which case
  this is a recorded prerequisite rather than work.
- **Who plays "the organizer" in a league one-identity race** (§2.1) — the opponent, the
  captain, or the operator after the fact. Product question, not structural; the list
  holds whoever it is told to.

---

## 5. Verdict against R32

> *"The same race, unchanged, must serve a league night of N individual races. This is
> the acceptance test for the whole design: if the league case needs a second
> implementation of the loop or the confirm flow, the design failed."*

**Passed.** The loop, the append rule, the confirm flow, the vacate semantics, the
scoring list and all three tables serve the league night without a second
implementation. The league needs one pointer column, one extra status, one widened
WHERE clause, and a variant in a Module that is not part of this design at all.

The one thing the walk disproves is a smaller claim than R32: not that the race fails a
league, but that **the league is not currently able to hold the night Ed described** —
for reasons that predate this feature and live one Module away.

---

## Sources

- `docs/brainstorms/2026-09-09-self-scoring-requirements.md` — R1–R47
- `docs/plans/2026-09-09-001-feat-self-scoring-individual-races-plan.md` — Unit 0's six questions
- `docs/league-system/modules/match-format.md` (locked) — race length ownership
- `docs/league-system/modules/team-geometry.md` (locked) — the game-generation axis
- `supabase/migrations/20260504000000_harden_prep_match_write_guards.sql` — pairing-row pre-creation
- `supabase/migrations/20260602000001_swap_player_in_lineup_rpc.sql` — the swap cascade
- `src/systems/team-geometry/index.ts`, `src/player/ScoreMatch.tsx`, `src/hooks/useMatchScoringMutations.ts`, `src/components/scoring/MatchEndVerification.tsx`
