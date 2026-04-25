-- Migration: org-scope placeholders + always-attribute invites
-- Purpose: Two related gaps:
--
--   1. invite_tokens.invited_by_member_id went nullable earlier today so the
--      members trigger could auto-create invites without a caller context.
--      But that leaves auto-invites without any attribution, which is wrong —
--      we DO know who created the placeholder (members.created_by_member_id).
--      Copying that value satisfies "every invite names a responsible human."
--
--   2. Placeholders aren't org-scoped in the schema. An LO viewing "my
--      placeholders" has to derive the org via team or creator chains.
--      Adding `members.organization_id` pins each placeholder to the
--      creator's organization at insert time, enabling efficient
--      org-scoped queries for future LO views / merge tools / placeholder
--      management.
--
-- For registered members (user_id IS NOT NULL), organization_id stays NULL —
-- a registered user can legitimately belong to teams across multiple orgs.
-- This column is a placeholder-only concept.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- ============================================================================
-- Helper: resolve an organization from a member (creator's org via priority)
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
-- Step 2: replace the placeholder-invite trigger to also attribute the
-- invite AND set members.organization_id at insert time
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_placeholder_invite_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set organization_id for placeholders at insert/email-change time if
  -- we can derive one from the creator. Registered members stay NULL.
  IF TG_OP = 'INSERT'
     AND NEW.user_id IS NULL
     AND NEW.organization_id IS NULL
     AND NEW.created_by_member_id IS NOT NULL THEN
    NEW.organization_id := resolve_member_primary_org(NEW.created_by_member_id);
  END IF;

  -- Only placeholders with a non-empty email need invites.
  IF NEW.user_id IS NOT NULL OR NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  -- Email change — cancel old pending invite (it was for a different person).
  IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE invite_tokens
       SET status = 'cancelled'
     WHERE member_id = NEW.id
       AND email <> lower(NEW.email)
       AND status = 'pending';
  END IF;

  -- Insert pending invite, attributing it to the placeholder's creator when
  -- known. Never anonymous going forward.
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

-- The trigger was previously AFTER — move to BEFORE so we can mutate NEW
-- (to set organization_id). Drop and recreate with the new timing.
DROP TRIGGER IF EXISTS members_ensure_invite_trigger ON members;

CREATE TRIGGER members_ensure_invite_trigger
BEFORE INSERT OR UPDATE OF email ON members
FOR EACH ROW
EXECUTE FUNCTION ensure_placeholder_invite_token();

-- Intentionally no backfill. This is pre-production; existing placeholder
-- rows are dev detritus and will wash out. All new inserts/updates go
-- through the trigger above and get full attribution.
