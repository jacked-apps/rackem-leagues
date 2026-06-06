-- Migration: add is_initiator flag to game_confirmations
-- (many-eyes Layer-2 Phase 2 amendment, 2026-05-26)
--
-- Why: distinguishes rows where the confirmer FILLED OUT THE DETAILS from
-- scratch (handleConfirmScore — entered winner, extras, points) from rows
-- where the confirmer JUST TAPPED CONFIRM on someone else's already-entered
-- details (confirmOpponentScore). Two roles, recorded explicitly instead of
-- inferred from "oldest row's side" timestamp ordering.
--
-- IMPORTANT: NO unique index on (game_id, side, is_initiator). is_initiator
-- is a TAG, not a slot — multiple initiators per (game_id, side) are
-- deliberately allowed:
--   • Two independent fills that AGREE = strongest confirmation possible
--     (each person did the high-effort act independently and reached the
--     same result — more weight than a confirm tap).
--   • Two independent fills that DISAGREE = a real dispute — both rows
--     stay in the log, the system auto-clears the game's winner, and the
--     dispute surfaces via the persistent banner (Phase 2 / Amendment F).
--
-- Vacate marker rows (action='vacate') stay is_initiator=false; a vacate is
-- not an initiation. Existing rows get the default (false) — for dev DBs
-- with prior Phase-1/2 test data, this re-labels old `handleConfirmScore`
-- rows as confirmers, which is harmless (test data is disposable; new rows
-- written after this migration are tagged correctly).

ALTER TABLE "public"."game_confirmations"
  ADD COLUMN IF NOT EXISTS "is_initiator" boolean NOT NULL DEFAULT false;


COMMENT ON COLUMN "public"."game_confirmations"."is_initiator" IS 'True for rows created by a person filling out the result details (handleConfirmScore). False for rows created by tapping Confirm on someone else''s details (confirmOpponentScore) and for vacate markers. NOT exclusive — multiple is_initiator=true rows per (game_id, side) are valid: agreement = stronger confirmation, disagreement = the dispute path that auto-clears the game.';
