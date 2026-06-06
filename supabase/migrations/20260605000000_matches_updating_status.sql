-- ============================================================================
-- Add the 'updating' match status (LO manual entry in progress)
-- ============================================================================
-- When a League Operator sets up a manual entry (enters lineups), the match
-- enters 'updating' instead of 'in_progress'. This keeps it OFF the players'
-- live-scoring surfaces (which key on 'in_progress') so no one wanders into a
-- match the operator is hand-entering, and it reads as "Updating" everywhere
-- (obvious why it has no scores yet). The operator's Finalize flips it straight
-- to 'completed'.
--
-- Lifecycle:  scheduled --(LO sets lineup)--> updating --(LO finalizes)--> completed
--
-- The two-party LIVE flow is untouched (it still uses 'in_progress' via
-- prep_match). v2 match-review corrections also still use 'in_progress' (a
-- reopened completed match) — the LO score/finalize functions accept both
-- 'updating' and 'in_progress' as "operator is editing" states.
-- ============================================================================

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
  CHECK (status = ANY (ARRAY[
    'scheduled'::text,
    'updating'::text,
    'in_progress'::text,
    'awaiting_verification'::text,
    'completed'::text,
    'forfeited'::text,
    'postponed'::text
  ]));
