-- Migration: auto-archive placeholders when they're removed from their last team
-- Purpose: Implements R13 of the lifecycle plan — if a captain removes a
--          placeholder from a team and that was their only team, the
--          placeholder gets soft-archived automatically (restorable for
--          a year, all data preserved). Captain doesn't have to think
--          about it. The placeholder simply leaves their active queue.
--
-- Mechanism: AFTER DELETE trigger on team_players. When a row is deleted:
--   - If the member is a placeholder (user_id IS NULL)
--   - AND not already archived
--   - AND has no remaining team_players rows
-- THEN flip members.archived_at = now() and write an audit entry.
--
-- Merge-path guard: merge_v2 also deletes team_players rows during the
-- copy+delete dance for the placeholder being merged. We don't want this
-- trigger to fire during a merge — the merge has its own archive +
-- audit flow, and a duplicate "auto_archive" entry would confuse the
-- timeline. merge_v2 sets a transaction-local flag
-- `app.placeholder_merge_in_progress=true` before its team_players
-- DELETEs; this trigger checks the flag and bails when set.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 11)

-- ============================================================================
-- Trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_archive_orphan_placeholder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member          RECORD;
  v_remaining_teams INT;
  v_merge_active    TEXT;
BEGIN
  -- Skip during a merge — merge_v2 owns its own archive flow.
  v_merge_active := current_setting('app.placeholder_merge_in_progress', true);
  IF v_merge_active = 'true' THEN
    RETURN OLD;
  END IF;

  SELECT id, user_id, archived_at, organization_id
    INTO v_member
    FROM members
   WHERE id = OLD.member_id;

  -- Member gone (cascade DELETE), already a registered user, or already
  -- archived → nothing to do.
  IF NOT FOUND
     OR v_member.user_id IS NOT NULL
     OR v_member.archived_at IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Any teams left?
  SELECT COUNT(*)::INT INTO v_remaining_teams
    FROM team_players
   WHERE member_id = OLD.member_id;

  IF v_remaining_teams > 0 THEN
    RETURN OLD;
  END IF;

  -- Last team — archive automatically.
  UPDATE members SET archived_at = now() WHERE id = OLD.member_id;

  INSERT INTO placeholder_audit_log (
    action,
    actor_member_id,
    placeholder_member_id,
    target_member_id,
    organization_id,
    archive_id,
    affected_tables
  ) VALUES (
    'remove_from_team',
    -- We don't know the captain in this trigger context. Self-attribute
    -- so the NOT NULL constraint is satisfied; the affected_tables blob
    -- explains it was an automatic archive.
    OLD.member_id,
    OLD.member_id,
    NULL,
    v_member.organization_id,
    NULL,
    jsonb_build_object(
      'op', 'auto_archive',
      'reason', 'no_remaining_teams_after_delete',
      'last_team_id', OLD.team_id
    )
  );

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION auto_archive_orphan_placeholder IS
'AFTER DELETE trigger on team_players: when a placeholder loses their last team membership, automatically archive them. Skipped during merges via the app.placeholder_merge_in_progress session flag.';

DROP TRIGGER IF EXISTS team_players_auto_archive_orphan_placeholder ON team_players;

CREATE TRIGGER team_players_auto_archive_orphan_placeholder
AFTER DELETE ON team_players
FOR EACH ROW
EXECUTE FUNCTION auto_archive_orphan_placeholder();

-- ============================================================================
-- merge_v2: set the merge-in-progress flag so the trigger above bails
-- ============================================================================
-- Replacing the function body to add `set_config(...)` early, before any
-- team_players DELETE fires. Same signature, same semantics otherwise —
-- just the flag.
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
  -- Tell the team_players auto-archive trigger to stand down. Transaction-
  -- local so it doesn't leak between sessions.
  PERFORM set_config('app.placeholder_merge_in_progress', 'true', true);

  IF p_actor_role NOT IN ('invite_accept', 'lo_initiated') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0,
      format('Invalid actor_role %L; must be invite_accept or lo_initiated', p_actor_role)::TEXT;
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

  -- Org-scope: accept either members.organization_id OR team-chain match.
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

  SELECT to_jsonb(m.*) INTO v_member_snapshot FROM members m WHERE id = p_placeholder_member_id;

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

  UPDATE invite_tokens
  SET status = 'claimed', claimed_by_user_id = v_target_user_id, claimed_at = now()
  WHERE member_id = p_placeholder_member_id AND status = 'pending';

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

  DELETE FROM members WHERE id = p_placeholder_member_id;

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
