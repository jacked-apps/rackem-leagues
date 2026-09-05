-- ============================================================================
-- One auto-managed conversation per scope — enforced by the database
-- ============================================================================
--
-- `createTeamChat` already had an idempotency check: look for an existing chat
-- for this team, return it if found, otherwise create one. That's check-then-act
-- with nothing atomic behind it, so two clicks 0.35s apart both looked, both
-- found nothing, and both inserted.
--
-- Observed on staging 2026-09-05: a captain double-tapped "Create team chat" and
-- got two identical "Point Break — Team Chat" conversations, each with the full
-- 9-person roster.
--
-- The UI guard that allowed it is fixed separately, but a UI guard can only ever
-- stop one tab on one device. Two tabs, a phone and a laptop, or a retry after a
-- slow response all reproduce it. This is the constraint that actually makes it
-- impossible.
--
-- It also makes the app-level lookup honest: `.maybeSingle()` ERRORS when it
-- finds more than one row, so a duplicate doesn't just create clutter — it
-- breaks the very code path meant to prevent duplicates, permanently, until
-- someone cleans the table by hand.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Clear existing duplicates before the index can be built
-- ----------------------------------------------------------------------------
--
-- Keep the OLDEST row per scope: participants and any messages attached to a
-- duplicate pair are overwhelmingly on the first one, and "the original" is the
-- least surprising thing to keep.
--
-- Only delete a duplicate that carries no real (non-system) messages. A
-- duplicate with actual conversation in it is a data problem a migration should
-- not silently resolve — if one exists, this raises instead, so it gets looked
-- at rather than deleted.

DO $$
DECLARE
  offending record;
BEGIN
  FOR offending IN
    SELECT c.id, c.scope_type, c.scope_id
    FROM conversations c
    WHERE c.auto_managed = true
      AND c.scope_id IS NOT NULL
      -- everything except the earliest for its scope
      AND c.id <> (
        SELECT c2.id FROM conversations c2
        WHERE c2.auto_managed = true
          AND c2.scope_type = c.scope_type
          AND c2.scope_id = c.scope_id
        ORDER BY c2.created_at, c2.id
        LIMIT 1
      )
  LOOP
    IF EXISTS (
      SELECT 1 FROM messages m
      WHERE m.conversation_id = offending.id
        AND m.is_system = false
    ) THEN
      RAISE EXCEPTION
        'Duplicate auto-managed conversation % (scope %/%) contains real messages; resolve by hand before applying this migration.',
        offending.id, offending.scope_type, offending.scope_id;
    END IF;

    DELETE FROM messages WHERE conversation_id = offending.id;
    DELETE FROM conversation_participants WHERE conversation_id = offending.id;
    DELETE FROM conversations WHERE id = offending.id;

    RAISE NOTICE 'Removed duplicate auto-managed conversation % (scope %/%)',
      offending.id, offending.scope_type, offending.scope_id;
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 2. Make it impossible from here on
-- ----------------------------------------------------------------------------
--
-- Partial, because only auto-managed conversations own a scope. Personal DMs and
-- manual group chats have scope_type='none' / scope_id NULL and must stay
-- unconstrained — a member can have as many of those as they like.

CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_auto_per_scope
  ON conversations (scope_type, scope_id)
  WHERE auto_managed = true AND scope_id IS NOT NULL;

COMMENT ON INDEX conversations_one_auto_per_scope IS
  'One auto-managed conversation per (scope_type, scope_id). The app-side idempotency check in createTeamChat is check-then-act and races under a double-click; this is what actually enforces it. Partial so personal DMs and manual group chats (scope_id NULL) are unaffected.';
