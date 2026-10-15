# promoteSubToRealPlayer — retroactive sub correction

**One file per step. Open the file, copy all of it, paste, run.** No line
numbers, no scrolling to find a block. Every file is standalone and carries its
own ids.

Only `step2_fix.sql` writes anything. Everything else is read-only and safe to
re-run as often as you like.

## ⚠ Check the project ref first

Three Supabase projects exist and only one is live:

| Ref | What it is |
|---|---|
| `cibboozjixxyypzchtvr` | **LIVE PRODUCTION** (rackemleagues.com). Pinned in `.github/workflows/deploy-production.yml`. |
| `eahlgydddmjebcfiskmz` | staging (`deploy-staging.yml`; the CLI links here) |
| `ouobajkpmqyqtgzcjmql` | stale. Survives only as a commented-out line in the local `.env`, and holds a convincing **copy** of production data. |

Read the ref from the dashboard URL bar. Don't trust `.env` — that is where the
stale ref lives, and because the copy answers every query plausibly, a run
against it looks completely successful right up until the app shows the old
number.

**Ids are per-database.** The uuids baked into these files were resolved against
production. Re-run `step0` and `step1d` in whichever database you are fixing and
use what they return; only assume they carry over if those two hand back the
same values.

## The problem

A roster player was entered into a lineup as an **anonymous substitute**, then
actually showed up and played. The lineup slot holds a sub sentinel UUID instead
of his `members.id`, so every game he played is credited to a fictional
placeholder — and the stats pages drop sentinel rows outright, so he gets
nothing.

The Oct 2026 case: the player wasn't sure he could make a makeup match, so the
captains set the lineup with an anonymous sub. He did make it, nobody knew how
to swap a player mid-match, so they played it out under the sub slot.

## Why this isn't the in-app swap

`swap_player_in_lineup` (migration `20260602000001`) is the in-app tool for this
and it will **refuse this job, correctly**. Two guards block a retroactive fix:

- the match must still be `in_progress` — a played match is `completed`; and
- the outgoing player must have **no completed games** — the sub played them all.

It also only cascades the new player into *unplayed* games and never touches
`winner_player_id`, so even if the guards passed it would leave every win
credited to the sentinel. Don't bend it into this. Running from the SQL editor
keeps the fix with a developer who can read the before-state.

## Requirements before you run step 2

- **The player actually played** the games now credited to the sentinel. This is
  the whole premise — the script rewrites history to match reality, so if he
  didn't play, you are fabricating results.
- **He played at the sub's handicap.** If the handicap was wrong too, stop — see
  "what it doesn't change" below.
- **He is not already in another slot** of the same lineup. `step1` reports this
  as `already_in_lineup`, and `step2` re-checks and aborts. One person cannot
  occupy two slots in one match, and no DB constraint prevents it.

## Order to run

| File | Does | When |
|---|---|---|
| `step0_find_match.sql` | finds the match from team names + date | always first |
| `step1_preview.sql` | the pre-flight check | always, before step 2 |
| `step2_fix.sql` | **the only file that writes** | once step 1 looks right |
| `step3_verify.sql` | every game with names; no sentinel left | right after step 2 |

Diagnostics, for when something doesn't line up:

| File | Answers |
|---|---|
| `step1b_dump_lineups.sql` | both lineups slot by slot, no roster assumption — run when `step1` returns **no rows** |
| `step1c_where_rostered.sql` | every team he's on, and whether the season matches |
| `step1d_auth_to_member.sql` | converts an `auth.users.id` to a `members.id` |
| `step1e_roster.sql` | the roster, to pick out who actually showed up |
| `step4_stats_filter.sql` | whether the match passes the Top Shooters filter at all |
| `step5_per_season.sql` | his totals per season, to catch a page on the wrong season |
| `step6_rebuild_board.sql` | the whole Top Shooters board in SQL, to spot duplicate accounts |

An empty `step1` means the roster lookup failed, **not** that the match is
wrong — it resolves his team *through* `team_players`. That empty result reads
like "wrong match" when it usually means "wrong id." Go to `step1b`.

## What step 2 changes

1. `match_lineups.playerN_id` — the sentinel's slot becomes his `members.id`.
2. `match_games.home_player_id` / `away_player_id` — his side only.
3. `match_games.winner_player_id` — every game the sentinel won becomes his.

That third column is the one that matters. Top Shooters, My Stats, team stats
and Feats are all computed live from those three `match_games` columns (see
`src/api/queries/playerStats.ts`), and they delete sentinel rows. Fix these and
every stats page corrects itself. There is no stats table to backfill.

## What it deliberately doesn't change

- **`match_lineups.playerN_handicap`** — left exactly as entered. If the
  handicap was *also* wrong, stop: it feeds `matches.home_to_win/_to_tie/_to_lose`
  plus the away set, and `home_to_tie` doubles as start-points credit in
  start-points leagues. So a handicap change can move team points and in the
  worst case flip `match_result` / `winner_team_id` and the standings. Much
  larger fix, not this one.
- **`game_confirmations`** — an append-only log of what each scorekeeper vouched
  for at the time, explicitly FK-free ("historical, must not mutate on parent
  delete"). Read only by `useGameConfirmations` for the scoring/dispute UI, never
  by stats, so stale sentinel ids there are harmless on a completed match.
  Rewriting it would falsify the record of what was actually confirmed.
- **`team_players.individual_wins` / `individual_losses`** — these columns exist
  but are dead. Nothing in the scoring path has ever written them.
- **`matches`** — untouched, because the handicap is unchanged, so every
  threshold and point total already computed is still correct.

## Guards in step 2

It refuses rather than guesses when:

- the match or the member can't be resolved;
- **no** sentinel is in his team's lineup (nothing to promote — already fixed?);
- **more than one** slot holds the sentinel. This is reachable:
  `getAnonSubId()` returns the same uuid for every anonymous sub on a side, so a
  5v5 team that fielded two anon subs has one uuid in two slots. Nothing
  distinguishes their games, so it can't be fixed automatically;
- he already occupies a slot.

## No undo

There is no archive row (unlike the placeholder merge). `step1`'s output is the
only before-state record — keep it until `step3` looks right. Reverting means
re-running the swap with the ids reversed by hand.

## A clean step 3 doesn't mean the page updates

Top Shooters counts a game only when its match is `completed` **and both**
`home_team_verified_by` / `away_team_verified_by` are set. A makeup played
off-night is exactly the kind that never collects both captains' verifications,
and an unverified match contributes nothing for *any* player. So the promotion
can be perfect and the page unchanged. `step4` reports the filter flags and his
totals under that same filter, so "data wrong" and "view stale" stop being the
same question.

The app's query cache is in-memory only, so a reload clears it. The service
worker caches Supabase responses (`supabase-api-cache`, NetworkFirst, 24h) and
survives a reload — and unregistering it does **not** release the page it
already controls, so close every tab on the origin. A private window is the
fastest way to rule caching out entirely.
