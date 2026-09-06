-- Track which completed matches have been hand-entered into CSI / FargoRate LMS.
--
-- LMS has no bulk import (confirmed 2026-06), so an operator prints our results
-- sheet and types each match into the LMS website by hand. Operators don't do
-- this weekly — they let a few weeks pile up and work through the backlog — so
-- they need a durable "did I already do this one?" marker.
--
-- NULL  = not yet entered into LMS
-- set   = entered, at this timestamp
--
-- A timestamp rather than a boolean: same storage cost, but it also answers
-- "when did we last push results to LMS", which is the natural follow-up
-- question when results go missing on CSI's side.
--
-- Shared state, not a personal to-do list: a league with two operators sees one
-- checkmark, so they don't double-enter the same match.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS lms_entered_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN matches.lms_entered_at IS
  'When this match''s results were hand-entered into CSI/FargoRate LMS. NULL = not yet entered.';

-- Operators filter "what is left to enter" per season, and the unentered set is
-- the small side once a season gets going — a partial index keeps that cheap.
CREATE INDEX IF NOT EXISTS idx_matches_lms_not_entered
  ON matches (season_id)
  WHERE lms_entered_at IS NULL;
