-- ─────────────────────────────────────────────────────────────────
-- STEP 0 — FIND THE MATCH  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Edit the two team-name fragments (ILIKE, so partial names are fine) and the
-- date window. A makeup match is played off its scheduled week, so this looks
-- at started_at/completed_at as well as the week's scheduled_date.
WITH input AS (
  SELECT
    '%leftover%'   AS team_a,
    '%fluff%'      AS team_b,
    DATE '2026-10-04' AS played_on
)
SELECT
  m.id                AS match_id,
  ht.team_name        AS home_team,
  at.team_name        AS away_team,
  m.status,
  sw.scheduled_date   AS week_scheduled_date,
  m.started_at,
  m.completed_at,
  m.home_games_won,
  m.away_games_won,
  m.match_result
FROM matches m
JOIN teams ht        ON ht.id = m.home_team_id
JOIN teams at        ON at.id = m.away_team_id
JOIN season_weeks sw ON sw.id = m.season_week_id
CROSS JOIN input i
WHERE (
        (ht.team_name ILIKE i.team_a AND at.team_name ILIKE i.team_b)
     OR (ht.team_name ILIKE i.team_b AND at.team_name ILIKE i.team_a)
      )
  AND (
        sw.scheduled_date    = i.played_on
     OR m.started_at::date   = i.played_on
     OR m.completed_at::date = i.played_on
      )
ORDER BY m.completed_at NULLS LAST;

