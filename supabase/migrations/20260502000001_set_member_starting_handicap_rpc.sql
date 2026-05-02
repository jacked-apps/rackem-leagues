-- ============================================================================
-- PHASE 6 UNIT 6.2 — set_member_starting_handicap RPC (authenticated path)
-- ============================================================================
--
-- Sibling to `set_match_lineup_rating` (the per-match-lineup atomic write
-- path) and `recompute_member_rating` (the service-role automated-recompute
-- path). This RPC fills the gap: an authenticated LO web client editing a
-- player's persistent starting handicap (members.starting_handicap_3v3 or
-- starting_handicap_5v5) needs to write atomically to BOTH the members
-- column AND the audit log — same correctness reason `set_match_lineup_rating`
-- exists.
--
-- Before this RPC, the operator UI's `updatePlayerStartingHandicaps` did a
-- bare `supabase.from('members').update(...)` with no audit. That bypassed
-- R21's audit-every-rating-change requirement; this RPC closes the gap.
--
-- Authz: caller must be an authenticated user whose member row maps to an
-- org_staff entry with position 'owner' or 'admin' in at least one
-- organization. Players can't edit their own starting handicap; only LOs
-- (org owners/admins) can. Mirrors the auth.uid()-NOT-NULL + org-staff
-- check pattern from set_match_lineup_rating.
--
-- @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 6.2)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_member_starting_handicap(
  p_member_id     UUID,
  p_rating_system TEXT,        -- 'points' or 'percentage'
  p_new_value     NUMERIC,
  p_reason        TEXT DEFAULT NULL
)
RETURNS UUID  -- returns the audit row id, or NULL when no value change (no-op)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_member_id UUID;
  v_actor_organization_id UUID;
  v_before NUMERIC;
  v_audit_id UUID;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'set_member_starting_handicap requires an authenticated caller';
  END IF;
  IF p_member_id IS NULL OR p_rating_system IS NULL OR p_new_value IS NULL THEN
    RAISE EXCEPTION 'set_member_starting_handicap: member_id, rating_system, and new_value are required';
  END IF;
  IF p_rating_system NOT IN ('points', 'percentage') THEN
    RAISE EXCEPTION 'set_member_starting_handicap: rating_system % does not have a persistent member-level column (only points / percentage are stored on members today)', p_rating_system;
  END IF;

  -- Resolve the calling member.
  SELECT id INTO v_actor_member_id
  FROM members
  WHERE user_id = v_actor_user_id
  LIMIT 1;

  IF v_actor_member_id IS NULL THEN
    RAISE EXCEPTION 'set_member_starting_handicap: caller has no member row';
  END IF;

  -- Authz: caller must be an owner/admin of at least one organization.
  -- We don't restrict to a specific org — starting handicaps are
  -- persistent and cross-org, so any LO can edit them. RLS on members
  -- + organization_staff still gates SELECT visibility (when RLS is on).
  -- Capture the first org_staff org for the audit row's organization_id
  -- field so the row is visible to that org's staff via the existing
  -- audit-log SELECT policy.
  SELECT organization_id INTO v_actor_organization_id
  FROM organization_staff
  WHERE member_id = v_actor_member_id
    AND position IN ('owner', 'admin')
  LIMIT 1;

  IF v_actor_organization_id IS NULL THEN
    RAISE EXCEPTION 'set_member_starting_handicap: caller is not an org owner/admin';
  END IF;

  -- Read the existing value from the right column.
  IF p_rating_system = 'points' THEN
    SELECT starting_handicap_3v3 INTO v_before FROM members WHERE id = p_member_id;
  ELSE -- 'percentage'
    SELECT starting_handicap_5v5 INTO v_before FROM members WHERE id = p_member_id;
  END IF;

  -- Change-detection: skip both UPDATE and audit insert when the value
  -- isn't actually changing. Treat NULL → NULL as no change too.
  IF v_before IS NOT DISTINCT FROM p_new_value THEN
    RETURN NULL;
  END IF;

  -- Apply the update.
  IF p_rating_system = 'points' THEN
    UPDATE members SET starting_handicap_3v3 = p_new_value WHERE id = p_member_id;
  ELSE
    UPDATE members SET starting_handicap_5v5 = p_new_value WHERE id = p_member_id;
  END IF;

  -- Insert the audit row in the same transaction. scope='persistent'
  -- distinguishes this from per_match_lineup writes. source='manual'
  -- because the caller is a human LO via the operator UI.
  INSERT INTO rating_edit_audit_log (
    actor_user_id, actor_type,
    target_member_id, target_match_lineup_id,
    rating_system, before_value, after_value,
    scope, reason, source,
    organization_id
  ) VALUES (
    v_actor_user_id, 'user',
    p_member_id, NULL,
    p_rating_system,
    CASE WHEN v_before IS NULL THEN NULL ELSE v_before::TEXT END,
    p_new_value::TEXT,
    'persistent', p_reason, 'manual',
    v_actor_organization_id
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

COMMENT ON FUNCTION set_member_starting_handicap(UUID, TEXT, NUMERIC, TEXT) IS
  'Atomically updates a member''s persistent starting handicap (starting_handicap_3v3 or _5v5) AND inserts a rating_edit_audit_log row. Caller must be authenticated and an owner/admin of at least one organization. Returns the audit row id, or NULL when the new value matches the old (no-op).';

-- Same GRANT pattern as set_match_lineup_rating: revoke from PUBLIC + anon,
-- grant to authenticated. The function body checks auth.uid() IS NOT NULL
-- and org-staff membership before any data work.
REVOKE EXECUTE ON FUNCTION set_member_starting_handicap(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_member_starting_handicap(UUID, TEXT, NUMERIC, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION set_member_starting_handicap(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
