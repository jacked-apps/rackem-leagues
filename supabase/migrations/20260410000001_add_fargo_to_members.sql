-- ============================================================================
-- ADD FARGO RATING TO MEMBERS
-- ============================================================================
--
-- Adds a fargo_rating column to the members table for leagues that use the
-- Fargo handicap system. This is the player's FargoRate rating (numeric,
-- typically 100-850).
--
-- For now, operators enter Fargo ratings manually. Future: Fargo API
-- integration for automatic rating sync.
--
-- See: memory-bank/plans/PLAN-wizard2.md
-- ============================================================================

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS fargo_rating INTEGER
  CHECK (fargo_rating IS NULL OR (fargo_rating >= 100 AND fargo_rating <= 850));

COMMENT ON COLUMN members.fargo_rating IS
  'Player FargoRate rating (100-850). Entered manually for now. NULL = no rating set. Used when league preferences.uses_fargo = true.';
