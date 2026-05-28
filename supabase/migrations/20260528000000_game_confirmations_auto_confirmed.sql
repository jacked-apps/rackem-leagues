-- Migration: add auto_confirmed flag to game_confirmations
-- (scoring participation modes, 2026-05-28)
--
-- Why: distinguishes a vouch the person tapped manually from one their
-- Auto-Confirm mode produced automatically (no modal, scan-fired). An
-- auto-confirmed vouch is WEAKER evidence — the person trusted the
-- scorekeeping and rubber-stamped it rather than actively verifying. A future
-- sandbag/cheat analyzer (the deferred Layer-2 detector) should be able to
-- weight manual vouches more heavily than auto-confirmed ones.
--
-- Defaults false (the common case: manual confirm / initiate). Only the
-- Auto-Confirm path writes true. Existing rows get false (correct — they were
-- all recorded before this flag existed; treating them as manual is the safe
-- assumption for an integrity metric).
--
-- Column-only add to an already-published table; no publication change.

ALTER TABLE "public"."game_confirmations"
  ADD COLUMN IF NOT EXISTS "auto_confirmed" boolean NOT NULL DEFAULT false;


COMMENT ON COLUMN "public"."game_confirmations"."auto_confirmed" IS 'True when this vouch was produced by the confirmer''s Auto-Confirm mode (no modal — scan-fired). False for a manually-tapped confirm, an initiator entry, or a vacate marker. Integrity metric: auto-confirmed vouches are weaker evidence than manual ones.';
