-- Migration: enrich get_my_pending_invites with full context fields
-- Purpose: The dashboard modal was showing only {team, captain}. Users who
--          receive an invite want to see more before clicking Accept: org
--          name, org owner, game count, starting handicap, nickname.
--          Everything the system can reasonably know goes in.
--
-- Robustness: when invite.team_id is NULL (auto-invite created by the
-- members trigger), we fall back to ANY team the placeholder is on via a
-- LATERAL lookup. So a placeholder that was auto-invited and later attached
-- to a team gets real context populated automatically.
--
-- Added columns (all nullable — UI renders gracefully when sparse):
--   placeholder_nickname, organization_name, organization_owner_name,
--   game_count, starting_handicap_5v5
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- Return shape changes, so we have to drop and re-create. Postgres doesn't
-- allow CREATE OR REPLACE to change the returned row type.
DROP FUNCTION IF EXISTS public.get_my_pending_invites();

CREATE FUNCTION public.get_my_pending_invites()
RETURNS TABLE(
  token                    UUID,
  member_id                UUID,
  placeholder_first_name   TEXT,
  placeholder_last_name    TEXT,
  placeholder_nickname     TEXT,
  team_name                TEXT,
  organization_name        TEXT,
  organization_owner_name  TEXT,
  captain_name             TEXT,
  game_count               INT,
  starting_handicap_5v5    INT,
  invited_at               TIMESTAMPTZ,
  expires_at               TIMESTAMPTZ,
  is_expired               BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    it.token,
    it.member_id,
    m.first_name::TEXT  AS placeholder_first_name,
    m.last_name::TEXT   AS placeholder_last_name,
    m.nickname::TEXT    AS placeholder_nickname,
    ctx.team_name::TEXT,
    ctx.organization_name::TEXT,
    ctx.org_owner_name::TEXT  AS organization_owner_name,
    (cm.first_name || ' ' || cm.last_name)::TEXT AS captain_name,
    ctx.game_count,
    m.starting_handicap_5v5,
    it.created_at AS invited_at,
    it.expires_at,
    (it.expires_at <= now()) AS is_expired
  FROM invite_tokens it
  JOIN members m ON m.id = it.member_id
  LEFT JOIN members cm ON cm.id = it.invited_by_member_id
  -- Team/org context: prefer the invite's team if set, otherwise any team
  -- the placeholder is on. Lateral join so we can reference `it` inside.
  LEFT JOIN LATERAL (
    SELECT
      t.team_name,
      o.organization_name,
      (oo.first_name || ' ' || oo.last_name) AS org_owner_name,
      (
        SELECT COUNT(*)::INT FROM match_lineups ml
        WHERE ml.player1_id = m.id OR ml.player2_id = m.id OR ml.player3_id = m.id
           OR ml.player4_id = m.id OR ml.player5_id = m.id
      ) AS game_count
    FROM team_players tp
    JOIN teams t        ON t.id = tp.team_id
    JOIN seasons s      ON s.id = t.season_id
    JOIN leagues l      ON l.id = s.league_id
    JOIN organizations o ON o.id = l.organization_id
    LEFT JOIN members oo ON oo.id = o.created_by
    WHERE tp.member_id = it.member_id
      AND (it.team_id IS NULL OR t.id = it.team_id)
    LIMIT 1
  ) ctx ON true
  WHERE LOWER(it.email) = LOWER(v_user_email)
    AND (
      (it.status = 'pending' AND it.expires_at > now())
      OR
      (it.status IN ('pending', 'expired') AND it.expires_at <= now())
    )
  ORDER BY
    (it.expires_at <= now()) ASC,
    it.created_at DESC;
END;
$$;
