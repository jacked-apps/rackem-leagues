-- Migration: get_org_placeholders_for_merge RPC
-- Purpose: Drive the LO-facing Placeholders tab on PlayerManagement. Returns
--          ONE row per unique placeholder (deduped across teams) with the
--          fields the LO needs to triage:
--            - identity: name, nickname, system_player_number, email
--            - stats: has_stats flag (amber chip), game_count
--            - team context: aggregated teams array
--            - attribution: creator_name
--            - invite status: has_pending_invite (so the UI can show who
--              hasn't claimed yet)
--
-- Sorted amber-first (has_stats=true, "needs merge"), then by last/first
-- name. Plan says amber above gray so LOs triage the stats-carrying
-- placeholders first (those are the ones where a merge matters most).
--
-- Sibling RPC to get_operator_placeholders (which returns one row per
-- team membership — suited to different surfaces). Both coexist.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 13)

CREATE OR REPLACE FUNCTION get_org_placeholders_for_merge(p_org_id UUID)
RETURNS TABLE (
  member_id              UUID,
  first_name             TEXT,
  last_name              TEXT,
  nickname               TEXT,
  system_player_number   INT,
  email                  TEXT,
  has_stats              BOOLEAN,
  game_count             INT,
  teams                  JSONB,
  creator_name           TEXT,
  has_pending_invite     BOOLEAN,
  created_at             TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id AS member_id,
    m.first_name,
    m.last_name,
    m.nickname,
    m.system_player_number,
    m.email,
    placeholder_has_stats(m.id) AS has_stats,
    (
      SELECT COUNT(*)::INT FROM match_lineups ml
      WHERE ml.player1_id = m.id OR ml.player2_id = m.id OR ml.player3_id = m.id
         OR ml.player4_id = m.id OR ml.player5_id = m.id
    ) AS game_count,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                 'team_id', t.id,
                 'team_name', t.team_name,
                 'is_captain', tp.is_captain
               ) ORDER BY t.team_name)
         FROM team_players tp
         JOIN teams t ON t.id = tp.team_id
         JOIN seasons s ON s.id = t.season_id
         JOIN leagues l ON l.id = s.league_id
        WHERE tp.member_id = m.id
          AND l.organization_id = p_org_id),
      '[]'::jsonb
    ) AS teams,
    (crt.first_name || ' ' || crt.last_name) AS creator_name,
    EXISTS (
      SELECT 1 FROM invite_tokens it
      WHERE it.member_id = m.id
        AND it.status = 'pending'
        AND it.expires_at > now()
    ) AS has_pending_invite,
    m.created_at
  FROM members m
  LEFT JOIN members crt ON crt.id = m.created_by_member_id
  WHERE m.user_id IS NULL
    AND (
      m.organization_id = p_org_id
      OR EXISTS (
        SELECT 1 FROM team_players tp
        JOIN teams t ON t.id = tp.team_id
        JOIN seasons s ON s.id = t.season_id
        JOIN leagues l ON l.id = s.league_id
        WHERE tp.member_id = m.id AND l.organization_id = p_org_id
      )
    )
  -- Amber first (needs-merge), then name
  ORDER BY placeholder_has_stats(m.id) DESC NULLS LAST,
           m.last_name, m.first_name;
$$;

COMMENT ON FUNCTION get_org_placeholders_for_merge IS
'LO merge tool data source — one row per unique placeholder in the org, aggregated teams, has_stats flag, game count, creator, pending-invite indicator. Sorted amber-first so stats-carrying placeholders surface at the top.';

GRANT EXECUTE ON FUNCTION get_org_placeholders_for_merge(UUID) TO authenticated, service_role;
