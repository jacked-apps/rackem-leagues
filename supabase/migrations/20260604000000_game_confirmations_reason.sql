-- Migration: add optional `reason` to game_confirmations
-- (LO match review & correction — v2, 2026-06-04)
--
-- Why: when a League Operator overturns a game in an already-scored match
-- (the dispute-adjudication flow), the correction appends an operator
-- override row to this append-only log. That row can carry an OPTIONAL
-- free-text reason — e.g. "John flagged game 6 as break-and-run; Judy and
-- Mike confirmed it was true and unmarked. Corrected." — so the chain reads
-- "teams confirmed X → operator changed it to Y, because Z". Operator-only
-- visibility; the reason is the human record of why a team-confirmed result
-- was overturned.
--
-- Optional (nullable): quick fixes and all existing/normal vouch rows leave
-- it NULL. Capped at 255 chars (matches the UI textarea cap) via a CHECK so
-- a too-long value fails loudly rather than silently truncating.

ALTER TABLE "public"."game_confirmations"
  ADD COLUMN IF NOT EXISTS "reason" text;

ALTER TABLE "public"."game_confirmations"
  DROP CONSTRAINT IF EXISTS "game_confirmations_reason_length_check";

ALTER TABLE "public"."game_confirmations"
  ADD CONSTRAINT "game_confirmations_reason_length_check"
  CHECK ("reason" IS NULL OR char_length("reason") <= 255);


COMMENT ON COLUMN "public"."game_confirmations"."reason" IS 'Optional ~255-char operator note explaining a correction (LO match review). NULL on normal vouch rows; set on operator override rows to document why a team-confirmed result was overturned. Visible only in the operator-facing confirmer-audit.';
