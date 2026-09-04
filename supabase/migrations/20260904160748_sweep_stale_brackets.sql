-- Migration: sweep_stale_brackets — Free Tier v1 (Unit 7)
--
-- The inactivity janitor for the ephemeral bracket tool. Hard-deletes (cascade)
-- any bracket that is closed OR has had no organizer activity for a while, so
-- nothing lingers. Called opportunistically at the start of createBracket
-- (cleanup-on-create) — zero scheduling infrastructure, which sidesteps the
-- no-cron-precedent problem for v1. An explicit close still tombstones
-- immediately; this sweep is what eventually removes closed + abandoned rows.
--
-- authenticated-only (revoke the Postgres PUBLIC + Supabase anon defaults) — a
-- destructive bulk delete must never be anon-callable, even though the public
-- share route only reads.

CREATE OR REPLACE FUNCTION "public"."sweep_stale_brackets"(
  "p_idle_days" integer DEFAULT 7
)
RETURNS integer
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH gone AS (
    DELETE FROM brackets
     WHERE status = 'closed'
        OR last_activity_at < now() - make_interval(days => p_idle_days)
    RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM gone;
  RETURN v_deleted;
END;
$$;

-- Not anon-callable: revoke PUBLIC + anon defaults, grant only authenticated.
REVOKE EXECUTE ON FUNCTION "public"."sweep_stale_brackets"(integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."sweep_stale_brackets"(integer) TO "authenticated";

COMMENT ON FUNCTION "public"."sweep_stale_brackets"(integer) IS
  'Bracket Unit 7: hard-delete (cascade) closed or idle (>p_idle_days) brackets. Called opportunistically at createBracket time — the ephemeral tool''s janitor, no cron. See docs/plans/2026-08-26-001.';
