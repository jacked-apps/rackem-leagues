-- Migration: merge_placeholder_into_member_v2 — snapshot + audit + authz
-- Purpose: Superset of the existing merge function that records everything
--          needed to undo the merge later, writes an audit entry, enforces
--          org scope, and blocks same-match collisions before any rewrite.
--          Shared by the invite-accept (R16) and LO-initiated (R17) paths.
--
-- Compatibility: the existing merge_placeholder_into_member (v1) is
-- INTENTIONALLY LEFT IN PLACE. Migrating the sole caller (the
-- claim-placeholder Edge Function) to v2 is part of this branch (Unit 12
-- in the plan). v1 can be dropped in a follow-up migration once all
-- callers have moved.
--
-- Parameters added (all server-resolved from JWT by the calling Edge
-- Function — never accepted from client request bodies, which would let a
-- valid LO falsify audit rows or spoof another org):
--   p_actor_member_id, p_actor_role, p_organization_id
--
-- Org-scope check accepts EITHER:
--   - members.organization_id matches p_organization_id (set by the
--     creation trigger for new placeholders), OR
--   - the placeholder is on a team in the org (legacy chain, still
--     valid for placeholders that predate the column)
-- Both are legitimate ownership signals.
--
-- Transferred-rows structure (the undo lookup index for Unit 5):
--   Entry A: {t: <table>, id: <uuid>, c: <column>, op: 'rewritten'}
--     Row had its member-referencing column rewritten from placeholder to
--     target. Undo: UPDATE <t> SET <c> = placeholder_id WHERE id = <id>.
--
--   Entry B: {t: 'team_players', id: <uuid>, op: 'inserted_for_target'}
--     Row newly inserted for the target because the placeholder was on a
--     team/season the target was not. Undo: DELETE FROM t WHERE id = <id>.
--
--   Entry C: {t: 'team_players', row_data: {...}, op: 'deleted_for_placeholder'}
--     Row previously owned by the placeholder, deleted during merge. Undo:
--     INSERT the row back. (team_players uses copy+delete to respect its
--     (team_id, season_id, member_id) uniqueness; other FK tables use the
--     simpler rewrite path via the schema-aware loop.)
--
-- Safety: foreign_key_violation at DELETE-placeholder time surfaces as a
-- clear error naming the offending table (same as v1). Same-match
-- collisions raise 'merge_would_create_duplicate_in_match' BEFORE any
-- rewrite — a member appearing twice in one match's lineup corrupts stats
-- permanently and cannot be cleanly undone.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 4)

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
  -- ========================================================================
  -- VALIDATE actor_role
  -- ========================================================================
  IF p_actor_role NOT IN ('invite_accept', 'lo_initiated') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0,
      format('Invalid actor_role %L; must be invite_accept or lo_initiated', p_actor_role)::TEXT;
    RETURN;
  END IF;

  -- ========================================================================
  -- VALIDATE placeholder
  -- ========================================================================
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

  -- ========================================================================
  -- VALIDATE target
  -- ========================================================================
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

  -- ========================================================================
  -- VALIDATE org scope — accept either members.organization_id (set by
  -- the creation trigger for new placeholders) OR a team-chain match
  -- (legacy placeholders that predate the column). Both are legitimate
  -- ownership signals.
  -- ========================================================================
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

  -- ========================================================================
  -- COLLISION: same-match, placeholder AND target both in lineup
  -- ========================================================================
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

  -- ========================================================================
  -- SNAPSHOT: capture the placeholder's members row
  -- ========================================================================
  SELECT to_jsonb(m.*) INTO v_member_snapshot FROM members m WHERE id = p_placeholder_member_id;

  -- ========================================================================
  -- SPECIAL: team_players (copy+delete; track both sides for undo)
  -- ========================================================================
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

  -- ========================================================================
  -- SCHEMA-AWARE: all other member-referencing FKs
  -- ========================================================================
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
      AND tc.table_name != 'team_players'                                      -- handled above
      AND NOT (tc.table_name = 'invite_tokens' AND kcu.column_name = 'member_id')  -- audit breadcrumb
      AND NOT (tc.table_name = 'archived_placeholders')                         -- archive rows never merge
      AND NOT (tc.table_name = 'placeholder_audit_log')                         -- audit log never merges
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

  -- ========================================================================
  -- invite_tokens: mark any pending invites as claimed (audit breadcrumb,
  -- not a member_id rewrite — kept out of transferred_rows)
  -- ========================================================================
  UPDATE invite_tokens
  SET status = 'claimed', claimed_by_user_id = v_target_user_id, claimed_at = now()
  WHERE member_id = p_placeholder_member_id AND status = 'pending';

  -- ========================================================================
  -- Archive snapshot
  -- ========================================================================
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

  -- ========================================================================
  -- Delete placeholder (FK violations here surface as clear errors)
  -- ========================================================================
  DELETE FROM members WHERE id = p_placeholder_member_id;

  -- ========================================================================
  -- Audit row
  -- ========================================================================
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

GRANT EXECUTE ON FUNCTION merge_placeholder_into_member_v2 TO service_role;

COMMENT ON FUNCTION merge_placeholder_into_member_v2 IS
'Snapshot-capturing, audit-logging, org-scoped version of merge_placeholder_into_member. Records enough state in archived_placeholders.transferred_rows to fully reverse the merge via undo_merge_placeholder. v1 is preserved for backward compatibility; callers migrate to v2 per-feature and v1 is dropped in a follow-up.';
