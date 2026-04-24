-- Migration: get_placeholder_remove_context RPC
-- Purpose: Single-query snapshot of a placeholder's current state for the
--          Remove confirmation dialog. Ensures the LO sees the true delete
--          vs archive decision based on fresh DB state — not on whatever
--          the list cache had when the page was last loaded.
--
-- Returns enough to:
--   - Branch delete vs archive (has_stats, team_count)
--   - Detect "already gone" (row not found)
--   - Detect "got merged" (user_id now set)
--   - Detect "already archived" (archived_at NOT NULL)
--   - Respect the BCA# can't-delete rule (has_bca)
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

CREATE OR REPLACE FUNCTION get_placeholder_remove_context(p_member_id UUID)
RETURNS TABLE (
  found             BOOLEAN,
  is_placeholder    BOOLEAN,
  is_archived       BOOLEAN,
  has_stats         BOOLEAN,
  team_count        INT,
  has_bca           BOOLEAN,
  first_name        TEXT,
  nickname          TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    TRUE                                           AS found,
    (m.user_id IS NULL)                            AS is_placeholder,
    (m.archived_at IS NOT NULL)                    AS is_archived,
    placeholder_has_stats(m.id)                    AS has_stats,
    (SELECT COUNT(*)::INT FROM team_players WHERE member_id = m.id) AS team_count,
    (m.bca_member_number IS NOT NULL
      AND trim(m.bca_member_number) <> '')         AS has_bca,
    m.first_name::TEXT,
    m.nickname::TEXT
  FROM members m
  WHERE m.id = p_member_id
  UNION ALL
  SELECT FALSE, FALSE, FALSE, FALSE, 0, FALSE, NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM members WHERE id = p_member_id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_placeholder_remove_context(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION get_placeholder_remove_context IS
'Fresh single-placeholder snapshot used by the Remove dialog to make its delete-vs-archive decision on live data, not stale cache.';
