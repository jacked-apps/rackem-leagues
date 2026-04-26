-- ============================================================================
-- Migration: leagues.ignore_org_house_rules
-- Date: 2026-04-20
-- ----------------------------------------------------------------------------
-- Per-league opt-out from the org's cascaded house rules. When true, the /rules
-- reader scoped to this league shows ONLY this league's house rules (plus the
-- official CSI rulebook) — it does NOT inherit anything from the parent org.
--
-- Use case: an LO with org-wide house rules (e.g., "8 on the break wins")
-- spins up a new league for pros in a pool hall that wants to run pure CSI.
-- That league flips this flag ON and the org's rules stop applying.
--
-- Default is FALSE so existing leagues keep inheriting org rules (the intuitive
-- cascade). Explicitly opting out is the exception, not the norm.
-- ============================================================================

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS ignore_org_house_rules BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN leagues.ignore_org_house_rules IS
  'When true, this league does not inherit house rules from its parent organization — only its own league-scoped rules (plus the official CSI rulebook) apply.';
