-- Migration: audit trigger for in-place placeholder→registered conversion
-- Purpose: Close the audit gap at the /register?claim=... flow. That flow
--          UPDATEs a placeholder's user_id in place (turning the same row
--          into a registered user) without going through merge_v2 — so the
--          archived_placeholders table and placeholder_audit_log never
--          learned about it. An LO looking at audit history would see no
--          record of placeholders that got claimed this way.
--
-- Fix: a trigger on members AFTER UPDATE OF user_id. When user_id goes
-- from NULL to a value on a row that previously had an email (i.e., a
-- placeholder), write a 'register_claim' audit entry. The row's id stays
-- the same (no merge happened), so placeholder_member_id and
-- target_member_id are both the same id — that's the correct semantic
-- for an in-place conversion.
--
-- Also consumes any pending invite_token for the old email by setting it
-- to 'claimed' with the new user as claimed_by_user_id. This was
-- previously only done for the merge path; register-claim skipped it.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- ============================================================================
-- Step 1: extend the audit log's action CHECK with 'register_claim'
-- ============================================================================
ALTER TABLE placeholder_audit_log
  DROP CONSTRAINT placeholder_audit_log_action_check;

ALTER TABLE placeholder_audit_log
  ADD CONSTRAINT placeholder_audit_log_action_check
  CHECK (action IN ('merge', 'undo', 'delete_no_stats', 'remove_from_team', 'register_claim'));

-- ============================================================================
-- Step 2: trigger function — audit + consume invite when user_id fills in
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_placeholder_register_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when user_id transitions NULL → something on a row that was
  -- a placeholder (had an email). Registered users setting user_id from
  -- nowhere (new registrations that create fresh rows) aren't in scope —
  -- their row doesn't exist yet in the pre-image.
  IF OLD.user_id IS NOT NULL OR NEW.user_id IS NULL OR OLD.email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Consume any pending invite_tokens for the placeholder's email. This
  -- mirrors what merge_v2 does for merge-based claims.
  UPDATE invite_tokens
     SET status = 'claimed',
         claimed_by_user_id = NEW.user_id,
         claimed_at = now()
   WHERE member_id = NEW.id
     AND status = 'pending';

  -- Write the audit row. Same id for placeholder and target because this
  -- is an in-place conversion (no separate merge target row).
  INSERT INTO placeholder_audit_log (
    action, actor_member_id, placeholder_member_id, target_member_id,
    organization_id, archive_id, affected_tables
  )
  VALUES (
    'register_claim',
    NEW.id,
    NEW.id,
    NEW.id,
    NEW.organization_id,
    NULL,
    jsonb_build_object(
      'method', 'in_place_user_id_update',
      'auth_user_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION audit_placeholder_register_claim IS
'AFTER UPDATE OF user_id trigger. When a placeholder row (email set, user_id NULL) gets its user_id filled in-place, writes a register_claim audit entry and marks any pending invite_tokens as claimed. Covers the /register?claim=... flow so no claim path is unaudited.';

DROP TRIGGER IF EXISTS members_audit_register_claim_trigger ON members;

CREATE TRIGGER members_audit_register_claim_trigger
AFTER UPDATE OF user_id ON members
FOR EACH ROW
EXECUTE FUNCTION audit_placeholder_register_claim();
