-- ============================================================================
-- One auto-managed conversation per scope AND TYPE — enforced by the database
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
--
-- ── WHY conversation_type IS PART OF THE KEY ────────────────────────────────
--
-- A scope is NOT limited to one auto-managed conversation. Activating a season
-- creates TWO, both `auto_managed` and both scoped to that same season:
--
--     conversation_type = 'captains_chat'  ("… Captains Chat")
--     conversation_type = 'announcements'  ("… — Announcements")
--
-- (See `auto_create_season_conversations()` in
-- 20260509000003_messaging_phase1_season_activation_trigger.sql, blocks 2 + 3.)
--
-- Keying only on (scope_type, scope_id) would therefore make the second insert
-- impossible — and because that trigger wraps each block in
-- `EXCEPTION WHEN OTHERS THEN RAISE WARNING`, it would fail SILENTLY: every
-- newly activated season would quietly have no announcements chat, with nothing
-- but a warning in the Postgres log to say so. The dedupe below would also have
-- deleted the announcements chat of every season that already had one.
--
-- The uniqueness we actually want is what the app already asks for: every
-- idempotency lookup in `autoConversations.ts` filters on conversation_type
-- alongside the scope. The index matches those lookups exactly. The team-chat
-- double-tap is still blocked — both racing inserts carry 'team_chat'.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Clear existing duplicates before the index can be built
-- ----------------------------------------------------------------------------
--
-- Keep the OLDEST row per (scope, type): participants and any messages attached
-- to a duplicate pair are overwhelmingly on the first one, and "the original" is
-- the least surprising thing to keep.
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
    SELECT c.id, c.scope_type, c.scope_id, c.conversation_type
    FROM conversations c
    WHERE c.auto_managed = true
      AND c.scope_id IS NOT NULL
      -- everything except the earliest for its scope AND type
      AND c.id <> (
        SELECT c2.id FROM conversations c2
        WHERE c2.auto_managed = true
          AND c2.scope_type = c.scope_type
          AND c2.scope_id = c.scope_id
          AND c2.conversation_type IS NOT DISTINCT FROM c.conversation_type
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
        'Duplicate auto-managed conversation % (scope %/%, type %) contains real messages; resolve by hand before applying this migration.',
        offending.id, offending.scope_type, offending.scope_id, offending.conversation_type;
    END IF;

    DELETE FROM messages WHERE conversation_id = offending.id;
    DELETE FROM conversation_participants WHERE conversation_id = offending.id;
    DELETE FROM conversations WHERE id = offending.id;

    RAISE NOTICE 'Removed duplicate auto-managed conversation % (scope %/%, type %)',
      offending.id, offending.scope_type, offending.scope_id, offending.conversation_type;
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 2. Make it impossible from here on
-- ----------------------------------------------------------------------------
--
-- Partial, because only auto-managed conversations own a scope. Personal DMs and
-- manual group chats have scope_type='none' / scope_id NULL and must stay
-- unconstrained — a member can have as many of those as they like.

DROP INDEX IF EXISTS conversations_one_auto_per_scope;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_auto_per_scope
  ON conversations (scope_type, scope_id, conversation_type)
  WHERE auto_managed = true AND scope_id IS NOT NULL;

COMMENT ON INDEX conversations_one_auto_per_scope IS
  'One auto-managed conversation per (scope_type, scope_id, conversation_type). The app-side idempotency check in createTeamChat is check-then-act and races under a double-click; this is what actually enforces it. conversation_type is part of the key because one season legitimately owns both a captains_chat and an announcements chat. Partial so personal DMs and manual group chats (scope_id NULL) are unaffected.';
