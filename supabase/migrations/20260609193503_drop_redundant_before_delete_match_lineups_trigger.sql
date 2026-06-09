-- Fix: bulk-deleting a season's matches (clearSchedule / "delete old matchups
-- and regenerate") failed with Postgres error 27000 —
--   "tuple to be deleted was already modified by an operation triggered by the
--    current command"
-- which PostgREST surfaces to the client as an unhelpful HTTP 400.
--
-- Root cause: `trigger_auto_delete_match_lineups` is a BEFORE DELETE trigger on
-- `matches` that deletes the match's `match_lineups` rows. In a multi-row delete
-- (a whole season's schedule), deleting one match's lineups mutates other rows
-- that are part of the SAME delete command — via the back-references
-- `matches.home_lineup_id` / `matches.away_lineup_id → match_lineups (ON DELETE
-- SET NULL)` — which Postgres rejects (error 27000). A BEFORE trigger must not
-- modify rows already queued for deletion in the same statement.
--
-- The trigger is also entirely REDUNDANT: `match_lineups.match_id` is NOT NULL
-- and its FK to `matches` is ON DELETE CASCADE, so a match's lineups are already
-- removed automatically when the match is deleted. Verified on a real season
-- (54 matches): dropping the trigger makes the delete succeed and leaves zero
-- orphaned lineups.
--
-- Fix: drop the trigger (and its now-unused function). The FK cascade handles
-- lineup cleanup.

DROP TRIGGER IF EXISTS "trigger_auto_delete_match_lineups" ON "public"."matches";
DROP FUNCTION IF EXISTS "public"."auto_delete_match_lineups"();
