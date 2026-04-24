-- Migration: split the placeholder trigger (before vs after)
-- Purpose: Fix a regression introduced in 20260422000011. That migration
--          moved the trigger to BEFORE INSERT so it could mutate
--          NEW.organization_id — but a BEFORE trigger can't INSERT into
--          invite_tokens yet, because invite_tokens.member_id REFERENCES
--          members(id) and the members row doesn't exist until AFTER the
--          insert visibility point.
--
-- Fix: two triggers, one function each.
--   - BEFORE INSERT: set NEW.organization_id (pure row-mutation, no side
--     effects against other tables)
--   - AFTER INSERT/UPDATE OF email: create/cancel invite_tokens (side
--     effects against invite_tokens — needs the member row committed)
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- ============================================================================
-- BEFORE trigger: set organization_id on new placeholders
-- ============================================================================
CREATE OR REPLACE FUNCTION set_placeholder_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NULL
     AND NEW.organization_id IS NULL
     AND NEW.created_by_member_id IS NOT NULL THEN
    NEW.organization_id := resolve_member_primary_org(NEW.created_by_member_id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_placeholder_organization_id IS
'BEFORE INSERT trigger for members: populates organization_id on new placeholder rows from the creator''s primary org. Pure row-mutation; no side effects.';

DROP TRIGGER IF EXISTS members_set_organization_id_trigger ON members;
CREATE TRIGGER members_set_organization_id_trigger
BEFORE INSERT ON members
FOR EACH ROW
EXECUTE FUNCTION set_placeholder_organization_id();

-- ============================================================================
-- AFTER trigger: ensure invite_tokens exists for placeholder+email
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_placeholder_invite_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only placeholders with a non-empty email need invites.
  IF NEW.user_id IS NOT NULL OR NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  -- Email change: cancel any pending invites for the old email (that invite
  -- was addressed to a different recipient — reusing it would be wrong).
  IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE invite_tokens
       SET status = 'cancelled'
     WHERE member_id = NEW.id
       AND email <> lower(NEW.email)
       AND status = 'pending';
  END IF;

  -- Insert pending invite, attributing it to the placeholder's creator when
  -- we know it. Never anonymous going forward.
  INSERT INTO invite_tokens (member_id, email, status, invited_by_member_id)
  SELECT NEW.id, lower(NEW.email), 'pending', NEW.created_by_member_id
  WHERE NOT EXISTS (
    SELECT 1 FROM invite_tokens
    WHERE member_id = NEW.id
      AND email = lower(NEW.email)
      AND status = 'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_ensure_invite_trigger ON members;
CREATE TRIGGER members_ensure_invite_trigger
AFTER INSERT OR UPDATE OF email ON members
FOR EACH ROW
EXECUTE FUNCTION ensure_placeholder_invite_token();
