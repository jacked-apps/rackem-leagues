-- Migration: members.archived_at + archive/restore RPCs
-- Purpose: Let LOs archive placeholders who've moved away, stopped playing,
--          or otherwise left their league. Archive ≠ delete: it's "inactive
--          in this league right now," with all stats and team history kept
--          intact. The player may return later or turn up in another
--          org's league — the archive keeps them queryable for that.
--
-- Distinct from `archived_placeholders` (that table stores merge-undo
-- snapshots; this column is a soft-inactive flag on the member itself).
--
-- Active-query semantics:
--   - get_org_placeholders_for_merge filters archived by default, exposes
--     an include_archived param for the LO's Archived sub-section
--   - Dropdown / player picker queries (getAllMembers, etc.) should
--     exclude archived rows going forward — that's a JS-side change.
--     This migration just delivers the storage + RPCs.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- ============================================================================
-- Step 1: column + partial index
-- ============================================================================
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN members.archived_at IS
'When non-NULL, this member is archived — inactive in the LO''s league. Data is preserved for future lookup (BCA lookups, cross-org return). Default queries filter these out; dedicated archived views include them.';

-- Partial index favors the common "active only" filter.
CREATE INDEX IF NOT EXISTS idx_members_active_not_archived
  ON members (id)
  WHERE archived_at IS NULL;

-- ============================================================================
-- Step 2: archive_placeholder RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION archive_placeholder(
  p_member_id       UUID,
  p_actor_member_id UUID,
  p_organization_id UUID
)
RETURNS TABLE (
  success       BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member RECORD;
BEGIN
  SELECT id, user_id, organization_id, archived_at INTO v_member
    FROM members WHERE id = p_member_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Placeholder not found'::TEXT;
    RETURN;
  END IF;

  IF v_member.user_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Target is not a placeholder (has a user account)'::TEXT;
    RETURN;
  END IF;

  IF v_member.organization_id IS NOT NULL
     AND v_member.organization_id <> p_organization_id THEN
    RETURN QUERY SELECT FALSE, 'Placeholder belongs to a different organization'::TEXT;
    RETURN;
  END IF;

  IF v_member.archived_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Already archived'::TEXT;
    RETURN;
  END IF;

  UPDATE members SET archived_at = now() WHERE id = p_member_id;

  INSERT INTO placeholder_audit_log (
    action, actor_member_id, placeholder_member_id, target_member_id,
    organization_id, archive_id, affected_tables
  ) VALUES (
    'remove_from_team',  -- nearest existing action label; archive is a
                         -- sibling concept and we reuse this bucket rather
                         -- than extending the CHECK again here
    p_actor_member_id,
    p_member_id,
    NULL,
    p_organization_id,
    NULL,
    jsonb_build_object('op', 'archive', 'archived_at_utc', now())
  );

  RETURN QUERY SELECT TRUE, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_placeholder(UUID, UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION archive_placeholder IS
'Soft-inactivates a placeholder (sets members.archived_at). Data is preserved for future lookup. Writes a placeholder_audit_log row.';

-- ============================================================================
-- Step 3: restore_placeholder RPC (inverse)
-- ============================================================================
CREATE OR REPLACE FUNCTION restore_placeholder(
  p_member_id       UUID,
  p_actor_member_id UUID,
  p_organization_id UUID
)
RETURNS TABLE (
  success       BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member RECORD;
BEGIN
  SELECT id, user_id, organization_id, archived_at INTO v_member
    FROM members WHERE id = p_member_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Placeholder not found'::TEXT;
    RETURN;
  END IF;

  IF v_member.user_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Target is not a placeholder'::TEXT;
    RETURN;
  END IF;

  IF v_member.organization_id IS NOT NULL
     AND v_member.organization_id <> p_organization_id THEN
    RETURN QUERY SELECT FALSE, 'Placeholder belongs to a different organization'::TEXT;
    RETURN;
  END IF;

  IF v_member.archived_at IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not archived'::TEXT;
    RETURN;
  END IF;

  UPDATE members SET archived_at = NULL WHERE id = p_member_id;

  INSERT INTO placeholder_audit_log (
    action, actor_member_id, placeholder_member_id, target_member_id,
    organization_id, archive_id, affected_tables
  ) VALUES (
    'remove_from_team',
    p_actor_member_id,
    p_member_id,
    NULL,
    p_organization_id,
    NULL,
    jsonb_build_object('op', 'restore')
  );

  RETURN QUERY SELECT TRUE, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_placeholder(UUID, UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION restore_placeholder IS
'Un-archives a placeholder (sets members.archived_at = NULL). Writes a placeholder_audit_log row.';

-- ============================================================================
-- Step 4: get_org_placeholders_for_merge — exclude archived, add param
-- ============================================================================
DROP FUNCTION IF EXISTS get_org_placeholders_for_merge(UUID);

CREATE FUNCTION get_org_placeholders_for_merge(
  p_org_id UUID,
  p_include_archived BOOLEAN DEFAULT false
)
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
  is_archived            BOOLEAN,
  archived_at            TIMESTAMPTZ,
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
    (m.archived_at IS NOT NULL) AS is_archived,
    m.archived_at,
    m.created_at
  FROM members m
  LEFT JOIN members crt ON crt.id = m.created_by_member_id
  WHERE m.user_id IS NULL
    AND (p_include_archived OR m.archived_at IS NULL)
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
  ORDER BY placeholder_has_stats(m.id) DESC NULLS LAST,
           m.last_name, m.first_name;
$$;

GRANT EXECUTE ON FUNCTION get_org_placeholders_for_merge(UUID, BOOLEAN) TO authenticated, service_role;

COMMENT ON FUNCTION get_org_placeholders_for_merge IS
'LO merge-tool data source. Returns one row per unique placeholder in the org with context (teams, has_stats, creator, invite status, archive status). Default excludes archived; pass p_include_archived=true for the Archived sub-section.';
