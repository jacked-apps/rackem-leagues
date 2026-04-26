-- Migration: placeholder_has_stats predicate function
-- Purpose: Canonical "has this placeholder played" check. One definition,
--          several call sites:
--            - R10 badge variant (amber "Needs Merge" vs gray "Placeholder")
--            - R12/R13 delete vs archive routing
--            - R19 two-stats merge confirmation
--
-- Definition: member_id appears as any player slot in at least one
--             match_lineups row. No match-status filter — the schema has no
--             void/cancel concept today; if that is added later, update this
--             function (and only this function).
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 2)

CREATE OR REPLACE FUNCTION placeholder_has_stats(p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM match_lineups ml
    WHERE ml.player1_id = p_member_id
       OR ml.player2_id = p_member_id
       OR ml.player3_id = p_member_id
       OR ml.player4_id = p_member_id
       OR ml.player5_id = p_member_id
  );
$$;

COMMENT ON FUNCTION placeholder_has_stats(UUID) IS
'Returns true if the member appears in any match_lineups player slot. Canonical predicate for placeholder "has played" checks across badge rendering, delete guards, and two-stats merge confirmations.';

-- Callable from authenticated client sessions (badge queries select
-- placeholder_has_stats(id) AS has_stats) and from service_role (Edge
-- Functions and SECURITY DEFINER RPCs). No PII exposure — boolean output only.
GRANT EXECUTE ON FUNCTION placeholder_has_stats(UUID) TO authenticated, service_role;
