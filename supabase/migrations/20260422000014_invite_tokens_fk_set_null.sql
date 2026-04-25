-- Migration: invite_tokens.member_id FK — CASCADE -> SET NULL
-- Purpose: Preserve invite audit history across merges.
--
-- Before this migration, invite_tokens.member_id had `ON DELETE CASCADE`
-- pointing at members(id). When a successful merge deleted the placeholder
-- row, Postgres cascade-deleted the matching invite rows too — destroying
-- the audit trail even though merge_v2 had already carefully set
-- status='claimed' and recorded claimed_at/claimed_by_user_id on them.
--
-- Fix: change the FK to ON DELETE SET NULL. When a placeholder is deleted,
-- the invite row stays (status='claimed' is preserved) and member_id goes
-- NULL. The row's email + token + claimed_by_user_id + status timeline all
-- remain queryable for audit/debugging.
--
-- Safety: invite_tokens.member_id becomes nullable (it was NOT NULL before).
-- Application code that reads invite_tokens must already handle orphan
-- member_ids because CASCADE delete always made them transient anyway.
-- Callers: send-invite reads member_id for its existing-invite dedupe check
-- via (member_id, email, status) — a NULL member_id can't collide with a
-- live placeholder row, which is the correct semantics.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- Drop-and-recreate the FK with the new action.
ALTER TABLE invite_tokens DROP CONSTRAINT invite_tokens_member_id_fkey;

-- Allow NULL so ON DELETE SET NULL can fire.
ALTER TABLE invite_tokens ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE invite_tokens
  ADD CONSTRAINT invite_tokens_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

COMMENT ON COLUMN invite_tokens.member_id IS
'Originally the placeholder this invite was for. NULL after a merge deletes the placeholder — the invite row stays for audit (status=claimed, claimed_by_user_id populated).';
