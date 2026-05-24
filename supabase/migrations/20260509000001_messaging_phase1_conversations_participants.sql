-- ============================================================================
-- MESSAGING OVERHAUL — PHASE 1 — UNIT 1
-- conversations + conversation_participants schema extensions
-- ============================================================================
--
-- Adds the schema foundations used by every later unit of Phase 1:
--   * conversations.archived_at         — nullable timestamp set when a season
--                                          ends (writer ships in a later phase;
--                                          column is here so RLS / queries can
--                                          reference it from Unit 6 onwards).
--   * conversation_participants.notification_mode  — tri-state replacement for
--                                          the legacy is_muted / notifications_enabled
--                                          pair. Phase 2 wires the UI; this
--                                          migration backfills existing rows so
--                                          no user silently loses their setting.
--   * conversation_participants.cannot_leave        — BOOLEAN flag enforced by
--                                          UI in Unit 6 (captain force-membership).
--
-- Plus three CHECK-constraint widenings so future phases don't have to alter
-- the constraints again:
--   * conversations.conversation_type adds 'match_chat'   (Phase 3 consumer)
--   * conversations.scope_type        adds 'match'        (Phase 3 consumer)
--   * conversation_participants.role  adds 'observer'     (Phase 5 consumer)
--
-- The 'observer' value lands now even though the staff-observer trigger
-- itself ships in Phase 5 — adding to a CHECK constraint is one line, but
-- altering a CHECK is a destructive-ish DROP/ADD and we'd rather pay it once.
--
-- All changes are additive. The legacy is_muted and notifications_enabled
-- columns stay in place during the deprecation window (no code reads
-- notification_mode yet — Phase 2 flips the readers — so dual columns are
-- safe). They are dropped in a Phase 2 cleanup migration once no consumer
-- references them.
--
-- See: docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 1)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. conversations.archived_at
-- ----------------------------------------------------------------------------

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

COMMENT ON COLUMN conversations.archived_at IS
  'Timestamp when the conversation was archived (e.g., season ended). NULL while active. Read-only behavior is enforced at the UI / RLS layer in later units.';


-- ----------------------------------------------------------------------------
-- 2. conversation_participants.notification_mode (tri-state) + backfill
-- ----------------------------------------------------------------------------

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS notification_mode varchar(20) NOT NULL DEFAULT 'all'
  CHECK (notification_mode IN ('all', 'mentions', 'none'));

-- Backfill: any user who already turned notifications off (either by muting
-- the chat OR by flipping notifications_enabled to false) gets 'none'. All
-- other existing rows already match the 'all' default, so we only UPDATE the
-- exception case. Honoring BOTH legacy columns prevents silently re-enabling
-- notifications for anyone who set notifications_enabled = false without muting.
UPDATE conversation_participants
SET notification_mode = 'none'
WHERE is_muted = TRUE OR notifications_enabled = FALSE;

COMMENT ON COLUMN conversation_participants.notification_mode IS
  'Per-user notification setting for this conversation: all (notify on every message), mentions (only on @mention), none (silent). Phase 2 wires the picker UI and the dispatch worker. During the deprecation window, this column is authoritative; legacy is_muted / notifications_enabled remain only as fallback for old code paths.';


-- ----------------------------------------------------------------------------
-- 3. conversation_participants.cannot_leave
-- ----------------------------------------------------------------------------

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS cannot_leave boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN conversation_participants.cannot_leave IS
  'When TRUE, the UI prevents this user from leaving or muting the conversation. Used for captain force-membership in team chats and captain chats (D6 / D11 of the messaging overhaul brainstorm). Set / unset by lifecycle triggers in Unit 5; UI gate in Unit 6.';


-- ----------------------------------------------------------------------------
-- 4. CHECK constraint extensions (drop-if-exists + recreate)
-- ----------------------------------------------------------------------------

-- conversations.conversation_type — add 'match_chat' for Phase 3 match-night chats.
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_conversation_type_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_conversation_type_check
  CHECK (conversation_type IN ('direct', 'team_chat', 'captains_chat', 'announcements', 'match_chat'));


-- conversations.scope_type — add 'match' so Phase 3 match-night chats can
-- scope themselves to a match UUID (already required by the existing
-- valid_auto_managed compound CHECK).
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_scope_type_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_scope_type_check
  CHECK (scope_type IN ('team', 'season', 'organization', 'none', 'match'));


-- conversation_participants.role — add 'observer' for the Phase 5 staff
-- oversight model. The trigger that creates observer rows ships with the
-- Operator View UI in Phase 5; only the value lands here.
ALTER TABLE conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_role_check;

ALTER TABLE conversation_participants
  ADD CONSTRAINT conversation_participants_role_check
  CHECK (role IN ('admin', 'participant', 'observer'));


COMMENT ON COLUMN conversation_participants.role IS
  'User role in conversation: admin (can add/remove users), participant (regular member), observer (read-only oversight by org staff — Phase 5).';
