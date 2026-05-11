-- ============================================================================
-- HOUSE_RULES TABLE + RLS + VIEW + rules_page_events EXTENSION
--
-- Branch 2 of the rules-feature family. LOs author house rules at two scopes
-- (organization-wide or league-specific); players see them layered on top of
-- CSI rules in the /rules reader.
--
-- Key design decisions (see docs/plans/2026-04-19-001-feat-league-house-rules-plan.md):
--   * Two nullable FK columns (organization_id, league_id) with ON DELETE
--     CASCADE and a mutual-exclusion CHECK — not a polymorphic scope_id,
--     which would prevent referential integrity and PostgREST joins.
--   * A VIEW `house_rules_with_scope_name` left-joins both parent tables so
--     clients can SELECT a single `scope_name` without polymorphic JOINs.
--   * RLS: world-readable SELECT (same posture as CSI rules). Write access is
--     restricted via SECURITY DEFINER function `can_write_house_rule_org` to
--     organization_staff members with position = 'owner' or 'admin'. The
--     'league_rep' position is intentionally read-only in v1 pending a
--     per-league assignment mechanism.
--   * Plain-text body only: `body` is text[], rendered as React <p> children
--     with default auto-escaping. Length caps (title ≤ 120, body ≤ 50
--     elements, each element ≤ 4000 chars) enforced at the DB layer.
--   * `rules_page_events` is extended with four new event types + optional
--     scope_type / scope_id columns. The existing event_type CHECK constraint
--     is dropped and recreated.
-- ============================================================================

SET search_path = public;

-- ============================================================================
-- house_rules table
-- ============================================================================

CREATE TABLE IF NOT EXISTS house_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Exactly one of these two is populated (enforced via CHECK below).
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,

  -- Which game this rule applies to (slug from Branch 1's registry, or 'general').
  game TEXT NOT NULL CHECK (char_length(game) <= 40),

  -- How this rule relates to the CSI rulebook.
  effect_type TEXT NOT NULL CHECK (effect_type IN ('override', 'enhance', 'standalone')),

  -- idMap key from Branch 1's cleaned data (e.g., "8-ball:2-2"). Required for
  -- override/enhance, forbidden for standalone.
  related_rule_id TEXT CHECK (related_rule_id IS NULL OR char_length(related_rule_id) <= 40),

  -- Display content.
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body TEXT[] NOT NULL DEFAULT '{}',

  -- Audit.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),

  -- Exactly one scope populated.
  CONSTRAINT house_rules_scope_exclusive CHECK (
    (organization_id IS NOT NULL) <> (league_id IS NOT NULL)
  ),

  -- Effect type ↔ related_rule_id relationship.
  CONSTRAINT house_rules_effect_related CHECK (
    (effect_type = 'standalone' AND related_rule_id IS NULL) OR
    (effect_type IN ('override', 'enhance') AND related_rule_id IS NOT NULL)
  ),

  -- Body cardinality cap (plain-text-only story).
  CONSTRAINT house_rules_body_max_count CHECK (
    array_length(body, 1) IS NULL OR array_length(body, 1) <= 50
  )
);

COMMENT ON TABLE house_rules IS
  'LO-authored house rules layered on top of CSI official rules. World-readable. Write-gated to organization_staff (owner/admin) via can_write_house_rule_org().';

-- Trigger to cap per-element body length (ARRAY type cannot express this in
-- a table-level CHECK directly).
CREATE OR REPLACE FUNCTION check_house_rules_body_length()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  para TEXT;
BEGIN
  IF NEW.body IS NULL THEN RETURN NEW; END IF;
  FOREACH para IN ARRAY NEW.body LOOP
    IF char_length(para) > 4000 THEN
      RAISE EXCEPTION 'house_rules.body element exceeds 4000 characters'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER house_rules_body_length_trg
BEFORE INSERT OR UPDATE ON house_rules
FOR EACH ROW
EXECUTE FUNCTION check_house_rules_body_length();

-- Trigger to bump updated_at and stamp updated_by on UPDATE.
CREATE OR REPLACE FUNCTION touch_house_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER house_rules_touch_trg
BEFORE UPDATE ON house_rules
FOR EACH ROW
EXECUTE FUNCTION touch_house_rules();

-- Indexes.
CREATE INDEX idx_house_rules_org ON house_rules(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_house_rules_league ON house_rules(league_id) WHERE league_id IS NOT NULL;
CREATE INDEX idx_house_rules_related ON house_rules(related_rule_id) WHERE related_rule_id IS NOT NULL;
CREATE INDEX idx_house_rules_game ON house_rules(game);

-- ============================================================================
-- house_rules_with_scope_name view
-- Adds scope_name (COALESCE org name / league name) and derived scope_type.
-- Default SECURITY INVOKER — uses caller's RLS on house_rules.
-- ============================================================================

-- leagues have no `name` column — they are identified by game_type +
-- day_of_week + (optional) division. We build a display string for them.
-- Both scope variants also expose the owning organization's name so the UI
-- can disambiguate same-named leagues across different orgs.
CREATE OR REPLACE VIEW house_rules_with_scope_name AS
SELECT
  hr.*,
  CASE
    WHEN hr.organization_id IS NOT NULL THEN 'organization'
    ELSE 'league'
  END AS scope_type,
  COALESCE(o.organization_name, parent_o.organization_name) AS parent_org_name,
  CASE
    WHEN hr.organization_id IS NOT NULL THEN o.organization_name
    ELSE CONCAT(
      INITCAP(l.game_type), ' ',
      INITCAP(l.day_of_week), 's',
      CASE WHEN l.division IS NOT NULL THEN CONCAT(' (', l.division, ')') ELSE '' END
    )
  END AS scope_name
FROM house_rules hr
LEFT JOIN organizations o ON hr.organization_id = o.id
LEFT JOIN leagues l ON hr.league_id = l.id
LEFT JOIN organizations parent_o ON l.organization_id = parent_o.id;

GRANT SELECT ON house_rules_with_scope_name TO anon, authenticated;

COMMENT ON VIEW house_rules_with_scope_name IS
  'house_rules joined with parent scope name. Use this for client reads instead of the base table.';

-- ============================================================================
-- can_write_house_rule_org(target_org_id uuid) — SECURITY DEFINER permission check
-- Bypasses caller RLS on organization_staff / members so league_rep users (who
-- may not have direct SELECT on organization_staff) are evaluated correctly.
-- ============================================================================

CREATE OR REPLACE FUNCTION can_write_house_rule_org(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_staff os
    JOIN members m ON m.id = os.member_id
    WHERE m.user_id = auth.uid()
      AND os.organization_id = target_org_id
      AND os.position IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION can_write_house_rule_org(UUID) IS
  'True iff the current user is an owner or admin of the given organization. league_rep is intentionally excluded in v1.';

-- ============================================================================
-- RLS policies for house_rules
-- ============================================================================

ALTER TABLE house_rules ENABLE ROW LEVEL SECURITY;

-- World-readable (matches Branch 1's public /rules posture).
CREATE POLICY house_rules_select_public
  ON house_rules
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: caller must be owner/admin of the target org (direct for org-scope,
-- transitive via leagues.organization_id for league-scope).
CREATE POLICY house_rules_insert_staff
  ON house_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    can_write_house_rule_org(
      COALESCE(
        organization_id,
        (SELECT l.organization_id FROM leagues l WHERE l.id = league_id)
      )
    )
  );

-- UPDATE: same rule for the existing row AND the proposed row (can't move
-- a rule to another org you don't own).
CREATE POLICY house_rules_update_staff
  ON house_rules
  FOR UPDATE
  TO authenticated
  USING (
    can_write_house_rule_org(
      COALESCE(
        organization_id,
        (SELECT l.organization_id FROM leagues l WHERE l.id = league_id)
      )
    )
  )
  WITH CHECK (
    can_write_house_rule_org(
      COALESCE(
        organization_id,
        (SELECT l.organization_id FROM leagues l WHERE l.id = league_id)
      )
    )
  );

-- DELETE.
CREATE POLICY house_rules_delete_staff
  ON house_rules
  FOR DELETE
  TO authenticated
  USING (
    can_write_house_rule_org(
      COALESCE(
        organization_id,
        (SELECT l.organization_id FROM leagues l WHERE l.id = league_id)
      )
    )
  );

-- ============================================================================
-- rules_page_events extension
-- ============================================================================

-- Drop the existing CHECK constraint and recreate with four new event types.
ALTER TABLE rules_page_events
  DROP CONSTRAINT IF EXISTS rules_page_events_event_type_check;

ALTER TABLE rules_page_events
  ADD CONSTRAINT rules_page_events_event_type_check
  CHECK (event_type IN (
    'page_open',
    'search_query',
    'deep_link_open',
    'house_filter_activated',
    'differences_only_activated',
    'house_rule_opened',
    'scope_changed'
  ));

-- Add scope metadata columns for the new house-rule event types.
ALTER TABLE rules_page_events
  ADD COLUMN IF NOT EXISTS scope_type TEXT
    CHECK (scope_type IS NULL OR scope_type IN ('organization', 'league'));

ALTER TABLE rules_page_events
  ADD COLUMN IF NOT EXISTS scope_id UUID;

COMMENT ON COLUMN rules_page_events.scope_type IS
  'For house_*_activated / house_rule_opened / scope_changed events: the scope kind being acted on.';
COMMENT ON COLUMN rules_page_events.scope_id IS
  'For house_*_activated / house_rule_opened / scope_changed events: the organization or league UUID.';
