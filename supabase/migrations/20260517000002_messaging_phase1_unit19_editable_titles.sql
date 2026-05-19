-- ============================================================================
-- MESSAGING OVERHAUL — PHASE 1 — UNIT 19 (editable team chat title)
-- Add `title_user_edited_at` to conversations so the auto-rename trigger
-- (future Unit 15) knows to skip rows the user has already renamed.
-- ============================================================================
--
-- Lets a captain rename their team chat (e.g., to a fun nickname). The
-- mutation that performs the rename stamps `title_user_edited_at = NOW()`
-- on the row. The Unit 15 auto-rename triggers (which propagate
-- entity-name changes — team rename → chat title rename) will check
-- `title_user_edited_at IS NULL` before updating, so a user-edited
-- title is never silently overwritten by the auto-rename machinery.
--
-- Per Ed (2026-05-16): "we NEED the team chat to be editable" — used
-- to support team-branding behavior captains commonly want (e.g.,
-- "Sharks Family Reunion" instead of just "Sharks").
--
-- Schema-only migration: adds one nullable column with no constraints.
-- Backfill is implicit — every existing row has `title_user_edited_at
-- = NULL`, meaning "auto-managed title; auto-rename trigger may
-- update freely." First explicit user rename flips it to a timestamp.
--
-- A `NULL` value means "default behavior — auto-rename may update."
-- A non-null timestamp means "the user has taken ownership of this
-- title — leave it alone."
--
-- See: docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 19)
-- ============================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS title_user_edited_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.conversations.title_user_edited_at IS
  'NULL = title is auto-managed (the auto-rename trigger may update it on entity renames). Non-null timestamp = the user (typically the team captain) has explicitly renamed this chat; the auto-rename trigger MUST leave the title alone going forward. Set by the updateConversationTitle mutation; cleared if the user resets to default (future feature).';
