-- Onboarding cold-start cascade — Unit 1: schema spine.
--
-- Adds the persistent per-team join token ("the address") and the
-- team_join_requests lifecycle table (shared link -> self-claim/"add me" ->
-- captain/LO approves Add/Replace/Decline). Additive only — safe to apply with
-- `supabase migration up` on a live local DB; do NOT `db reset`.
--
-- See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 1).
-- NOTE: the 'captain_approve' merge actor_role widening (the merge RPC whitelist
-- AND the archived_placeholders.actor_role CHECK) lands with Unit 4, where the
-- Replace path actually calls the merge — kept together so neither half ships
-- without the other.
-- RLS is intentionally disabled project-wide until launch; this table ships no
-- RLS policies (authorization lives in the approve edge function — Unit 4).

-- 1. Persistent, forwardable per-team join token. Postgres evaluates the
--    volatile default once per existing row, so every current team gets its own
--    unique token on ADD COLUMN (no separate backfill step needed).
ALTER TABLE "public"."teams"
  ADD COLUMN IF NOT EXISTS "join_token" "uuid" NOT NULL DEFAULT "gen_random_uuid"();

CREATE UNIQUE INDEX IF NOT EXISTS "teams_join_token_key"
  ON "public"."teams" ("join_token");

COMMENT ON COLUMN "public"."teams"."join_token" IS
  'Persistent, forwardable team-join link token; stable for the season, read by the /join/:token page. Rotatable on leak (Unit 7).';

-- 2. Join-request lifecycle. A claim/self-add is a REQUEST until a captain/LO
--    approves. requested_member_id = the joiner''s member row (once formed);
--    claimed_member_id = the open placeholder being claimed (NULL for "add me").
CREATE TABLE IF NOT EXISTS "public"."team_join_requests" (
  "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
  "team_id" "uuid" NOT NULL REFERENCES "public"."teams"("id") ON DELETE CASCADE,
  "requested_by_user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "requested_member_id" "uuid" REFERENCES "public"."members"("id") ON DELETE SET NULL,
  "claimed_member_id" "uuid" REFERENCES "public"."members"("id") ON DELETE SET NULL,
  "status" "text" NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
  "created_at" timestamptz NOT NULL DEFAULT "now"(),
  "expires_at" timestamptz NOT NULL DEFAULT ("now"() + interval '30 days'),
  "acknowledged_at" timestamptz,
  "resolved_at" timestamptz,
  "resolved_by_member_id" "uuid" REFERENCES "public"."members"("id") ON DELETE SET NULL
);

-- Triage + doorbell lookups (pending requests per team).
CREATE INDEX IF NOT EXISTS "team_join_requests_team_status_idx"
  ON "public"."team_join_requests" ("team_id", "status");

-- Dedup guard: at most one pending request per person per team.
CREATE UNIQUE INDEX IF NOT EXISTS "team_join_requests_user_pending_uniq"
  ON "public"."team_join_requests" ("team_id", "requested_by_user_id")
  WHERE "status" = 'pending';

-- Race guard: at most one pending claim per open placeholder spot.
CREATE UNIQUE INDEX IF NOT EXISTS "team_join_requests_spot_pending_uniq"
  ON "public"."team_join_requests" ("team_id", "claimed_member_id")
  WHERE "status" = 'pending' AND "claimed_member_id" IS NOT NULL;

COMMENT ON TABLE "public"."team_join_requests" IS
  'Onboarding cascade: pending join requests from a shared team link, held until a captain/LO approves (Add/Replace/Decline). See docs/plans/2026-05-29-001.';
