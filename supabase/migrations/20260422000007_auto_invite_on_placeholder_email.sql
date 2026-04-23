-- Migration: enforce "placeholder with email ⇒ invite exists" as a DB invariant
-- Purpose: Remove a latent production incident mode. Previously, every code
--          path that set `members.email` on a placeholder had to remember to
--          also create an invite_token — and some didn't. Result: placeholders
--          could exist in a state where an email was saved but no claim
--          link ever existed, so the registering user hit a dead-end page
--          with no way forward (Tuesday incident).
--
-- Fix: a DB trigger on `members` that guarantees the invariant regardless of
-- which code path wrote the row. Plus a constraint relaxation so the trigger
-- can do its job without needing team context.
--
-- What changes:
--   1. `invite_tokens.team_id` and `invite_tokens.invited_by_member_id`
--      become nullable. They were context for the email body, never
--      fundamental to the invite's identity. The claim flow already handles
--      multi-team placeholders by querying team_players dynamically — the
--      team on the token was only used for a single-team display label.
--   2. Trigger on `members` AFTER INSERT/UPDATE OF email: if the row is a
--      placeholder (`user_id IS NULL`) and has a non-empty email, ensure a
--      pending invite_tokens row exists. If the email just CHANGED, cancel
--      pending invites for the old email first (they're for a different
--      recipient now).
--   3. Backfill: walk existing placeholders with emails but no pending
--      invite and create the missing invites. Idempotent via
--      `ON CONFLICT DO NOTHING` against `unique_pending_invite`.
--
-- Delivery: token existence is the contract; email send remains a separate,
-- best-effort concern handled by the `send-invite` Edge Function. The
-- trigger does not attempt to send — Postgres triggers have no business
-- talking to Resend.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- ============================================================================
-- Step 1: relax NOT NULL on team_id and invited_by_member_id
-- ============================================================================
ALTER TABLE invite_tokens ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE invite_tokens ALTER COLUMN invited_by_member_id DROP NOT NULL;

COMMENT ON COLUMN invite_tokens.team_id IS
'Optional context (populated when a captain triggers the invite from a specific team). The invite itself binds an email to a member_id; team context is for email body display only.';

COMMENT ON COLUMN invite_tokens.invited_by_member_id IS
'Optional audit (populated when a captain/LO explicitly triggers the invite). Invites created by the auto-trigger have NULL here — the trigger speaks for the system.';

-- ============================================================================
-- Step 2: trigger function + trigger on members
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_placeholder_invite_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only placeholders with a non-empty email need invites.
  IF NEW.user_id IS NOT NULL OR NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  -- If the email changed (UPDATE only), cancel any pending invites for the
  -- old email — that invite was for a different recipient and reusing it
  -- would be wrong.
  IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE invite_tokens
       SET status = 'cancelled'
     WHERE member_id = NEW.id
       AND email <> lower(NEW.email)
       AND status = 'pending';
  END IF;

  -- Insert a pending invite for the current (member, email) unless one
  -- already exists. `unique_pending_invite` is DEFERRABLE, which blocks
  -- ON CONFLICT from using it as an arbiter — hence the NOT EXISTS form.
  -- The unique index still catches any genuine race as a last line of
  -- defense (would raise an exception and abort the trigger).
  INSERT INTO invite_tokens (member_id, email, status)
  SELECT NEW.id, lower(NEW.email), 'pending'
  WHERE NOT EXISTS (
    SELECT 1 FROM invite_tokens
    WHERE member_id = NEW.id
      AND email = lower(NEW.email)
      AND status = 'pending'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION ensure_placeholder_invite_token IS
'Trigger function enforcing the invariant that every placeholder with an email has a pending invite_token. Fires AFTER INSERT/UPDATE OF email on members.';

-- Drop any prior version (clean re-run in case this migration is reapplied
-- during development).
DROP TRIGGER IF EXISTS members_ensure_invite_trigger ON members;

CREATE TRIGGER members_ensure_invite_trigger
AFTER INSERT OR UPDATE OF email ON members
FOR EACH ROW
EXECUTE FUNCTION ensure_placeholder_invite_token();

-- ============================================================================
-- Step 3: backfill existing placeholders that should have invites but don't
-- ============================================================================
-- Idempotent — the unique constraint guards against duplicates if this
-- migration is ever replayed.
INSERT INTO invite_tokens (member_id, email, status)
SELECT m.id, lower(m.email), 'pending'
FROM members m
WHERE m.user_id IS NULL
  AND m.email IS NOT NULL
  AND trim(m.email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM invite_tokens it
    WHERE it.member_id = m.id
      AND it.email = lower(m.email)
      AND it.status = 'pending'
  );
