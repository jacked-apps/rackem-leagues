-- Migration: add 'rejected' to invite_tokens.status CHECK constraint
-- Purpose: Support the "This isn't me" path on the claim-invite page. When a
--          user clicks an invite link, views the placeholder details, and
--          recognizes the record isn't theirs, they can reject it instead of
--          claiming it — without firing any merge.
--
-- Status lifecycle after this migration:
--   pending   -> invite created, awaiting action
--   claimed   -> user accepted and merge completed
--   expired   -> past expires_at
--   cancelled -> captain or LO cancelled the invite
--   rejected  -> NEW: user viewed the details, said "this isn't me",
--                no merge fired; token is consumed so the invite can't be
--                reused, and the LO sees the placeholder is still unmerged
--
-- Safety: the CHECK rename uses DROP + ADD rather than a plain ALTER because
-- ALTER TABLE does not support modifying CHECK constraint expressions
-- directly. Both happen inside the same migration transaction.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 12)

ALTER TABLE invite_tokens
  DROP CONSTRAINT invite_tokens_status_check;

ALTER TABLE invite_tokens
  ADD CONSTRAINT invite_tokens_status_check
  CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled', 'rejected'));

COMMENT ON COLUMN invite_tokens.status IS
'pending | claimed | expired | cancelled | rejected. "rejected" means the invited user opened the invite and explicitly said "this isn''t me" — no merge fired, token is consumed, LO sees the placeholder is still unmerged.';
