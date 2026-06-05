-- Onboarding cold-start cascade — Unit 4: the approve engine.
--
-- The approver's one-tap decision on a pending team_join_request:
--   Add     → put the joiner's registered member on the roster (no merge)
--   Replace → merge a chosen placeholder INTO the joiner's member (spot + record)
--   Decline → mark the request rejected, no roster change
--
-- Implemented as a SECURITY DEFINER RPC (not an edge function): RLS is off, the
-- merge it calls is already a DEFINER RPC, and an RPC is consistent with the
-- cascade's other server-side boundaries (get_team_join_view, request_team_join)
-- and far simpler to test. It still does everything the plan demands:
--   * reads team_id FROM THE REQUEST ROW (never client input)
--   * resolves org via teams.league_id → leagues.organization_id
--   * authorizes caller = team captain OR org staff (nullable captain → staff only)
--   * actor_member resolved from auth.uid() (never client input)
--   * re-reads the request FOR UPDATE and short-circuits a non-pending row to a
--     friendly "already handled" (the double-approve race)
--   * inspects the merge RPC's success flag (it returns success=false, not a
--     throw) and refuses to mark approved on a failed merge
--
-- This migration ALSO widens the 'captain_approve' actor_role in BOTH places it
-- must live — the merge RPC whitelist AND the archived_placeholders CHECK — kept
-- together so neither half ever ships without the other (a whitelist-only change
-- would make every Replace silent-fail when the merge tries to archive the role).
--
-- See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 4).

-- 1. Allow the merge to archive a captain-approved merge.
ALTER TABLE "public"."archived_placeholders"
  DROP CONSTRAINT IF EXISTS "archived_placeholders_actor_role_check";
ALTER TABLE "public"."archived_placeholders"
  ADD CONSTRAINT "archived_placeholders_actor_role_check"
  CHECK ("actor_role" = ANY (ARRAY['invite_accept'::text, 'lo_initiated'::text, 'captain_approve'::text]));

-- 2. Recreate merge_placeholder_into_member_v2 VERBATIM from
--    20260422000020_merge_v2_org_check_via_members_column.sql, changing ONLY the
--    actor_role whitelist (and its error text) to admit 'captain_approve'. The
--    rest of the body is byte-for-byte the current definition.
CREATE OR REPLACE FUNCTION merge_placeholder_into_member_v2(
  p_placeholder_member_id UUID,
  p_target_member_id      UUID,
  p_actor_member_id       UUID,
  p_actor_role            TEXT,
  p_organization_id       UUID
)
RETURNS TABLE (
  success            BOOLEAN,
  archive_id         UUID,
  tables_updated     INT,
  total_rows_updated INT,
  error_message      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pp_user_id           UUID;
  v_target_user_id       UUID;
  v_tables_count         INT := 0;
  v_total_rows           INT := 0;
  v_row_count            INT := 0;
  v_fk_record            RECORD;
  v_tp_rec               RECORD;
  v_sql                  TEXT;
  v_member_snapshot      JSONB;
  v_transferred_rows     JSONB := '[]'::JSONB;
  v_affected_tables      JSONB := '{}'::JSONB;
  v_archive_id           UUID;
  v_new_tp_id            UUID;
  v_batch_rewrites       JSONB;
  v_conflict_match_ids   UUID[];
BEGIN
  IF p_actor_role NOT IN ('invite_accept', 'lo_initiated', 'captain_approve') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0,
      format('Invalid actor_role %L; must be invite_accept, lo_initiated, or captain_approve', p_actor_role)::TEXT;
    RETURN;
  END IF;

  SELECT user_id INTO v_pp_user_id FROM members WHERE id = p_placeholder_member_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'Placeholder member not found'::TEXT;
    RETURN;
  END IF;
  IF v_pp_user_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0,
      'Source member is not a placeholder (already has user_id)'::TEXT;
    RETURN;
  END IF;

  SELECT user_id INTO v_target_user_id FROM members WHERE id = p_target_member_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'Target member not found'::TEXT;
    RETURN;
  END IF;
  IF v_target_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0,
      'Target member is not registered (no user_id)'::TEXT;
    RETURN;
  END IF;

  IF p_placeholder_member_id = p_target_member_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'Cannot merge member into itself'::TEXT;
    RETURN;
  END IF;

  -- Org-scope: accept either members.organization_id (placeholder
  -- attributed to this org by the creation trigger) OR a team-chain
  -- match (placeholder is on a team in this org).
  IF NOT EXISTS (
       SELECT 1 FROM members
       WHERE id = p_placeholder_member_id
         AND organization_id = p_organization_id
     )
     AND NOT EXISTS (
       SELECT 1
       FROM team_players tp
       JOIN teams     t ON t.id = tp.team_id
       JOIN seasons   s ON s.id = t.season_id
       JOIN leagues   l ON l.id = s.league_id
       WHERE tp.member_id = p_placeholder_member_id
         AND l.organization_id = p_organization_id
     ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0,
      format('Placeholder %s is not in organization %s',
             p_placeholder_member_id, p_organization_id)::TEXT;
    RETURN;
  END IF;

  -- Same-match collision detection
  SELECT array_agg(DISTINCT ml_p.match_id)
  INTO v_conflict_match_ids
  FROM match_lineups ml_p
  JOIN match_lineups ml_t ON ml_t.match_id = ml_p.match_id
  WHERE (ml_p.player1_id = p_placeholder_member_id OR ml_p.player2_id = p_placeholder_member_id
         OR ml_p.player3_id = p_placeholder_member_id OR ml_p.player4_id = p_placeholder_member_id
         OR ml_p.player5_id = p_placeholder_member_id)
    AND (ml_t.player1_id = p_target_member_id OR ml_t.player2_id = p_target_member_id
         OR ml_t.player3_id = p_target_member_id OR ml_t.player4_id = p_target_member_id
         OR ml_t.player5_id = p_target_member_id);

  IF v_conflict_match_ids IS NOT NULL AND array_length(v_conflict_match_ids, 1) > 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0,
      format('merge_would_create_duplicate_in_match: match_ids=%s',
             v_conflict_match_ids::TEXT)::TEXT;
    RETURN;
  END IF;

  -- Snapshot
  SELECT to_jsonb(m.*) INTO v_member_snapshot FROM members m WHERE id = p_placeholder_member_id;

  -- team_players: copy + delete (track both for undo)
  FOR v_tp_rec IN
    SELECT tp.* FROM team_players tp WHERE tp.member_id = p_placeholder_member_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM team_players
      WHERE team_id = v_tp_rec.team_id
        AND season_id = v_tp_rec.season_id
        AND member_id = p_target_member_id
    ) THEN
      INSERT INTO team_players (
        member_id, team_id, season_id, is_captain, individual_wins,
        individual_losses, skill_level, status, joined_at
      )
      VALUES (
        p_target_member_id, v_tp_rec.team_id, v_tp_rec.season_id, v_tp_rec.is_captain,
        v_tp_rec.individual_wins, v_tp_rec.individual_losses, v_tp_rec.skill_level,
        v_tp_rec.status, v_tp_rec.joined_at
      )
      RETURNING id INTO v_new_tp_id;

      v_transferred_rows := v_transferred_rows || jsonb_build_object(
        't', 'team_players', 'id', v_new_tp_id, 'op', 'inserted_for_target'
      );
      v_total_rows := v_total_rows + 1;
    END IF;

    v_transferred_rows := v_transferred_rows || jsonb_build_object(
      't', 'team_players', 'row_data', to_jsonb(v_tp_rec), 'op', 'deleted_for_placeholder'
    );
  END LOOP;

  DELETE FROM team_players WHERE member_id = p_placeholder_member_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_total_rows := v_total_rows + v_row_count;
  IF v_row_count > 0 THEN
    v_tables_count := v_tables_count + 1;
    v_affected_tables := v_affected_tables || jsonb_build_object('team_players', v_row_count);
  END IF;

  -- Schema-aware FK loop
  FOR v_fk_record IN
    SELECT tc.table_schema, tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'members'
      AND ccu.column_name = 'id'
      AND tc.table_schema = 'public'
      AND tc.table_name != 'team_players'
      AND NOT (tc.table_name = 'invite_tokens' AND kcu.column_name = 'member_id')
      AND NOT (tc.table_name = 'archived_placeholders')
      AND NOT (tc.table_name = 'placeholder_audit_log')
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = tc.table_schema
          AND col.table_name   = tc.table_name
          AND col.column_name  = 'id'
      )
  LOOP
    v_sql := format(
      'SELECT jsonb_agg(jsonb_build_object(''t'', %L, ''id'', id, ''c'', %L, ''op'', ''rewritten''))
       FROM %I.%I WHERE %I = $1',
      v_fk_record.table_name,
      v_fk_record.column_name,
      v_fk_record.table_schema,
      v_fk_record.table_name,
      v_fk_record.column_name
    );
    EXECUTE v_sql INTO v_batch_rewrites USING p_placeholder_member_id;

    IF v_batch_rewrites IS NOT NULL THEN
      v_transferred_rows := v_transferred_rows || v_batch_rewrites;
    END IF;

    v_sql := format(
      'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
      v_fk_record.table_schema, v_fk_record.table_name,
      v_fk_record.column_name, v_fk_record.column_name
    );
    EXECUTE v_sql USING p_target_member_id, p_placeholder_member_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_total_rows := v_total_rows + v_row_count;
    IF v_row_count > 0 THEN
      v_tables_count := v_tables_count + 1;
      v_affected_tables := v_affected_tables || jsonb_build_object(
        v_fk_record.table_name || '.' || v_fk_record.column_name, v_row_count
      );
    END IF;
  END LOOP;

  -- invite_tokens: mark claimed
  UPDATE invite_tokens
  SET status = 'claimed', claimed_by_user_id = v_target_user_id, claimed_at = now()
  WHERE member_id = p_placeholder_member_id AND status = 'pending';

  -- Archive
  INSERT INTO archived_placeholders (
    placeholder_member_id, target_member_id, organization_id,
    actor_member_id, actor_role,
    member_snapshot, transferred_rows
  ) VALUES (
    p_placeholder_member_id, p_target_member_id, p_organization_id,
    p_actor_member_id, p_actor_role,
    v_member_snapshot, v_transferred_rows
  )
  RETURNING id INTO v_archive_id;

  -- Delete placeholder
  DELETE FROM members WHERE id = p_placeholder_member_id;

  -- Audit
  INSERT INTO placeholder_audit_log (
    action, actor_member_id, placeholder_member_id, target_member_id,
    organization_id, archive_id, affected_tables
  ) VALUES (
    'merge', p_actor_member_id, p_placeholder_member_id, p_target_member_id,
    p_organization_id, v_archive_id, v_affected_tables
  );

  RETURN QUERY SELECT TRUE, v_archive_id, v_tables_count, v_total_rows, NULL::TEXT;

EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, v_tables_count, v_total_rows,
      ('FK violation — table still references placeholder: ' || SQLERRM)::TEXT;
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, v_tables_count, v_total_rows, SQLERRM::TEXT;
END;
$$;

-- 3. The approve engine.
CREATE OR REPLACE FUNCTION "public"."approve_join_request"(
  "p_request_id" "uuid",
  "p_action" "text",
  "p_claimed_member_id" "uuid" DEFAULT NULL
)
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user        uuid := auth.uid();
  v_actor       uuid;        -- caller's member id
  v_req         team_join_requests%ROWTYPE;
  v_captain_id  uuid;
  v_org_id      uuid;
  v_season_id   uuid;
  v_placeholder uuid;
  v_merge       RECORD;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_action NOT IN ('add', 'replace', 'decline') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_action');
  END IF;

  -- Lock the request; team_id comes from the row, never the caller.
  SELECT * INTO v_req FROM team_join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- The double-approve race: anything but pending is already settled.
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_handled', 'status', v_req.status);
  END IF;

  -- Resolve the team's captain + organization (teams.league_id → leagues).
  SELECT t.captain_id, t.season_id, l.organization_id
    INTO v_captain_id, v_season_id, v_org_id
    FROM teams t
    JOIN leagues l ON l.id = t.league_id
   WHERE t.id = v_req.team_id;

  -- Caller's member identity.
  SELECT id INTO v_actor FROM members WHERE user_id = v_user LIMIT 1;
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  -- Authz: the team captain OR org staff (owner is staff). Nullable captain
  -- (bye/edge team) falls through to staff-only.
  IF NOT (
    (v_captain_id IS NOT NULL AND v_captain_id = v_actor)
    OR EXISTS (
      SELECT 1 FROM organization_staff os
       WHERE os.organization_id = v_org_id AND os.member_id = v_actor
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  -- ---- Decline ---------------------------------------------------------
  IF p_action = 'decline' THEN
    UPDATE team_join_requests
       SET status = 'rejected', resolved_at = now(), resolved_by_member_id = v_actor
     WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', true, 'reason', 'declined');
  END IF;

  -- Both Add and Replace need a registered joiner to land on the roster.
  IF v_req.requested_member_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_target');
  END IF;

  -- ---- Replace (merge a placeholder into the joiner's member) ----------
  IF p_action = 'replace' THEN
    v_placeholder := COALESCE(p_claimed_member_id, v_req.claimed_member_id);
    IF v_placeholder IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_placeholder');
    END IF;

    SELECT * INTO v_merge FROM merge_placeholder_into_member_v2(
      v_placeholder, v_req.requested_member_id, v_actor, 'captain_approve', v_org_id
    );
    IF NOT v_merge.success THEN
      -- Don't mark approved on a failed merge; surface the engine's reason.
      RETURN jsonb_build_object('ok', false, 'reason', 'merge_failed',
                                'detail', v_merge.error_message);
    END IF;

    UPDATE team_join_requests
       SET status = 'approved', resolved_at = now(), resolved_by_member_id = v_actor
     WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', true, 'reason', 'replaced');
  END IF;

  -- ---- Add (put the joiner's member on the roster, no merge) -----------
  INSERT INTO team_players (team_id, member_id, season_id, status, is_captain)
  VALUES (v_req.team_id, v_req.requested_member_id, v_season_id, 'active', false)
  ON CONFLICT (team_id, member_id) DO NOTHING;

  UPDATE team_join_requests
     SET status = 'approved', resolved_at = now(), resolved_by_member_id = v_actor
   WHERE id = v_req.id;
  RETURN jsonb_build_object('ok', true, 'reason', 'added');
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."approve_join_request"("uuid", "text", "uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."approve_join_request"("uuid", "text", "uuid") IS
  'Onboarding cascade (Unit 4): captain/org-staff one-tap decision on a pending team_join_request — Add / Replace (merge placeholder→member, role captain_approve) / Decline. Server-side authz + actor from auth.uid(); FOR UPDATE race-guard. See docs/plans/2026-05-29-001.';
