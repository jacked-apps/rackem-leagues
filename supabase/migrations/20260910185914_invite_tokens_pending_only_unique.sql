-- ============================================================================
-- invite_tokens: make the "one pending invite" rule actually mean pending.
--
-- THE BUG
-- -------
-- `unique_pending_invite` was declared as
--     UNIQUE (member_id, email, status)
-- with the comment "Prevent duplicate pending invites for same PP+email".
-- Including `status` in the key does not restrict the rule to pending rows —
-- it constrains EVERY status independently, so a member+email may hold one
-- pending row AND one cancelled row, but never two cancelled ones.
--
-- That collides with `ensure_placeholder_invite_token`, which cancels the
-- old pending invite whenever a placeholder's email changes. Editing an
-- email A -> B -> A walks straight into it:
--
--   1. A -> B  cancels the pending invite for A  (cancelled row for A exists)
--              and issues a pending invite for B
--   2. B -> A  cancels the pending invite for B, then tries to cancel the
--              pending row for A again on a later edit — and the UPDATE to
--              'cancelled' collides with the cancelled row already sitting
--              there from step 1.
--
-- The operator sees the save fail with a duplicate-key error (23505) while
-- doing something completely reasonable: fixing a typo, then changing their
-- mind back.
--
-- A UNIQUE CONSTRAINT cannot be restricted to a subset of rows in Postgres,
-- so the constraint is replaced with a PARTIAL UNIQUE INDEX, which can. The
-- rule becomes what the original comment always said it was: at most one
-- PENDING invite per member + email. Cancelled and claimed rows accumulate
-- freely, which is the point — they are history.
--
-- The constraint was DEFERRABLE INITIALLY DEFERRED and a partial index cannot
-- be. Nothing needs the deferral: the trigger cancels pending rows for OTHER
-- emails and then inserts a pending row guarded by NOT EXISTS, so it never
-- creates two pending rows for the same pair even momentarily.
-- ============================================================================

ALTER TABLE public.invite_tokens
  DROP CONSTRAINT IF EXISTS unique_pending_invite;

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_invite
  ON public.invite_tokens (member_id, email)
  WHERE status = 'pending';

COMMENT ON INDEX public.unique_pending_invite IS
  'At most one PENDING invite per member + email. Deliberately partial: '
  'cancelled and claimed invites are history and may repeat. See the '
  'migration that created it for the duplicate-key bug this replaced.';
