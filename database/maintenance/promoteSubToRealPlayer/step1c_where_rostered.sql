-- ─────────────────────────────────────────────────────────────────
-- STEP 1c — WHERE IS HE ROSTERED?  (read-only; run if 1b showed all FALSE)
-- ─────────────────────────────────────────────────────────────────────────────
-- Every roster row he has, with the season each one belongs to, next to the
-- season the match belongs to. If a team name here matches a team in the match
-- but the season_id differs, the roster row is on the wrong season.
WITH input AS (
  SELECT
    '552891c9-47f9-4562-9007-75a3390351de'::uuid AS member_id,
    '27d7bfe6-13c0-435c-bd28-dfe48a57a186'::uuid                        AS match_id
)
SELECT
  (SELECT first_name || ' ' || last_name FROM members WHERE id = i.member_id)
                            AS player_name,
  t.team_name,
  tp.season_id              AS roster_season_id,
  (SELECT season_id FROM matches WHERE id = i.match_id)
                            AS match_season_id,
  tp.season_id = (SELECT season_id FROM matches WHERE id = i.match_id)
                            AS same_season,
  tp.status,
  tp.is_captain
FROM team_players tp
JOIN teams t ON t.id = tp.team_id
CROSS JOIN input i
WHERE tp.member_id = i.member_id
ORDER BY same_season DESC, t.team_name;

