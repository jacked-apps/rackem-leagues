-- ============================================================================
-- MESSAGING OVERHAUL — PHASE 1 — UNIT 7 (polish)
-- Reword members.profanity_filter_enabled comment + harden system-message
-- unread-count semantics.
-- ============================================================================
--
-- Two small schema-layer changes that finish the polish slice of Unit 7:
--
-- 1. COMMENT ON COLUMN public.members.profanity_filter_enabled
--    Baseline (line 1692 of 20251130010824_baseline.sql) reads:
--      "Forced ON for users under 18, optional for adults."
--    That phrasing assumed DOB was always collected. After the 2026-05-13
--    decision, DOB is OPTIONAL — collected if the user fills it in or if a
--    CSI/BCA partnership requires it. The frontend (`useProfanityFilter`)
--    forces the filter ON only when DOB is on file AND `isMinor(dob)` is
--    true; adults and members with no DOB on file can toggle freely. The
--    column comment needs to match that reality.
--
--    See: src/hooks/useProfanityFilter.ts, src/utils/age.ts,
--         memory/project_dob_optional_minor_filter.md
--
-- 2. CREATE OR REPLACE FUNCTION public.increment_unread_count()
--    The Unit 7 plan requires that system messages do NOT increment unread-
--    count badges — "X joined the team" notifications shouldn't pop unread
--    in a user's inbox.
--
--    Today the trigger doesn't increment unread for system messages, but
--    only by accident of SQL three-valued logic: the WHERE clause has
--    `user_id != NEW.sender_id`, and for system messages NEW.sender_id IS
--    NULL, so `user_id != NULL` evaluates to NULL → falsy in WHERE → no
--    rows updated. That's correct behavior achieved implicitly.
--
--    This migration adds an explicit early-return at the top of the
--    function for `NEW.is_system = TRUE`. Two reasons:
--      (a) Intent is visible — anyone reading the function understands the
--          rule without having to reason about NULL semantics.
--      (b) Defense against future schema changes — if someone ever sets
--          system messages to have a placeholder sender_id (e.g., a
--          dedicated system-user UUID), the implicit NULL guard would
--          silently start incrementing unread counts. The explicit
--          is_system check stays correct.
--
--    No COMMENT update on the function itself — the existing description
--    ("Increments unread_count for participants except sender") still
--    holds; system messages just take an earlier exit before the increment.
--
-- ----------------------------------------------------------------------------
-- IDEMPOTENCY
-- ----------------------------------------------------------------------------
-- Both statements are idempotent (COMMENT ON COLUMN replaces, CREATE OR
-- REPLACE FUNCTION replaces). Re-running this migration is a no-op once
-- applied. No DML, no schema-shape change, no data backfill.
--
-- See: docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 7)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Reword members.profanity_filter_enabled comment
-- ----------------------------------------------------------------------------

-- COMMENT ON COLUMN's IS clause requires a single string literal — `||`
-- concatenation isn't allowed there (SQL grammar treats this slot as a
-- string-constant context, not an expression). Keep the body on one line.
COMMENT ON COLUMN public.members.profanity_filter_enabled IS 'Personal profanity filter preference for message display. Forced ON for known minors (date_of_birth on file AND age < 18); toggleable by adults and members with no DOB on file. Enforcement happens client-side via useProfanityFilter (sees DOB) — this column stores the user preference and is only consulted when the minor override does not apply.';


-- ----------------------------------------------------------------------------
-- 2. Explicit system-message guard in increment_unread_count()
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_unread_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- System messages (is_system = TRUE, sender_id IS NULL by CHECK
  -- constraint) are informational narration like "Sally joined the
  -- team". They should NOT pop unread badges in anyone's inbox.
  -- Skip the UPDATE entirely.
  IF NEW.is_system THEN
    RETURN NEW;
  END IF;

  -- Regular path: bump unread for every active participant except
  -- the sender themselves.
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND left_at IS NULL;

  RETURN NEW;
END;
$$;
