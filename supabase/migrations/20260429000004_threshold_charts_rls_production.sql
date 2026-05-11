-- ============================================================================
-- PHASE 2 UNIT 2.4 — REPLACE THRESHOLD-CHARTS DEV RLS WITH PRODUCTION POLICIES
-- ============================================================================
--
-- The original threshold_charts migration (20260410000002_threshold_charts.sql)
-- shipped placeholder RLS labeled "Dev: Allow all operations" with a TODO to
-- add proper policies before production. Phase 3 of the modular-league plan
-- activates these tables for runtime threshold lookups + an LO-facing chart
-- editor — without proper RLS, LOs from one org could write charts that
-- affect other orgs' leagues. This migration replaces the dev policies with
-- the same organization_staff-join pattern used by house_rules
-- (20260419120000_house_rules.sql).
--
-- Authorization model:
--   - SELECT: open to authenticated. Chart values feed scoring math that
--     all participants observe; gating reads to org members would break
--     spectator views and pre-match threshold previews.
--   - INSERT/UPDATE/DELETE on entity_type='league' or 'organization':
--     restricted to owner/admin of the chart's organization
--     (organization for org-scope; leagues.organization_id for league-scope).
--   - INSERT/UPDATE/DELETE on entity_type='global': denied. Global presets
--     are seeded by SECURITY-DEFINER migrations only. The existing
--     prevent_global_chart_modification trigger remains as defense in depth.
--   - threshold_chart_rows policies mirror the parent chart's authorization
--     by looking up entity_type/entity_id via the chart_id FK.
--
-- Patterns followed:
--   - house_rules can_write_house_rule_org() — SECURITY DEFINER + STABLE
--     so the function is callable across RLS boundaries (organization_staff
--     and members may not be directly readable by every authenticated role)
--   - SET search_path = public, auth — explicit search path inside SECURITY
--     DEFINER prevents privilege-escalation via shadow schemas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Permission predicate: can_write_threshold_chart(entity_type, entity_id)
-- ----------------------------------------------------------------------------
-- Returns true iff the current authenticated user is owner/admin of the
-- organization that owns the chart referenced by (entity_type, entity_id).
--   - entity_type='global' → false (always — global charts are seed-only)
--   - entity_type='organization' → entity_id IS the org; check directly
--   - entity_type='league' → resolve org via leagues.organization_id
--   - entity_type/entity_id NULL → false
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION can_write_threshold_chart(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF p_entity_type IS NULL OR p_entity_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_entity_type = 'global' THEN
    RETURN FALSE;
  ELSIF p_entity_type = 'organization' THEN
    v_org_id := p_entity_id;
  ELSIF p_entity_type = 'league' THEN
    SELECT organization_id INTO v_org_id FROM leagues WHERE id = p_entity_id;
    IF v_org_id IS NULL THEN
      RETURN FALSE;
    END IF;
  ELSE
    -- Unknown entity_type — deny by default.
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM organization_staff os
    JOIN members m ON m.id = os.member_id
    WHERE m.user_id = auth.uid()
      AND os.organization_id = v_org_id
      AND os.position IN ('owner', 'admin')
  );
END;
$$;

COMMENT ON FUNCTION can_write_threshold_chart(TEXT, UUID) IS
  'True iff the current user is owner/admin of the organization that owns the chart referenced by (entity_type, entity_id). Always false for global charts. Used by threshold_charts RLS policies.';

-- ----------------------------------------------------------------------------
-- Permission predicate (rows table): can_write_threshold_chart_via_id(chart_id)
-- ----------------------------------------------------------------------------
-- threshold_chart_rows references threshold_charts(id) via chart_id FK.
-- Looks up the parent chart's (entity_type, entity_id) and delegates to
-- can_write_threshold_chart.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION can_write_threshold_chart_via_id(p_chart_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id UUID;
BEGIN
  IF p_chart_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT entity_type, entity_id
  INTO v_entity_type, v_entity_id
  FROM threshold_charts
  WHERE id = p_chart_id;

  IF v_entity_type IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN can_write_threshold_chart(v_entity_type, v_entity_id);
END;
$$;

COMMENT ON FUNCTION can_write_threshold_chart_via_id(UUID) IS
  'True iff the current user is owner/admin of the org that owns the parent chart. Used by threshold_chart_rows RLS policies.';

-- ----------------------------------------------------------------------------
-- Drop dev policies on both tables
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Dev: Allow all operations on threshold_charts" ON threshold_charts;
DROP POLICY IF EXISTS "Dev: Allow all operations on threshold_chart_rows" ON threshold_chart_rows;

-- ----------------------------------------------------------------------------
-- threshold_charts policies
-- ----------------------------------------------------------------------------

-- SELECT: any authenticated user. Chart values feed scoring math that all
-- match participants observe.
CREATE POLICY threshold_charts_select_authenticated
  ON threshold_charts
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: caller must be owner/admin of the chart's organization.
-- Global charts (entity_type='global') are denied here AND by the existing
-- prevent_global_chart_modification trigger (defense in depth).
CREATE POLICY threshold_charts_insert_staff
  ON threshold_charts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    can_write_threshold_chart(entity_type, entity_id)
  );

-- UPDATE: same rule for the existing row AND the proposed row (can't move
-- a chart to another org you don't own, can't promote it to global).
CREATE POLICY threshold_charts_update_staff
  ON threshold_charts
  FOR UPDATE
  TO authenticated
  USING (
    can_write_threshold_chart(entity_type, entity_id)
  )
  WITH CHECK (
    can_write_threshold_chart(entity_type, entity_id)
  );

-- DELETE.
CREATE POLICY threshold_charts_delete_staff
  ON threshold_charts
  FOR DELETE
  TO authenticated
  USING (
    can_write_threshold_chart(entity_type, entity_id)
  );

-- ----------------------------------------------------------------------------
-- threshold_chart_rows policies
-- ----------------------------------------------------------------------------

-- SELECT: any authenticated user (same reasoning as parent table).
CREATE POLICY threshold_chart_rows_select_authenticated
  ON threshold_chart_rows
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: caller must be owner/admin of the parent chart's organization.
CREATE POLICY threshold_chart_rows_insert_staff
  ON threshold_chart_rows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    can_write_threshold_chart_via_id(chart_id)
  );

-- UPDATE.
CREATE POLICY threshold_chart_rows_update_staff
  ON threshold_chart_rows
  FOR UPDATE
  TO authenticated
  USING (
    can_write_threshold_chart_via_id(chart_id)
  )
  WITH CHECK (
    can_write_threshold_chart_via_id(chart_id)
  );

-- DELETE.
CREATE POLICY threshold_chart_rows_delete_staff
  ON threshold_chart_rows
  FOR DELETE
  TO authenticated
  USING (
    can_write_threshold_chart_via_id(chart_id)
  );

-- ----------------------------------------------------------------------------
-- Sanity comments
-- ----------------------------------------------------------------------------

COMMENT ON TABLE threshold_charts IS
  'Stores threshold chart configurations for determining games-to-win thresholds. Charts can be global templates (seed-only), organization defaults, or league-specific overrides. Read access is open to authenticated users so spectators see correct scoring; write access is restricted to org owners/admins via can_write_threshold_chart() (Phase 2 Unit 2.4).';
