-- Migration: Tournament paid-tier foundation — Phase A, Unit A1 (paid schema)
--
-- Extends `brackets` so a tournament can be PAID: it carries the organizer's
-- premium-feature selections, a verified card on file (verify-at-setup), and a
-- game type.
--
-- DISPOSABLE by design: tournaments (both tiers) are still swept like the free
-- tier — there is NO change to sweep_stale_brackets here. The durable footprint
-- is per-player (saved setup + roster + a run-count) and lands in later units.
-- See docs/plans/2026-09-04-001-feat-tournament-paid-foundation-plan.md (Unit A1).
--
-- TIER INVARIANT: a CHECK enforces that any bracket with a premium feature
-- checked must be tier='paid', so `tier` and `premium_features` can never drift
-- (downstream branches on `tier` alone). "Paid" is entering paid mode (the
-- baseline: real players/pool/self-add); the checklist adds features on top.
--
-- All new columns are nullable / defaulted, so existing free brackets are
-- unaffected.


ALTER TABLE "public"."brackets"
  ADD COLUMN IF NOT EXISTS "tier"             text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "premium_features" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "game_type"        text;
-- NOTE: the card-on-file does NOT live here. It is a per-PLAYER asset (reusable
-- for tournaments, dues, LO, etc.) in `payment_methods`; a paid tournament
-- references the card to charge via `brackets.payment_method_id`, added in the
-- payment_methods migration.


-- tier ∈ {free, paid}. (DROP-then-ADD keeps the migration idempotent on re-apply.)
ALTER TABLE "public"."brackets" DROP CONSTRAINT IF EXISTS "brackets_tier_check";
ALTER TABLE "public"."brackets"
  ADD CONSTRAINT "brackets_tier_check"
  CHECK (("tier" = ANY (ARRAY['free'::text, 'paid'::text])));

-- Invariant: any premium feature checked ⇒ the bracket is paid. Stops the
-- tier/premium_features drift the plan flagged (a checked feature on a 'free'
-- row that downstream code would then mis-branch on).
ALTER TABLE "public"."brackets" DROP CONSTRAINT IF EXISTS "brackets_premium_implies_paid_check";
ALTER TABLE "public"."brackets"
  ADD CONSTRAINT "brackets_premium_implies_paid_check"
  CHECK ((cardinality("premium_features") = 0) OR ("tier" = 'paid'));


COMMENT ON COLUMN "public"."brackets"."tier" IS
  'free (default; disposable names-only tier) | paid (real players/pool/self-add + premium features). Kept consistent with premium_features by brackets_premium_implies_paid_check.';
COMMENT ON COLUMN "public"."brackets"."premium_features" IS
  'The organizer''s checked premium features for this tournament (extensible; empty for free). Any non-empty value forces tier=paid.';
COMMENT ON COLUMN "public"."brackets"."game_type" IS
  'The tournament''s game type (e.g. eight_ball) — a per-tournament attribute, also part of the saved reusable setup. Nullable/free-form in v1; formalized by the scoring/handicap features.';
