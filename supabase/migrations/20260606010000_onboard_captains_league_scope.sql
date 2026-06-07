-- ============================================================================
-- ONBOARD CAPTAINS — re-scope from org to league, placeholder-captains only
-- ============================================================================
--
-- The "onboard my captains" list was org-scoped (get_org_teams_for_onboarding)
-- and showed every team in every league forever — including bye teams (no
-- captain) and captains who had already registered. That's the wrong altitude:
-- captains belong to a LEAGUE, and the list is a TEMPORARY, self-clearing
-- onboarding aid — once a captain registers, they're done and should drop off.
--
-- This migration:
--   1. Adds get_league_teams_for_onboarding(p_league_id) — one row per non-bye
--      team in the league whose captain is still a placeholder (members.user_id
--      IS NULL). Org-staff gated against the league's org.
--   2. Drops the old org-scoped get_org_teams_for_onboarding (sole consumer is
--      this surface, which moves to the league page).
--
-- "Placeholder captain" = members.user_id IS NULL. When a captain registers and
-- claims their spot, merge_placeholder_into_member_v2 rewrites teams.captain_id
-- to the registered member and deletes the placeholder, so the captain naturally
-- falls out of this list (user_id IS NOT NULL). No season filter is needed: a
-- registered captain — including a copied-team captain next season — is excluded
-- by definition.
--
-- See:
--   docs/plans/2026-06-06-002-fix-onboard-captains-league-scope-plan.md
--   docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 7, superseded surface)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. League-scoped onboarding list
--
-- INNER JOIN members on t.captain_id: a bye team has captain_id IS NULL and so
-- drops out automatically; the explicit `t.status <> 'bye'` is defensive
-- clarity. A non-bye team that somehow has no captain has nobody to onboard, so
-- excluding it is correct.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_league_teams_for_onboarding"("p_league_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_actor uuid;
  v_org   uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id INTO v_actor FROM members WHERE user_id = v_user LIMIT 1;
  IF v_actor IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Resolve the league's org, then gate on org-staff membership.
  SELECT organization_id INTO v_org FROM leagues WHERE id = p_league_id;
  IF v_org IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_staff os
     WHERE os.organization_id = v_org AND os.member_id = v_actor
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'team_id', t.id,
               'team_name', t.team_name,
               'captain_name', member_display_name(t.captain_id),
               'join_token', t.join_token
             )
             ORDER BY t.team_name
           )
      FROM teams t
      JOIN members m ON m.id = t.captain_id
     WHERE t.league_id = p_league_id
       AND t.status <> 'bye'
       AND m.user_id IS NULL
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_league_teams_for_onboarding"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."get_league_teams_for_onboarding"("uuid") IS
  'Onboarding (league-scoped): one row per non-bye team in the league whose captain is still a placeholder (members.user_id IS NULL) — team + captain name + join link — for the LO''s temporary "onboard my captains" list. Self-clears as captains register. Org-staff gated against the league''s org. See docs/plans/2026-06-06-002.';


-- ----------------------------------------------------------------------------
-- 2. Drop the superseded org-scoped function
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "public"."get_org_teams_for_onboarding"("uuid");
