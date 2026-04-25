-- Migration: members.created_by_member_id — track who created a placeholder
-- Purpose: Every placeholder is created by a real person (LO or captain) who
--          belongs to an organization. Recording the creator gives us a
--          reliable org/creator fallback when a placeholder is floating
--          without team membership — so the dashboard pending-invites modal
--          always has at least one organization and one responsible human
--          to name.
--
-- Column is nullable: existing placeholders can't be retroactively assigned
-- a creator. For them the RPC gracefully falls back to sparse display.
-- Going forward, the client mutation populates it.
--
-- Also updates get_my_pending_invites to resolve organization and creator
-- name from created_by_member_id when there's no direct team context.
--
-- Org-resolution priority (first match wins):
--   1. Creator owns an organization (organizations.created_by)
--   2. Creator is organization staff (organization_staff)
--   3. Creator captains a team (teams.captain_id → season → league → org)
--   4. Creator is a player on a team (team_players → season → league → org)
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- ============================================================================
-- Step 1: add the column + index
-- ============================================================================
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS created_by_member_id UUID REFERENCES members(id);

CREATE INDEX IF NOT EXISTS idx_members_created_by_member_id
  ON members (created_by_member_id)
  WHERE created_by_member_id IS NOT NULL;

COMMENT ON COLUMN members.created_by_member_id IS
'The member (LO or captain) who created this record. Nullable — existing rows predate this column, and self-registrations have no creator. Used to trace org context and surface creator identity in invite-related UI.';

-- ============================================================================
-- Step 2: RPC — include creator info and fall back to creator's org
-- ============================================================================
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
  creator_name             TEXT,
  game_count               INT,
  starting_handicap_5v5    NUMERIC,
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
    m.first_name::TEXT AS placeholder_first_name,
    m.last_name::TEXT  AS placeholder_last_name,
    m.nickname::TEXT   AS placeholder_nickname,

    -- Team: invite's team if set, else any team placeholder is on.
    team_ctx.team_name::TEXT,

    -- Organization: prefer the team's org; else derive from creator.
    COALESCE(team_ctx.organization_name, creator_ctx.organization_name)::TEXT
      AS organization_name,

    -- Org owner: prefer team's org owner; else creator's org owner.
    COALESCE(team_ctx.org_owner_name, creator_ctx.org_owner_name)::TEXT
      AS organization_owner_name,

    -- Captain: from invite's invited_by, else null
    (cm.first_name || ' ' || cm.last_name)::TEXT AS captain_name,

    -- Creator: the LO/captain who created the placeholder record
    (crt.first_name || ' ' || crt.last_name)::TEXT AS creator_name,

    -- Stats pulled from match_lineups
    (
      SELECT COUNT(*)::INT FROM match_lineups ml
      WHERE ml.player1_id = m.id OR ml.player2_id = m.id OR ml.player3_id = m.id
         OR ml.player4_id = m.id OR ml.player5_id = m.id
    ) AS game_count,

    m.starting_handicap_5v5,
    it.created_at AS invited_at,
    it.expires_at,
    (it.expires_at <= now()) AS is_expired
  FROM invite_tokens it
  JOIN members m ON m.id = it.member_id
  LEFT JOIN members cm ON cm.id = it.invited_by_member_id
  LEFT JOIN members crt ON crt.id = m.created_by_member_id

  -- Team/org context via the placeholder's team membership
  LEFT JOIN LATERAL (
    SELECT t.team_name, o.organization_name,
           (oo.first_name || ' ' || oo.last_name) AS org_owner_name
    FROM team_players tp
    JOIN teams t ON t.id = tp.team_id
    JOIN seasons s ON s.id = t.season_id
    JOIN leagues l ON l.id = s.league_id
    JOIN organizations o ON o.id = l.organization_id
    LEFT JOIN members oo ON oo.id = o.created_by
    WHERE tp.member_id = it.member_id
      AND (it.team_id IS NULL OR t.id = it.team_id)
    LIMIT 1
  ) team_ctx ON true

  -- Org context via the creator (fallback when placeholder has no team)
  LEFT JOIN LATERAL (
    SELECT o.organization_name,
           (oo.first_name || ' ' || oo.last_name) AS org_owner_name
    FROM organizations o
    LEFT JOIN members oo ON oo.id = o.created_by
    WHERE o.id = (
      -- Priority order: creator owns the org, else is staff, else has a team link
      COALESCE(
        (SELECT org.id FROM organizations org WHERE org.created_by = m.created_by_member_id LIMIT 1),
        (SELECT os.organization_id FROM organization_staff os WHERE os.member_id = m.created_by_member_id LIMIT 1),
        (SELECT l.organization_id
           FROM teams t2
           JOIN seasons s2 ON s2.id = t2.season_id
           JOIN leagues l  ON l.id = s2.league_id
          WHERE t2.captain_id = m.created_by_member_id
          LIMIT 1),
        (SELECT l.organization_id
           FROM team_players tp2
           JOIN teams t2      ON t2.id = tp2.team_id
           JOIN seasons s2    ON s2.id = t2.season_id
           JOIN leagues l     ON l.id = s2.league_id
          WHERE tp2.member_id = m.created_by_member_id
          LIMIT 1)
      )
    )
    LIMIT 1
  ) creator_ctx ON true

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
