-- Migration: Game Room — Unit 2 (idle sweep via pg_cron)
--
-- Rooms are perishable (docs/brainstorms/2026-09-16-game-room-requirements.md
-- R2). A room nobody has touched for a day is deleted; its phones and every
-- game table's rows go with it by cascade (every game table's FK to rooms is
-- validated ON DELETE CASCADE at creation — room_validate_tables).
--
-- "Touched" = rooms.last_activity_at, which is bumped by the room's own
-- heartbeat (room_heartbeat) and by every host action. Games contribute
-- nothing to it, so a free room (no realtime channel) is still kept alive by
-- the screen being open, and a game author cannot forget to keep it alive.
--
-- Keyed on STATE (last_activity_at older than the window), never a specific
-- timestamp, so a skipped run self-heals on the next one. Hourly rather than
-- daily because a 24-hour window swept once a day would let rooms live up to
-- 48 hours; hourly keeps "24 hours" honest. The window is an argument with a
-- default so it is a dial, not a decision.
--
-- The LOGIC lives in a function (testable directly via executeSql); pg_cron
-- only calls it. Mirrors 20260611000000_auto_forfeit_sweep.sql.
--
-- Hosted projects: pg_cron is enabled per project in the Supabase dashboard
-- (Database → Extensions). `create extension if not exists` is a no-op when
-- it already is, and the auto-forfeit job already depends on it — the room
-- sweep inherits whatever footing that job has. Verify on staging (a line in
-- LIST_FOR_ED) rather than assume.

create extension if not exists pg_cron;

-- sweep_stale_rooms(p_idle_hours) — delete rooms idle longer than the window.
-- Returns how many rooms were deleted (cascade handles the rest silently).
CREATE OR REPLACE FUNCTION "public"."sweep_stale_rooms"("p_idle_hours" integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH gone AS (
    DELETE FROM rooms
     WHERE last_activity_at < now() - make_interval(hours => GREATEST(p_idle_hours, 1))
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM gone;
  RETURN v_count;
END;
$$;

-- Not a client surface: pg_cron runs as the owner; nobody else needs it.
REVOKE EXECUTE ON FUNCTION "public"."sweep_stale_rooms"(integer) FROM PUBLIC, "anon", "authenticated";

COMMENT ON FUNCTION "public"."sweep_stale_rooms"(integer) IS
  'Game Room janitor: deletes rooms whose last_activity_at is older than p_idle_hours (default 24); children cascade. Keyed on state, so a skipped run self-heals. Called hourly by pg_cron (game-room-sweep).';

-- Schedule hourly, on the hour. Unschedule any prior version first so re-running
-- this migration is idempotent.
do $$
begin
  perform cron.unschedule('game-room-sweep');
exception
  when others then null; -- no prior job to remove
end $$;

select cron.schedule('game-room-sweep', '0 * * * *', $cron$ select sweep_stale_rooms(24); $cron$);
