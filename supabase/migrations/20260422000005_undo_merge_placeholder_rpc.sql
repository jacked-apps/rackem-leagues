-- Migration: undo_merge_placeholder(archive_id) RPC
-- Purpose: Reverse a completed placeholder merge. Restores the placeholder
--          row from archived_placeholders.member_snapshot, then walks
--          transferred_rows and inverts each operation:
--            - {op: 'rewritten'}                → UPDATE t SET c = pp_id WHERE id = id
--            - {op: 'inserted_for_target'}      → DELETE FROM t WHERE id = id
--            - {op: 'deleted_for_placeholder'}  → INSERT row_data back
--
-- Target's post-merge activity is never in transferred_rows, so it stays with
-- the target automatically. The LO's mental model holds: "my 8 games go back
-- to the placeholder; John's new games stay with John."
--
-- Authz: service_role only, just like the merge RPC. The calling Edge
-- Function (supabase/functions/lo-undo-merge, landing in Unit 14) verifies
-- the caller is staff on the archive's organization_id before invoking.
-- p_caller_org_id is passed server-resolved from the JWT; re-checked here
-- against archive.organization_id as belt-and-suspenders.
--
-- Errors (returned as (false, error_message), no partial state):
--   - 'archive_not_found'    : archive_id doesn't exist
--   - 'already_undone'       : archive.undone_at is not NULL
--   - 'archive_expired'      : archive.expires_at < now()
--   - 'not_authorized'       : p_caller_org_id != archive.organization_id
--   - 'placeholder_id_taken' : a members row already exists at
--                              archive.placeholder_member_id (shouldn't
--                              happen under normal flow; guards against
--                              manual data surgery)
--
-- Dynamic SQL safety: the table name in transferred_rows is used in dynamic
-- UPDATE and DELETE statements via format(%I). Since transferred_rows is
-- written only by merge_placeholder_into_member_v2 — which itself sources
-- table names from information_schema, not user input — this is safe today.
-- Belt-and-suspenders: we additionally whitelist the table name against
-- information_schema before executing, so any stored value outside the set
-- of current public tables is rejected.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 5)

CREATE OR REPLACE FUNCTION undo_merge_placeholder(
  p_archive_id      UUID,
  p_caller_org_id   UUID,
  p_actor_member_id UUID
)
RETURNS TABLE (
  success           BOOLEAN,
  rows_restored     INT,
  missing_rows      INT,
  error_message     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archive              RECORD;
  v_entry                JSONB;
  v_op                   TEXT;
  v_table                TEXT;
  v_sql                  TEXT;
  v_rows_restored        INT := 0;
  v_missing_rows         INT := 0;
  v_affected_tables      JSONB := '{}'::JSONB;
  v_table_count          INT;
  v_exec_rows            INT;
  v_row_data             JSONB;
  v_row_id               UUID;
  v_col                  TEXT;
BEGIN
  -- ========================================================================
  -- Load and validate the archive row
  -- ========================================================================
  SELECT * INTO v_archive FROM archived_placeholders WHERE id = p_archive_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'archive_not_found'::TEXT;
    RETURN;
  END IF;

  -- Authorize BEFORE leaking state. A cross-org caller sees only
  -- 'not_authorized', never 'already_undone' / 'archive_expired' etc.
  IF v_archive.organization_id != p_caller_org_id THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'not_authorized'::TEXT;
    RETURN;
  END IF;

  IF v_archive.undone_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'already_undone'::TEXT;
    RETURN;
  END IF;

  IF v_archive.expires_at < now() THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'archive_expired'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM members WHERE id = v_archive.placeholder_member_id) THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'placeholder_id_taken'::TEXT;
    RETURN;
  END IF;

  -- ========================================================================
  -- Step 1: restore the placeholder row from the snapshot. jsonb_populate_record
  -- casts JSONB to the `members` composite type, so enums/arrays/timestamps
  -- are all handled natively without per-column type gymnastics.
  -- ========================================================================
  INSERT INTO members
  SELECT * FROM jsonb_populate_record(NULL::members, v_archive.member_snapshot);

  -- ========================================================================
  -- Step 2: walk transferred_rows and invert each operation
  -- ========================================================================
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_archive.transferred_rows)
  LOOP
    v_op    := v_entry ->> 'op';
    v_table := v_entry ->> 't';

    -- Whitelist the table name against current public tables. If someone
    -- somehow tampered with transferred_rows, we reject unknown tables
    -- rather than executing arbitrary dynamic SQL against them.
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = v_table;

    IF v_table_count = 0 THEN
      v_missing_rows := v_missing_rows + 1;
      CONTINUE;
    END IF;

    IF v_op = 'rewritten' THEN
      -- Invert a member-id rewrite: flip the column back to the placeholder.
      v_row_id := (v_entry ->> 'id')::UUID;
      v_col    := v_entry ->> 'c';

      -- Guard: column must actually exist on the table (defensive).
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = v_table AND column_name = v_col
      ) THEN
        v_missing_rows := v_missing_rows + 1;
        CONTINUE;
      END IF;

      v_sql := format('UPDATE %I SET %I = $1 WHERE id = $2', v_table, v_col);
      EXECUTE v_sql USING v_archive.placeholder_member_id, v_row_id;
      GET DIAGNOSTICS v_exec_rows = ROW_COUNT;
      IF v_exec_rows = 0 THEN
        -- Row was deleted between merge and undo — log as missing, continue.
        v_missing_rows := v_missing_rows + 1;
      ELSE
        v_rows_restored := v_rows_restored + 1;
      END IF;

    ELSIF v_op = 'inserted_for_target' THEN
      -- The merge inserted this row into team_players for the target.
      -- Undo: delete it.
      v_row_id := (v_entry ->> 'id')::UUID;
      v_sql := format('DELETE FROM %I WHERE id = $1', v_table);
      EXECUTE v_sql USING v_row_id;
      GET DIAGNOSTICS v_exec_rows = ROW_COUNT;
      IF v_exec_rows = 0 THEN
        v_missing_rows := v_missing_rows + 1;
      ELSE
        v_rows_restored := v_rows_restored + 1;
      END IF;

    ELSIF v_op = 'deleted_for_placeholder' THEN
      -- The merge deleted this row from team_players. Reinsert from row_data.
      -- jsonb_populate_record casts JSONB to the table's composite type, so
      -- enums/arrays/timestamps are handled natively. ON CONFLICT DO NOTHING
      -- is defensive (the row shouldn't exist — it was deleted during the
      -- merge — but guards against manual data surgery mid-window).
      v_row_data := v_entry -> 'row_data';
      v_sql := format(
        'INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1) ON CONFLICT DO NOTHING',
        v_table, v_table
      );
      BEGIN
        EXECUTE v_sql USING v_row_data;
        GET DIAGNOSTICS v_exec_rows = ROW_COUNT;
        IF v_exec_rows = 0 THEN
          v_missing_rows := v_missing_rows + 1;
        ELSE
          v_rows_restored := v_rows_restored + 1;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- A reinsert can fail if downstream data changed in a way that
          -- violates a constraint. Log and continue — the rest of the undo
          -- should still succeed.
          v_missing_rows := v_missing_rows + 1;
      END;

    ELSE
      -- Unknown op. Do not fail the whole undo; log and continue.
      v_missing_rows := v_missing_rows + 1;
    END IF;

    -- Per-table accounting for the audit row
    v_affected_tables := v_affected_tables || jsonb_build_object(
      v_table,
      COALESCE((v_affected_tables ->> v_table)::INT, 0) + 1
    );
  END LOOP;

  -- ========================================================================
  -- Mark the archive as undone
  -- ========================================================================
  UPDATE archived_placeholders
    SET undone_at = now()
    WHERE id = p_archive_id;

  -- ========================================================================
  -- Write audit row
  -- ========================================================================
  INSERT INTO placeholder_audit_log (
    action, actor_member_id, placeholder_member_id, target_member_id,
    organization_id, archive_id, affected_tables
  ) VALUES (
    'undo', p_actor_member_id, v_archive.placeholder_member_id, v_archive.target_member_id,
    v_archive.organization_id, v_archive.id,
    v_affected_tables || jsonb_build_object(
      '__summary', jsonb_build_object('restored', v_rows_restored, 'missing', v_missing_rows)
    )
  );

  RETURN QUERY SELECT TRUE, v_rows_restored, v_missing_rows, NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, v_rows_restored, v_missing_rows, SQLERRM::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION undo_merge_placeholder(UUID, UUID, UUID) TO service_role;

COMMENT ON FUNCTION undo_merge_placeholder IS
'Reverses a placeholder merge: restores the placeholder row from the archive snapshot, then walks transferred_rows and inverts each operation (UPDATE-rewritten / DELETE-inserted / INSERT-deleted). Target''s post-merge activity is never in transferred_rows, so it stays with the target automatically. Service role only. Errors are returned in the error_message column; no partial state on failure.';
