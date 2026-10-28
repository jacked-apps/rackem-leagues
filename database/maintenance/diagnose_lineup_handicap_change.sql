-- ============================================================================
-- Diagnose: why did a match's lineup handicaps change?
-- ============================================================================
-- READ-ONLY. Runs three SELECTs. Writes nothing, changes nothing.
--
-- Built for the "Ben vs Duff" question (match 92b799f2…): the lineup handicaps
-- changed on a match that had NO tiebreaker, so the tiebreaker re-lock path is
-- ruled out. See docs/audits/2026-10-28-tiebreaker-audit.md.
--
-- HOW TO RUN
--   Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--   Change the match id on the next line if you are checking a different match.
-- ============================================================================

\set match_prefix '92b799f2'

-- ---------------------------------------------------------------------------
-- 1. The match itself — confirm there really was no tiebreaker.
-- ---------------------------------------------------------------------------
SELECT
  m.id,
  m.status,
  m.match_result,
  m.winner_team_id,
  m.home_games_won,
  m.away_games_won,
  m.completed_at,
  (SELECT count(*) FROM match_games g
     WHERE g.match_id = m.id AND g.is_tiebreaker) AS tiebreaker_games
FROM matches m
WHERE m.id::text LIKE :'match_prefix' || '%';

-- ---------------------------------------------------------------------------
-- 2. THE ANSWER. Both lineup rows with their swap audit trail.
--
--    verdict = 'SWAP (legitimate)'  -> swap_last_resolution is populated, so the
--              change came through swap_player_in_lineup. Expected behaviour,
--              nothing to chase. Ed's guess.
--
--    verdict = 'NO SWAP RECORDED'   -> nothing audited this change. It came from
--              the lineup screen (a pick changed, a handicap hand-edited) or an
--              unlock/re-lock before the match. There is NO trail saying who or
--              when — that absence is itself the finding (audit F2).
-- ---------------------------------------------------------------------------
SELECT
  CASE WHEN l.team_id = m.home_team_id THEN 'HOME' ELSE 'AWAY' END AS side,
  t.team_name,
  l.locked,
  l.locked_at,
  l.home_team_modifier,
  l.player1_handicap, l.player2_handicap, l.player3_handicap,
  l.player4_handicap, l.player5_handicap,
  l.swap_requested_by_member_id,
  l.swap_last_resolution,
  CASE
    WHEN l.swap_last_resolution IS NOT NULL THEN 'SWAP (legitimate)'
    ELSE 'NO SWAP RECORDED'
  END AS verdict
FROM match_lineups l
JOIN matches m ON m.id = l.match_id
LEFT JOIN teams t ON t.id = l.team_id
WHERE m.id::text LIKE :'match_prefix' || '%'
ORDER BY side;

-- ---------------------------------------------------------------------------
-- 3. Cross-check: the handicap each player was actually scored at, per game.
--    A swap shows one player replaced partway through; a hand-edit shows the
--    same player carrying a different number than the lineup row says.
-- ---------------------------------------------------------------------------
SELECT
  g.game_number,
  g.is_tiebreaker,
  hp.nickname AS home_player,
  ap.nickname AS away_player,
  g.winner_team_id,
  g.winner_player_id
FROM match_games g
JOIN matches m ON m.id = g.match_id
LEFT JOIN members hp ON hp.id = g.home_player_id
LEFT JOIN members ap ON ap.id = g.away_player_id
WHERE m.id::text LIKE :'match_prefix' || '%'
ORDER BY g.game_number;
