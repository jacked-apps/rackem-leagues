-- Add a team's schedule position to the teams table.
--
-- A team's "schedule position" (1..N, including the bye slot) maps it to the
-- hard-coded matchup chart used to generate the season's matches. Until now this
-- value only lived transiently in the matchups wizard's state and was never
-- persisted — so after a season was created, the position→team mapping survived
-- only implicitly, buried in the generated matches.
--
-- The "Change Season Length" feature needs to APPEND new weeks (continuing the
-- rotation) without disturbing existing matches, which requires reading each
-- team's position. Persisting it here makes that a trivial read instead of a
-- fragile reverse-engineering from existing matches.
--
-- Written at matchup creation in `generateSchedule` (src/utils/scheduleGenerator.ts).
-- Nullable: existing teams (created before this column) stay NULL; lengthening is
-- unsupported for such pre-column seasons (the UI surfaces a "regenerate" message).

ALTER TABLE "public"."teams"
  ADD COLUMN IF NOT EXISTS "schedule_position" integer;

COMMENT ON COLUMN "public"."teams"."schedule_position" IS
  'Position (1..N incl. bye) mapping this team to the matchup chart that generated the season. Set at matchup creation; read when changing season length. NULL for teams created before 2026-06-11.';
