-- =============================================================================
-- recalculate_points_3man_1_preview.sql  —  PREVIEW the Points 3-Man re-score
-- =============================================================================
--
-- Why this exists
--   Before fix 559959d ("score Points 3-Man against the match's saved
--   targets"), the scoring engine re-derived each match's targets from the
--   locked lineups on every scoring event instead of using the targets saved
--   at match prep. A tiebreaker re-lock could shift them, so some completed
--   matches were stored with wrong points (e.g. a match WIN at −1). The code
--   fix only affects matches scored from now on; this script corrects the
--   points already stored on completed matches.
--
-- The rule applied (per team, per match — same as the app)
--   W = saved games-to-win target, T = saved games-to-tie target (NULL when a
--   tie is impossible), L = T if a tie is possible else W, m = the league's
--   per_extra_game_multiplier (default 1).
--     games won >  W  →  (games won − W) × m        need 12, win 13 → +1
--     L ≤ games ≤ W   →  0                          win 11 or 12   →  0
--     games won <  L  →  (games won − L) × m        win 10         → −1
--   Games counted = regular (non-tiebreaker) games confirmed by BOTH teams.
--
-- What it touches
--   ONLY matches.home_points_earned / away_points_earned, ONLY on matches that:
--     * have status = 'completed'
--     * use the linear_above_threshold calculator in GAMES mode (from the
--       match's system_snapshot when it has one — exactly as the app reads
--       it — else the league's resolved preferences)
--     * have saved win targets for both sides
--     * have stored games-won that agree with the confirmed match_games rows
--       (a disagreement means something else is wrong with that match — it is
--       listed in the preview as needs_review and left alone)
--     * have stored points that differ from the rule
--   Games-won columns, winners, and every other column are never changed.
--
-- How to run (Supabase SQL editor, against the target database)
--   The script is split into three files so you can never apply by accident:
--     recalculate_points_3man_1_preview.sql  ← THIS FILE (read-only)
--     recalculate_points_3man_2_apply.sql    (one transaction: backup + update)
--     recalculate_points_3man_3_undo.sql     (only if you need to roll back)
--   0. Set the season in the `params` block below (or leave NULL for all
--      seasons) — and use the SAME value in the apply file. Find ids with:
--        select id, season_name, start_date from seasons order by start_date desc;
--   1. Run this file. Check the `action` column:
--        will_update  — points will be corrected (old → new shown)
--        needs_review — stored games disagree with match_games; NOT changed
--      Only rows that need action are listed.
--   2. Happy with the preview? Run the apply file.
--   Afterwards, refresh the standings page (it caches for up to 5 minutes).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PREVIEW (read-only)
-- -----------------------------------------------------------------------------
with params as (
  select null::uuid as season_id   -- e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid
),
m as (
  select
    mt.*,
    -- Same source rule as the app (updateMatchRunningTotals): a snapshot
    -- that carries the points_calculator key is authoritative (even when its
    -- value is NULL = "no points"); only a snapshot without it falls back to
    -- the league's resolved preferences.
    case when mt.system_snapshot ? 'points_calculator'
      then mt.system_snapshot->>'points_calculator'
      else rlp.points_calculator end as calc,
    case when mt.system_snapshot ? 'points_calculator'
      then coalesce(mt.system_snapshot->>'win_condition', 'games')
      else coalesce(rlp.win_condition, 'games') end as win_cond,
    coalesce(
      (case when mt.system_snapshot ? 'points_calculator'
         then mt.system_snapshot->'points_calculator_params'
         else rlp.points_calculator_params end
        ->>'per_extra_game_multiplier')::numeric,
      1
    ) as mult
  from matches mt
  join seasons s on s.id = mt.season_id
  left join resolved_league_preferences rlp on rlp.league_id = s.league_id
  cross join params p
  where mt.status = 'completed'
    and (p.season_id is null or mt.season_id = p.season_id)
),
counted as (
  select
    m.id,
    count(mg.id) filter (where mg.winner_team_id = m.home_team_id) as home_g,
    count(mg.id) filter (where mg.winner_team_id = m.away_team_id) as away_g
  from m
  left join match_games mg
    on mg.match_id = m.id
   and not mg.is_tiebreaker
   and mg.confirmed_by_home is not null
   and mg.confirmed_by_away is not null
  group by m.id
),
calc as (
  select
    m.id as match_id,
    m.season_id,
    ht.team_name as home_team,
    at.team_name as away_team,
    wt.team_name as winner,
    m.home_to_win, m.home_to_tie, m.away_to_win, m.away_to_tie,
    m.home_games_won, m.away_games_won,
    c.home_g as home_counted_games, c.away_g as away_counted_games,
    m.home_points_earned as home_old_pts,
    m.away_points_earned as away_old_pts,
    case
      when c.home_g > m.home_to_win then (c.home_g - m.home_to_win) * m.mult
      when c.home_g < coalesce(m.home_to_tie, m.home_to_win)
        then (c.home_g - coalesce(m.home_to_tie, m.home_to_win)) * m.mult
      else 0
    end as home_new_pts,
    case
      when c.away_g > m.away_to_win then (c.away_g - m.away_to_win) * m.mult
      when c.away_g < coalesce(m.away_to_tie, m.away_to_win)
        then (c.away_g - coalesce(m.away_to_tie, m.away_to_win)) * m.mult
      else 0
    end as away_new_pts,
    (m.home_games_won = c.home_g and m.away_games_won = c.away_g) as games_agree
  from m
  join counted c on c.id = m.id
  left join teams ht on ht.id = m.home_team_id
  left join teams at on at.id = m.away_team_id
  left join teams wt on wt.id = m.winner_team_id
  where m.calc = 'linear_above_threshold'
    and m.win_cond = 'games'
    and m.home_to_win is not null
    and m.away_to_win is not null
)
select
  case when games_agree then 'will_update' else 'needs_review' end as action,
  calc.*
from calc
where not games_agree
   or home_old_pts is distinct from home_new_pts
   or away_old_pts is distinct from away_new_pts
order by action desc, home_team;
