# Resume here — individual races

> Rewritten 2026-09-16. **The race is built.** It is waiting on one thing: the
> game room that launches it. Read this, then go straight to §5.

## 1. Where we are in one line

**Schema, engine and room are built, tested and committed** on
`feat/self-scoring-individual-races`, rebased onto main. Nothing is merged.
Two people can already play and score a race end to end today — see §3.

## 2. Scope, restated (Ed, 2026-09-10)

**This is tournaments only.** The league is NOT "the race, five times": its
lineup sequencing, its scoring and its matchups (which are not predetermined)
are each far larger than a race and are their own effort. Do not pull league
schema or league flows into this branch.

The only league obligation while building here: **the race must not be built in
a shape a league could never reuse.** That is honoured and is worth not
undoing — see §6.

## 3. How to run it right now

Two people must be signed in — two accounts in two browsers works. Locally that
is `operator@test.com` (shows as **Op**) and `shodbyed@gmail.com` (**Ed**).

1. One of them opens **`/race/new`** — pick the opponent, a target EACH, the
   break rule, the game type, Start.
2. That lands them in the race. Send the other person the same URL.
3. Tap who breaks. Then tap whoever won each game.

Nothing counts until the other person agrees, and the next game does not appear
until then either. **Reverse** shows on exactly one row — the last game played.

Both routes are gated `!isProduction`. Nothing links to them, so there is no
door to gate alongside them — **when the game room adds one, it needs the same
guard** until this un-gates. Logged in `LIST_FOR_ED.md`.

## 4. What exists

**Database** — `supabase/migrations/20260910175307_races_sandbox.sql`
- `races` — the two players, a goal EACH, break rule, game type, status, who
  breaks first. No parent pointer: a bracket match or a league pairing points AT
  a race, never the reverse.
- `race_games` — one row per game actually played. Appended, never pre-created.
- `race_confirmations` — the many-eyes record, mirroring `game_confirmations`.
- All three are SELECT-only for the browser. Writes go through the RPCs.

**Engine** — `supabase/migrations/20260910181344_race_engine.sql`
`create_race`, `start_race`, `record_race_game`, `confirm_race_game`,
`vacate_race_game`, plus internal `race_advance` / `race_standing` /
`race_breaker_side` / `race_side_of`.

**Room** — `src/race/`
`ScoreRace.tsx` (the room), `RaceScoreboard`, `RaceGamesList`,
`FirstBreakerPrompt`, `useRaceView`, `useRaceData`, `useRaceActions`,
`ScoreRacePage` (route wrapper), `StartRacePage` (**disposable**, see §5).

**Tests** — 44 db (`race.schema` + `race.engine`), 7 component
(`src/race/__tests__/RaceGamesList.test.tsx`). All green, build clean.

## 5. THE NEXT ACTION — wiring the game room

This is the whole remaining job, and it is small by design.

**The room is a component that takes a race id.** It is not a page that finds
one. So the game room hosts it directly:

```
<ScoreRace raceId={id} />
```

It also accepts optional `names={{ home, away }}` when the host already knows
what to call the two people — a league would pass nicknames from its lineup.
Given nothing, it looks them up itself.

**`create_race` is the seam.** Once the game room has two people together, it
calls `create_race(home_member_id, away_member_id, goal_home, goal_away,
break_rule, game_type)` and gets back `{ ok, race_id }`. The caller must be one
of the two players.

So the wiring is: game room knows the two people → calls `create_race` → renders
`<ScoreRace raceId={...} />` (or navigates both to `/race/:raceId`).

**`/race/new` (`StartRacePage.tsx`) is disposable.** It exists only so a race
could be played before the game room existed. It calls the same `create_race`.
Delete it when the room lands, or keep it as a dev entrance — nothing else
depends on it.

**Also when the room lands:** the coin flip (merged in main, PR #279) and the
race are siblings in that room. A coin flip is the natural way to settle who
breaks first — `start_race(race_id, 'home' | 'away')` takes that answer.

## 6. Decisions — do not re-litigate

- **A race is LINEAR.** Both players are at one table the whole time, so games
  cannot be played or entered out of order. A result goes only on the earliest
  unsettled game; a wipe comes only off the LAST game with a result. To fix game
  3 of 5 you reverse 5, then 4, then 3. (The round-robin reason for out-of-order
  scoring — someone is in the bathroom and must not stall 24 other games — does
  not exist here.)
- **A goal EACH, not one shared number.** Equal is the ordinary race; unequal is
  the handicap. Nothing else about the race differs between them, which is why
  they are two plain columns and not a handicap feature.
- **`race_games` mirrors `match_games` column-for-column** — including a NULL
  `winner_team_id`. That is what lets the existing `ScoringDialog` /
  `ConfirmationDialog` / `deriveDissents` read a race with no shim, and what
  would let a league adopt races without a second scoring implementation. When
  main adds a scoring field (it added **early 8** on 2026-09-15), mirror it here
  and thread it through — that is the mirroring working, not extra work.
- **The append is server-side**, inside the transaction of the confirmation that
  satisfied the gate, under `FOR UPDATE` on the race row. Both phones hit the
  gate at the same instant; a client-side append writes two game 6s.
- **Changing a result clears the opponent's agreement.** They agreed to the old
  result. You may retype freely until they agree; after that it takes a
  reversal.
- **Advance policy default: automatic**, with confirm and manual kept as the
  organizer's dial. (Not yet built — that is bracket integration, Unit 7/8 of
  the plan, and not needed for the game room.)
- **The room derives nothing about identity.** It is handed the two names and
  their sides. Whoever hosts a race resolves them — bracket seats, a lineup, or
  a game room. Keep it that way; it is the reason a league can reuse this.

## 7. Local environment notes

- The race migrations were applied BEFORE main's `20260905225925` (which is
  dated earlier), so `supabase migration up` needs `--include-all` on this
  machine. A fresh database applies everything in date order and is fine.
- **18 db test files fail locally** — none of them race. They want the dev seed
  (`database/dev_starting_point.sql`), which this machine does not have. CI
  loads it, so they pass there. That seed is DESTRUCTIVE (deletes members, auth
  users, matches, seasons) — do not load it without asking Ed.
- After any migration touching the realtime publication, run
  `supabase stop && supabase start`, or the realtime container serves the old
  schema and the symptom looks like an app bug.

## 8. The rest of the plan, not started

`docs/plans/2026-09-09-001-feat-self-scoring-individual-races-plan.md` still has
the tournament half: the late-entry fix (**done separately — PR #284**), QR
claim tickets, Validate, bracket integration, the Scoring tab, player entry.
None of it is needed for the game room.

`docs/plans/2026-09-09-002-league-race-walkthrough.md` is a **parked league
reference** — notes to a future league brainstorm, not scope, and nothing here
depends on it.
