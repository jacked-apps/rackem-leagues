-- =============================================================================
-- recalculate_points_3man.sql  —  re-score stored match points (Points 3-Man)
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
--       listed in STEP 1 as needs_review and left alone)
--     * have stored points that differ from the rule
--   Games-won columns, winners, and every other column are never changed.
--
-- How to run (Supabase SQL editor, against the target database)
--   0. Set the season in EVERY `params` block below (or leave NULL for all
--      seasons). Find ids with:
--        select id, season_name, start_date from seasons order by start_date desc;
--   1. Run STEP 1 (read-only preview). Check the `action` column:
--        will_update  — points will be corrected (old → new shown)
--        needs_review — stored games disagree with match_games; NOT changed
--      Only rows that need action are listed.
--   2. Run STEP 2 (one transaction). It first copies the current values of
--      every row it will change into maintenance.points_recalc_backup, then
--      updates them, then prints what changed.
--   3. Only if you need to roll back: run STEP 3 (restores the latest run).
--   Afterwards, refresh the standings page (it caches for up to 5 minutes).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- STEP 1 — PREVIEW (read-only)
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


-- -----------------------------------------------------------------------------
-- STEP 2 — APPLY (one transaction: backup, then update)
-- -----------------------------------------------------------------------------
begin;

-- Backup lives in its own schema so PostgREST (public schema only) never
-- exposes it to the app's API.
create schema if not exists maintenance;
create table if not exists maintenance.points_recalc_backup (
  run_at              timestamptz not null,
  match_id            uuid        not null,
  home_points_earned  numeric     not null,
  away_points_earned  numeric     not null,
  new_home_points     numeric     not null,
  new_away_points     numeric     not null,
  primary key (run_at, match_id)
);

insert into maintenance.points_recalc_backup
  (run_at, match_id, home_points_earned, away_points_earned, new_home_points, new_away_points)
with params as (
  select null::uuid as season_id   -- MUST match STEP 1
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
    end as away_new_pts
  from m
  join counted c on c.id = m.id
  where m.calc = 'linear_above_threshold'
    and m.win_cond = 'games'
    and m.home_to_win is not null
    and m.away_to_win is not null
    -- Leave matches whose stored games disagree with match_games alone.
    and m.home_games_won = c.home_g
    and m.away_games_won = c.away_g
)
select now(), match_id, home_old_pts, away_old_pts, home_new_pts, away_new_pts
from calc
where home_old_pts is distinct from home_new_pts
   or away_old_pts is distinct from away_new_pts;

-- Apply exactly the rows just backed up in this run (now() is constant
-- within a transaction, so run_at = now() selects this run only).
update matches mt
set home_points_earned = b.new_home_points,
    away_points_earned = b.new_away_points
from maintenance.points_recalc_backup b
where b.run_at = now()
  and b.match_id = mt.id;

-- What changed in this run.
select b.match_id, ht.team_name as home_team, at.team_name as away_team,
       b.home_points_earned as home_old, b.new_home_points as home_new,
       b.away_points_earned as away_old, b.new_away_points as away_new
from maintenance.points_recalc_backup b
join matches mt on mt.id = b.match_id
left join teams ht on ht.id = mt.home_team_id
left join teams at on at.id = mt.away_team_id
where b.run_at = now()
order by home_team;

commit;


-- -----------------------------------------------------------------------------
-- STEP 3 — UNDO (only if needed): restore the most recent run's old values
-- -----------------------------------------------------------------------------
-- begin;
-- update matches mt
-- set home_points_earned = b.home_points_earned,
--     away_points_earned = b.away_points_earned
-- from maintenance.points_recalc_backup b
-- where b.run_at = (select max(run_at) from maintenance.points_recalc_backup)
--   and b.match_id = mt.id;
-- delete from maintenance.points_recalc_backup
-- where run_at = (select max(run_at) from maintenance.points_recalc_backup);
-- commit;
