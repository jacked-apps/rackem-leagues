-- =============================================================================
-- diagnose_playoff_team_bonus.sql  —  READ-ONLY diagnostic (changes nothing)
-- =============================================================================
--
-- Purpose
--   The home-team team bonus was being applied in PLAYOFF matches. It must
--   not be (fixed on branch fix/team-bonus-playoffs, 2026-11-01). This lists
--   every playoff match whose home lineup was locked WITH a bonus, so you can
--   see which playoff races were set with a bonus that shouldn't exist.
--
-- How to read it
--   home_team_bonus   = the bonus frozen on the home lineup when it locked
--                       (0 = fine; anything else = bonus wrongly applied).
--   home_to_win / away_to_win = the race the match was actually set with.
--   status / winner   = whether the match is finished and who won.
--
-- How to use (Supabase SQL editor)
--   Paste the whole file and run it. No ids to fill in. It only SELECTs.
-- =============================================================================

SELECT
  l.organization_id,
  l.id                     AS league_id,
  sw.scheduled_date        AS playoff_date,
  ht.team_name             AS home_team,
  at.team_name             AS away_team,
  hl.home_team_modifier    AS home_team_bonus,
  m.home_to_win,
  m.away_to_win,
  m.status,
  wt.team_name             AS winner,
  m.id                     AS match_id
FROM matches m
JOIN season_weeks sw      ON sw.id = m.season_week_id AND sw.week_type = 'playoffs'
JOIN seasons s            ON s.id = m.season_id
JOIN leagues l            ON l.id = s.league_id
JOIN match_lineups hl     ON hl.match_id = m.id AND hl.team_id = m.home_team_id
LEFT JOIN teams ht        ON ht.id = m.home_team_id
LEFT JOIN teams at        ON at.id = m.away_team_id
LEFT JOIN teams wt        ON wt.id = m.winner_team_id
WHERE hl.locked
  AND COALESCE(hl.home_team_modifier, 0) <> 0
ORDER BY sw.scheduled_date DESC, ht.team_name;
