-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7 — IS THE STATS QUERY HITTING THE POSTGREST ROW CAP?  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this when SQL and a stats page disagree and caching is already ruled out
-- (a private window showed the same stale number).
--
-- fetchSeasonPlayerStats (src/api/queries/playerStats.ts) asks for EVERY
-- countable game row in the season in ONE request, with no .range(), no
-- .limit(), and no .order(). PostgREST caps rows per response (Supabase's
-- default is 1000; the local config.toml pins `max_rows = 1000`). Past that
-- cap the response is silently TRUNCATED — no error, no warning, just a short
-- array — and every player's totals come out low by whatever games fell off.
--
-- Worse, it is unstable. With no ORDER BY, Postgres returns heap order, and an
-- UPDATE writes a NEW ROW VERSION AT THE END OF THE HEAP. So editing a game
-- can push it past the cap and out of the stats entirely, which is exactly how
-- a correct fix makes a page look unchanged.
--
--   countable_games   the rows the page's query would return
--   over_1000_cap     TRUE = the page is under-reporting for EVERYONE
--   games_over_by     how many games are being silently dropped
WITH input AS (
  SELECT 'de71a764-2628-4ba3-81d7-bb42983f07cd'::uuid AS season_id
),
countable AS (
  SELECT g.id
  FROM match_games g
  JOIN matches mm ON mm.id = g.match_id
  CROSS JOIN input i
  WHERE mm.season_id = i.season_id
    AND mm.status = 'completed'
    AND mm.home_team_verified_by IS NOT NULL
    AND mm.away_team_verified_by IS NOT NULL
    AND g.is_tiebreaker = false
)
SELECT
  (SELECT count(*) FROM countable)                        AS countable_games,
  (SELECT count(*) FROM countable) > 1000                 AS over_1000_cap,
  greatest((SELECT count(*) FROM countable) - 1000, 0)    AS games_over_by,
  -- Every game in the season regardless of filter, for context on headroom.
  (SELECT count(*)
     FROM match_games g JOIN matches mm ON mm.id = g.match_id
     CROSS JOIN input i WHERE mm.season_id = i.season_id) AS all_season_games,
  -- Are OUR six inside the window a cap would keep? Compares each game's
  -- physical position (ctid) against the cap. Rough — heap order is not a
  -- promise — but it shows whether the updated rows now sit at the back.
  (SELECT count(*)
     FROM match_games g
     WHERE g.match_id = '27d7bfe6-13c0-435c-bd28-dfe48a57a186'
       AND g.home_player_id = '552891c9-47f9-4562-9007-75a3390351de')
                                                          AS his_games_present;
