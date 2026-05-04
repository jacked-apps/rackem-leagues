-- ============================================================================
-- PHASE 6 UNIT 6.1 — ATOMIC RATING-MUTATION RPCs
-- ============================================================================
--
-- Builds the SECURITY DEFINER RPCs that perform a player-rating change
-- AND insert a rating_edit_audit_log row in a single PL/pgSQL transaction.
-- This is the only architecture where the audit log can credibly claim
-- immutability + completeness — separate client calls for the mutation
-- and the audit row cannot be rolled back together.
--
-- R21 of the modular-league plan addresses BCA's #1 software anxiety
-- (sandbagging via silent rating manipulation): every rating change in
-- the app — manual, computed, or future API-sourced — is recorded.
--
-- This migration:
--   1. Relaxes target_member_id NOT NULL → NULLABLE so vacate-rescore
--      MARKER rows (which describe an operation, not a per-member change)
--      can be inserted. Per-member audit rows still populate the field.
--   2. Adds the SELECT policy for rating_edit_audit_log (org owners/admins
--      can read their org's audit history).
--   3. Defines three SECURITY DEFINER RPCs:
--        - set_match_lineup_rating
--        - recompute_member_rating
--        - vacate_and_rescore_audit_marker
--   4. Sets GRANT/REVOKE per the plan: user-callable RPCs to authenticated,
--      recompute_member_rating to service_role only.
--
-- DEFERRED to Unit 6.2: wiring existing rating-edit pathways through
-- these RPCs (currently no caller writes to ratings via these — Fargo
-- manual entry still calls bare UPDATE on match_lineups, BCA recompute
-- is read-only via calculatePlayerHandicap, vacate-rescore doesn't
-- recompute ratings yet).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Relax target_member_id NOT NULL for marker rows
-- ----------------------------------------------------------------------------
-- Per-member audit rows (set_match_lineup_rating, recompute_member_rating)
-- still populate this field. vacate_and_rescore_audit_marker rows describe
-- an LO operation — no specific member — and need this column NULL.
-- ----------------------------------------------------------------------------

ALTER TABLE rating_edit_audit_log
  ALTER COLUMN target_member_id DROP NOT NULL;

COMMENT ON COLUMN rating_edit_audit_log.target_member_id IS
  'Player whose rating changed. NULL for vacate-rescore marker rows (which describe an LO operation, not a per-member edit). Per-member rows always populate this.';

-- ----------------------------------------------------------------------------
-- 2. SELECT policy for rating_edit_audit_log — org owners/admins
-- ----------------------------------------------------------------------------
-- The Phase 2 Unit 2.3b migration created RESTRICTIVE deny-all policies
-- for anon and authenticated. Postgres ANDs RESTRICTIVE policies with
-- PERMISSIVE policies — so we need the deny policies dropped/replaced
-- before any access can succeed.
--
-- Approach: drop the deny-all-authenticated policy, replace with a
-- PERMISSIVE select-only policy gated by organization_staff (owner/admin)
-- on the audit row's organization_id. The anon deny policy stays — anon
-- never reads audit rows.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS rating_edit_audit_log_deny_authenticated_default
  ON rating_edit_audit_log;

CREATE POLICY rating_edit_audit_log_select_org_staff
  ON rating_edit_audit_log
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM organization_staff os
      JOIN members m ON m.id = os.member_id
      WHERE m.user_id = auth.uid()
        AND os.organization_id = rating_edit_audit_log.organization_id
        AND os.position IN ('owner', 'admin')
    )
  );

-- INSERT/UPDATE/DELETE for authenticated remain implicitly denied
-- (no policy granting them = denied by default with RLS enabled).
-- The RPCs below are SECURITY DEFINER and bypass RLS as the function
-- owner; they are the ONLY insert path.

COMMENT ON POLICY rating_edit_audit_log_select_org_staff ON rating_edit_audit_log IS
  'Org owners and admins can read audit rows scoped to their organization. Marker rows with NULL organization_id are intentionally invisible to this policy (defense — they should never have NULL org since vacate_and_rescore_audit_marker resolves and writes the org).';

-- ----------------------------------------------------------------------------
-- 3a. RPC: set_match_lineup_rating
-- ----------------------------------------------------------------------------
-- Authenticated path (Fargo manual entry on the lineup page, future custom-
-- rating entry on BCA leagues). Performs:
--   - Authz: caller's auth.uid() must map to a member who is on the
--     team's roster (team_players, status='active') OR an owner/admin
--     of the league's organization.
--   - Slot resolution: find which playerN_id slot holds p_member_id on
--     this match_lineups row. Reject if the member is not on the lineup.
--   - Rating-system resolution: read handicap_type from the resolved
--     view to identify which system the audit row should record.
--   - Atomic update: change the slot's playerN_handicap to p_rating_value
--     AND insert the audit row in the same transaction.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_match_lineup_rating(
  p_match_lineup_id UUID,
  p_member_id       UUID,
  p_rating_value    NUMERIC,
  p_reason          TEXT DEFAULT NULL
)
RETURNS UUID  -- returns the audit row id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_member_id UUID;
  v_match_id UUID;
  v_team_id UUID;
  v_league_id UUID;
  v_organization_id UUID;
  v_rating_system TEXT;
  v_slot INT;
  v_before NUMERIC;
  v_audit_id UUID;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'set_match_lineup_rating requires an authenticated caller';
  END IF;
  IF p_match_lineup_id IS NULL OR p_member_id IS NULL OR p_rating_value IS NULL THEN
    RAISE EXCEPTION 'set_match_lineup_rating: match_lineup_id, member_id, and rating_value are required';
  END IF;

  -- Resolve the match-lineup context: which match, which team, which slot
  -- holds the target member, and the existing handicap (for before_value).
  SELECT
    ml.match_id,
    ml.team_id,
    CASE
      WHEN ml.player1_id = p_member_id THEN 1
      WHEN ml.player2_id = p_member_id THEN 2
      WHEN ml.player3_id = p_member_id THEN 3
      WHEN ml.player4_id = p_member_id THEN 4
      WHEN ml.player5_id = p_member_id THEN 5
      ELSE NULL
    END,
    CASE
      WHEN ml.player1_id = p_member_id THEN ml.player1_handicap
      WHEN ml.player2_id = p_member_id THEN ml.player2_handicap
      WHEN ml.player3_id = p_member_id THEN ml.player3_handicap
      WHEN ml.player4_id = p_member_id THEN ml.player4_handicap
      WHEN ml.player5_id = p_member_id THEN ml.player5_handicap
      ELSE NULL
    END
  INTO v_match_id, v_team_id, v_slot, v_before
  FROM match_lineups ml
  WHERE ml.id = p_match_lineup_id;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'set_match_lineup_rating: match_lineup % not found', p_match_lineup_id;
  END IF;
  IF v_slot IS NULL THEN
    RAISE EXCEPTION 'set_match_lineup_rating: member % is not on lineup %', p_member_id, p_match_lineup_id;
  END IF;

  -- Resolve league + organization for org-scoped audit + authz.
  SELECT s.league_id, l.organization_id
  INTO v_league_id, v_organization_id
  FROM matches m
  JOIN seasons s ON s.id = m.season_id
  JOIN leagues l ON l.id = s.league_id
  WHERE m.id = v_match_id;

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'set_match_lineup_rating: could not resolve league for match %', v_match_id;
  END IF;

  -- Resolve rating_system from the resolved-prefs view (cascade applies).
  SELECT handicap_type INTO v_rating_system
  FROM resolved_league_preferences
  WHERE league_id = v_league_id;

  IF v_rating_system IS NULL THEN
    -- Defensive default; resolved view always returns a row when the league exists.
    v_rating_system := 'points';
  END IF;

  -- Resolve actor member (audit logs caller as a member, not just auth user).
  SELECT id INTO v_actor_member_id
  FROM members
  WHERE user_id = v_actor_user_id
  LIMIT 1;

  -- Authz: caller is on the team's roster (active) OR an org owner/admin.
  IF NOT EXISTS (
    SELECT 1 FROM team_players tp
    WHERE tp.team_id = v_team_id
      AND tp.member_id = v_actor_member_id
      AND tp.status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM organization_staff os
    WHERE os.organization_id = v_organization_id
      AND os.member_id = v_actor_member_id
      AND os.position IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'set_match_lineup_rating: caller is not authorized to edit this lineup''s ratings';
  END IF;

  -- Atomic mutation: update the right slot's handicap AND insert the audit row.
  -- The two writes share the same implicit transaction — failure of either
  -- rolls back both, which is the entire point of this RPC.
  IF v_slot = 1 THEN
    UPDATE match_lineups SET player1_handicap = p_rating_value WHERE id = p_match_lineup_id;
  ELSIF v_slot = 2 THEN
    UPDATE match_lineups SET player2_handicap = p_rating_value WHERE id = p_match_lineup_id;
  ELSIF v_slot = 3 THEN
    UPDATE match_lineups SET player3_handicap = p_rating_value WHERE id = p_match_lineup_id;
  ELSIF v_slot = 4 THEN
    UPDATE match_lineups SET player4_handicap = p_rating_value WHERE id = p_match_lineup_id;
  ELSIF v_slot = 5 THEN
    UPDATE match_lineups SET player5_handicap = p_rating_value WHERE id = p_match_lineup_id;
  END IF;

  INSERT INTO rating_edit_audit_log (
    actor_user_id, actor_type,
    target_member_id, target_match_lineup_id,
    rating_system, before_value, after_value,
    scope, reason, source,
    organization_id
  ) VALUES (
    v_actor_user_id, 'user',
    p_member_id, p_match_lineup_id,
    v_rating_system,
    CASE WHEN v_before IS NULL THEN NULL ELSE v_before::TEXT END,
    p_rating_value::TEXT,
    'per_match_lineup', p_reason, 'manual',
    v_organization_id
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

COMMENT ON FUNCTION set_match_lineup_rating(UUID, UUID, NUMERIC, TEXT) IS
  'Atomically updates a match-lineup slot''s handicap AND inserts a rating_edit_audit_log row. Caller must be authenticated and on the team roster (active) or an owner/admin of the league''s organization. Rejects if the member is not on the lineup. Returns the audit row id.';

-- See the comment block on recompute_member_rating below for why we
-- explicitly REVOKE from anon (Supabase grants EXECUTE to anon by default
-- on all public functions). authenticated keeps its grant — the function
-- body checks auth.uid() IS NOT NULL and team-roster / org-staff
-- membership before any data work.
REVOKE EXECUTE ON FUNCTION set_match_lineup_rating(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_match_lineup_rating(UUID, UUID, NUMERIC, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION set_match_lineup_rating(UUID, UUID, NUMERIC, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3b. RPC: recompute_member_rating
-- ----------------------------------------------------------------------------
-- Service-role-only path for automated recomputes (BCA points / percentage
-- after a match closes, future FargoRate sync via 'api' source). Performs:
--   - Field resolution: rating_system='points' → starting_handicap_3v3,
--     rating_system='percentage' → starting_handicap_5v5.
--     Other rating systems are not persisted on members yet (Fargo is
--     per-match-lineup; skill_level has no persistent column).
--   - Change-detection: skip the UPDATE + audit if before_value equals
--     p_new_value (avoids audit-flooding on every post-match recompute
--     where the rating didn't actually change).
--   - Atomic update + audit insert (scope='persistent').
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION recompute_member_rating(
  p_member_id     UUID,
  p_rating_system TEXT,
  p_new_value     NUMERIC,
  p_source        TEXT DEFAULT 'computed'
)
RETURNS UUID  -- returns the audit row id, or NULL when no change
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_before NUMERIC;
  v_audit_id UUID;
  v_actor_type TEXT;
BEGIN
  IF p_member_id IS NULL OR p_rating_system IS NULL OR p_new_value IS NULL THEN
    RAISE EXCEPTION 'recompute_member_rating: member_id, rating_system, and new_value are required';
  END IF;
  IF p_rating_system NOT IN ('points', 'percentage') THEN
    RAISE EXCEPTION 'recompute_member_rating: rating_system % does not have a persistent member-level column (only points / percentage are stored on members today)', p_rating_system;
  END IF;
  IF p_source NOT IN ('manual', 'computed', 'api', 'rescore') THEN
    RAISE EXCEPTION 'recompute_member_rating: invalid source %; must be manual / computed / api / rescore', p_source;
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

  -- 'manual' source implies a human actor; everything else is system/api.
  -- The actor_user_id is the authenticated caller (will be NULL for pure
  -- service_role contexts where no JWT is attached).
  v_actor_type := CASE p_source
    WHEN 'manual' THEN 'user'
    WHEN 'api' THEN 'api'
    ELSE 'system'
  END;

  -- Persistent recomputes don't have a single league/org context (a member
  -- plays in many leagues). organization_id is left NULL — the audit-log
  -- read UI for org owners will need a different surface for these rows
  -- (e.g. "members touched by this org's seasons" via a view). For v1,
  -- persistent rows are visible only to service-role consumers.
  INSERT INTO rating_edit_audit_log (
    actor_user_id, actor_type,
    target_member_id, target_match_lineup_id,
    rating_system, before_value, after_value,
    scope, reason, source,
    organization_id
  ) VALUES (
    auth.uid(), v_actor_type,
    p_member_id, NULL,
    p_rating_system,
    CASE WHEN v_before IS NULL THEN NULL ELSE v_before::TEXT END,
    p_new_value::TEXT,
    'persistent', NULL, p_source,
    NULL
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

COMMENT ON FUNCTION recompute_member_rating(UUID, TEXT, NUMERIC, TEXT) IS
  'Atomically updates a member''s persistent BCA handicap (starting_handicap_3v3 or _5v5) AND inserts an audit row, ONLY when the value is actually changing. Service-role only — automated recompute / API-sync path. Returns the audit row id, or NULL when no change.';

-- Supabase's baseline GRANTs EXECUTE on all public functions to anon and
-- authenticated explicitly (not just via PUBLIC). REVOKE FROM PUBLIC alone
-- does not strip those role-specific grants — we have to revoke from each
-- role by name. Without this, anon/authenticated callers could invoke this
-- service-role-only RPC directly.
REVOKE EXECUTE ON FUNCTION recompute_member_rating(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recompute_member_rating(UUID, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION recompute_member_rating(UUID, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION recompute_member_rating(UUID, TEXT, NUMERIC, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 3c. RPC: vacate_and_rescore_audit_marker
-- ----------------------------------------------------------------------------
-- Authenticated path (LO action). Inserts a marker row to the audit log
-- noting that rating changes from this match's vacate-rescore are coming.
-- Subsequent recompute_member_rating calls in the same flow correlate
-- with this marker via timestamp + organization (read UI groups them).
--
-- Marker rows have target_member_id = NULL (operation describes a match,
-- not a member) and source='rescore'.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION vacate_and_rescore_audit_marker(
  p_match_id UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_member_id UUID;
  v_organization_id UUID;
  v_rating_system TEXT;
  v_audit_id UUID;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'vacate_and_rescore_audit_marker requires an authenticated caller';
  END IF;
  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'vacate_and_rescore_audit_marker: match_id is required';
  END IF;

  -- Resolve organization + rating_system via match → season → league.
  SELECT l.organization_id, COALESCE(rlp.handicap_type, 'points')
  INTO v_organization_id, v_rating_system
  FROM matches m
  JOIN seasons s ON s.id = m.season_id
  JOIN leagues l ON l.id = s.league_id
  LEFT JOIN resolved_league_preferences rlp ON rlp.league_id = l.id
  WHERE m.id = p_match_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'vacate_and_rescore_audit_marker: could not resolve organization for match %', p_match_id;
  END IF;

  -- Authz: vacate-rescore is an LO action — caller must be owner/admin
  -- of the match's league's organization.
  SELECT id INTO v_actor_member_id FROM members WHERE user_id = v_actor_user_id LIMIT 1;
  IF NOT EXISTS (
    SELECT 1 FROM organization_staff os
    WHERE os.organization_id = v_organization_id
      AND os.member_id = v_actor_member_id
      AND os.position IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'vacate_and_rescore_audit_marker: caller is not an owner/admin of the match''s organization';
  END IF;

  INSERT INTO rating_edit_audit_log (
    actor_user_id, actor_type,
    target_member_id, target_match_lineup_id,
    rating_system, before_value, after_value,
    scope, reason, source,
    organization_id
  ) VALUES (
    v_actor_user_id, 'user',
    NULL, NULL,                           -- marker: no member, no lineup
    v_rating_system, NULL, NULL,          -- marker: no value change
    'persistent',                         -- nominal scope; the row is metadata
    COALESCE(p_reason, 'vacate-and-rescore for match ' || p_match_id::TEXT),
    'rescore',
    v_organization_id
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

COMMENT ON FUNCTION vacate_and_rescore_audit_marker(UUID, TEXT) IS
  'Inserts a rating-edit audit MARKER row recording that an LO has initiated a vacate-rescore for a match. Subsequent recompute_member_rating calls in the same flow correlate via the marker''s timestamp + organization. Caller must be owner/admin of the match''s organization.';

REVOKE EXECUTE ON FUNCTION vacate_and_rescore_audit_marker(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION vacate_and_rescore_audit_marker(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION vacate_and_rescore_audit_marker(UUID, TEXT) TO authenticated;
