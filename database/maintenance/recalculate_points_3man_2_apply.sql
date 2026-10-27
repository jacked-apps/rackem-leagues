-- =============================================================================
-- recalculate_points_3man_2_apply.sql  —  APPLY the Points 3-Man re-score
-- =============================================================================
--
-- Step 2 of 3. Run recalculate_points_3man_1_preview.sql FIRST — that file
-- explains the bug, the points rule, and exactly which matches are touched.
--
-- What this does (one transaction — all or nothing)
--   1. Copies the current points of every match it will change into
--      maintenance.points_recalc_backup.
--   2. Updates ONLY matches.home_points_earned / away_points_earned on those
--      matches. Games won, winners and every other column are never changed.
--   3. Prints what changed.
--
-- Before running: set season_id below to the SAME value used in the preview.
-- To roll back: recalculate_points_3man_3_undo.sql.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- APPLY (one transaction: backup, then update)
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
  select null::uuid as season_id   -- MUST match the preview file
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
