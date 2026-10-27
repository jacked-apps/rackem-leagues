-- =============================================================================
-- diagnose_standings_points.sql  —  READ-ONLY diagnostic (changes nothing)
-- =============================================================================
--
-- Purpose
--   Standings show every team with negative points, including teams with
--   strong winning records. This script checks, match by match, whether the
--   points STORED on each completed match agree with the league's points rule
--   applied to that match's own saved targets and its confirmed games.
--
-- The rule being checked (per team, per match)
--   par = that team's games-to-tie target when a tie is possible, else its
--   games-to-win target (the league scoresheet's rule).
--     points = games won − par
--   Tie target 9 / win 10: 10–8 → +1 / −1, 12–6 → +3 / −3, 9–9 → 0 / 0.
--   No tie possible, need 12: win 13 → +1, win 12 → 0.
--   Only regular (non-tiebreaker) games confirmed by BOTH teams count —
--   the same filter the app's running-totals code uses.
--
-- How to use (Supabase SQL editor)
--   1. Run QUERY 1 to find the season's id.
--   2. Paste that id into the `params` CTE of QUERY 2 and QUERY 3.
--   3. QUERY 2 lists every completed match; `points_ok = false` rows are the
--      matches whose stored points disagree with the rule. QUERY 3 totals
--      stored vs expected points per team, which should explain the
--      standings page.
--
-- Extra diagnostic columns in QUERY 2
--   * stored_games vs counted_games — whether the stored games-won columns
--     match the confirmed match_games rows.
--   * lineup_diff — the home-minus-away handicap difference rebuilt from the
--     LOCKED lineups (+ home_team_modifier). The new scoring engine derives
--     its targets from this number instead of the saved targets, so a
--     mismatch here vs the saved targets would point at the engine path.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- QUERY 1 — find the season id
-- -----------------------------------------------------------------------------
select s.id as season_id, s.season_name, s.status, s.start_date, s.league_id
from seasons s
order by s.start_date desc
limit 20;


-- -----------------------------------------------------------------------------
-- QUERY 2 — every completed match: stored vs expected points
-- -----------------------------------------------------------------------------
with params as (
  select 'PASTE-SEASON-ID-HERE'::uuid as season_id
),
m as (
  select mt.*
  from matches mt, params p
  where mt.season_id = p.season_id
    and mt.status = 'completed'
),
-- Count confirmed, regular games per side (same filter the app uses).
g as (
  select
    mg.match_id,
    count(*)                                              as game_rows,
    count(*) filter (where mg.is_tiebreaker)              as tiebreaker_rows,
    count(*) filter (where not mg.is_tiebreaker
                       and mg.winner_team_id is not null
                       and (mg.confirmed_by_home is null
                            or mg.confirmed_by_away is null)) as unconfirmed_rows,
    count(*) filter (where not mg.is_tiebreaker
                       and mg.confirmed_by_home is not null
                       and mg.confirmed_by_away is not null
                       and mg.winner_team_id = m.home_team_id) as home_counted,
    count(*) filter (where not mg.is_tiebreaker
                       and mg.confirmed_by_home is not null
                       and mg.confirmed_by_away is not null
                       and mg.winner_team_id = m.away_team_id) as away_counted
  from match_games mg
  join m on m.id = mg.match_id
  group by mg.match_id
),
-- Handicap difference the new engine rebuilds from the locked lineups.
l as (
  select
    m.id as match_id,
    sum(case when ml.team_id = m.home_team_id then
          coalesce(ml.player1_handicap,0) + coalesce(ml.player2_handicap,0)
        + coalesce(ml.player3_handicap,0) + coalesce(ml.player4_handicap,0)
        + coalesce(ml.player5_handicap,0) + coalesce(ml.home_team_modifier,0)
        else 0 end)
    - sum(case when ml.team_id = m.away_team_id then
          coalesce(ml.player1_handicap,0) + coalesce(ml.player2_handicap,0)
        + coalesce(ml.player3_handicap,0) + coalesce(ml.player4_handicap,0)
        + coalesce(ml.player5_handicap,0)
        else 0 end) as lineup_diff,
    count(*) as locked_lineups
  from m
  join match_lineups ml on ml.match_id = m.id and ml.locked = true
  group by m.id
),
calc as (
  select
    m.id as match_id,
    sw.scheduled_date,
    ht.team_name as home_team,
    at.team_name as away_team,
    wt.team_name as winner,
    m.home_to_win, m.home_to_tie, m.away_to_win, m.away_to_tie,
    m.home_games_won  as home_stored_games,
    m.away_games_won  as away_stored_games,
    coalesce(g.home_counted, 0) as home_counted_games,
    coalesce(g.away_counted, 0) as away_counted_games,
    coalesce(g.game_rows, 0)        as game_rows,
    coalesce(g.tiebreaker_rows, 0)  as tiebreaker_rows,
    coalesce(g.unconfirmed_rows, 0) as unconfirmed_rows,
    m.home_points_earned as home_stored_pts,
    m.away_points_earned as away_stored_pts,
    -- Expected points under the rule, from the SAVED targets.
    case
      when m.home_to_win is null then null
      else coalesce(g.home_counted,0) - coalesce(m.home_to_tie, m.home_to_win)
    end as home_expected_pts,
    case
      when m.away_to_win is null then null
      else coalesce(g.away_counted,0) - coalesce(m.away_to_tie, m.away_to_win)
    end as away_expected_pts,
    l.lineup_diff,
    coalesce(l.locked_lineups, 0) as locked_lineups
  from m
  left join g  on g.match_id = m.id
  left join l  on l.match_id = m.id
  left join season_weeks sw on sw.id = m.season_week_id
  left join teams ht on ht.id = m.home_team_id
  left join teams at on at.id = m.away_team_id
  left join teams wt on wt.id = m.winner_team_id
)
select
  calc.*,
  (home_stored_pts = home_expected_pts and away_stored_pts = away_expected_pts) as points_ok,
  (home_stored_games = home_counted_games and away_stored_games = away_counted_games) as games_ok
from calc
order by points_ok nulls first, scheduled_date, home_team;


-- -----------------------------------------------------------------------------
-- QUERY 3 — per-team totals: stored (what standings shows) vs expected
-- -----------------------------------------------------------------------------
with params as (
  select 'PASTE-SEASON-ID-HERE'::uuid as season_id
),
m as (
  select mt.*
  from matches mt, params p
  where mt.season_id = p.season_id
    and mt.status = 'completed'
),
counted as (
  select
    m.id as match_id,
    count(*) filter (where mg.winner_team_id = m.home_team_id) as home_counted,
    count(*) filter (where mg.winner_team_id = m.away_team_id) as away_counted
  from m
  left join match_games mg
    on mg.match_id = m.id
   and not mg.is_tiebreaker
   and mg.confirmed_by_home is not null
   and mg.confirmed_by_away is not null
  group by m.id
),
sides as (
  -- One row per team per match.
  select m.home_team_id as team_id, m.winner_team_id = m.home_team_id as won,
         m.home_points_earned as stored_pts,
         c.home_counted as games, m.home_to_win as w,
         coalesce(m.home_to_tie, m.home_to_win) as lo
  from m join counted c on c.match_id = m.id
  union all
  select m.away_team_id, m.winner_team_id = m.away_team_id,
         m.away_points_earned,
         c.away_counted, m.away_to_win,
         coalesce(m.away_to_tie, m.away_to_win)
  from m join counted c on c.match_id = m.id
)
select
  t.team_name,
  t.status as team_status,
  count(*) filter (where s.won)          as match_wins,
  count(*) filter (where not s.won)      as match_losses,
  sum(s.stored_pts)                      as stored_points_total,
  sum(case when s.w is null then null
           when s.games > s.w  then s.games - s.w
           when s.games < s.lo then s.games - s.lo
           else 0 end)                   as expected_points_total,
  sum(s.stored_pts) filter (where s.won) as stored_points_in_wins,
  count(*) filter (where s.won and s.stored_pts < 0) as wins_with_negative_points
from sides s
join teams t on t.id = s.team_id
group by t.team_name, t.status
order by match_wins desc, stored_points_total desc;
