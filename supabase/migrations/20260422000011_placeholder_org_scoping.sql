-- Migration: org-scope placeholders + auto-create attributed invites
-- Purpose: Two related guarantees, enforced as DB-level invariants:
--
--   1. Placeholders are org-scoped — each one carries a
--      `members.organization_id` resolved from the creator's primary
--      organization at insert time. Lets LO surfaces filter to "my org"
--      cleanly. NULL for registered members (they span orgs).
--
--   2. Every placeholder with a non-empty email has a pending
--      invite_tokens row, attributed to the placeholder's creator.
--      Closes the latent dead-end mode where a captain typed an email
--      but no claim link ever existed (Tuesday-incident class).
--
-- Implemented as TWO triggers because of one subtle Postgres rule:
--   - BEFORE INSERT can mutate NEW (used to set organization_id) but
--     can't INSERT into invite_tokens — invite_tokens.member_id
--     REFERENCES members(id) and the row isn't visible until AFTER.
--   - AFTER INSERT/UPDATE OF email handles the invite_tokens side
--     once the member row is committed.
--
-- Both triggers are no-ops for registered members (user_id IS NOT NULL).
-- The invite trigger references members.created_by_member_id which is
-- added in 20260422000010 — file ordering ensures the column exists
-- by the time these triggers run.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- ============================================================================
-- Step 1: members.organization_id column
-- ============================================================================
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_members_organization_id
  ON members (organization_id)
  WHERE organization_id IS NOT NULL;

COMMENT ON COLUMN members.organization_id IS
'Placeholder-only: the org the placeholder belongs to, resolved at insert from the creator''s primary org. NULL for registered members (they can span orgs).';

-- ============================================================================
-- Step 2: helper — resolve a member's primary organization
-- ============================================================================
CREATE OR REPLACE FUNCTION resolve_member_primary_org(p_member_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  -- Priority: owner > staff > captain > player. First match wins. Returns
  -- NULL if none apply (orphan member with no affiliation).
  SELECT COALESCE(
    (SELECT org.id FROM organizations org WHERE org.created_by = p_member_id LIMIT 1),
    (SELECT os.organization_id FROM organization_staff os WHERE os.member_id = p_member_id LIMIT 1),
    (SELECT l.organization_id
       FROM teams t
       JOIN seasons s ON s.id = t.season_id
       JOIN leagues l ON l.id = s.league_id
      WHERE t.captain_id = p_member_id
      LIMIT 1),
    (SELECT l.organization_id
       FROM team_players tp
       JOIN teams t ON t.id = tp.team_id
       JOIN seasons s ON s.id = t.season_id
       JOIN leagues l ON l.id = s.league_id
      WHERE tp.member_id = p_member_id
      LIMIT 1)
  );
$$;

COMMENT ON FUNCTION resolve_member_primary_org IS
'Given a member_id, return the UUID of their primary organization using priority order: org-owner > org-staff > team-captain > team-player. NULL if the member has no org affiliation.';

-- ============================================================================
-- Step 3: BEFORE INSERT trigger — set NEW.organization_id on placeholders
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
'BEFORE INSERT trigger for members: populates organization_id on new placeholder rows from the creator''s primary org. Pure row-mutation; no side effects against other tables.';

DROP TRIGGER IF EXISTS members_set_organization_id_trigger ON members;
CREATE TRIGGER members_set_organization_id_trigger
BEFORE INSERT ON members
FOR EACH ROW
EXECUTE FUNCTION set_placeholder_organization_id();

-- ============================================================================
-- Step 4: AFTER INSERT/UPDATE OF email trigger — ensure invite_tokens row
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

  -- Email change: cancel any pending invites for the old email (that
  -- invite was addressed to a different recipient — reusing it would
  -- be wrong).
  IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE invite_tokens
       SET status = 'cancelled'
     WHERE member_id = NEW.id
       AND email <> lower(NEW.email)
       AND status = 'pending';
  END IF;

  -- Insert pending invite, attributed to the placeholder's creator when
  -- known. NOT EXISTS gate (rather than ON CONFLICT) because
  -- unique_pending_invite is DEFERRABLE and Postgres won't accept it as
  -- a conflict arbiter. The unique index still catches genuine races as
  -- a last line of defense.
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

COMMENT ON FUNCTION ensure_placeholder_invite_token IS
'AFTER INSERT/UPDATE OF email trigger for members: guarantees that every placeholder with a non-empty email has a pending invite_tokens row, attributed to the creator. Cancels stale pending invites when email changes.';

DROP TRIGGER IF EXISTS members_ensure_invite_trigger ON members;
CREATE TRIGGER members_ensure_invite_trigger
AFTER INSERT OR UPDATE OF email ON members
FOR EACH ROW
EXECUTE FUNCTION ensure_placeholder_invite_token();

-- Intentionally no backfill. This is pre-production; existing
-- placeholder rows are dev detritus and will wash out. New inserts and
-- email updates go through the triggers above.
