-- Migration: get_merges_into_member RPC
-- Purpose: Drives the deliberate "Unmerge a player" lookup flow. Given a
--          target registered user, returns every active (non-undone,
--          non-expired) merge that landed on them — including a synopsis
--          of what the placeholder brought to the target derived from
--          archived_placeholders.transferred_rows.
--
-- Why this shape (and not a "recent merges" feed): undoing a merge is a
-- mistake-correcting action and should be deliberate. The LO must look
-- up a specific target, see ALL merges that affected them, and pick the
-- specific one to reverse — with a clear synopsis of what gets stripped.
-- One target may have multiple historical merges; this lists them all.
--
-- Synopsis logic: walks the transferred_rows JSONB and counts entries
-- by table name, plus a count of new team_players the target gained
-- from the merge.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 14)

DROP FUNCTION IF EXISTS get_org_recent_merges(UUID);

CREATE OR REPLACE FUNCTION get_merges_into_member(
  p_target_member_id UUID,
  p_org_id           UUID
)
RETURNS TABLE (
  archive_id              UUID,
  placeholder_member_id   UUID,
  placeholder_first_name  TEXT,
  placeholder_last_name   TEXT,
  placeholder_nickname    TEXT,
  actor_role              TEXT,
  actor_name              TEXT,
  created_at              TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ,
  synopsis                JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ap.id AS archive_id,
    ap.placeholder_member_id,
    (ap.member_snapshot ->> 'first_name')::TEXT AS placeholder_first_name,
    (ap.member_snapshot ->> 'last_name')::TEXT  AS placeholder_last_name,
    (ap.member_snapshot ->> 'nickname')::TEXT   AS placeholder_nickname,
    ap.actor_role,
    (act.first_name || ' ' || act.last_name)::TEXT AS actor_name,
    ap.created_at,
    ap.expires_at,
    -- Synopsis: { tables: { table_name: count }, team_players_added: int }
    -- Counts entries per table from transferred_rows so the LO sees
    -- exactly what came from this placeholder before reversing.
    jsonb_build_object(
      'tables',
      (
        SELECT jsonb_object_agg(t, c)
        FROM (
          SELECT entry ->> 't' AS t, COUNT(*) AS c
          FROM jsonb_array_elements(ap.transferred_rows) entry
          WHERE entry ? 't'
          GROUP BY entry ->> 't'
        ) sub
      ),
      'team_players_added',
      (
        SELECT COUNT(*)::INT
        FROM jsonb_array_elements(ap.transferred_rows) entry
        WHERE entry ->> 't' = 'team_players'
          AND entry ->> 'op' = 'inserted_for_target'
      )
    ) AS synopsis
  FROM archived_placeholders ap
  LEFT JOIN members act ON act.id = ap.actor_member_id
  WHERE ap.target_member_id = p_target_member_id
    AND ap.organization_id = p_org_id
    AND ap.undone_at IS NULL
    AND ap.expires_at > now()
  ORDER BY ap.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_merges_into_member(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION get_merges_into_member IS
'Lists active merges that absorbed placeholders into a specific registered user, scoped to an org. Returns synopsis derived from transferred_rows so the LO sees what each merge brought to the target before deciding to reverse.';
