-- Migration: delete_unused_placeholder RPC
-- Purpose: Give LOs a one-click path to remove the "unused" placeholders
--          that clutter player dropdowns — the ones with no team, no stats,
--          and no claim to persistence. Direct DELETE, not archive, because
--          there's nothing worth preserving.
--
-- Safety gates (all server-side, TOCTOU-safe in one transaction):
--   1. Placeholder exists and user_id IS NULL
--   2. placeholder_has_stats(id) = false  (no lineup appearances)
--   3. Not on any team_players row anywhere
--   4. No BCA member number set — those might be looked up across orgs by
--      another LO later; archive instead for those (not built yet)
--   5. Caller's org matches placeholder's org (defense-in-depth alongside
--      Edge Function authz)
--
-- Writes a placeholder_audit_log row with action='delete_no_stats' and
-- affected_tables context. Cascade cleanup handles invite_tokens (which is
-- now ON DELETE SET NULL, so any claimed audit history is preserved).
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 11)

CREATE OR REPLACE FUNCTION delete_unused_placeholder(
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
  v_member     RECORD;
  v_has_stats  BOOLEAN;
  v_team_count INT;
BEGIN
  SELECT id, user_id, organization_id, bca_member_number, email
    INTO v_member
    FROM members WHERE id = p_member_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Placeholder not found'::TEXT;
    RETURN;
  END IF;

  IF v_member.user_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Target is not a placeholder (has a user account)'::TEXT;
    RETURN;
  END IF;

  -- Org-scope authz. The Edge Function should already verify the caller's
  -- org — this is belt-and-suspenders.
  IF v_member.organization_id IS NOT NULL
     AND v_member.organization_id <> p_organization_id THEN
    RETURN QUERY SELECT FALSE, 'Placeholder belongs to a different organization'::TEXT;
    RETURN;
  END IF;

  -- Cannot delete if they have a BCA number — they may be matched by
  -- another LO later via BCA lookup. Future: route to archive instead.
  IF v_member.bca_member_number IS NOT NULL
     AND trim(v_member.bca_member_number) <> '' THEN
    RETURN QUERY SELECT FALSE, 'Placeholder has a BCA number; archive instead of delete'::TEXT;
    RETURN;
  END IF;

  -- No stats check
  SELECT placeholder_has_stats(p_member_id) INTO v_has_stats;
  IF v_has_stats THEN
    RETURN QUERY SELECT FALSE, 'Placeholder has game stats; cannot delete'::TEXT;
    RETURN;
  END IF;

  -- No team check
  SELECT COUNT(*)::INT INTO v_team_count
    FROM team_players WHERE member_id = p_member_id;
  IF v_team_count > 0 THEN
    RETURN QUERY SELECT FALSE, 'Placeholder is on a team; remove from teams first'::TEXT;
    RETURN;
  END IF;

  -- All gates passed. Delete the member. invite_tokens.member_id is
  -- ON DELETE SET NULL (migration 20260422000014), so any history rows
  -- survive for audit.
  DELETE FROM members WHERE id = p_member_id;

  INSERT INTO placeholder_audit_log (
    action, actor_member_id, placeholder_member_id, target_member_id,
    organization_id, archive_id, affected_tables
  ) VALUES (
    'delete_no_stats',
    p_actor_member_id,
    p_member_id,
    NULL,
    p_organization_id,
    NULL,
    jsonb_build_object(
      'placeholder_email', v_member.email,
      'deletion_reason', 'unused_no_team_no_stats'
    )
  );

  RETURN QUERY SELECT TRUE, NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_unused_placeholder(UUID, UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION delete_unused_placeholder IS
'One-click purge for unused placeholders (no team, no stats, no BCA#). Server-side guards prevent deleting anything with preservation value. Writes a delete_no_stats audit row.';
